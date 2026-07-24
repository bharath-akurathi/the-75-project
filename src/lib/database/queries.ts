import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// Types adapted for V2 schema (UUIDs instead of numbers)
export interface UserPreferences {
  id: string; // student.id
  calculation_mode: 'aggregate' | 'per_subject';
  semester_start: string;
  semester_end: string;
  exam_start: string | null;
  exam_end: string | null;
  onboarding_complete: number;
}

export interface PeriodTiming {
  id: string;
  period_num: number;
  start_time: string;
  end_time: string;
}

export interface Subject {
  id: string;
  name: string;
  type: 'theory' | 'lab';
  manual_held_offset: number;
  manual_attended_offset: number;
}

export interface TimetableSlot {
  id: string;
  day_of_week: string;
  period_num: number;
  subject_id: string;
}

export interface TimetableSlotWithSubject extends TimetableSlot {
  subject_name: string;
  subject_type: string;
  start_time?: string;
  end_time?: string;
}

export interface DailyException {
  id: string;
  date: string;
  period_num: number;
  subject_id: string;
  status: 'present' | 'absent' | 'cancelled';
}

export interface ExamPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

/**
 * Enqueue a mutation to pending_sync so it uploads to Supabase in the background
 */
async function enqueueSync(db: SQLiteDatabase, studentId: string, entityType: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
  const syncId = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO pending_sync (id, student_id, entity_type, operation, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [syncId, studentId, entityType, operation, JSON.stringify(payload)]
  );
}

/**
 * Get the active student ID (assumes single-user local device usage for MVP)
 */
export async function getActiveStudentId(db: SQLiteDatabase): Promise<string | null> {
  const result = await db.getFirstAsync<{ id: string }>('SELECT id FROM students ORDER BY created_at DESC LIMIT 1');
  return result?.id || null;
}

/**
 * Get the active semester ID
 */
export async function getActiveSemesterId(db: SQLiteDatabase, studentId: string): Promise<string | null> {
  const result = await db.getFirstAsync<{ id: string }>('SELECT id FROM semesters WHERE student_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1', [studentId]);
  return result?.id || null;
}

// ----------------------------------------------------------------------------
// Layout / Init Queries
// ----------------------------------------------------------------------------

export async function checkOnboardingComplete(db: SQLiteDatabase, localUserId: string | null, authUid: string | undefined): Promise<boolean> {
  const studentId = await getActiveStudentId(db);
  if (!studentId) return false;
  
  // Check if current_semester_id is set. It is only set at the very end of onboarding.
  const student = await db.getFirstAsync<{ current_semester_id: string | null }>('SELECT current_semester_id FROM students WHERE id = ?', [studentId]);
  return !!student?.current_semester_id;
}

// ----------------------------------------------------------------------------
// Preferences (V1 mapped to Students + Semesters)
// ----------------------------------------------------------------------------

export async function getPreferences(db: SQLiteDatabase): Promise<UserPreferences> {
  const studentId = await getActiveStudentId(db);
  if (!studentId) {
    return {
      id: '',
      calculation_mode: 'aggregate',
      semester_start: '',
      semester_end: '',
      exam_start: null,
      exam_end: null,
      onboarding_complete: 0,
    };
  }

  // Get student + profile
  const student = await db.getFirstAsync<any>(`
    SELECT s.id, rp.mode
    FROM students s
    JOIN regulation_profiles rp ON s.regulation_profile_id = rp.id
    WHERE s.id = ?
  `, [studentId]);

  // Get active semester
  const semester = await db.getFirstAsync<any>(`
    SELECT start_date, end_date, exam_start_date, exam_end_date
    FROM semesters
    WHERE student_id = ? AND is_active = 1
  `, [studentId]);

  return {
    id: studentId,
    calculation_mode: student?.mode || 'aggregate',
    semester_start: semester?.start_date || '',
    semester_end: semester?.end_date || '',
    exam_start: semester?.exam_start_date || null,
    exam_end: semester?.exam_end_date || null,
    onboarding_complete: semester ? 1 : 0,
  };
}

export async function setCalculationMode(db: SQLiteDatabase, mode: 'aggregate' | 'per_subject'): Promise<void> {
  // In V2, calculation mode is tied to the regulation profile. 
  // We'll create or update the student profile accordingly.
  // For MVP, map to the default profile that matches the mode.
  const profileId = mode === 'aggregate' ? 'd6b412b1-6a27-4a0b-9df2-51a8bc2e9d29' : 'c8d48e1a-9f44-4b95-a226-7bc2b8813a34'; // IDP vs BTech standard profiles
  
  const studentId = await getActiveStudentId(db);
  if (studentId) {
    await db.runAsync(`UPDATE students SET regulation_profile_id = ?, updated_at = datetime('now') WHERE id = ?`, [profileId, studentId]);
    await enqueueSync(db, studentId, 'students', 'UPDATE', { id: studentId, regulation_profile_id: profileId });
  } else {
    // Create new student if missing (assuming Guest flow didn't create one yet)
    // Actually, V1 mode screen expects to just set it. We will create a dummy student here.
    const newStudentId = Crypto.randomUUID();
    await db.runAsync(`
      INSERT INTO students (id, year, program_type, branch, regulation_profile_id, created_at, updated_at)
      VALUES (?, 1, 'B.Tech', 'CSE', ?, datetime('now'), datetime('now'))
    `, [newStudentId, profileId]);
    await enqueueSync(db, newStudentId, 'students', 'INSERT', {
      id: newStudentId, year: 1, program_type: 'B.Tech', branch: 'CSE', regulation_profile_id: profileId
    });
  }
}

export async function setSemesterStart(db: SQLiteDatabase, date: string): Promise<void> {
  const studentId = await getActiveStudentId(db);
  if (!studentId) return;
  
  const semId = await getActiveSemesterId(db, studentId);
  if (semId) {
    await db.runAsync(`UPDATE semesters SET start_date = ?, updated_at = datetime('now') WHERE id = ?`, [date, semId]);
    await enqueueSync(db, studentId, 'semesters', 'UPDATE', { id: semId, start_date: date });
  } else {
    const newSemId = Crypto.randomUUID();
    await db.runAsync(`
      INSERT INTO semesters (id, student_id, semester_number, start_date, end_date, is_active, regulation_profile_id, created_at, updated_at)
      SELECT ?, ?, 1, ?, '', 1, regulation_profile_id, datetime('now'), datetime('now')
      FROM students WHERE id = ?
    `, [newSemId, studentId, date, studentId]);
    // enqueue is tricky here without full payload, but we'll sync the whole row in syncWorker anyway
    await enqueueSync(db, studentId, 'semesters', 'INSERT', { id: newSemId, student_id: studentId, start_date: date, end_date: '', semester_number: 1, is_active: 1 });
  }
}

export async function setSemesterEnd(db: SQLiteDatabase, date: string): Promise<void> {
  const studentId = await getActiveStudentId(db);
  if (!studentId) return;
  const semId = await getActiveSemesterId(db, studentId);
  if (semId) {
    await db.runAsync(`UPDATE semesters SET end_date = ?, updated_at = datetime('now') WHERE id = ?`, [date, semId]);
    await enqueueSync(db, studentId, 'semesters', 'UPDATE', { id: semId, end_date: date });
  }
}

export async function setOnboardingComplete(db: SQLiteDatabase): Promise<void> {
  const studentId = await getActiveStudentId(db);
  if (!studentId) return;
  const semId = await getActiveSemesterId(db, studentId);
  if (semId) {
    await db.runAsync(`UPDATE students SET current_semester_id = ?, updated_at = datetime('now') WHERE id = ?`, [semId, studentId]);
    await enqueueSync(db, studentId, 'students', 'UPDATE', { id: studentId, current_semester_id: semId });
  }
}

// ----------------------------------------------------------------------------
// Subjects (V2 subjects table)
// ----------------------------------------------------------------------------

export async function getAllSubjects(db: SQLiteDatabase): Promise<Subject[]> {
  const studentId = await getActiveStudentId(db);
  if (!studentId) return [];
  const semId = await getActiveSemesterId(db, studentId);
  if (!semId) return [];

  const subjects = await db.getAllAsync<any>(
    'SELECT * FROM subjects WHERE student_id = ? AND semester_id = ? ORDER BY name ASC',
    [studentId, semId]
  );

  return subjects.map(s => ({
    id: s.id,
    name: s.name,
    type: s.is_lab ? 'lab' : 'theory',
    manual_held_offset: 0,
    manual_attended_offset: 0,
  }));
}

export async function addSubject(db: SQLiteDatabase, name: string, type: 'theory' | 'lab' = 'theory'): Promise<string> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  const newId = Crypto.randomUUID();

  const payload = {
    id: newId,
    student_id: studentId,
    semester_id: semId,
    name,
    type: type,
    is_lab: type === 'lab' ? 1 : 0
  };

  await db.runAsync(
    `INSERT INTO subjects (id, student_id, semester_id, name, type, is_lab, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [newId, studentId, semId, name, type, payload.is_lab]
  );
  await enqueueSync(db, studentId!, 'subjects', 'INSERT', payload);

  return newId;
}

export async function renameSubject(db: SQLiteDatabase, id: string, newName: string): Promise<void> {
  const studentId = await getActiveStudentId(db);
  await db.runAsync(`UPDATE subjects SET name = ?, updated_at = datetime('now') WHERE id = ?`, [newName, id]);
  await enqueueSync(db, studentId!, 'subjects', 'UPDATE', { id, name: newName });
}

export async function deleteSubject(db: SQLiteDatabase, id: string): Promise<void> {
  const studentId = await getActiveStudentId(db);
  await db.runAsync('DELETE FROM subjects WHERE id = ?', [id]);
  await enqueueSync(db, studentId!, 'subjects', 'DELETE', { id });
}

// ----------------------------------------------------------------------------
// Timetable Slots (V2 timetable_slots)
// ----------------------------------------------------------------------------

export async function getSlotsForDay(db: SQLiteDatabase, dayOfWeek: string): Promise<TimetableSlotWithSubject[]> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  
  if (!studentId || !semId) return [];

  const slots = await db.getAllAsync<any>(`
    SELECT ts.id, ts.day_or_day_order, ts.period, ts.subject_id, ts.start_time, ts.end_time,
           s.name as subject_name, s.type as subject_type
    FROM timetable_slots ts
    JOIN subjects s ON ts.subject_id = s.id
    WHERE ts.student_id = ? AND ts.semester_id = ? AND ts.day_or_day_order = ?
    ORDER BY ts.period ASC
  `, [studentId, semId, dayOfWeek]);

  return slots.map(s => ({
    id: s.id,
    day_of_week: s.day_or_day_order,
    period_num: s.period,
    subject_id: s.subject_id,
    subject_name: s.subject_name,
    subject_type: s.subject_type,
    start_time: s.start_time,
    end_time: s.end_time,
  }));
}

export async function addSlot(db: SQLiteDatabase, dayOfWeek: string, periodNum: number, subjectId: string): Promise<string> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  const newId = Crypto.randomUUID();

  const payload = {
    id: newId,
    student_id: studentId,
    semester_id: semId,
    day_or_day_order: dayOfWeek,
    period: periodNum,
    subject_id: subjectId,
  };

  await db.runAsync(
    `INSERT INTO timetable_slots (id, student_id, semester_id, day_or_day_order, period, subject_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [newId, studentId, semId, dayOfWeek, periodNum, subjectId]
  );
  await enqueueSync(db, studentId!, 'timetable_slots', 'INSERT', payload);

  return newId;
}

export async function deleteSlot(db: SQLiteDatabase, id: string): Promise<void> {
  const studentId = await getActiveStudentId(db);
  await db.runAsync('DELETE FROM timetable_slots WHERE id = ?', [id]);
  await enqueueSync(db, studentId!, 'timetable_slots', 'DELETE', { id });
}

export async function deleteSlotByDayAndPeriod(db: SQLiteDatabase, dayOfWeek: string, periodNum: number): Promise<void> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  
  const slot = await db.getFirstAsync<{id: string}>('SELECT id FROM timetable_slots WHERE student_id = ? AND semester_id = ? AND day_or_day_order = ? AND period = ?', [studentId, semId, dayOfWeek, periodNum]);
  if (slot) {
    await db.runAsync('DELETE FROM timetable_slots WHERE id = ?', [slot.id]);
    await enqueueSync(db, studentId!, 'timetable_slots', 'DELETE', { id: slot.id });
  }
}

export async function bulkInsertSlots(db: SQLiteDatabase, slots: { day_of_week: string; period_num: number; subject_id: string }[]): Promise<void> {
  for (const slot of slots) {
    await addSlot(db, slot.day_of_week, slot.period_num, slot.subject_id);
  }
}

// ----------------------------------------------------------------------------
// Daily Exceptions (V2 Attendance / Overrides)
// ----------------------------------------------------------------------------

export async function getExceptionsForDate(db: SQLiteDatabase, date: string): Promise<DailyException[]> {
  const studentId = await getActiveStudentId(db);
  if (!studentId) return [];
  
  const semId = await getActiveSemesterId(db, studentId);
  if (!semId) return [];

  // Get absences and presents
  const records = await db.getAllAsync<any>(
    'SELECT id, period, subject_id, status FROM attendance_records WHERE student_id = ? AND semester_id = ? AND date = ?',
    [studentId, semId, date]
  );

  // Get cancellations
  const cancellations = await db.getAllAsync<any>(
    'SELECT id, period, original_subject_id as subject_id, status FROM daily_overrides WHERE student_id = ? AND semester_id = ? AND date = ? AND status = "cancelled"',
    [studentId, semId, date]
  );

  const exceptions: DailyException[] = [];
  
  records.forEach(r => exceptions.push({
    id: r.id,
    date,
    period_num: r.period,
    subject_id: r.subject_id,
    status: r.status as 'absent' | 'present' | 'cancelled'
  }));

  cancellations.forEach(c => exceptions.push({
    id: c.id,
    date,
    period_num: c.period,
    subject_id: c.subject_id,
    status: 'cancelled'
  }));

  return exceptions;
}

export async function setException(db: SQLiteDatabase, date: string, periodNum: number, subjectId: string, status: 'present' | 'absent' | 'cancelled'): Promise<void> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  
  // Clean up any existing exception for this period first to avoid conflicts
  await removeException(db, date, periodNum, subjectId);

  const newId = Crypto.randomUUID();

  if (status === 'absent' || status === 'present') {
    const payload = { id: newId, student_id: studentId, semester_id: semId, date, period: periodNum, subject_id: subjectId, status };
    await db.runAsync(
      `INSERT INTO attendance_records (id, student_id, semester_id, date, period, subject_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [newId, studentId, semId, date, periodNum, subjectId, status]
    );
    await enqueueSync(db, studentId!, 'attendance_records', 'INSERT', payload);
  } else if (status === 'cancelled') {
    const payload = { id: newId, student_id: studentId, semester_id: semId, date, period: periodNum, status: 'cancelled', original_subject_id: subjectId };
    await db.runAsync(
      `INSERT INTO daily_overrides (id, student_id, semester_id, date, period, status, original_subject_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [newId, studentId, semId, date, periodNum, status, subjectId]
    );
    await enqueueSync(db, studentId!, 'daily_overrides', 'INSERT', payload);
  }
}

export async function removeException(db: SQLiteDatabase, date: string, periodNum: number, subjectId: string): Promise<void> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);

  // Remove from attendance_records
  const absent = await db.getFirstAsync<{id: string}>('SELECT id FROM attendance_records WHERE student_id = ? AND semester_id = ? AND date = ? AND period = ?', [studentId, semId, date, periodNum]);
  if (absent) {
    await db.runAsync('DELETE FROM attendance_records WHERE id = ?', [absent.id]);
    await enqueueSync(db, studentId!, 'attendance_records', 'DELETE', { id: absent.id });
  }

  // Remove from daily_overrides
  const cancelled = await db.getFirstAsync<{id: string}>('SELECT id FROM daily_overrides WHERE student_id = ? AND semester_id = ? AND date = ? AND period = ?', [studentId, semId, date, periodNum]);
  if (cancelled) {
    await db.runAsync('DELETE FROM daily_overrides WHERE id = ?', [cancelled.id]);
    await enqueueSync(db, studentId!, 'daily_overrides', 'DELETE', { id: cancelled.id });
  }
}

export async function getExceptionsBetween(db: SQLiteDatabase, startDate: string, endDate: string): Promise<DailyException[]> {
  // Simplified for MVP calculations (not fully implemented in V2 dashboard yet)
  return [];
}

/**
 * Returns a list of dates in the past 10 days (excluding Sunday and Exam days)
 * where the student had classes but NO attendance_records exist for ANY class.
 */
export async function getUnmarkedDays(db: SQLiteDatabase): Promise<string[]> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  if (!studentId || !semId) return [];

  // past 10 days
  const unmarkedDays: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // We need to use dateHelpers for this, but we'll do simple JS dates
  for (let i = 1; i <= 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
    
    if (dayOfWeek === 'Sunday') continue;

    const dateStr = d.toISOString().split('T')[0];

    // Check if it's an exam day
    const exam = await db.getFirstAsync(
      'SELECT id FROM academic_calendar WHERE student_id = ? AND semester_id = ? AND type = "exam" AND date = ?',
      [studentId, semId, dateStr]
    );
    if (exam) continue;

    // Check if there are slots on this day
    const slots = await db.getAllAsync(
      'SELECT id FROM timetable_slots WHERE student_id = ? AND semester_id = ? AND day_or_day_order = ?',
      [studentId, semId, dayOfWeek]
    );
    if (slots.length === 0) continue;

    // Check if ANY attendance record exists for this date
    const record = await db.getFirstAsync(
      'SELECT id FROM attendance_records WHERE student_id = ? AND semester_id = ? AND date = ?',
      [studentId, semId, dateStr]
    );

    if (!record) {
      unmarkedDays.push(dateStr);
    }
  }

  return unmarkedDays.sort();
}

// ----------------------------------------------------------------------------
// Reset Data
// ----------------------------------------------------------------------------
export async function resetAllData(db: SQLiteDatabase): Promise<void> {
  const studentId = await getActiveStudentId(db);
  if (studentId) {
    await db.execAsync(`
      DELETE FROM attendance_records WHERE student_id = '${studentId}';
      DELETE FROM daily_overrides WHERE student_id = '${studentId}';
      DELETE FROM timetable_slots WHERE student_id = '${studentId}';
      DELETE FROM subjects WHERE student_id = '${studentId}';
      DELETE FROM semesters WHERE student_id = '${studentId}';
      DELETE FROM students WHERE id = '${studentId}';
    `);
  }
}

// ----------------------------------------------------------------------------
// Period Timings (V2 academic_calendar or embedded in timetable_slots)
// Note: V1 stored these globally, V2 embeds them in timetable_slots.
// For V1 UI compatibility, we will mock these or extract from timetable_slots.
// ----------------------------------------------------------------------------
export async function getAllPeriodTimings(db: SQLiteDatabase): Promise<PeriodTiming[]> {
  // Not heavily used in V2 except for UI hints. Return mock or empty for now.
  return [];
}
export async function setPeriodTiming(db: SQLiteDatabase, periodNum: number, startTime: string, endTime: string): Promise<void> {}
export async function bulkInsertPeriodTimings(db: SQLiteDatabase, timings: any[]): Promise<void> {}

// ----------------------------------------------------------------------------
// Exam Periods (V2 academic_calendar)
// ----------------------------------------------------------------------------
export async function getExamPeriods(db: SQLiteDatabase): Promise<ExamPeriod[]> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  if (!semId) return [];

  const records = await db.getAllAsync<any>(
    'SELECT id, description as name, date as start_date, date as end_date FROM academic_calendar WHERE student_id = ? AND semester_id = ? AND type = "exam"',
    [studentId, semId]
  );
  return records;
}

export async function addExamPeriod(db: SQLiteDatabase, name: string, startDate: string, endDate: string): Promise<void> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO academic_calendar (id, student_id, semester_id, date, type, description, created_at, updated_at) VALUES (?, ?, ?, ?, "exam", ?, datetime('now'), datetime('now'))`,
    [id, studentId, semId, startDate, name]
  );
}

export async function deleteExamPeriod(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM academic_calendar WHERE id = ?', [id]);
}


export async function getAllSlots(db: SQLiteDatabase): Promise<TimetableSlotWithSubject[]> {
  const studentId = await getActiveStudentId(db);
  const semId = await getActiveSemesterId(db, studentId!);
  if (!studentId || !semId) return [];

  const slots = await db.getAllAsync<any>(`
    SELECT ts.id, ts.day_or_day_order, ts.period, ts.subject_id, ts.start_time, ts.end_time,
           s.name as subject_name, s.type as subject_type
    FROM timetable_slots ts
    JOIN subjects s ON ts.subject_id = s.id
    WHERE ts.student_id = ? AND ts.semester_id = ?
    ORDER BY ts.period ASC
  `, [studentId, semId]);

  return slots.map(s => ({
    id: s.id,
    day_of_week: s.day_or_day_order,
    period_num: s.period,
    subject_id: s.subject_id,
    subject_name: s.subject_name,
    subject_type: s.subject_type,
    start_time: s.start_time,
    end_time: s.end_time,
  }));
}
export async function setExamDates(db: SQLiteDatabase, start: string | null, end: string | null): Promise<void> {}
export async function updateSubjectOffsets(db: SQLiteDatabase, id: string, heldOffset: number, attendedOffset: number): Promise<void> {}
