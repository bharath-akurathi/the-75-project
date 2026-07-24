# The 75 Project — Project Setup Guide

Do this before writing application code for the next build. Each section ends with what "done" looks like so you can verify as you go, whether you're clicking through dashboards yourself or driving this through Supabase MCP from Antigravity.

---

## 1. Prerequisites
- Node.js (LTS), `npm` or `yarn`
- Python 3.11+ for the FastAPI backend
- Expo CLI and EAS CLI: `npm install -g eas-cli`
- A Supabase account (free tier is enough to start)
- A Google Cloud account (for OAuth — no billing needs to be enabled for this)
- Accounts on Google AI Studio and OpenRouter (for the VLM keys, Section 7)

---

## 2. Repo structure (monorepo)
This is a single repository with two top-level directories, not two separate repos:
```
the-75-project/
├── backend/     ← FastAPI service (Section 8, 9)
├── mobile/      ← Expo app
├── .env.example
└── CONTRIBUTING.md, SETUP.md, TESTING_AND_DEPLOYMENT.md
```
Keeping both in one repo matters more than usual here: the schema, the API contract, and the client all need to stay in lockstep, and the migration work (SRS Section 6) touches both sides at once.

**Done when:** both `backend/` and `mobile/` exist with their own dependency manifests (`requirements.txt` / `pyproject.toml` and `package.json`), and a single `git clone` gets a contributor everything they need.

---

## 3. Supabase project

1. Create a new project at supabase.com. Note the **Project URL** and **anon public key** (Settings → API) — these two, and only these two, ever go into the mobile app.
2. Do **not** put the **`service_role` key** anywhere near client code. It belongs only in the FastAPI backend's environment, if it's needed there at all.
3. Create your tables (Student, RegulationProfile, Subject, TimetableSlot, PeriodTiming, DailyOverride, AttendanceRecord, AcademicCalendar, ClassGroup, ClassGroupMember, CrowdReport, PendingSync — per SRS Section 8) via SQL migrations, not the Table Editor UI, so schema is versioned in the repo from day one.
4. **Check Settings → JWT** to see whether this project is on the newer asymmetric (ES256) signing keys or the legacy shared-secret (HS256) scheme — this determines exactly how you'll verify tokens in Section 8 below, so confirm it now rather than assuming.

**Done when:** you can connect to the project from the Supabase CLI or MCP tooling and see all tables listed, and you know which JWT signing mode the project is on.

---

## 4. Row Level Security — do this immediately after creating each table

Tables created via SQL/migrations do **not** get RLS automatically — only tables created through the Table Editor UI do. Skipping this step means anyone with the public anon key can read and write every row in the table.

```sql
-- Run this for every single table, right after creating it
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Verify nothing was missed, across the whole schema
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

Baseline ownership policy pattern for personal tables (`attendance_records`, `timetable_slots`, `daily_overrides`, `student` profile row):

```sql
CREATE POLICY "owner read" ON attendance_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner write" ON attendance_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner update" ON attendance_records
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Shared tables (`class_group`, `class_group_member`, `crowd_report`) need a different shape — membership-scoped rather than strict ownership:

```sql
CREATE POLICY "group members can read reports" ON crowd_report
  FOR SELECT USING (
    class_group_id IN (
      SELECT class_group_id FROM class_group_member WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "members can submit their own report" ON crowd_report
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "members can see their group roster" ON class_group_member
  FOR SELECT USING (
    class_group_id IN (
      SELECT class_group_id FROM class_group_member WHERE user_id = auth.uid()
    )
  );
```

A few things worth internalizing, not just copy-pasting:
- Enabling RLS with no policy at all **blocks everything**, including your own queries — if the app suddenly returns empty results with no error, this is almost always why.
- Index every column referenced inside a policy (`user_id`, `class_group_id` above) — an unindexed policy column is the single most common Supabase performance complaint.
- **Test policies by calling the table through the actual client SDK with the anon key** — the SQL Editor in the Supabase dashboard runs as an elevated role and bypasses RLS entirely, so it will look "fine" even when a policy is broken.

**Done when:** every table in `pg_tables` shows `rowsecurity = true`, and a quick anon-key client test confirms user A cannot read user B's `attendance_records`.

---

## 5. Google OAuth (Sign in with Google)

### 5a. Google Cloud Console
1. Create (or reuse) a Google Cloud project.
2. APIs & Services → OAuth consent screen: fill in the basics. While in development, add your own and your friends' Google accounts as **test users** — an unpublished consent screen only allows sign-in from accounts explicitly added here.
3. APIs & Services → Credentials → Create OAuth client ID → **type: Web application** (this is the one Supabase needs — it manages the mobile flow server-side, so mobile-specific client ID types are not what you configure here).
4. Add Supabase's callback URL to **Authorized redirect URIs**. Find the exact URL in the Supabase dashboard: Authentication → Providers → Google (it's shown at the bottom of that panel once you open it).
5. Add `http://localhost:<port>` to **Authorized JavaScript origins** while developing.

### 5b. Supabase dashboard
1. Authentication → Providers → Google → toggle on.
2. Paste the **Client ID** and **Client Secret** from step 5a.
3. Authentication → URL Configuration → add your app's custom deep link scheme (e.g. `the75project://auth-callback`) to the redirect allow-list.

### 5c. In the app
Prefer the **native Google Sign-In SDK on-device → pass the ID token to `supabase.auth.signInWithIdToken()`**, rather than the browser-redirect `signInWithOAuth()` flow. It's a smoother in-app experience with no browser hand-off, and it sidesteps the most common failure people hit with the redirect approach.

### Known gotchas, so you don't lose an afternoon to them
- **"Nonces mismatch" errors** are the most commonly reported issue with this exact setup — almost always a nonce generated on one side not matching what's passed to the other.
- **Expo Go cannot run this flow at all** (SRS FR-1.7). You need a development build (`eas build --profile development`) — native Google Sign-In requires native modules Expo Go doesn't include. Email/password sign-in continues to work fine in Expo Go.
- If sign-in fails with something like "app not verified" or "user not in test users," your OAuth consent screen is still unpublished.
- Using the wrong OAuth client type in the wrong place is the other classic mistake — for this Supabase-managed flow, the Web application client from 5a is the only one you configure.

**Done when:** a test Google account can sign in in a dev build, and a row appears in Supabase's `auth.users` table.

---

## 6. Email/password auth
Enabled by default in Supabase Auth — there's very little to configure. Two practical notes:
- Authentication → Settings lets you toggle "Confirm email" off during early friend-testing (frictionless), and back on before wider release.
- Rate limiting on auth endpoints is on by default; no extra work needed there.

---

## 7. VLM keys (SRS Section 3.4)
1. **Google AI Studio**: generate a Gemini API key. No credit card required for the free tier. Store it as `GEMINI_API_KEY` in the FastAPI backend's environment — never in the mobile app.
2. **OpenRouter**: generate an API key for the fallback path. Store as `OPENROUTER_API_KEY`, same rule — backend only.
3. Both keys are called exclusively from the `POST /timetable/extract` endpoint (SRS Section 9) — the mobile client never sees either key, only the extraction result. This endpoint is also the first one that needs the JWT verification from Section 8 below, since it's signed-in-users-only.

---

## 8. JWT verification in FastAPI (new — SRS Section 10)
This is what gates every account-only endpoint (`/timetable/extract`, `/class-group*`, `/crowd-report`, `/condonation/draft`). **You do not need to store any JWT secret for this** — verification uses Supabase's public JWKS endpoint, not a shared key, which is the whole point of the asymmetric scheme.

1. Install a JWT/JWKS library, e.g. `pip install python-jose[cryptography]` (or PyJWT with a JWKS client — either works, `python-jose` is used below for concreteness).
2. Fetch and cache the JWKS once, refreshing on a `kid` cache miss rather than on every request:
   ```python
   import time
   import httpx
   from jose import jwt

   SUPABASE_PROJECT_URL = "https://<project>.supabase.co"
   JWKS_URL = f"{SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json"

   _jwks_cache = {"keys": None, "fetched_at": 0}
   CACHE_TTL_SECONDS = 600  # matches Supabase's own ~10 minute edge cache

   def get_jwks():
       if _jwks_cache["keys"] is None or time.time() - _jwks_cache["fetched_at"] > CACHE_TTL_SECONDS:
           resp = httpx.get(JWKS_URL, timeout=5)
           resp.raise_for_status()
           _jwks_cache["keys"] = resp.json()["keys"]
           _jwks_cache["fetched_at"] = time.time()
       return _jwks_cache["keys"]
   ```
3. Verify an incoming token as a reusable FastAPI dependency, not duplicated per route:
   ```python
   from fastapi import Depends, HTTPException, Header

   def verify_supabase_jwt(authorization: str = Header(...)) -> str:
       if not authorization.startswith("Bearer "):
           raise HTTPException(status_code=401, detail="Missing bearer token")
       token = authorization.removeprefix("Bearer ")

       unverified_header = jwt.get_unverified_header(token)
       kid = unverified_header.get("kid")
       keys = get_jwks()
       key = next((k for k in keys if k["kid"] == kid), None)

       if key is None:
           # kid not in cache — refetch once before rejecting, to survive key rotation
           _jwks_cache["fetched_at"] = 0
           keys = get_jwks()
           key = next((k for k in keys if k["kid"] == kid), None)
           if key is None:
               raise HTTPException(status_code=401, detail="Unknown signing key")

       try:
           payload = jwt.decode(token, key, algorithms=["ES256"], audience="authenticated")
       except Exception:
           raise HTTPException(status_code=401, detail="Invalid or expired token")

       return payload["sub"]  # this is the user's auth.uid()

   # Usage on a gated route:
   # @app.post("/timetable/extract")
   # def extract(user_id: str = Depends(verify_supabase_jwt)):
   #     ...
   ```
4. **If Section 3's check found the project is still on legacy HS256** (not every project has moved yet), swap `algorithms=["ES256"]` for `algorithms=["HS256"]` and verify against the legacy JWT secret (Settings → API → JWT Secret) instead of the JWKS — but plan to migrate the project to asymmetric keys before this matters at any real scale, since it removes an entire class of secret-management risk.
5. On the mobile client, configure the Supabase client with `persistSession: true` and `autoRefreshToken: true`, backed by `expo-secure-store` rather than plain `AsyncStorage` (these are credentials), with an `AppState` listener to pause/resume the refresh timer as the app backgrounds and foregrounds.

**Done when:** a request with a valid token from a signed-in test user reaches the route and resolves the correct `user_id`; a request with an expired, tampered, or missing token gets a clean 401; a guest (no token at all) never reaches these routes in the first place.

---

## 9. Secrets management (matters more here because this repo will be public)
- Commit a `.env.example` with variable **names** only (`SUPABASE_URL=`, `GEMINI_API_KEY=`, `OPENROUTER_API_KEY=`, etc.) — never real values.
- Add `.env` to `.gitignore` before your first commit, not after.
- For EAS builds, use `eas secret:create` for anything the client build needs (the Supabase URL and anon key are safe here — they're meant to be public; nothing else should be).
- For the FastAPI backend, load secrets via environment variables (`python-dotenv` locally, your hosting provider's secret/environment settings in production) — never hardcoded.
- Turn on GitHub's Dependabot (Settings → Security) on day one.

---

## 10. Migration safety pre-check (SRS Section 6, Section 15 item 7)
Before this build ships to anyone already running V1 in production:
- Export a **real** copy of production data (not synthetic test data) and run the full migration pipeline against it locally — backup, slot-merge (Section 6.2), offset conversion (Section 6.5), legacy compatibility mapping (Section 4.4).
- Confirm the resulting percentages match what the pre-migration app showed for the same data, for at least one real account with non-trivial history (multiple subjects, at least one manual offset, at least one multi-period lab).
- Confirm the automatic local backup file is valid and restorable — actually try restoring from it once, don't just check that the file exists.

**Done when:** you've done this against at least one real legacy dataset, not just a freshly-generated test fixture.

---

## 11. Final pre-development checklist
- [ ] Monorepo structure in place (`backend/`, `mobile/`)
- [ ] All tables have RLS enabled and tested via the anon key, not the SQL Editor
- [ ] `service_role` key exists only in backend environment config, confirmed absent from any client bundle
- [ ] Confirmed whether the Supabase project uses asymmetric (ES256) or legacy (HS256) JWT signing
- [ ] JWT verification dependency tested with a valid, an expired, and a tampered token
- [ ] Google OAuth test sign-in works from a dev build
- [ ] Email/password sign-up and reset-password flow both tested
- [ ] `GEMINI_API_KEY` and `OPENROUTER_API_KEY` both set server-side only
- [ ] `.env` is git-ignored, `.env.example` is committed instead
- [ ] Dependabot enabled on the repository
- [ ] Migration pipeline run at least once against a real legacy dataset, not just synthetic fixtures
