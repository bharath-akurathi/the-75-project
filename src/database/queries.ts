/**
 * The 75 Project — Database Query Functions
 * All CRUD operations using expo-sqlite async API
 */

import type { SQLiteDatabase } from 'expo-sqlite';

// ============================================================
// Types
// ============================================================

export interface UserPreferences {
  id: number;
  calculation_mode: 'aggregate' | 'per_subject';
  semester_start: string;
  semester_end: string;
  exam_start: string | null;
  exam_end: string | null;
  onboarding_complete: number;
}

export interface PeriodTiming {
  id: number;
  period_num: number;
  start_time: string;
  end_time: string;
}

export interface Subject {
  id: number;
  name: string;
  type: 'theory' | 'lab';
  manual_held_offset: number;
  manual_attended_offset: number;
}

export interface TimetableSlot {
  id: number;
  day_of_week: string;
  period_num: number;
  subject_id: number;
}

export interface TimetableSlotWithSubject extends TimetableSlot {
  subject_name: string;
  subject_type: string;
  start_time?: string;
  end_time?: string;
}

export interface DailyException {
  id: number;
  date: string;
  period_num: number;
  subject_id: number;
  status: 'absent' | 'cancelled';
}

export interface ExamPeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

// ============================================================
// Preferences
// ============================================================

export async function getPreferences(db: SQLiteDatabase): Promise<UserPreferences> {
  const result = await db.getFirstAsync<UserPreferences>(
    'SELECT * FROM UserPreferences WHERE id = 1;'
  );
  return result ?? {
    id: 1,
    calculation_mode: 'aggregate',
    semester_start: '',
    semester_end: '',
    exam_start: null,
    exam_end: null,
    onboarding_complete: 0,
  };
}

export async function setCalculationMode(
  db: SQLiteDatabase,
  mode: 'aggregate' | 'per_subject'
): Promise<void> {
  await db.runAsync(
    'UPDATE UserPreferences SET calculation_mode = ? WHERE id = 1;',
    [mode]
  );
}

export async function setSemesterStart(
  db: SQLiteDatabase,
  date: string
): Promise<void> {
  await db.runAsync(
    'UPDATE UserPreferences SET semester_start = ? WHERE id = 1;',
    [date]
  );
}

export async function setSemesterEnd(
  db: SQLiteDatabase,
  date: string
): Promise<void> {
  await db.runAsync(
    'UPDATE UserPreferences SET semester_end = ? WHERE id = 1;',
    [date]
  );
}

export async function setExamDates(
  db: SQLiteDatabase,
  start: string | null,
  end: string | null
): Promise<void> {
  await db.runAsync(
    'UPDATE UserPreferences SET exam_start = ?, exam_end = ? WHERE id = 1;',
    [start, end]
  );
}

export async function setOnboardingComplete(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    'UPDATE UserPreferences SET onboarding_complete = 1 WHERE id = 1;'
  );
}

// ============================================================
// Period Timings
// ============================================================

export async function getAllPeriodTimings(db: SQLiteDatabase): Promise<PeriodTiming[]> {
  return db.getAllAsync<PeriodTiming>(
    'SELECT * FROM PeriodTimings ORDER BY period_num ASC;'
  );
}

export async function setPeriodTiming(
  db: SQLiteDatabase,
  periodNum: number,
  startTime: string,
  endTime: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO PeriodTimings (period_num, start_time, end_time)
     VALUES (?, ?, ?)
     ON CONFLICT(period_num) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time;`,
    [periodNum, startTime, endTime]
  );
}

export async function bulkInsertPeriodTimings(
  db: SQLiteDatabase,
  timings: { period_num: number; start_time: string; end_time: string }[]
): Promise<void> {
  for (const t of timings) {
    await setPeriodTiming(db, t.period_num, t.start_time, t.end_time);
  }
}

// ============================================================
// Subjects
// ============================================================

export async function getAllSubjects(db: SQLiteDatabase): Promise<Subject[]> {
  return db.getAllAsync<Subject>('SELECT * FROM Subjects ORDER BY name ASC;');
}

export async function addSubject(
  db: SQLiteDatabase,
  name: string,
  type: 'theory' | 'lab' = 'theory'
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO Subjects (name, type) VALUES (?, ?);',
    [name, type]
  );
  return result.lastInsertRowId;
}

export async function renameSubject(
  db: SQLiteDatabase,
  id: number,
  newName: string
): Promise<void> {
  await db.runAsync('UPDATE Subjects SET name = ? WHERE id = ?;', [newName, id]);
}

export async function deleteSubject(db: SQLiteDatabase, id: number): Promise<void> {
  // Cascade will handle TimetableSlots and DailyExceptions
  await db.runAsync('DELETE FROM Subjects WHERE id = ?;', [id]);
}

export async function updateSubjectOffsets(
  db: SQLiteDatabase,
  id: number,
  heldOffset: number,
  attendedOffset: number
): Promise<void> {
  await db.runAsync(
    'UPDATE Subjects SET manual_held_offset = ?, manual_attended_offset = ? WHERE id = ?;',
    [heldOffset, attendedOffset, id]
  );
}

// ============================================================
// Timetable Slots
// ============================================================

export async function getAllSlots(db: SQLiteDatabase): Promise<TimetableSlotWithSubject[]> {
  return db.getAllAsync<TimetableSlotWithSubject>(
    `SELECT ts.*, s.name as subject_name, s.type as subject_type,
            pt.start_time, pt.end_time
     FROM TimetableSlots ts
     JOIN Subjects s ON ts.subject_id = s.id
     LEFT JOIN PeriodTimings pt ON ts.period_num = pt.period_num
     ORDER BY ts.day_of_week, ts.period_num;`
  );
}

export async function getSlotsForDay(
  db: SQLiteDatabase,
  dayOfWeek: string
): Promise<TimetableSlotWithSubject[]> {
  return db.getAllAsync<TimetableSlotWithSubject>(
    `SELECT ts.*, s.name as subject_name, s.type as subject_type,
            pt.start_time, pt.end_time
     FROM TimetableSlots ts
     JOIN Subjects s ON ts.subject_id = s.id
     LEFT JOIN PeriodTimings pt ON ts.period_num = pt.period_num
     WHERE ts.day_of_week = ?
     ORDER BY ts.period_num;`,
    [dayOfWeek]
  );
}

export async function addSlot(
  db: SQLiteDatabase,
  dayOfWeek: string,
  periodNum: number,
  subjectId: number
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO TimetableSlots (day_of_week, period_num, subject_id) VALUES (?, ?, ?);',
    [dayOfWeek, periodNum, subjectId]
  );
  return result.lastInsertRowId;
}

export async function deleteSlot(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM TimetableSlots WHERE id = ?;', [id]);
}

export async function deleteSlotByDayAndPeriod(
  db: SQLiteDatabase,
  dayOfWeek: string,
  periodNum: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM TimetableSlots WHERE day_of_week = ? AND period_num = ?;',
    [dayOfWeek, periodNum]
  );
}

export async function bulkInsertSlots(
  db: SQLiteDatabase,
  slots: { day_of_week: string; period_num: number; subject_id: number }[]
): Promise<void> {
  for (const slot of slots) {
    await addSlot(db, slot.day_of_week, slot.period_num, slot.subject_id);
  }
}

// ============================================================
// Daily Exceptions
// ============================================================

export async function getExceptionsForDate(
  db: SQLiteDatabase,
  date: string
): Promise<DailyException[]> {
  return db.getAllAsync<DailyException>(
    'SELECT * FROM DailyExceptions WHERE date = ?;',
    [date]
  );
}

export async function setException(
  db: SQLiteDatabase,
  date: string,
  periodNum: number,
  subjectId: number,
  status: 'absent' | 'cancelled'
): Promise<void> {
  await db.runAsync(
    `INSERT INTO DailyExceptions (date, period_num, subject_id, status)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date, period_num, subject_id) DO UPDATE SET status = excluded.status;`,
    [date, periodNum, subjectId, status]
  );
}

export async function removeException(
  db: SQLiteDatabase,
  date: string,
  periodNum: number,
  subjectId: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM DailyExceptions WHERE date = ? AND period_num = ? AND subject_id = ?;',
    [date, periodNum, subjectId]
  );
}

export async function getExceptionsBetween(
  db: SQLiteDatabase,
  startDate: string,
  endDate: string
): Promise<DailyException[]> {
  return db.getAllAsync<DailyException>(
    'SELECT * FROM DailyExceptions WHERE date >= ? AND date <= ? ORDER BY date;',
    [startDate, endDate]
  );
}

// ============================================================
// Reset
// ============================================================

export async function resetAllData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM DailyExceptions;
    DELETE FROM TimetableSlots;
    DELETE FROM Subjects;
    DELETE FROM PeriodTimings;
    DELETE FROM ExamPeriods;
    UPDATE UserPreferences SET calculation_mode = 'aggregate', semester_start = '', semester_end = '', exam_start = NULL, exam_end = NULL, onboarding_complete = 0 WHERE id = 1;
  `);
}

// ============================================================
// Exam Periods
// ============================================================

export async function getExamPeriods(db: SQLiteDatabase): Promise<ExamPeriod[]> {
  return db.getAllAsync<ExamPeriod>('SELECT * FROM ExamPeriods ORDER BY start_date;');
}

export async function addExamPeriod(
  db: SQLiteDatabase,
  name: string,
  startDate: string,
  endDate: string
): Promise<void> {
  await db.runAsync(
    'INSERT INTO ExamPeriods (name, start_date, end_date) VALUES (?, ?, ?);',
    [name, startDate, endDate]
  );
}

export async function deleteExamPeriod(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM ExamPeriods WHERE id = ?;', [id]);
}
