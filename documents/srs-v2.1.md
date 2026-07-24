# Software Requirements Specification
## The 75 Project — Next Build (V2)

| | |
|---|---|
| **Version** | 2.1 (Next Build, refined scope) |
| **Date** | July 24, 2026 |
| **Builds on** | V1 — Local MVP (shipped, tested, in production) |
| **Platform** | React Native (Expo), Android first, iOS follow-on |
| **Backend** | FastAPI + PostgreSQL, via Supabase |
| **Auth** | Supabase Auth — email/password and Google OAuth |
| **Local storage** | SQLite, offline-first, guest mode is the default and unchanged behavior |
| **License** | MIT (carried over from V1) |
| **Status** | Draft for review |

### Document history
This refines the 2.0 Next Build spec after a scope review. Three changes: the crowd-claim quorum moves from 15% to **50%** of the class group; **native AI photo/PDF extraction is deferred to future work** — the paste-JSON workflow remains the only assisted timetable path for now, keeping the backend free of VLM key management exactly as V1's original BYO-LLM design intended; and **the evidence log and condonation-letter drafting (formerly FR-8) are removed entirely**, for the same reason FR-11 was cut earlier — this app doesn't touch anything "official." The FastAPI backend is retained, specifically because it's still needed for the crowd/quorum voting system, and both guest mode and Google sign-in are retained by design: guest mode serves anyone who wants purely personal, offline tracking, and sign-in serves anyone who wants to participate in their class's crowd voting.

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for the next build of The 75 Project — adding accounts, cloud sync, crowd-sourced schedule voting, and the full regulation-profile engine on top of the shipped local-only V1, without breaking or losing any existing user's data.

### 1.2 Scope
This build adds: Supabase-backed accounts (email/password + Google OAuth) alongside a guest mode that remains functionally identical to how V1 already behaves; the auto-detecting, phase-aware regulation-profile engine (replacing V1's manual toggle, with a compatibility path for existing users); day swaps, precise period substitution, extra classes, and Lab Batch Divide; the generalized crowd-claim system with a 50% quorum and a Class Representative role; local notifications; and a complete, tested migration path from V1's schema to this build's schema. Native AI timetable extraction is explicitly **not** in this build — see Section 17. It remains **not** an official or institutional tool.

### 1.3 Definitions and acronyms

| Term | Meaning |
|---|---|
| IDP | Integrated Dual Program (5-year B.Tech + M.Tech) |
| UG / PG | Undergraduate / Postgraduate |
| Guest mode | Using the app fully offline with no account — the only mode V1 has; still the default here |
| Legacy user | Someone who installed V1 before this build and has local data in V1's schema |
| Regulation profile | The rule set — aggregate vs. per-subject attendance, thresholds, detention scope — determined by program + year |
| Held period | A scheduled class period that actually took place |
| Outbox | Local queue of pending writes awaiting sync (Section 11) |
| Claim | A crowd-reported event about a class period or day — a cancellation, day swap, period swap, or extra class (FR-4.3) |
| Stance | Whether a student's report on a claim is `assert` or `reject` |
| Quorum | The net-stance threshold needed before a claim is treated as fact — **50% of the class group, or 3 students, whichever is higher** (FR-4.3) |
| BYO-LLM | Bring Your Own LLM — the paste-JSON workflow where a student runs an external LLM themselves; the only assisted timetable path in this build |
| JWT | JSON Web Token — Supabase Auth's session credential; see Section 10 |
| JWKS | JSON Web Key Set — the public-key endpoint used to verify Supabase JWTs without a shared secret (Section 10) |

### 1.4 References
- JNTUH CEH R21 IDP Academic Regulations, Section 7 — primary source for the IDP profile.
- JNTUH R22 B.Tech/M.Tech regulation excerpts — B.Tech-regular and M.Tech-regular profiles.
- The shipped V1 SRS and codebase — the actual baseline for every migration requirement in Section 6.

---

## 2. Current state — V1 in production

- 100% local, client-side only — no backend, no accounts, no network dependency of any kind.
- Onboarding: launches directly into the app; a single manual toggle (Aggregate / Per-Subject) sets the calculation mode. No program, year, or branch is collected.
- Timetable: paste-JSON (BYO-LLM) workflow and manual entry only. The extraction prompt shown to users **splits** multi-period blocks into separate consecutive slots — the opposite of this build's merged `period_span` approach (Section 6.2).
- Exam handling: user-defined date ranges (`ExamPeriods`) pause tracking and subtract from the held count.
- Insight engine: live safe-to-skip number only.
- Data model: `UserPreferences`, `ExamPeriods`, `Subjects` (with `manual_held_offset`/`manual_attended_offset` as a manual correction escape hatch), `TimetableSlots` (no `period_span`, no `is_lab`, no `batch`), `DailyExceptions`, `PeriodTimings`.
- Already has: dark mode, a rendered PNG app icon, MIT license.
- Does not have: any form of account, cloud backup, crowd features, day swaps, period substitution mechanics, extra-class logging, or notifications.

---

## 3. Overall description

### 3.1 Product perspective
Still a standalone, non-official tool. Accounts and cloud sync are additive, not a requirement to use the app.

### 3.2 User classes

| Class | Notes |
|---|---|
| Legacy user (existing V1 install) | Local data in V1's schema; migrated per Section 6, then behaves as a guest by default |
| Guest (no account) | Full personal tracking, entirely offline — this is a deliberate, permanent tier, not a trial. It's for anyone who has no interest in crowd/class-group features and just wants the core tracker. |
| Signed-in user | Adds cloud backup and the crowd/class-group voting system — this is the actual reason to sign in, and the only reason, now that native extraction is deferred (Section 17) |
| Years 1–3 students (aggregate) / Years 4–5 IDP and M.Tech-regular (per-subject) | Regulation-profile classes, Section 4 |
| Class Representative | A signed-in user holding the `cr` role in a class group (FR-4.3) |

This app is built for JNTUH students broadly, not scoped to one program — the full multi-program regulation engine (Section 4) stays as designed for exactly that reason.

### 3.3 Operating environment
- **Client:** React Native via Expo. Android primary, iOS follow-on. **Minimum supported versions: Android API 24 (Android 7.0), iOS 15.**
- **Preview/dev workflow:** Expo Go, as already in use. Native Google Sign-In cannot run inside Expo Go under any circumstances — see FR-1.7.
- **Repository structure:** a monorepo — `backend/` (FastAPI) alongside `mobile/` (the Expo app).
- **Backend-as-a-service:** Supabase (PostgreSQL, Auth) — new to this build.
- **API layer:** a FastAPI service, retained specifically for the crowd/class-group voting system (Section 9) — not for any VLM proxying, since there's no extraction feature in this build.
- **Local storage:** SQLite on-device, unchanged in kind from V1, evolved in schema (Section 6).

### 3.4 Design and implementation constraints
- Everything V1 already does offline must continue to work offline, for guests exactly as today.
- Every mutation is idempotent under retry (client-generated UUIDs).
- No university credentials are ever stored or used anywhere in this product.
- No secret, key, or credential may be hardcoded or committed (open-source repo).
- The migration must never run without first taking a local backup (Section 6.1), and must never leave a legacy user's app in a broken or data-losing state, even on partial failure.

### 3.5 Assumptions, dependencies, and confidence levels

| Regulation profile | Source confidence | Note |
|---|---|---|
| IDP, years 1–3 (aggregate) | High — full primary regulation text reviewed | — |
| IDP, years 4–5 (per-subject) | High — full primary regulation text reviewed | Worth reconciling with the department on all-subjects vs. PG-only in practice |
| M.Tech regular (per-subject) | Medium-high — multiple corroborating excerpts | — |
| B.Tech regular (aggregate) | Medium — single excerpt, not a fully reviewed primary document | Pre-launch validation item, Section 15 |
| MBA / MCA | Not researched | Excluded until data is collected |

---

## 4. The regulation profile system

Kept in full, generalized for all JNTUH programs — this is a deliberate choice given the app targets JNTUH students broadly, not one friend group's programs.

### 4.1 Profile behavior

| Profile | Eligibility rule | Unit at risk if not condoned |
|---|---|---|
| B.Tech regular, all 4 years | Aggregate across all subjects, per semester | Whole semester |
| M.Tech regular, whole program | Per subject, individually | That subject only |
| IDP, years 1–3 | Aggregate (same mechanism as B.Tech) | Whole semester |
| IDP, years 4–5 | Per subject — UG and PG subjects alike (same mechanism as M.Tech) | That subject only |

### 4.2 Shared parameters, configurable per profile
`full_eligibility_threshold` (default 75%), `condonable_floor` (default 65%).

### 4.3 Core computation
```
if profile.mode == "aggregate":
    eligible = (sum(attended[s] for s in subjects) / sum(held[s] for s in subjects)) >= threshold
    at_risk_unit = "semester"

elif profile.mode == "per_subject":
    for s in subjects:
        eligible[s] = (attended[s] / held[s]) >= threshold
    at_risk_unit = "subject"
    overall_display_only = sum(attended[s] for s in subjects) / sum(held[s] for s in subjects)
```

### 4.4 Legacy compatibility mapping
V1's `calculation_mode` toggle maps directly onto `profile.mode` — `Aggregate → "aggregate"`, `Per-Subject → "per_subject"` — so a legacy user's existing numbers **do not change** the moment they update. This mapped value is what the app uses until a legacy user completes the one-time upgrade prompt (Section 6.3).

---

## 5. Functional requirements

Priority key: **M** = MVP, all ships in this build. Each item is tagged **[NEW]**, **[EVOLVED from V1]**, or **[CARRIED OVER]**.

### FR-1 — Account, guest mode, and onboarding (M)
- FR-1.1 **[EVOLVED]** On first launch (new installs), two equally prominent paths: create an account, or continue as a guest — genuinely equal, not a trial-vs-real-app framing. **For legacy users this FR does not apply at first update launch** — see Section 6.3 instead.
- FR-1.2 **[NEW]** Choosing guest mode shows an honest comparison screen (Section 5.1 table) before confirming, leading with what an account actually gets you now: crowd/class-group voting.
- FR-1.3 **[NEW]** Account creation via Supabase Auth — email + password and Google OAuth. Supabase owns hashing, reset flows, and OAuth verification entirely.
- FR-1.4 **[EVOLVED]** Onboarding (guest or signed-in) collects program type, current year, branch, and — for IDP — the UG+PG pair, resolving `regulation_profile` automatically (Section 4).
- FR-1.5 **[NEW]** Guest data — new installs and legacy users alike — uses a persistent `local_user_id` as the row-owner key instead of `auth.uid()`.
- FR-1.6 **[NEW]** Sign-in-later upgrade path: guest data can be re-keyed to a real `auth.uid()` and enqueued into the sync outbox at any time — this is exactly the path a guest takes the moment they decide they want to join a class group's voting.
- FR-1.7 **[NEW]** Native Google Sign-In is environment-aware — hidden under Expo Go, with email/password remaining fully functional there. Testable from a development build onward.

#### 5.1 What guest mode includes vs. what an account adds

| Available to everyone, including guests | Requires an account |
|---|---|
| Manual timetable creation | Cloud backup and multi-device sync |
| Paste-JSON (BYO-LLM) timetable creation | Timetable clone-by-share-code and all crowd/class-group voting (day swaps, period swaps, extra classes, cancellations) |
| Full daily marking loop | — |
| Personal exception marking — cancel/substitute/holiday/extra class, day swap | — |
| The complete phase-aware calculation engine, on-device | — |
| Lab Batch Divide resolution, any entry path | — |
| Light/dark mode, full core UI | — |

The list on the right is short and that's intentional: it's the entire, honest pitch for creating an account.

### FR-2 — Timetable setup (M)
- ~~FR-2.1~~ / ~~FR-2.2~~ — **Deferred.** Native photo/PDF upload with AI extraction is not in this build; see Section 17. Section numbers are preserved rather than reused, so a future build can reintroduce them without renumbering everything else.
- FR-2.3 **[EVOLVED]** The timetable grid is fully editable, whether it was populated by paste-JSON or manual entry — one surface, not a reduced "review" mode versus a "real" entry mode.
- FR-2.4 **[EVOLVED]** Grid supports add/delete, merge/split of multi-period blocks, day-order vs. calendar-day toggle, lab-batch toggle.
- FR-2.5 **[CARRIED OVER]** Subject confirmation offers to merge near-duplicate names.
- FR-2.6 **[EVOLVED]** Subjects tagged UG/PG, optional custom threshold, `is_optional` flag excluding a subject from calculations.
- FR-2.7 **[CARRIED OVER]** Manual entry, available to everyone, first-class (V1's FR-2.2).
- FR-2.8 **[NEW]** Share-code timetable cloning. Signed-in only.
- FR-2.9 **[CARRIED OVER]** Paste-JSON path (V1's FR-2.1), available to everyone — **the only assisted timetable-creation path in this build**, which makes its polish more important than it would be as a secondary option.
- FR-2.10 **[EVOLVED]** Semester start/end and expected exam dates collected at setup, editable anytime.
- FR-2.11 **[EVOLVED]** Lab Batch Divide: same-slot collisions — two subjects at one `(day, period)` — trigger a one-time "Batch A or Batch B?" prompt regardless of whether the timetable came from cloning a share code, pasting JSON, or manual entry. The non-applicable slot is removed from the working copy, correctable later via ordinary manual editing.

### FR-3 — Daily marking loop (M)
- FR-3.1 **[CARRIED OVER]** Today screen, chronological cards, default present, later-in-day periods stay tappable.
- FR-3.2 **[EVOLVED]** Single tap toggles present/absent; a multi-period lab block toggles as one unit, with an expand affordance for partial marking.
- FR-3.3 **[NEW]** Full-day and half-day bulk-mark shortcuts, writing real per-period records.
- FR-3.4 **[CARRIED OVER]** Every marking action writes locally, instantly, no loading state.
- FR-3.5 **[NEW]** Undo affordance on every state change.
- FR-3.6 **[CARRIED OVER]** Absent uses a neutral tone; red reserved for genuine threshold danger.
- FR-3.7 **[NEW]** Retroactive fill-in prompt (10-day lookback), plus free-form History correction at any time.
- FR-3.8 **[EVOLVED]** Days under an active holiday or exam-mode override render as a non-markable status banner.

### FR-4 — Exception / reality layer (M)
- FR-4.1 **[EVOLVED]** Personal cancel/substitute/holiday, with the substitution mechanic made precise: the moment a substitution applies, the period's card relabels to the new subject immediately, so a subsequent tap writes against the correct `subject_id`.
- FR-4.1a **[NEW]** Day Swap — a day-template lookup override, not a bulk period copy:
  ```
  day_key_for(date):
      return DailyOverride.get(date, period=NULL, status='day_template_swap')?.source_day_key
             ?? natural_day_key(date)
  ```
- **Precedence rule [NEW]:** a per-period override always wins over a whole-day swap for that specific period.
- FR-4.2 **[CARRIED OVER]** One-tap holiday declaration.
- FR-4.3 **[NEW, revised]** Crowd-sourced claims — four claim types (`cancellation`, `day_swap`, `period_swap`, `extra_class`) through one mechanism:

  | Field | Meaning |
  |---|---|
  | `claim_type` | `cancellation` \| `day_swap` \| `period_swap` \| `extra_class` |
  | `claim_payload` | e.g. `{source_day}`, `{new_subject_id}`, `{subject_id, period_span}` |
  | `stance` | `assert` or `reject` |
  | `student_id`, `class_group_id`, `date`, `period` (nullable) | Scope |

  - **Quorum: `ceil(max(0.50 × class_group_size, 3))`** — 50% of the class or 3 students, whichever is higher. Raised from an earlier 15% design specifically to make a small colluding group harder — worth being aware that this only hardens the *non-CR* path; a CR's instant assert (below) bypasses the percentage entirely by design.
  - `net = distinct asserts − distinct rejects`; auto-applies while `net ≥ quorum`, continuously re-evaluated.
  - **Class Representative role, kept as designed:** class-group membership carries a `role` (`member`/`cr`); a `cr`'s assert satisfies quorum instantly, but is still just one more disputable report — any member can `reject` it if the CR made a mistake or posted something false. This is the one place the 50% threshold doesn't apply at all, since it's a deliberate convenience for a trusted role rather than a vote.
- FR-4.4 **[NEW]** Extra Class — personal FAB (subject, date, period count 1–3, immediate present/absent) available to everyone including guests, plus a crowd-reportable variant through the identical assert/reject/quorum machinery.

### FR-5 — Insight engine (M)
Three separate headline metrics, kept as designed — no simplification to a single number:
- FR-5.1 **[EVOLVED]** Phase-aware hero metric — a single number in aggregate mode, a ranked per-subject list in per-subject mode.
- FR-5.2 **[CARRIED OVER]** `N_max`: `floor(attended / threshold − held)`.
- FR-5.3 **[NEW]** `M_min` (recovery count) shown once already below threshold: `ceil((threshold × held − attended) / (1 − threshold))`.
- FR-5.4 **[NEW]** Worst-case burndown — the exact date the student crosses the line if they never attend another class from today:
  ```
  worst_case_burndown(subject_or_aggregate):
      running_attended, running_held = attended, held
      for date in remaining_working_days(today, semester_end):
          periods_today = scheduled_periods(date)
          running_held += periods_today
          if running_attended / running_held < threshold:
              return date
      return None
  ```
- FR-5.5 **[NEW]** Per-subject progress rings with the threshold line marked.
- FR-5.6 **[NEW]** Calendar heatmap view.
- FR-5.7 **[CARRIED OVER]** Risk banner language differs by regulation-profile mode.

### FR-6 — Exam mode & calendar sync (M)
- FR-6.1 **[EVOLVED]** Dates from FR-2.10 seed `AcademicCalendar`; migrated from V1's `ExamPeriods` per Section 6.4.
- FR-6.2 **[CARRIED OVER]** Active exam windows auto-switch affected days to exam mode.
- FR-6.3 **[CARRIED OVER]** Held-period calculations exclude holidays/exam windows automatically.

### FR-7 — Crowd / class-group features (M)
- FR-7.1 **[NEW]** Any signed-in student can generate a share code, creating a `ClassGroup`.
- FR-7.2 **[NEW]** Joining a code clones the timetable and adds the student to the group.

### ~~FR-8~~ — Removed
Evidence logging and condonation-letter drafting are cut entirely, for the same reason FR-11 was cut earlier: this app doesn't touch anything official, and condonation is literally the university committee process. Kept out of the numbering to avoid renumbering everything after it.

### FR-9 — Notifications (M, local/on-device only)
- FR-9.1 **[NEW]** Evening nudge with in-notification quick actions.
- FR-9.2 **[NEW]** Per-class reminders scheduled on-device.
- FR-9.3 **[NEW]** Nothing depends on a live server round trip; local scheduled notifications remain fully available in Expo Go.

### FR-10 — Semester transition (M)
- FR-10.1 **[EVOLVED]** New semester re-runs timetable setup, carries the profile forward, re-resolves the regulation profile.
- FR-10.2 **[NEW]** Prior semesters become read-only history, still correctable via History.

### FR-11 — Not included
Export and official-portal reconciliation remain out of scope.

### FR-12 — Offline sync engine (M)
- FR-12.1 **[NEW]** Every write produces a local record and a queued outbox entry in one atomic transaction.
- FR-12.2 **[NEW]** Sync attempted on connectivity restore, app foreground, and a periodic in-foreground timer.
- FR-12.3 **[NEW]** Client-generated UUIDs as idempotency keys; mutations phrased as "set," never "increment."
- FR-12.4 **[NEW]** Crowd/social data pulled via a separate, simpler `since=<timestamp>` sync, never blocking the personal-write outbox.
- FR-12.5 **[NEW]** The guest-to-account migration (FR-1.6) and the legacy-to-guest migration (Section 6) both re-key existing rows into this same mechanism.

---

## 6. Migration & rollout

### 6.1 Automatic backup before any schema change
On first launch of the updated app, before touching a single row: export the entire existing V1 SQLite database to a timestamped file in app-private storage, verify the export completed before proceeding. If the backup itself fails, halt the migration entirely and retry on next launch — never leave a user mid-migration with a half-converted database.

### 6.2 Timetable slot restructuring: split periods → merged `period_span`
V1's stored `TimetableSlots` have one row per period. Migration groups rows by `(day_of_week, subject_id)`, finds consecutive `period_num` runs, and merges each run into a single new-schema `TimetableSlot` with `period_span = count`. Fully deterministic, no user input needed. The paste-JSON prompt shown to users going forward (Appendix B) is updated to never split multi-period cells — this only affects future pastes, not the one-time historical merge.

### 6.3 Legacy-to-new onboarding: the one-time upgrade prompt
Every legacy user is prompted once, immediately after the update, to supply program type, current year, and branch (and the IDP UG+PG pair if applicable). Until completed, the app uses the Section 4.4 legacy mapping — unchanged behavior, unchanged numbers. The prompt is dismissible without penalty, and remains reachable afterward via a persistent "Upgrade your profile" entry in Settings.

### 6.4 Entity-by-entity schema mapping

| V1 entity | Maps to | Transform |
|---|---|---|
| `UserPreferences` | `Student` + `RegulationProfile` | `calculation_mode` → legacy-mapped `regulation_profile.mode`; `semester_start`/`semester_end` copied into `AcademicCalendar` seeding |
| `ExamPeriods` | `AcademicCalendar` rows | Each date range becomes a run of rows with `type='exam'` |
| `Subjects` | `Subject` | Direct field copy; offsets handled per Section 6.5, then dropped |
| `TimetableSlots` | `TimetableSlot` | Split-to-merged transform, Section 6.2 |
| `DailyExceptions` | `AttendanceRecord` / `DailyOverride` | `status='Absent'` → `AttendanceRecord`; `status='Cancelled'` → `DailyOverride` |
| `PeriodTimings` | `PeriodTiming` (carried over as its own entity) | Direct copy |

### 6.5 Preserving `manual_held_offset` / `manual_attended_offset`
Each subject's non-zero offset converts into a single synthetic historical adjustment, dated at that subject's semester start, preserving the exact net effect on numerator and denominator — surfaced transparently in the subject's detail view rather than hidden.

### 6.6 Failure handling
If any step fails after the backup succeeds: roll back using that backup, present a clear "your existing app still works" message, log the failure, retry automatically next launch.

---

## 7. Non-functional requirements

| Category | Requirement |
|---|---|
| Performance | Marking a period updates the UI and hero metric with no perceptible delay |
| Offline capability | Everything guests could already do in V1 continues to work fully offline |
| Security | See Section 14 |
| Privacy | A user's data is visible only to them, except aggregate (non-attributed) crowd-claim confirmation counts |
| Appearance | Light and dark mode both fully themed |
| Reliability | No mutation is ever lost on app kill or multi-day offline use; migration is never destructive |
| Usability | A fully-present day takes zero taps; a day with exceptions takes under 15 seconds |
| Extensibility | Adding a new program's regulation profile requires a data entry, not a code change |
| Data safety | An automatic local backup exists before any schema-altering update |

---

## 8. Data model

| Entity | Key fields | Migration source |
|---|---|---|
| Student | year, program_type, branch, pg_specialization, regulation_profile, auth_id (nullable) / local_user_id | `UserPreferences` |
| RegulationProfile | mode (aggregate/per_subject), threshold, condonable_floor | Legacy-mapped from `calculation_mode` until upgraded |
| Subject | name, code, type (UG/PG), credits, is_lab, is_optional, min_attendance_override | `Subjects`, offsets converted per Section 6.5 |
| TimetableSlot | day_or_day_order, period, subject_id, room, is_lab, batch, period_span | `TimetableSlots`, merged per Section 6.2 |
| PeriodTiming | period_num, start_time, end_time | `PeriodTimings`, carried over directly |
| DailyOverride | date, period (nullable), status (held/cancelled/holiday/extra/exam_mode/day_template_swap), source_day_key, source (personal/crowd) | `DailyExceptions` (cancelled rows) |
| AttendanceRecord | date, period, subject_id, status | `DailyExceptions` (absent rows) |
| AcademicCalendar | date, type (working/holiday/exam), semester_id | `ExamPeriods` |
| ClassGroup | section_id, timetable_id, share_code | New |
| ClassGroupMember | class_group_id, student_id, role (member/cr) | New |
| CrowdReport | class_group_id, date, period (nullable), claim_type, claim_payload, stance, student_id | New |
| PendingSync | id (UUID), entity_type, operation, payload, sync_status, retry_count | New |

`AttendanceRecord` no longer carries `evidence_tag`/`evidence_attachment` — those existed only to support the now-removed FR-8.

---

## 9. External interface overview

**Core screens:** the one-time upgrade prompt (legacy users only), Onboarding (new installs), Timetable Review Grid (paste-JSON output and manual entry converge here, including Lab Batch Divide), Today (Swap Day affordance, long-press quick-menu, Add Extra Class FAB), Insights/Home, Subject Detail, Calendar Heatmap, History, Settings (including "Upgrade your profile" if dismissed).

**Backend API surface — scoped entirely to crowd/sync, no VLM proxy in this build:**
- `POST /auth/register`, `POST /auth/login`, `POST /auth/reset-password`
- `POST /sync/attendance` — batched outbox flush
- `GET /sync?since=<timestamp>` — crowd/calendar pull
- `POST /class-group`, `POST /class-group/join`
- `POST /crowd-report` — carries `claim_type`/`claim_payload`/`stance`, resolves quorum server-side

---

## 10. Authentication & JWT architecture

### 10.1 How Supabase issues and signs tokens
On sign-in, Supabase Auth issues an access token (JWT) and a refresh token. Current Supabase projects sign access tokens asymmetrically (ES256) — check Settings → JWT to confirm which mode your project is on. Key claims: `sub` (the user's `auth.uid()`), `role`, `aud`, `exp` (short, around 5 minutes under asymmetric signing, which is why client-side refresh handling matters).

### 10.2 Verifying tokens without a shared secret
Supabase publishes public verification keys at a JWKS endpoint (`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`). The FastAPI backend verifies a token's signature locally against this, without ever holding a secret capable of creating one. Cache the JWKS (~10 minutes), refetch on a `kid` miss rather than on every request.

### 10.3 FastAPI backend verification (gates `/class-group*`, `/crowd-report`)
As a shared dependency, not duplicated per route: read the `Authorization: Bearer <token>` header, look up the signing key by `kid` from the cached JWKS, verify signature/expiry/audience, extract `sub` as the authenticated user's ID, return a clean 401 on any failure. If the project is still on legacy HS256, verify against the JWT secret instead — but plan to move to asymmetric keys.

### 10.4 Client-side session handling
Configure the Supabase client with `persistSession: true` and `autoRefreshToken: true`, backed by `expo-secure-store`, with an `AppState` listener to pause/resume refresh as the app backgrounds and foregrounds.

### 10.5 Guest requests
Guest-mode requests never carry a JWT. There's currently nothing in the API surface a guest would legitimately call, since crowd features are the entire signed-in feature set now — the mobile client should never attempt these calls in guest mode in the first place, not just rely on the backend rejecting them.

### 10.6 Relationship to Row Level Security
JWT verification in 10.1–10.3 is for our own FastAPI endpoints specifically. When the mobile client talks to Supabase's database directly, PostgREST verifies the JWT itself and RLS checks `auth.uid()` automatically — no code of ours is involved in that path.

---

## 11. Offline sync architecture

### 11.1 Why an outbox
Every write lands in local SQLite twice, in one atomic transaction: once in the real table, once in a `PendingSync` queue.

### 11.2 Idempotency
Client-generated UUIDs are the permanent identity of each mutation on both sides, enforced via a unique constraint server-side. Mutations are phrased as "set," never "increment."

### 11.3 Flush worker
Triggered on connectivity restore, app foreground, and a periodic in-foreground timer. Batched sends; failures back off exponentially.

### 11.4 Conflict resolution
Personal records are single-writer, last-write-wins. Crowd claims are multi-writer, resolved via unique `(student_id, claim)` rows and a distinct-row count.

### 11.5 Undo
Undone while `pending`: delete the outbox row. Undone while `syncing`: queue a fresh compensating mutation. Append-only, no in-place rollback.

### 11.6 How the two migrations plug in
Both the legacy-to-guest migration (Section 6) and the guest-to-account migration (FR-1.6) are re-keys of existing rows into this same mechanism.

---

## 12. Full feature list for this build

**Migration & continuity**
- Automatic local backup before any schema change
- Timetable slot merge (split periods → `period_span`)
- One-time legacy upgrade prompt, dismissible, always reachable later
- Manual-offset preservation as a transparent historical adjustment
- Safe-failure handling

**Setup & account**
- Guest mode, unchanged from V1, as a permanent tier — not a trial
- Supabase account creation (email/password + Google OAuth), environment-aware for Expo Go
- Sign-in-anytime upgrade path
- Paste-JSON (everyone, updated merge-based prompt), manual entry (everyone)
- Share-code timetable cloning (signed-in)
- Lab Batch Divide at setup, any entry path
- Semester/exam dates, editable anytime

**Daily use**
- Today screen, tap-to-mark, full/half-day shortcuts, lab-block handling, undo, retroactive fill-in, free-form history correction

**Exceptions**
- Personal cancel/substitute (with card relabeling)/holiday
- Day Swap with per-period override precedence
- Extra Class, personal and crowd-reportable
- Generalized crowd-claim system: **50% quorum**, CR instant-quorum, universal dispute rights

**Insights**
- Phase-aware bunk meter / per-subject risk ranking
- Recovery count once below threshold
- Worst-case burndown date
- Threshold rings, calendar heatmap

**Notifications**
- Local evening nudge, local per-class reminders

**Infrastructure & security**
- Full offline-first sync, guest and signed-in alike
- Multi-program regulation engine with legacy compatibility mapping
- JWT-based backend auth (asymmetric verification via JWKS), scoped to crowd/sync only
- Row Level Security on every table
- Light and dark mode
- Open-source-ready, monorepo structure

---

## 13. Out of scope

**Deliberately rejected:**
- Automated login/scraping of any official JNTUH system
- Background GPS geofencing
- Official-portal export/reconciliation (FR-11)
- **Evidence logging and condonation-letter drafting (formerly FR-8)** — this app doesn't touch anything official, consistent with the FR-11 decision.

**Deferred to a later version (Section 17):**
- **Native AI photo/PDF timetable extraction** — deliberately cut from this build to keep the backend free of VLM key management, consistent with V1's original BYO-LLM philosophy. The provider decision (Gemini 2.5 Flash primary, OpenRouter fallback) and the extraction prompt are preserved in Section 17 so this isn't re-researched from scratch later.
- A WhatsApp/Telegram conversational agent.
- Weather/long-weekend nudges, opt-in buddy accountability, home-screen widget, microcopy pass.

---

## 14. Security requirements
1. **RLS mandatory on every table**, enabled explicitly.
2. Every policy scoped with `auth.uid()` (or the guest `local_user_id` equivalent, validated server-side where it touches shared data).
3. The `service_role` key never reaches client code.
4. Passwords handled entirely by Supabase Auth.
5. All traffic HTTPS-only.
6. No secret is ever committed.
7. FastAPI verifies every account-gated request via JWKS.
8. Dependency scanning (Dependabot) enabled from first commit.
9. The pre-migration backup (Section 6.1) is local, private app storage only — never uploaded anywhere — and purged automatically once a migration has been confirmed stable for a reasonable period.

---

## 15. Open risks and pre-launch validation items
1. Confirm the years 4–5 IDP per-subject rule applies to all subjects as written, vs. a PG-only interpretation in local practice.
2. Validate the B.Tech-regular aggregate rule against the full primary regulation document.
3. Decide hosting provider for the FastAPI/PostgreSQL backend.
4. Confirm whether MBA/MCA programs are added before or after this build's launch.
5. Confirm current Supabase and EAS free/hobby-tier limits.
6. Confirm the exact current API name for Expo Go environment detection.
7. Run the full migration against a real copy of production data before shipping to any real user.
8. **Watch actual usage of the 50% quorum once class groups are live** — worth checking whether it's high enough that legitimate cancellations/swaps routinely fail to reach quorum in smaller class groups, which would push more of the burden onto the CR role than intended.

---

## 16. Open source
Repository is public (monorepo, Section 3.3), MIT-licensed, with friends contributing via pull requests.

---

## 17. Future work

**Native AI timetable extraction.** Deferred from this build to keep the backend free of VLM key management. When this is picked back up, the provider decision already made and worth reusing directly:

| Role | Provider | Why |
|---|---|---|
| Primary | Gemini 2.5 Flash, via Google AI Studio's free tier | Vision-capable, strong at structured extraction, ~1,500 requests/day free |
| Fallback | `google/gemma-4-31b-it:free` via OpenRouter | Free, vision-capable, automatic fallback on error/rate-limit |

Both calls would need to happen server-side, gated behind the same JWT verification already built for crowd features (Section 10) — extending, not replacing, that work. The extraction prompt (Appendix B) is already written in the merge-based (not split-based) form this build needs.

**A WhatsApp or Telegram conversational agent** for checking status without opening the app — noted for later discussion, not specified further yet.

---

## Appendix A — Worst-case burndown
See FR-5.4.

## Appendix B — Timetable extraction prompt (for the paste-JSON workflow, and reusable as-is for future native extraction)
```
You are extracting a weekly class timetable from an image or PDF.
Return ONLY valid JSON, no markdown, no commentary, in this schema:

{
  "day_type": "calendar_day" | "day_order",
  "slots": [
    {
      "day": "Monday" | "Day 1",
      "period_number": 1,
      "start_time": "09:00",
      "end_time": "09:50",
      "subject_raw": "exactly as written on the timetable",
      "room": "if visible, else null",
      "is_lab": true/false,
      "period_span": 1,
      "confidence": "high" | "low"
    }
  ]
}

Rules:
- A cell spanning multiple periods is ONE slot with period_span noting the
  span — never split it into repeated slots.
- If text is unclear, set confidence to "low" rather than guessing silently.
- Never invent a subject or period that isn't visible in the source.
```

## Appendix C — Migration merge algorithm (reference)
```
merge_split_slots(legacy_slots):
    grouped = group_by(legacy_slots, key=(day_of_week, subject_id))
    new_slots = []
    for (day, subject), rows in grouped:
        rows.sort(by=period_num)
        run = [rows[0]]
        for row in rows[1:]:
            if row.period_num == run[-1].period_num + 1:
                run.append(row)
            else:
                new_slots.append(make_slot(run))
                run = [row]
        new_slots.append(make_slot(run))
    return new_slots

def make_slot(run):
    return TimetableSlot(
        day=run[0].day_of_week,
        period=run[0].period_num,
        subject_id=run[0].subject_id,
        period_span=len(run),
        is_lab=False,
    )
```