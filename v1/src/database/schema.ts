/**
 * The 75 Project — Database Schema
 * SQLite table definitions matching SRS §5 Data Model
 */

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS UserPreferences (
    id INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
    calculation_mode TEXT NOT NULL DEFAULT 'aggregate' CHECK(calculation_mode IN ('aggregate', 'per_subject')),
    semester_start TEXT NOT NULL DEFAULT '',
    semester_end TEXT NOT NULL DEFAULT '',
    exam_start TEXT,
    exam_end TEXT,
    onboarding_complete INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS PeriodTimings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_num INTEGER NOT NULL UNIQUE,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'theory' CHECK(type IN ('theory', 'lab')),
    manual_held_offset INTEGER NOT NULL DEFAULT 0,
    manual_attended_offset INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS TimetableSlots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
    period_num INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS DailyExceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    period_num INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('absent', 'cancelled')),
    UNIQUE(date, period_num, subject_id),
    FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ExamPeriods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL
  );
`;

export const SEED_PREFERENCES_SQL = `
  INSERT OR IGNORE INTO UserPreferences (id, calculation_mode, semester_start, semester_end, onboarding_complete)
  VALUES (1, 'aggregate', '', '', 0);
`;
