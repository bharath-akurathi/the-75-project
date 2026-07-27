/**
 * The 75 Project — Local SQLite Schema
 *
 * Mirrors the Supabase schema identically to ensure that outbox re-keying
 * (guest to signed-in) is just a column update, not a restructure.
 */

export const INITIALIZE_DB_SQL = `
  PRAGMA foreign_keys = ON;

  -- 1. Regulation Profiles
  CREATE TABLE IF NOT EXISTS regulation_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL,
      full_eligibility_threshold REAL NOT NULL DEFAULT 0.75,
      condonable_floor REAL NOT NULL DEFAULT 0.65,
      at_risk_unit TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- 2. Students
  CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      auth_id TEXT,
      local_user_id TEXT,
      year INTEGER NOT NULL,
      program_type TEXT NOT NULL,
      branch TEXT NOT NULL,
      pg_specialization TEXT,
      regulation_profile_id TEXT NOT NULL REFERENCES regulation_profiles(id),
      current_semester_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- 3. Semesters
  CREATE TABLE IF NOT EXISTS semesters (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_number INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      exam_start_date TEXT,
      exam_end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      regulation_profile_id TEXT NOT NULL REFERENCES regulation_profiles(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- 4. Subjects
  CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      type TEXT NOT NULL,
      credits INTEGER,
      is_lab INTEGER NOT NULL DEFAULT 0,
      is_optional INTEGER NOT NULL DEFAULT 0,
      min_attendance_override REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- 5. Timetable Slots
  CREATE TABLE IF NOT EXISTS timetable_slots (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      day_or_day_order TEXT NOT NULL,
      period INTEGER NOT NULL,
      start_time TEXT,
      end_time TEXT,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      room TEXT,
      is_lab INTEGER NOT NULL DEFAULT 0,
      batch TEXT,
      period_span INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- 6. Daily Overrides
  CREATE TABLE IF NOT EXISTS daily_overrides (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      period INTEGER,
      status TEXT NOT NULL,
      original_subject_id TEXT REFERENCES subjects(id),
      replacement_subject_id TEXT REFERENCES subjects(id),
      source_day_key TEXT,
      source TEXT NOT NULL DEFAULT 'personal',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- 7. Attendance Records
  CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      period INTEGER NOT NULL,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'present',
      evidence_tag TEXT,
      evidence_attachment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (student_id, date, period)
  );

  -- 8. Academic Calendar
  CREATE TABLE IF NOT EXISTS academic_calendar (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- 9. Class Groups
  CREATE TABLE IF NOT EXISTS class_groups (
      id TEXT PRIMARY KEY,
      name TEXT,
      share_code TEXT NOT NULL UNIQUE,
      creator_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- 10. Class Group Members
  CREATE TABLE IF NOT EXISTS class_group_members (
      id TEXT PRIMARY KEY,
      class_group_id TEXT NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      UNIQUE (class_group_id, student_id)
  );

  -- 11. Crowd Reports
  CREATE TABLE IF NOT EXISTS crowd_reports (
      id TEXT PRIMARY KEY,
      class_group_id TEXT NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      period INTEGER,
      claim_type TEXT NOT NULL,
      claim_payload TEXT NOT NULL DEFAULT '{}',
      stance TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (class_group_id, student_id, date, period, claim_type)
  );

  -- 12. Pending Sync (Outbox)
  CREATE TABLE IF NOT EXISTS pending_sync (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
  CREATE INDEX IF NOT EXISTS idx_pending_sync_status ON pending_sync(sync_status);
`;

export const SEED_PROFILES_SQL = `
  INSERT OR IGNORE INTO regulation_profiles (id, name, mode, full_eligibility_threshold, condonable_floor, at_risk_unit, created_at, updated_at)
  VALUES
      ('d6b412b1-6a27-4a0b-9df2-51a8bc2e9d29', 'btech_regular', 'aggregate', 0.75, 0.65, 'semester', datetime('now'), datetime('now')),
      ('c8d48e1a-9f44-4b95-a226-7bc2b8813a34', 'mtech_regular', 'per_subject', 0.75, 0.65, 'subject', datetime('now'), datetime('now')),
      ('b9f36a4b-8d54-4a2a-89a1-7c9c0c3b1e3e', 'idp_years_1_3', 'aggregate', 0.75, 0.65, 'semester', datetime('now'), datetime('now')),
      ('a2f57b6c-3e2a-4c8d-9b1b-8c8a1d2e5f3c', 'idp_years_4_5', 'per_subject', 0.75, 0.65, 'subject', datetime('now'), datetime('now'));
`;
