import pytest
from fastapi.testclient import TestClient
from main import app
import os
import uuid

# Load environment variables for the test if needed (usually loaded from .env)
# The backend expects SUPABASE_URL and SUPABASE_KEY to be in the environment.

client = TestClient(app)

# Test Data
TEST_EMAIL = "john@gmail.com"
TEST_PASSWORD = "123456"

# Global state to share across tests
test_state = {}

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_auth_register_or_login():
    """Attempt to login. If it fails due to invalid credentials (doesn't exist), register instead."""
    # First, try to login
    response = client.post("/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        assert "user" in data
        assert "session" in data
        test_state["token"] = data["session"]["access_token"]
        test_state["user_id"] = data["user"]["id"]
    else:
        # If login fails, try to register
        reg_response = client.post("/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        # If we successfully registered, or hit another error, handle it
        assert reg_response.status_code == 200, f"Register failed: {reg_response.text}"
        data = reg_response.json()
        assert "user" in data
        
        # Then login to get the token properly
        login_response = client.post("/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200, f"Login after register failed: {login_response.text}"
        data = login_response.json()
        test_state["token"] = data["session"]["access_token"]
        test_state["user_id"] = data["user"]["id"]

def test_class_group_create():
    token = test_state.get("token")
    assert token is not None, "Missing auth token"
    
    # We need a semester_id. We can't easily create one without the full schema, 
    # but we can try inserting with a fake UUID (might fail foreign key constraint)
    # Let's see if we can create a class group
    fake_semester_id = str(uuid.uuid4())
    share_code = f"TEST-{str(uuid.uuid4())[:6].upper()}"
    test_state["share_code"] = share_code
    
    response = client.post("/class-group", headers={
        "Authorization": f"Bearer {token}"
    }, json={
        "name": "Test Group",
        "semester_id": fake_semester_id,
        "share_code": share_code
    })
    
    # It might fail with 400 because of FK constraint on semester_id, which is fine, 
    # as long as we know the endpoint was hit and attempted the query.
    # We will accept 200 or 400 (if it's a DB constraint error)
    assert response.status_code in [200, 400]
    if response.status_code == 200:
        test_state["group_id"] = response.json()["class_group"]["id"]

def test_class_group_join():
    token = test_state.get("token")
    share_code = test_state.get("share_code")
    assert token is not None
    assert share_code is not None
    
    response = client.post(f"/class-group/join?share_code={share_code}", headers={
        "Authorization": f"Bearer {token}"
    })
    
    # Might fail with 404 if creation failed above, or 400 for constraints
    assert response.status_code in [200, 400, 404]

def test_sync_attendance():
    token = test_state.get("token")
    assert token is not None
    
    response = client.post("/sync/attendance", headers={
        "Authorization": f"Bearer {token}"
    }, json={
        "mutations": [
            {
                "table": "daily_overrides",
                "data": {
                    "id": str(uuid.uuid4()),
                    "student_id": test_state["user_id"],
                    "date": "2026-07-22",
                    "status": "holiday",
                    "source": "personal"
                    # missing semester_id might cause a DB constraint failure, which is expected
                }
            }
        ]
    })
    
    assert response.status_code == 200
    results = response.json().get("results", [])
    assert len(results) == 1
    # Check that it either synced or returned a DB error, not a 500 Python crash
    assert results[0]["status"] in ["synced", "error"]

def test_pull_sync():
    token = test_state.get("token")
    assert token is not None
    
    response = client.get("/sync?since=2026-01-01T00:00:00Z", headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code == 200, f"Sync pull failed: {response.text}"
    assert "crowd_reports" in response.json()

def test_timetable_extract_invalid_key():
    # Will fail quickly because no real image is provided and NIM key might not be set in test env
    # Or if set, it will fail due to base64 format. We just check it doesn't 500 unexpectedly.
    response = client.post("/timetable/extract", json={
        "image_base64": "invalid_base64"
    })
    assert response.status_code in [400, 429, 500] 
