
# Software Requirements Specification
## The 75 Project (V1 - Local MVP)

**Version:** 1.0 — Local MVP  
**Date:** July 2026  
**Platform:** React Native (Expo Go compatible)  
**Architecture:** 100% Offline / Client-side only  
**Local Storage:** SQLite (on-device)  
**License:** MIT License  
**Status:** Ready for Implementation  

---

## 1. Introduction

### 1.1 Purpose
This document specifies the V1 requirements for The 75 Project, an unofficial mobile app that lets JNTUH students track attendance by logging absences rather than presences. 

### 1.2 Scope
V1 ships strictly the core tracking loop. It supports a "Bring Your Own LLM" JSON-paste workflow for timetable creation, manual timetable editing, daily attendance marking, and the core 75% mathematical calculation. All data lives exclusively on the user's local device.

### 1.3 Definitions and Acronyms
* **IDP:** Integrated Dual Program (5-year B.Tech + M.Tech).
* **Regulation Profile:** The rule set determining aggregate vs. per-subject attendance thresholds.
* **Held Period:** A scheduled class period that actually took place.
* **BYO-LLM:** Bring Your Own LLM (user utilizes an external AI to parse their timetable).

---

## 2. Overall Description

### 2.1 Product Perspective
A standalone, non-official tool built by a student, for students. It requires no login, no internet connection for daily use, and stores absolutely zero data in the cloud.

### 2.2 Operating Environment
* **Client:** React Native via Expo (Android minimum API 24 / Android 7.0; iOS minimum version iOS 15).
* **Local Storage:** SQLite on-device database.

---

## 3. The Regulation Profile System

To accurately reflect university rules, the app calculates risk based on a universal toggle selected by the user during onboarding.

* **Aggregate Mode (B.Tech / Early IDP):** Calculates 75% across ALL subjects combined. The unit at risk is the entire semester.
* **Per-Subject Mode (M.Tech / Late IDP):** Calculates 75% individually for each subject. The unit at risk is the specific subject.

### 3.1 Core Computation Logic

```python
if profile.mode == "aggregate":
    eligible = (sum(attended) / sum(held)) >= 0.75
elif profile.mode == "per_subject":
    for s in subjects:
        eligible[s] = (attended[s] / held[s]) >= 0.75

```

---

## 4. Functional Requirements (V1)

### 4.1 FR-1 — Zero-Friction Onboarding

* **FR-1.1:** The app launches directly into the local experience. No sign-up, login, or splash screens blocking entry.
* **FR-1.2:** The app collects the student's calculation mode (Aggregate or Per-Subject) via a simple toggle on first launch.

### 4.2 FR-2 — Timetable Setup (Paste-JSON & Manual)

* **FR-2.1 Paste-JSON Workflow:** The app provides a strict, copy-ready prompt. The user pastes this prompt and a photo of their timetable into an external LLM (ChatGPT, Gemini, Claude). The user pastes the resulting JSON back into the app to instantly generate the timetable.
* **FR-2.2 Manual Entry:** A first-class, fully editable weekly grid where a student can manually add a day, period slot, and subject name.
* **FR-2.3 Total Editability:** The user can add a new subject, delete a lab, or rename a class directly from the settings menu at any time.

### 4.3 FR-3 — Daily Marking Loop

* **FR-3.1 "Today" Dashboard:** Every day, the app reads the local SQLite database and displays today's scheduled classes as chronological cards.
* **FR-3.2 Default Present:** All scheduled classes are automatically assumed "Present" without user intervention.
* **FR-3.3 One-Tap Absent:** The user taps a specific period card to toggle it to "Absent." This instantly logs the date, period, and subject into the local database as an exception.
* **FR-3.4 Cancelled Classes:** A user can long-press or swipe a card to mark it as "Cancelled," completely removing it from the held denominator for that day.
* **FR-3.5 Unlimited Exam Phases:** A user can define multiple date ranges as exam phases. During these periods, all attendance tracking and timetable assumptions are automatically paused and safely subtracted from the total "classes held" count.

### 4.4 FR-4 — Insight Engine (The Bunk Meter)

* **FR-4.1 Live Calculations:** The app calculates the exact number of classes held based on the elapsed days in the timetable minus any marked cancellations.
* **FR-4.2 Safe-to-Skip Metric:** The home screen displays the live buffer count using the formula $\lfloor \frac{\text{attended}}{0.75} - \text{held} \rfloor$.
* **FR-4.3 Display Logic:** In Aggregate mode, this is displayed as one primary, central number. In Per-Subject mode, it is rendered as a ranked list showing the subjects closest to the danger zone.

---

## 5. Data Model (SQLite Schema)

| Table | Columns | Purpose |
| --- | --- | --- |
| **UserPreferences** | `id`, `calculation_mode`, `semester_start`, `semester_end`, `onboarding_complete` | Stores app-wide settings. |
| **ExamPeriods** | `id`, `name`, `start_date`, `end_date` | Date ranges where attendance tracking is paused. |
| **Subjects** | `id`, `name`, `type`, `manual_held_offset`, `manual_attended_offset` | The master list of subjects, with overrides for real-world discrepancies. |
| **TimetableSlots** | `id`, `day_of_week`, `period_num`, `subject_id` | The static weekly template. |
| **DailyExceptions** | `id`, `date`, `period_num`, `subject_id`, `status` | Logs deviations: Absent or Cancelled. |
| **PeriodTimings** | `period_num`, `start_time`, `end_time` | Dynamic timestamps for daily periods. |

---

## 6. Non-Functional Requirements

* **Performance:** Zero loading spinners. SQLite writes and UI updates must happen instantly.
* **Privacy:** 100% on-device architecture. Absolutely no telemetry or remote database connections permitted.
* **Appearance:** Sleek, modern UI with Dark Mode support. Red colors are reserved exclusively for severe attendance warnings.
* **App Icon:** Tilted rounded pill split by a diagonal threshold line (rendered in PNG).

---

## Appendix A — Timetable Extraction Prompt

*This text is displayed in the app for the user to copy/paste into their LLM of choice.*

```text
You are extracting a weekly class timetable from an image.
Return ONLY valid JSON, no markdown, no commentary, in this schema:

{
  "slots": [
    {
      "day": "Monday",
      "period_number": 1,
      "subject_raw": "exactly as written on the timetable"
    }
  ]
}

Rules:
- A cell spanning multiple periods must be split into separate, consecutive slots (e.g., if a lab is 3 periods long, create 3 separate JSON objects for period 1, 2, and 3).
- Never invent a subject or period that isn't visible in the source.
