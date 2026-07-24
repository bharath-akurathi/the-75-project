import os
import time
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import jwt
from jwt import PyJWKClient
from typing import Optional

# Setup
app = FastAPI(title="The 75 Project API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", SUPABASE_KEY)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set")

jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=600) # Cache for 10 mins

def get_current_user(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = auth_header.split(" ")[1]
    
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        # Supabase JWTs typically have audience "authenticated"
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256", "HS256"],
            audience="authenticated"
        )
        return payload["sub"]
    except jwt.PyJWKClientError as e:
        raise HTTPException(status_code=401, detail="Unable to fetch signing keys")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Crowd / Class Group Models
class CreateClassGroupRequest(BaseModel):
    name: str
    semester_id: str

class JoinClassGroupRequest(BaseModel):
    share_code: str

class CrowdReportRequest(BaseModel):
    class_group_id: str
    date: str
    period: Optional[int]
    claim_type: str
    claim_payload: str
    stance: str

import random
import string
import uuid
import datetime

def generate_share_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@app.post("/class-group")
async def create_class_group(req: CreateClassGroupRequest, request: Request, user_id: str = Depends(get_current_user)):
    """
    Creates a new class group with a unique 6-character share code.
    Requires the user's JWT passed via Authorization header.
    """
    auth_header = request.headers.get("Authorization")
    
    # We must first find the student_id belonging to this auth user
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": auth_header,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    async with httpx.AsyncClient() as client:
        # 1. Get student_id
        student_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/students?select=id&auth_id=eq.{user_id}",
            headers=headers
        )
        if not student_res.is_success or not student_res.json():
            raise HTTPException(status_code=400, detail="Student record not found")
        
        student_id = student_res.json()[0]["id"]

        # 2. Try to insert with a unique code (retry up to 3 times for collisions)
        for _ in range(3):
            share_code = generate_share_code()
            group_id = str(uuid.uuid4())
            now = datetime.datetime.utcnow().isoformat()
            
            payload = {
                "id": group_id,
                "name": req.name,
                "share_code": share_code,
                "creator_id": student_id,
                "semester_id": req.semester_id,
                "created_at": now,
                "updated_at": now
            }
            
            res = await client.post(
                f"{SUPABASE_URL}/rest/v1/class_groups",
                headers=headers,
                json=payload
            )
            
            if res.is_success:
                # 3. Add creator as first member
                member_payload = {
                    "id": str(uuid.uuid4()),
                    "class_group_id": group_id,
                    "student_id": student_id,
                    "role": "admin",
                    "joined_at": now
                }
                await client.post(
                    f"{SUPABASE_URL}/rest/v1/class_group_members",
                    headers=headers,
                    json=member_payload
                )
                
                return {"status": "success", "share_code": share_code, "group_id": group_id}
            
            # If 409 Conflict (unique constraint on share_code), retry.
            if res.status_code != 409:
                break
                
        raise HTTPException(status_code=500, detail="Failed to create class group")

@app.get("/timetable/code/{share_code}")
async def get_timetable_by_code(share_code: str, request: Request, user_id: str = Depends(get_current_user)):
    """
    Fetches the timetable of the creator of the class group matching the share code.
    (FR-2.8 Share-Code Timetable Cloning)
    """
    admin_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        # 1. Find group and creator_id
        group_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/class_groups?select=creator_id&share_code=eq.{share_code.upper()}",
            headers=admin_headers
        )
        if not group_res.is_success or not group_res.json():
            raise HTTPException(status_code=404, detail="Invalid share code")
            
        creator_id = group_res.json()[0]["creator_id"]
        
        # 2. Fetch creator's subjects
        subjects_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/subjects?select=id,name,is_lab&student_id=eq.{creator_id}",
            headers=admin_headers
        )
        if not subjects_res.is_success:
            raise HTTPException(status_code=500, detail="Failed to fetch subjects")
        subjects = subjects_res.json()
        
        # 3. Fetch creator's timetable slots
        slots_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/timetable_slots?select=day_or_day_order,period,subject_id&student_id=eq.{creator_id}",
            headers=admin_headers
        )
        if not slots_res.is_success:
            raise HTTPException(status_code=500, detail="Failed to fetch slots")
        slots = slots_res.json()
        
        # Map subject IDs to names for the client
        subject_map = {s["id"]: s for s in subjects}
        
        formatted_slots = []
        for slot in slots:
            if slot["subject_id"] in subject_map:
                subj = subject_map[slot["subject_id"]]
                formatted_slots.append({
                    "day": slot["day_or_day_order"],
                    "period_number": slot["period"],
                    "subject_raw": subj["name"],
                    "is_lab": subj["is_lab"]
                })
                
        # Send it back in a format similar to AI JSON validation
        return {
            "status": "success",
            "timetable": {
                "slots": formatted_slots
            }
        }

@app.post("/class-group/join")
async def join_class_group(req: JoinClassGroupRequest, request: Request, user_id: str = Depends(get_current_user)):
    auth_header = request.headers.get("Authorization")
    
    # We will use the service role key to look up the group by share code,
    # because RLS normally prevents reading groups unless you are a member!
    # Wait, RLS for class_groups has "class_groups_read_by_share_code"? No, I didn't add that.
    # We'll use the user's JWT to query. If RLS blocks it, we might need a bypass.
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": auth_header,
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        student_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/students?select=id&auth_id=eq.{user_id}",
            headers=headers
        )
        if not student_res.is_success or not student_res.json():
            raise HTTPException(status_code=400, detail="Student not found")
        student_id = student_res.json()[0]["id"]
        
        # We need the service key to bypass RLS and find the group by code
        admin_headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }
        
        group_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/class_groups?select=id&share_code=eq.{req.share_code.upper()}",
            headers=admin_headers
        )
        if not group_res.is_success or not group_res.json():
            raise HTTPException(status_code=404, detail="Invalid share code")
            
        group_id = group_res.json()[0]["id"]
        
        # Insert member using user's JWT so RLS `class_group_members_insert_self` applies
        member_payload = {
            "id": str(uuid.uuid4()),
            "class_group_id": group_id,
            "student_id": student_id,
            "role": "member",
            "joined_at": datetime.datetime.utcnow().isoformat()
        }
        
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/class_group_members",
            headers=headers,
            json=member_payload
        )
        
        if res.is_success:
            return {"status": "success", "group_id": group_id}
        if res.status_code == 409:
            return {"status": "success", "message": "Already a member", "group_id": group_id}
            
        raise HTTPException(status_code=500, detail="Failed to join group")

@app.post("/crowd-report")
async def submit_crowd_report(req: CrowdReportRequest, request: Request, user_id: str = Depends(get_current_user)):
    auth_header = request.headers.get("Authorization")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": auth_header,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    async with httpx.AsyncClient() as client:
        # Get student_id
        student_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/students?select=id&auth_id=eq.{user_id}",
            headers=headers
        )
        if not student_res.is_success or not student_res.json():
            raise HTTPException(status_code=400, detail="Student not found")
        student_id = student_res.json()[0]["id"]
        
        # Upsert report
        report_payload = {
            "id": str(uuid.uuid4()),
            "class_group_id": req.class_group_id,
            "student_id": student_id,
            "date": req.date,
            "period": req.period,
            "claim_type": req.claim_type,
            "claim_payload": req.claim_payload,
            "stance": req.stance,
            "created_at": datetime.datetime.utcnow().isoformat(),
            "updated_at": datetime.datetime.utcnow().isoformat()
        }
        
        # Use ON CONFLICT to act as upsert (id is primary key, but unique constraint is class_group_id, student_id, date, period, claim_type)
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/crowd_reports",
            headers={**headers, "Prefer": "resolution=merge-duplicates,return=representation"},
            json=report_payload
        )
        if not res.is_success:
            raise HTTPException(status_code=500, detail="Failed to submit report")
            
        return {"status": "success", "message": "Report recorded. Quorum validation deferred to sync layer."}
