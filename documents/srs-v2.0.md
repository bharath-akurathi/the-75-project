# Software Requirements Specification
## The 75 Project — Next Build (V2)

| | |
|---|---|
| **Version** | 2.0 (Next Build) |
| **Date** | July 23, 2026 |
| **Builds on** | V1 — Local MVP (shipped, tested, in production) |
| **Platform** | React Native (Expo), Android first, iOS follow-on |
| **Backend** | FastAPI + PostgreSQL, via Supabase (new in this build) |
| **Auth** | Supabase Auth — email/password and Google OAuth (new in this build) |
| **Local storage** | SQLite, offline-first, guest mode is the default and unchanged behavior |
| **License** | MIT (carried over from V1) |
| **Status** | Draft for review |

### Document history
V1 shipped as a deliberately minimal, 100%-local, no-login MVP — paste-JSON/manual timetable entry, a manual Aggregate/Per-Subject toggle, simple date-range exam periods, and the core absence-tracking loop. It is real, tested, and has real users with real local data. This document is **not** a continuation of earlier exploratory SRS drafts that were never built — it is the actual next build, specified against the actual shipped baseline, and its single most important new concern is protecting that existing production data through the upgrade. Two decisions are locked in for this build: existing users are prompted once, right after updating, to add program/year (upgrading them onto the new regulation engine — Section 6.3), and the migration takes an automatic local backup before touching the schema (Section 6.1).

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for the next build of The 75 Project — adding accounts, cloud sync, native AI timetable extraction, crowd-sourced schedule updates, and the full regulation-profile engine on top of the shipped local-only V1, without breaking or losing any existing user's data.

### 1.2 Scope
This build adds, in full: Supabase-backed accounts (email/password + Google OAuth) alongside a guest mode that is functionally identical to how V1 already behaves; native in-app AI timetable extraction; the auto-detecting, phase-aware regulation-profile engine (replacing V1's manual toggle, with a compatibility path for existing users); day swaps, precise period substitution, extra classes, and Lab Batch Divide; the generalized crowd-claim system with dynamic quorum and a Class Representative role; evidence logging and condonation drafting; local notifications; and a complete, tested migration path from V1's schema to this build's schema. It remains **not** an official or institutional tool.

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
| Quorum | The net-stance threshold needed before a claim is treated as fact (FR-4.3) |
| VLM | Vision-language model, used for timetable image → structured JSON extraction |
| JWT | JSON Web Token — Supabase Auth's session credential; see Section 10 |
| JWKS | JSON Web Key Set — the public-key endpoint used to verify Supabase JWTs without a shared secret (Section 10) |

### 1.4 References
- JNTUH CEH R21 IDP Academic Regulations, Section 7 — primary source for the IDP profile.
- JNTUH R22 B.Tech/M.Tech regulation excerpts — B.Tech-regular and M.Tech-regular profiles.
- The shipped V1 SRS and codebase — the actual baseline for every migration requirement in Section 6.

---

## 2. Current state — V1 in production

Stated explicitly because every requirement below is a delta against this, not against a blank slate:

- 100% local, client-side only — no backend, no accounts, no network dependency of any kind.
- Onboarding: launches directly into the app; a single manual toggle (Aggregate / Per-Subject) sets the calculation mode. No program, year, or branch is collected.
- Timetable: paste-JSON (BYO-LLM) workflow and manual entry only. The extraction prompt shown to users **splits** multi-period blocks into separate consecutive slots (e.g., a 3-period lab becomes 3 rows) — the opposite of this build's merged `period_span` approach (Section 6.2).
- Exam handling: user-defined date ranges (`ExamPeriods`) pause tracking and subtract from the held count.
- Insight engine: live safe-to-skip number only (`N_max`-equivalent); no worst-case burndown, no per-subject rings/heatmap as distinct itemized features.
- Data model: `UserPreferences`, `ExamPeriods`, `Subjects` (with `manual_held_offset`/`manual_attended_offset` as a manual correction escape hatch), `TimetableSlots` (no `period_span`, no `is_lab`, no `batch`), `DailyExceptions`, `PeriodTimings`.
- Already has: dark mode, a rendered PNG app icon, MIT license.
- Does not have: any form of account, cloud backup, crowd features, AI photo extraction, day swaps, period substitution mechanics, extra-class logging, evidence/condonation support, or notifications.

---

## 3. Overall description

### 3.1 Product perspective
Still a standalone, non-official tool. Nothing about that changes — accounts and cloud sync are additive, not a requirement to use the app.

### 3.2 User classes

| Class | Notes |
|---|---|
| Legacy user (existing V1 install) | Local data in V1's schema; migrated per Section 6, then behaves as a guest by default |
| Guest (new install, no account) | Identical experience to what V1 already offers, unchanged |
| Signed-in user | Adds cloud backup, native AI extraction, and crowd/class-group features |
| Years 1–3 students (aggregate) / Years 4–5 IDP and M.Tech-regular (per-subject) | Regulation-profile classes, Section 4 |
| Class Representative | A signed-in user holding the `cr` role in a class group (FR-4.3) |

### 3.3 Operating environment
- **Client:** React Native via Expo. Android primary, iOS follow-on. **Minimum supported versions: Android API 24 (Android 7.0), iOS 15.**
- **Preview/dev workflow:** Expo Go, as already in use. Native Google Sign-In cannot run inside Expo Go under any circumstances — see FR-1.7.
- **Repository structure: a monorepo** — `backend/` (FastAPI) alongside `mobile/` (the Expo app), rather than two separate repositories. This keeps schema, API contract, and client in lockstep, which matters more than usual here given the migration in Section 6.
- **Backend-as-a-service:** Supabase (PostgreSQL, Auth, Storage for evidence attachments) — entirely new to this build.
- **API layer:** a thin FastAPI service for the VLM extraction proxy and anything Supabase doesn't serve directly.
- **Local storage:** SQLite on-device, unchanged in kind from V1, evolved in schema (Section 6).

### 3.4 Timetable extraction provider (new capability)

| Role | Provider | Why |
|---|---|---|
| Primary | **Gemini 2.5 Flash**, via Google AI Studio's free API tier | Vision-capable, strong at structured table/document extraction, and the free tier is generous for this task — roughly 1,500 requests/day, no card required |
| Fallback | **`google/gemma-4-31b-it:free`** via OpenRouter | Also free and vision-capable; used automatically if the primary call errors or is rate-limited |

Both calls happen **server-side only**, gated behind a verified JWT (Section 10) so the shared key isn't exposed to unlimited anonymous use — this is why native extraction is a signed-in-only feature, exactly as in guest mode already (paste-JSON remains available to everyone, unchanged from V1). One honest tradeoff: Google's free tier allows prompts to be used to improve their products, worth a short privacy note in-app since a timetable photo can carry a name or roll number.

### 3.5 Design and implementation constraints
- Everything V1 already does offline must continue to work offline, for guests exactly as today. Nothing about adding accounts may regress that.
- Every mutation is idempotent under retry (client-generated UUIDs).
- No university credentials are ever stored or used anywhere in this product.
- No secret, key, or credential may be hardcoded or committed (open-source repo).
- **The migration must never run without first taking a local backup (Section 6.1), and must never leave a legacy user's app in a broken or data-losing state, even on partial failure.**

### 3.6 Assumptions, dependencies, and confidence levels

| Regulation profile | Source confidence | Note |
|---|---|---|
| IDP, years 1–3 (aggregate) | High — full primary regulation text reviewed | — |
| IDP, years 4–5 (per-subject) | High — full primary regulation text reviewed | Worth reconciling with the department on all-subjects vs. PG-only in practice |
| M.Tech regular (per-subject) | Medium-high — multiple corroborating excerpts | — |
| B.Tech regular (aggregate) | Medium — single excerpt, not a fully reviewed primary document | Pre-launch validation item, Section 15 |
| MBA / MCA | Not researched | Excluded until data is collected |

---

## 4. The regulation profile system

### 4.1 Profile behavior

| Profile | Eligibility rule | Unit at risk if not condoned |
|---|---|---|
| B.Tech regular, all 4 years | Aggregate across all subjects, per semester | Whole semester |
| M.Tech regular, whole program | Per subject, individually | That subject only |
| IDP, years 1–3 | Aggregate (same mechanism as B.Tech) | Whole semester |
| IDP, years 4–5 | Per subject — UG and PG subjects alike (same mechanism as M.Tech) | That subject only |

### 4.2 Shared parameters, configurable per profile
`full_eligibility_threshold` (default 75%), `condonable_floor` (default 65%), `condonation_requires_evidence` (default true).

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

### 4.4 Legacy compatibility mapping (new)
V1's `calculation_mode` toggle maps directly onto `profile.mode` — `Aggregate → "aggregate"`, `Per-Subject → "per_subject"` — so a legacy user's existing numbers **do not change** the moment they update. This mapped value is what the app uses until a legacy user completes the one-time upgrade prompt (Section 6.3), which replaces it with a properly auto-resolving profile tied to real program/year data — needed because the old toggle has no year concept and can never auto-advance the years 3→4 phase switch the way the resolved profile can (FR-10.1).

---

## 5. Functional requirements

Priority key: **M** = MVP, all ships in this build. Each item is tagged **[NEW]**, **[EVOLVED from V1]**, or **[CARRIED OVER]**.

### FR-1 — Account, guest mode, and onboarding (M)
- FR-1.1 **[EVOLVED]** On first launch (new installs), two equally prominent paths: create an account, or continue as a guest. **For legacy users this FR does not apply at first update launch** — see Section 6.3 for the actual upgrade-prompt flow they get instead.
- FR-1.2 **[NEW]** Choosing guest mode shows an honest comparison screen (Section 5.1 table) before confirming, with an equally easy path back to sign-in.
- FR-1.3 **[NEW]** Account creation via Supabase Auth — email + password and Google OAuth. Supabase owns hashing, reset flows, and OAuth verification entirely.
- FR-1.4 **[EVOLVED]** Onboarding (guest or signed-in) collects program type, current year, branch, and — for IDP — the UG+PG pair, resolving `regulation_profile` automatically (Section 4). This is the same information the Section 6.3 upgrade prompt collects from legacy users, just at a different moment in their lifecycle.
- FR-1.5 **[NEW]** Guest data — new installs and legacy users alike — uses a persistent `local_user_id` as the row-owner key instead of `auth.uid()`, so the same schema and outbox mechanics (Section 11) work identically for guests, migrated legacy users, and signed-in users.
- FR-1.6 **[NEW]** Sign-in-later upgrade path: at any point, guest data (including migrated legacy data) can be re-keyed from `local_user_id` to a real `auth.uid()` and enqueued into the sync outbox — nothing already tracked is lost.
- FR-1.7 **[NEW]** Native Google Sign-In is environment-aware — detected and hidden under Expo Go (`Constants.appOwnership` or the current SDK equivalent; verify the exact API name against the Expo SDK version in use), with email/password remaining fully functional there. Google Sign-In is testable from a development build onward.

#### 5.1 What guest mode includes vs. what an account adds

| Available to everyone, including guests (this is what V1 users already have) | Requires an account (new in this build) |
|---|---|
| Manual timetable creation | Native in-app photo/PDF upload with automatic AI extraction |
| Paste-JSON timetable creation | Cloud backup and multi-device sync |
| Full daily marking loop | Timetable clone-by-share-code and all crowd/class-group features |
| Personal exception marking — cancel/substitute/holiday/extra class, day swap | Backed-up evidence attachments |
| The complete phase-aware calculation engine, on-device | Calendar sync shared across a class group |
| Lab Batch Divide resolution, any entry path | — |
| Light/dark mode, full core UI | — |

### FR-2 — Timetable setup (M)
- FR-2.1 **[NEW]** Upload a photo/PDF for AI extraction. Signed-in users only.
- FR-2.2 **[NEW]** Extraction prompt (Appendix B) returns day/day-order, period, time, subject, room, lab flag, **period span (merged, not split — see Section 6.2 for why this differs from V1's shipped prompt)**, and a confidence flag.
- FR-2.3 **[EVOLVED]** Results render in a fully editable grid — the same surface as manual entry (FR-2.7), not a reduced "just fix the AI" mode.
- FR-2.4 **[EVOLVED]** Grid supports add/delete, merge/split of multi-period blocks, day-order vs. calendar-day toggle, lab-batch toggle.
- FR-2.5 **[CARRIED OVER]** Subject confirmation offers to merge near-duplicate names — V1's FR-2.3 "Total Editability" already covers renaming; this adds proactive duplicate detection.
- FR-2.6 **[EVOLVED]** Subjects tagged UG/PG, optional custom threshold, `is_optional` flag excluding a subject from calculations.
- FR-2.7 **[CARRIED OVER]** Manual entry, available to everyone, first-class (this is V1's FR-2.2, unchanged in spirit).
- FR-2.8 **[NEW]** Share-code timetable cloning. Signed-in only.
- FR-2.9 **[CARRIED OVER]** Paste-JSON path, available to everyone — this is V1's FR-2.1, with the prompt itself updated (Section 6.2, Appendix B).
- FR-2.10 **[EVOLVED]** Semester start/end and expected exam dates collected at setup, editable anytime. V1 already stores `semester_start`/`semester_end` on `UserPreferences`; this formalizes exam-date collection alongside it and feeds the `AcademicCalendar` entity (FR-6).
- FR-2.11 **[NEW]** Lab Batch Divide: same-slot collisions (two subjects at one `(day, period)`, however the timetable was populated) trigger a one-time "Batch A or Batch B?" prompt; the non-applicable slot is removed from the working copy, correctable later via ordinary manual editing.

### FR-3 — Daily marking loop (M)
- FR-3.1 **[CARRIED OVER]** Today screen, chronological cards, default present, later-in-day periods stay tappable. (V1's FR-3.1.)
- FR-3.2 **[EVOLVED]** Single tap toggles present/absent; a multi-period lab block toggles as one unit once Section 6.2's merge runs, with an expand affordance for partial marking.
- FR-3.3 **[NEW]** Full-day and half-day bulk-mark shortcuts, writing real per-period records.
- FR-3.4 **[CARRIED OVER]** Every marking action writes locally, instantly, no loading state.
- FR-3.5 **[NEW]** Undo affordance on every state change.
- FR-3.6 **[CARRIED OVER]** Absent uses a neutral tone; red reserved for genuine threshold danger (V1's NFR already states this).
- FR-3.7 **[NEW]** Retroactive fill-in prompt (10-day lookback), plus free-form History correction at any time.
- FR-3.8 **[EVOLVED]** Days under an active holiday or exam-mode override render as a non-markable status banner (V1's exam phases already pause tracking; this adds the explicit banner state and holiday coverage).

### FR-4 — Exception / reality layer (M)
- FR-4.1 **[EVOLVED]** Personal cancel/substitute/holiday, with the substitution mechanic made precise: the moment a substitution applies, the period's card relabels to the new subject immediately, so a subsequent tap writes against the correct `subject_id`. (V1's FR-3.4 already had "long-press to cancel"; this adds substitution and the relabeling guarantee.)
- FR-4.1a **[NEW]** Day Swap — a day-template lookup override, not a bulk period copy:
  ```
  day_key_for(date):
      return DailyOverride.get(date, period=NULL, status='day_template_swap')?.source_day_key
             ?? natural_day_key(date)
  ```
- **Precedence rule [NEW]:** a per-period override always wins over a whole-day swap for that specific period.
- FR-4.2 **[CARRIED OVER]** One-tap holiday declaration.
- FR-4.3 **[NEW]** Crowd-sourced claims — four claim types (`cancellation`, `day_swap`, `period_swap`, `extra_class`) through one mechanism:

  | Field | Meaning |
  |---|---|
  | `claim_type` | `cancellation` \| `day_swap` \| `period_swap` \| `extra_class` |
  | `claim_payload` | e.g. `{source_day}`, `{new_subject_id}`, `{subject_id, period_span}` |
  | `stance` | `assert` or `reject` |
  | `student_id`, `class_group_id`, `date`, `period` (nullable) | Scope |

  - Dynamic quorum: `ceil(max(0.15 × class_group_size, 3))`.
  - `net = distinct asserts − distinct rejects`; auto-applies while `net ≥ quorum`, continuously re-evaluated (a claim can revert if disputes push it back below quorum).
  - Class-group membership carries a `role` (`member`/`cr`); a `cr`'s assert satisfies quorum instantly but is still just one more disputable report.
- FR-4.4 **[NEW]** Extra Class — personal FAB (subject, date, period count 1–3, immediate present/absent) available to everyone including guests, plus a crowd-reportable variant (the `extra_class` claim above) through the identical assert/reject/quorum machinery, deliberately not a separate ungoverned channel.

### FR-5 — Insight engine (M)
- FR-5.1 **[EVOLVED]** Phase-aware hero metric — a single number in aggregate mode, a ranked per-subject list in per-subject mode. (V1's FR-4.2/4.3 already do the aggregate-vs-per-subject display split; this formalizes it against the resolved regulation profile instead of the raw toggle.)
- FR-5.2 **[CARRIED OVER]** `N_max`: `floor(attended / threshold − held)` — this is V1's FR-4.2 formula verbatim.
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
- FR-5.7 **[CARRIED OVER]** Risk banner language differs by regulation-profile mode (V1's FR-4.3 display logic, extended to banner copy).

### FR-6 — Exam mode & calendar sync (M)
- FR-6.1 **[EVOLVED]** Dates from FR-2.10 seed `AcademicCalendar`; a fuller calendar can be imported later via extraction or manual entry. Migrated from V1's `ExamPeriods` per Section 6.4.
- FR-6.2 **[CARRIED OVER]** Active exam windows auto-switch affected days to exam mode — V1's FR-3.5 already does this; this build adds the explicit non-markable banner (FR-3.8).
- FR-6.3 **[CARRIED OVER]** Held-period calculations exclude holidays/exam windows automatically (V1's FR-4.1 "elapsed days... minus any marked cancellations" already implies this; this makes the calendar-driven exclusion explicit and precise).

### FR-7 — Crowd / class-group features (M)
- FR-7.1 **[NEW]** Any signed-in student can generate a share code, creating a `ClassGroup`.
- FR-7.2 **[NEW]** Joining a code clones the timetable and adds the student to the group.

### FR-8 — Evidence log & condonation support (M)
- FR-8.1 **[NEW]** Absences taggable medical/official with an optional photo attachment.
- FR-8.2 **[NEW]** Evidence tags are informational only, never altering the computed percentage.
- FR-8.3 **[NEW]** Once a subject/aggregate enters the condonable band, offer to auto-draft a condonation request.

### FR-9 — Notifications (M, local/on-device only)
- FR-9.1 **[NEW]** Evening nudge with in-notification quick actions.
- FR-9.2 **[NEW]** Per-class reminders scheduled on-device.
- FR-9.3 **[NEW]** Nothing depends on a live server round trip; local scheduled notifications remain fully available in Expo Go (only remote push is restricted there, and this app never uses remote push).

### FR-10 — Semester transition (M)
- FR-10.1 **[EVOLVED]** New semester re-runs timetable setup, carries the profile forward, re-resolves the regulation profile — this is what triggers the years 3→4 IDP switch, and only works correctly once a legacy user has completed the Section 6.3 upgrade prompt.
- FR-10.2 **[NEW]** Prior semesters become read-only history, still correctable via History.

### FR-11 — Not included
Export and official-portal reconciliation remain out of scope (decided during the earlier design phase; this product does not touch anything "official").

### FR-12 — Offline sync engine (M)
- FR-12.1 **[NEW]** Every write produces a local record and a queued outbox entry in one atomic transaction.
- FR-12.2 **[NEW]** Sync attempted on connectivity restore, app foreground, and a periodic in-foreground timer.
- FR-12.3 **[NEW]** Client-generated UUIDs as idempotency keys; mutations phrased as "set," never "increment."
- FR-12.4 **[NEW]** Crowd/social data pulled via a separate, simpler `since=<timestamp>` sync, never blocking the personal-write outbox.
- FR-12.5 **[NEW]** The guest-to-account migration (FR-1.6) and the legacy-to-guest migration (Section 6) both re-key existing rows into this same mechanism — no separate sync pattern needed for either.

---

## 6. Migration & rollout (new — the core of this build)

### 6.1 Automatic backup before any schema change
On first launch of the updated app, before touching a single row: export the entire existing V1 SQLite database to a timestamped file in app-private storage (e.g. `legacy_backup_<timestamp>.sqlite`), verify the export completed (file exists, non-zero size, opens and reads back the expected table list) before proceeding. If the backup step itself fails for any reason, **halt the migration entirely** and continue running the app against the untouched V1 schema, retrying the backup+migration on next launch. A user is never left mid-migration with a half-converted database.

### 6.2 Timetable slot restructuring: split periods → merged `period_span`
V1's stored `TimetableSlots` have one row per period, even for multi-period blocks (its own extraction prompt explicitly instructed this). Migration groups rows by `(day_of_week, subject_id)`, finds consecutive `period_num` runs with no gap, and merges each run into a single new-schema `TimetableSlot` with `period_span = count`. A run of length 1 simply carries over as `period_span = 1`. This is fully deterministic and requires no user input. Going forward, the extraction prompt shown to users (Appendix B) is updated to **never** split multi-period cells — this only affects future re-extractions, not the one-time historical merge.

### 6.3 Legacy-to-new onboarding: the one-time upgrade prompt
Per the confirmed decision, every legacy user is prompted **once**, immediately after the update, to supply program type, current year, and branch (and the IDP UG+PG pair if applicable) — the same fields FR-1.4 collects at fresh onboarding. Until this is completed:
- The app uses the Section 4.4 legacy compatibility mapping (their existing toggle value, unchanged behavior, unchanged numbers).
- The prompt is dismissible without penalty — dismissing does not block any existing functionality — but remains reachable afterward via a persistent "Upgrade your profile" entry in Settings, not lost forever.
- Completing it resolves a real `regulation_profile` (Section 4) and unlocks correct automatic behavior at the next semester transition (FR-10.1), which the old toggle could never do on its own.

### 6.4 Entity-by-entity schema mapping

| V1 entity | Maps to | Transform |
|---|---|---|
| `UserPreferences` | `Student` + `RegulationProfile` | `calculation_mode` → legacy-mapped `regulation_profile.mode` (Section 4.4); `semester_start`/`semester_end` copied directly into `AcademicCalendar` seeding (FR-2.10); `onboarding_complete` preserved as-is |
| `ExamPeriods` | `AcademicCalendar` rows | Each date range becomes a run of `AcademicCalendar` rows with `type='exam'` |
| `Subjects` | `Subject` | Direct field copy for `name`, `type`; `manual_held_offset`/`manual_attended_offset` handled per Section 6.5, then dropped from the live schema |
| `TimetableSlots` | `TimetableSlot` | Split-to-merged transform, Section 6.2; `is_lab`/`batch` default to `false`/`null` unless Lab Batch Divide (FR-2.11) detects a same-slot collision at first read, in which case it triggers normally |
| `DailyExceptions` | `AttendanceRecord` / `DailyOverride` | `status='Absent'` rows → `AttendanceRecord`; `status='Cancelled'` rows → `DailyOverride` |
| `PeriodTimings` | `PeriodTiming` (carried over as its own entity — Section 8) | Direct copy; this table's separation from `TimetableSlot` in V1 was a good design and is kept rather than folded in |

### 6.5 Preserving `manual_held_offset` / `manual_attended_offset`
These fields let V1 users manually correct real-world discrepancies the raw calculation missed. The new schema has no generic "offset" concept — it models specific events precisely instead — so simply dropping these fields would silently change a real user's percentage the moment they update, which is not acceptable for numbers people rely on for something that matters. Migration instead converts each subject's non-zero offset into a single synthetic historical adjustment, dated at that subject's semester start, that preserves the exact net effect on numerator and denominator. This is surfaced transparently in the subject's detail view (e.g., "N periods carried over from before the update") rather than hidden — a silent, unexplained fudge is worse than a visible, honest one.

### 6.6 Failure handling
If any step of the migration fails after the backup (6.1) succeeds: roll back to the pre-migration schema using that backup, present the user with a clear "we couldn't update your data safely, your existing app still works" message, log the failure for review, and retry automatically on the next app launch. The app must never be left in a state where it can't be opened at all.

---

## 7. Non-functional requirements

| Category | Requirement |
|---|---|
| Performance | Marking a period updates the UI and hero metric with no perceptible delay |
| Offline capability | Everything guests could already do in V1 continues to work fully offline; only cloud-dependent new features (native extraction, crowd, calendar sharing) require connectivity |
| Security | See Section 14 |
| Privacy | A user's data is visible only to them, except aggregate (non-attributed) crowd-claim confirmation counts |
| Appearance | Light and dark mode both fully themed (V1 already ships dark mode; this build adds light mode to match) |
| Reliability | No mutation is ever lost on app kill or multi-day offline use; **migration is never destructive, per Section 6** |
| Usability | A fully-present day takes zero taps; a day with exceptions takes under 15 seconds |
| Extensibility | Adding a new program's regulation profile requires a data entry, not a code change |
| Data safety | An automatic local backup exists before any schema-altering update (Section 6.1) |

---

## 8. Data model

| Entity | Key fields | Migration source |
|---|---|---|
| Student | year, program_type, branch, pg_specialization, regulation_profile, auth_id (nullable) / local_user_id | `UserPreferences` (Section 6.4) |
| RegulationProfile | mode (aggregate/per_subject), threshold, condonable_floor | Legacy-mapped from `calculation_mode` (Section 4.4) until upgraded |
| Subject | name, code, type (UG/PG), credits, is_lab, is_optional, min_attendance_override | `Subjects`, offsets converted per Section 6.5 |
| TimetableSlot | day_or_day_order, period, subject_id, room, is_lab, batch, period_span | `TimetableSlots`, merged per Section 6.2 |
| PeriodTiming | period_num, start_time, end_time | `PeriodTimings`, carried over directly |
| DailyOverride | date, period (nullable), status (held/cancelled/holiday/extra/exam_mode/day_template_swap), source_day_key, source (personal/crowd) | `DailyExceptions` (cancelled rows) |
| AttendanceRecord | date, period, subject_id, status, evidence_tag, evidence_attachment | `DailyExceptions` (absent rows) |
| AcademicCalendar | date, type (working/holiday/exam), semester_id | `ExamPeriods` |
| ClassGroup | section_id, timetable_id, share_code | New |
| ClassGroupMember | class_group_id, student_id, role (member/cr) | New |
| CrowdReport | class_group_id, date, period (nullable), claim_type, claim_payload, stance, student_id | New |
| PendingSync | id (UUID), entity_type, operation, payload, sync_status, retry_count | New |

---

## 9. External interface overview

**Core screens:** the one-time upgrade prompt (legacy users only, Section 6.3), Onboarding (new installs), Timetable Upload, Timetable Review Grid (including Lab Batch Divide), Today (Swap Day affordance, long-press quick-menu, Add Extra Class FAB), Insights/Home, Subject Detail, Calendar Heatmap, History, Evidence Log, Settings (including "Upgrade your profile" if the prompt was dismissed).

**Backend API surface:**
- `POST /auth/register`, `POST /auth/login`, `POST /auth/reset-password`
- `POST /timetable/extract` — JWT-gated (Section 10); tries Gemini 2.5 Flash first, falls back to OpenRouter on error
- `POST /sync/attendance` — batched outbox flush
- `GET /sync?since=<timestamp>` — crowd/calendar pull
- `POST /class-group`, `POST /class-group/join`
- `POST /crowd-report`
- `POST /condonation/draft`

---

## 10. Authentication & JWT architecture (new)

### 10.1 How Supabase issues and signs tokens
On sign-in (email/password or Google OAuth), Supabase Auth issues an **access token** (a JWT) and a **refresh token**. Current Supabase projects sign access tokens **asymmetrically** (ES256, elliptic curve), replacing the older shared-secret (HS256) model — check the project's Settings → JWT dashboard section to confirm which mode is active, since verification code differs between the two, and projects created at different times can default differently.

Key claims inside the JWT: `sub` (the user's `auth.uid()` — what RLS policies check), `role` (typically `authenticated`), `aud`, `exp`. Under asymmetric signing, access tokens default to a **short expiry (around 5 minutes)** — this makes the client's automatic refresh behavior (below) load-bearing rather than a nicety.

### 10.2 Verifying tokens without a shared secret
Supabase publishes the current public verification keys at a JWKS endpoint: `https://<project>.supabase.co/auth/v1/.well-known/jwks.json`. Any service — including our own FastAPI backend — can verify a token's signature locally against this endpoint, without ever holding a secret capable of *creating* a token, and without a round-trip to Supabase's auth server on every request. Each JWT header carries a `kid` (key ID) identifying which published key to check against, which is also how key rotation works without breaking already-issued tokens: if a `kid` isn't in the cached key set, refetch the JWKS once before rejecting.

**Cache the JWKS rather than fetching it per-request** — Supabase's own edge caches it for about 10 minutes, and the FastAPI service should do the same (e.g., cache in memory keyed by `kid`, refresh on a miss or on a timer).

### 10.3 FastAPI backend verification (required for every account-gated endpoint)
Every endpoint restricted to signed-in users (`/timetable/extract`, `/class-group*`, `/crowd-report`, `/condonation/draft`) must, as a shared dependency rather than duplicated per-route:
1. Read the `Authorization: Bearer <token>` header.
2. Look up the signing key by the token's `kid` from the cached JWKS (Section 10.2).
3. Verify signature, expiry, and audience.
4. On success, extract `sub` as the authenticated user's ID and proceed; on any failure, return a clean 401 — never a generic error that obscures whether the problem was a missing token, an expired one, or a bad signature.

A commonly reported failure mode worth designing around explicitly: an "Invalid JWT" error caused by the backend still expecting the legacy HS256 secret after the project has since moved to asymmetric keys. Always verify against the *current* JWKS rather than a hardcoded secret, so a future key rotation on the Supabase side doesn't silently break this service.

### 10.4 Client-side session handling
The Supabase RN client manages refresh and persistence automatically when configured with `persistSession: true` and `autoRefreshToken: true`, backed by secure on-device storage (e.g. `expo-secure-store`, not plain `AsyncStorage`, since these are sensitive credentials) — with an `AppState` listener to start/stop the refresh timer as the app foregrounds and backgrounds.

### 10.5 Guest requests
Guest-mode requests never carry a JWT at all, because there's no account. Endpoints that guests can legitimately reach (there currently are none among the account-gated list above — paste-JSON, the only guest-available "extraction," never touches the backend) should simply never be exposed to unauthenticated calls in the first place, rather than relying on the JWT check alone to enforce that boundary.

### 10.6 How this relates to Row Level Security
The JWT verification in 10.1–10.3 is for **our own FastAPI endpoints**. It's a separate concern from RLS (Section 14): when the mobile client talks to Supabase's database directly (via the Supabase client library, not through FastAPI), PostgREST verifies the JWT itself and RLS policies check `auth.uid()` against it automatically — no code of ours is involved in that path at all. FastAPI only needs to do its own verification because it's a separate service outside that automatic protection.

---

## 11. Offline sync architecture

### 11.1 Why an outbox
A naive "call the API, retry on failure" approach either blocks the UI on network latency or risks losing a mutation on app kill mid-retry. Every write lands in local SQLite twice, in one atomic transaction: once in the real table the UI reads from, once in a `PendingSync` queue.

### 11.2 Idempotency
Each mutation's UUID is client-generated at the moment of the action and is its permanent identity on both sides, enforced via a unique constraint server-side. Mutations are phrased as "set," never "increment," so a retried request can never double-apply.

### 11.3 Flush worker
Triggered on connectivity restore, app foreground, and a periodic in-foreground timer — not relied on as a background-execution guarantee, since OS-level background tasks are throttled unpredictably. Batched sends; the server returns a per-item result; failures back off exponentially.

### 11.4 Conflict resolution
Personal records are single-writer — server-authoritative `updated_at`, last-write-wins. Crowd claims are genuinely multi-writer, resolved via unique `(student_id, claim)` rows and a distinct-row count, for the same idempotency reason as 11.2.

### 11.5 Undo
Undone while `pending`: delete the outbox row outright. Undone while `syncing`: queue a fresh compensating mutation rather than cancel the in-flight request. Append-only; no in-place rollback needed.

### 11.6 How the two migrations plug into this
Both the legacy-to-guest migration (Section 6) and the guest-to-account migration (FR-1.6) are re-keys of existing rows, not new mechanisms — the same flush worker handles either once local rows carry the right owner key.

---

## 12. Full feature list for this build

**Migration & continuity**
- Automatic local backup before any schema change
- Timetable slot merge (split periods → `period_span`)
- One-time legacy upgrade prompt, dismissible, always reachable later
- Manual-offset preservation as a transparent historical adjustment
- Safe-failure handling — never a broken or data-losing app state

**Setup & account**
- Guest mode, unchanged from V1, plus honest account-upsell comparison screen
- Supabase account creation (email/password + Google OAuth), environment-aware for Expo Go
- Sign-in-anytime upgrade path
- Native AI photo/PDF extraction (signed-in), paste-JSON (everyone, updated prompt), manual entry (everyone)
- Share-code timetable cloning (signed-in)
- Lab Batch Divide at setup, any entry path
- Semester/exam dates, editable anytime

**Daily use**
- Today screen, tap-to-mark, full/half-day shortcuts, lab-block handling, undo, retroactive fill-in, free-form history correction

**Exceptions**
- Personal cancel/substitute (with card relabeling)/holiday
- Day Swap with per-period override precedence
- Extra Class, personal and crowd-reportable
- Generalized crowd-claim system: dynamic quorum, CR instant-quorum, universal dispute rights

**Insights**
- Phase-aware bunk meter / per-subject risk ranking
- Worst-case burndown date
- Threshold rings, calendar heatmap

**Compliance (personal use only)**
- Evidence tagging with photo attachment
- Auto-drafted condonation letters

**Notifications**
- Local evening nudge, local per-class reminders

**Infrastructure & security**
- Full offline-first sync, guest and signed-in alike
- Multi-program regulation engine with legacy compatibility mapping
- JWT-based backend auth (asymmetric verification via JWKS)
- Row Level Security on every table
- Light and dark mode (V1 already has dark)
- Open-source-ready, monorepo structure

---

## 13. Out of scope
Unchanged from the earlier design phase: no automated login/scraping of any official JNTUH system, no background GPS geofencing, no official-portal export/reconciliation (FR-11). Deferred: a WhatsApp/Telegram conversational agent, weather/long-weekend nudges, opt-in buddy accountability, home-screen widget, microcopy pass.

---

## 14. Security requirements
1. **RLS mandatory on every new table**, enabled explicitly — not automatic for tables created via migration, and a table without it is fully exposed to anyone holding the anon key. A January 2026 incident exposed 1.5 million records from a different app for exactly this reason.
2. Every policy scoped with `auth.uid()` (or the guest `local_user_id` equivalent, validated server-side where it touches shared data).
3. The `service_role` key never reaches client code, under any circumstance.
4. Passwords are handled entirely by Supabase Auth, never by this app's own code.
5. All traffic HTTPS-only; VLM keys live only in the FastAPI backend's environment.
6. No secret is ever committed — `.env.example` with placeholder names only, real values git-ignored and stored in EAS/host secret managers.
7. FastAPI verifies every account-gated request via JWKS (Section 10), never a hardcoded legacy secret.
8. Dependency scanning (Dependabot) enabled from first commit.
9. **Migration-specific**: the pre-migration backup (Section 6.1) is itself local, private app storage — not uploaded anywhere — and should be purged automatically after a successful migration has been confirmed stable for some reasonable period, so it doesn't become a second, stale copy of a user's data sitting around indefinitely.

---

## 15. Open risks and pre-launch validation items
1. Confirm the years 4–5 IDP per-subject rule applies to all subjects as written, vs. a PG-only interpretation in local practice.
2. Validate the B.Tech-regular aggregate rule against the full primary regulation document.
3. Decide hosting provider for the FastAPI/PostgreSQL backend.
4. Confirm whether MBA/MCA programs are added before or after this build's launch.
5. Confirm current Supabase and EAS free/hobby-tier limits before assuming zero infrastructure cost.
6. Confirm the exact current API name for Expo Go environment detection against the Expo SDK version in use.
7. **Run the full migration (Sections 6.1–6.6) against a real copy of production data before shipping to any real user**, not just synthetic test data — the merge algorithm (6.2) and offset conversion (6.5) both deserve validation against actual edge cases in what's already out there, not just the happy path.

---

## 16. Open source
Repository is public (monorepo, Section 3.3), MIT-licensed (carried over from V1), with friends contributing via pull requests. Security (Section 14) treats "the code is public" as a given from day one.

---

## 17. Future work
A conversational agent reachable via WhatsApp or Telegram, answering questions like "am I safe to skip today?" without opening the app — would consume the same insight-engine outputs (Section 5, FR-5) through a new channel, once this build is stable.

---

## 18. Branding & assets
The app icon (a tilted rounded pill split by a diagonal threshold line, red-to-amber gradient) is already rendered to PNG and shipping in V1 — no further work needed here beyond what's already live.

---

## Appendix A — Worst-case burndown
See FR-5.4.

## Appendix B — Timetable extraction prompt (updated — merges multi-period blocks, unlike V1's shipped prompt)
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
    # legacy_slots: rows from V1's TimetableSlots, one per period
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
        is_lab=False,   # confirmed/corrected by the user if Lab Batch Divide
                         # or manual review flags it otherwise
    )
```
