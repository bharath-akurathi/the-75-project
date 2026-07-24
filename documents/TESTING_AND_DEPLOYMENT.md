# The 75 Project — Testing & Deployment

## Part 0 — Migration testing (do this first, it's the highest-risk part of this build)

This build is the first one touching real production data (SRS Section 6), which makes it a different category of risk than anything shipped before. Don't treat this as one item on a longer checklist — treat it as its own gate that has to pass before anything else matters.

1. **Get a real copy of production data.** Not a freshly generated fixture — an actual export from at least one real V1 install, ideally your own or a friend's with genuine history (multiple subjects, at least one manually-corrected offset, at least one multi-period lab, at least one exam period already logged).
2. **Run the full pipeline against it, locally, before touching any real device**: automatic backup (6.1) → slot merge (6.2, verify the split-period-to-`period_span` transform actually merged what it should have — spot check a known lab block) → legacy compatibility mapping (4.4) → offset conversion (6.5).
3. **Confirm the numbers didn't move.** The single most important check: whatever percentage the pre-migration app showed for a subject, the post-migration app should show the same number, not a recalculated one — the whole point of Section 6.5's conversion is that nobody's percentage changes just because they updated the app.
4. **Confirm the backup is actually restorable.** Don't just check the file exists — actually restore from it once and verify the app opens correctly against the restored copy.
5. **Deliberately break the migration mid-way** (kill the app process between steps, corrupt a row) and confirm the failure-handling behavior in SRS Section 6.6 holds: the app falls back to the untouched pre-migration state and retries next launch, rather than getting stuck half-converted.
6. **Test the one-time upgrade prompt** (Section 6.3) end to end: it appears once, it's dismissible without breaking anything, dismissing it doesn't lose the option permanently (check it's reachable again from Settings), and completing it correctly resolves a real `regulation_profile` from program/year/branch.

Only move to Part 1 once this passes against real data, not synthetic data.

---

## Part 1 — Testing

The highest-stakes bugs otherwise aren't UI glitches, they're the calculation engine and the sync engine quietly lying to someone about their own attendance. Test in that priority order.

### 1. Calculation engine — unit tests, exhaustive
Every formula in SRS Section 5 (FR-5) is a pure function — no excuse not to cover them thoroughly:
- Aggregate mode and per-subject mode eligibility, at and around the 65%/75% boundaries exactly
- `N_max` (safe-to-skip) — including the case where it's already negative
- `M_min` (recovery count) — including recovery from exactly the condonable floor
- Worst-case burndown — including a semester where the student never crosses the line, and one where they cross it on the very last working day
- Quorum math (FR-4.3), across **all four claim types** (cancellation, day swap, period swap, extra class) — net confirmations above, at, and below the dynamic threshold, and the reversal case where disputes pull an already-applied claim back to its prior state
- A CR's instant-quorum assert, and a subsequent member `reject` overturning it

### 2. Sync engine — integration tests
- Write while offline, kill the app, relaunch, confirm the write is still queued and still correct
- Simulate a retried batch (server already applied it) and confirm the idempotency key prevents double-counting
- Guest-to-account migration (FR-1.6): create a chunk of guest data, sign in, confirm every row re-keys correctly and nothing duplicates or disappears
- The legacy-to-guest migration (Section 6) feeding into this same outbox correctly, per Part 0

### 3. JWT / auth testing (new — SRS Section 10)
- A request with a valid, current token reaches the route and resolves the correct `user_id`
- An expired token is rejected with a clean 401, not a generic error
- A tampered token (flip a byte in the signature) is rejected
- A token signed with the wrong `kid` — simulate this against a stale cached JWKS to confirm the refetch-on-miss logic (Section 8 of `SETUP.md`) actually refetches rather than just failing
- A guest request (no `Authorization` header at all) never reaches an account-gated endpoint — confirmed both by the backend rejecting it and by the mobile client never attempting the call in guest mode in the first place

### 4. RLS policies — test through the client, not the SQL Editor
The SQL Editor runs as an elevated role and will make a broken policy look fine. For every table:
- User A cannot read User B's rows via the anon-key client
- A guest's local-only data never reaches the network at all (nothing to test server-side, but worth a client-side assertion)
- Class-group-scoped tables (`crowd_report`, `class_group_member`) — a non-member cannot read or write into a group they haven't joined

### 5. Manual QA checklist, on a real device
- Blurry or badly-lit timetable photo → does extraction degrade gracefully (low-confidence flags, not silent garbage)?
- Multi-day offline stretch, then reconnect → correct retroactive fill-in prompt, correct sync
- Full quorum-then-dispute cycle with a few test accounts in the same class group, across all four claim types
- Exam-mode transition at the boundary dates from FR-2.10
- Semester transition, specifically the years 3→4 regulation-profile switch for an IDP test account — and specifically for an account that came through the legacy upgrade path (Section 6.3), not just a fresh signup
- Light mode and dark mode, every screen (V1 already has dark mode tested — this is mainly about the new light mode and the new screens not existing in V1)
- Deny camera/photo permission and confirm the app degrades to manual entry or paste-JSON rather than breaking

### 6. Device matrix
At minimum: one budget Android device (common among students) and one recent one, across a couple of Android versions from API 24 up. This is where offline behavior and camera/extraction quality diverge most.

---

## Part 2 — Deployment

### Option A — Friends-only, zero cost, no store account
```
eas build --platform android --profile preview
```
This produces an installable `.apk`. Download it from the EAS dashboard and share it directly.

### Option B — Play Console Internal Testing (optional, more polished)
1. Google Play Developer account — one-time $25 USD fee.
2. Build a release artifact: `eas build --platform android --profile production` (produces `.aab`).
3. Submit it: `eas submit -p android --profile production`.
4. Share the tester opt-in link directly.

### Given this build carries real migration risk, roll it out staged rather than all at once
This is different from V1's launch, which had nothing to lose. If using Play Console, use its **staged rollout percentage** (e.g. start at 10–20% of existing installs) rather than releasing to 100% immediately, and watch for crash reports or support messages before widening it. If distributing directly via APK to a known group of friends, the equivalent is simply: update your own device first, use it for a few real days, then hand it to one or two others before pushing it to everyone.

### Automating it (optional, once the manual path works)
A GitHub Actions workflow can run `eas build` and `eas submit` on push to `main`, authenticated via an `EXPO_TOKEN` repository secret.

### Shipping small fixes fast
For JS-only changes (no native module changes), `eas update` pushes an over-the-air update in minutes, without a new store submission.

### Backend hosting
Not yet decided (SRS Section 15) — the FastAPI service needs somewhere to run persistently for the `/timetable/extract` proxy and the JWT-gated endpoints. Worth comparing current hobby/free tiers on a couple of options (Railway, Render, Fly.io, or a small VPS) directly before committing, since free-tier terms shift often enough that a specific recommendation here would risk going stale.

### Before promoting anything beyond internal testing
Re-run the full manual QA checklist from Part 1 **and the migration checklist from Part 0** on the actual built artifact, not just in a dev build — extraction, camera permissions, deep-linked OAuth, and the migration pipeline can all behave differently in a release build than in Expo Go or a dev client.
