/**
 * The 75 Project — Attendance Calculation Engine (V2 Compatible)
 * Core 75% logic from SRS §3.1 and §4.4
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { formatDate, getWeekdaysBetween, parseDate, getDayOfWeek } from '@/utils/dateHelpers';

// ============================================================
// Types
// ============================================================

export interface AggregateResult {
  totalHeld: number;
  totalAttended: number;
  percentage: number;
  safeBunks: number;
  classesNeeded: number;
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  held: number;
  attended: number;
  percentage: number;
  safeBunks: number;
  classesNeeded: number;
}

// ============================================================
// Safe-to-Skip Formula
// ============================================================

export function calculateSafeBunks(attended: number, held: number): number {
  if (held === 0) return 0;
  return Math.floor(attended / 0.75 - held);
}

export function calculateClassesNeeded(attended: number, held: number): number {
  if (held === 0) return 0;
  const percentage = attended / held;
  if (percentage >= 0.75) return 0;
  return Math.ceil((0.75 * held - attended) / 0.25);
}

// ============================================================
// V2 Context Helper
// ============================================================

async function getActiveContext(db: SQLiteDatabase) {
  const student = await db.getFirstAsync<{ id: string }>('SELECT id FROM students ORDER BY created_at DESC LIMIT 1');
  if (!student) return { studentId: null, semId: null };
  const sem = await db.getFirstAsync<{ id: string }>('SELECT id FROM semesters WHERE student_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1', [student.id]);
  return { studentId: student.id, semId: sem?.id || null };
}

// ============================================================
// Aggregate Calculation
// ============================================================

export async function calculateAggregate(
  db: SQLiteDatabase,
  semesterStart: string
): Promise<AggregateResult> {
  const today = formatDate(new Date());
  const { studentId, semId } = await getActiveContext(db);
  if (!studentId || !semId) return { totalHeld: 0, totalAttended: 0, percentage: 100, safeBunks: 0, classesNeeded: 0 };

  const allSlots = await db.getAllAsync<{ day_of_week: string }>(
    `SELECT day_or_day_order as day_of_week
     FROM timetable_slots
     WHERE student_id = ? AND semester_id = ?`,
    [studentId, semId]
  );

  if (allSlots.length === 0) {
    return { totalHeld: 0, totalAttended: 0, percentage: 100, safeBunks: 0, classesNeeded: 0 };
  }

  const slotsPerDay: Record<string, number> = {};
  for (const slot of allSlots) {
    slotsPerDay[slot.day_of_week] = (slotsPerDay[slot.day_of_week] || 0) + 1;
  }

  const examPeriods = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM academic_calendar WHERE student_id = ? AND semester_id = ? AND type = "exam";',
    [studentId, semId]
  );
  
  const excludeRanges = examPeriods.map(ep => ({
    start: parseDate(ep.date),
    end: parseDate(ep.date)
  }));

  const daysBetween = getWeekdaysBetween(new Date(semesterStart), new Date(today), excludeRanges);
  let totalHeld = 0;
  for (const [day, count] of Object.entries(daysBetween)) {
    totalHeld += (slotsPerDay[day] || 0) * count;
  }

  const absences = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM attendance_records WHERE student_id = ? AND semester_id = ? AND date >= ? AND date <= ? AND status = "absent";',
    [studentId, semId, semesterStart, today]
  );
  
  const cancellations = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM daily_overrides WHERE student_id = ? AND semester_id = ? AND date >= ? AND date <= ? AND status = "cancelled";',
    [studentId, semId, semesterStart, today]
  );

  totalHeld = totalHeld - cancellations.length;
  const totalAttended = totalHeld - absences.length;
  
  const percentage = totalHeld > 0 ? (totalAttended / totalHeld) * 100 : 100;
  const safeBunks = calculateSafeBunks(totalAttended, totalHeld);
  const classesNeeded = calculateClassesNeeded(totalAttended, totalHeld);

  return { totalHeld, totalAttended, percentage, safeBunks, classesNeeded };
}

// ============================================================
// Per-Subject Calculation
// ============================================================

export async function calculatePerSubject(
  db: SQLiteDatabase,
  semesterStart: string
): Promise<SubjectResult[]> {
  const today = formatDate(new Date());
  const { studentId, semId } = await getActiveContext(db);
  if (!studentId || !semId) return [];

  const subjects = await db.getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM subjects WHERE student_id = ? AND semester_id = ? ORDER BY name;',
    [studentId, semId]
  );

  if (subjects.length === 0) return [];

  const allSlots = await db.getAllAsync<{ subject_id: string; day_of_week: string }>(
    'SELECT subject_id, day_or_day_order as day_of_week FROM timetable_slots WHERE student_id = ? AND semester_id = ?;',
    [studentId, semId]
  );

  const subjectDaySlots: Record<string, Record<string, number>> = {};
  for (const slot of allSlots) {
    if (!subjectDaySlots[slot.subject_id]) subjectDaySlots[slot.subject_id] = {};
    subjectDaySlots[slot.subject_id][slot.day_of_week] =
      (subjectDaySlots[slot.subject_id][slot.day_of_week] || 0) + 1;
  }

  const examPeriods = await db.getAllAsync<{ date: string }>('SELECT date FROM academic_calendar WHERE student_id = ? AND semester_id = ? AND type = "exam";', [studentId, semId]);
  const excludeRanges = examPeriods.map(ep => ({
    start: parseDate(ep.date),
    end: parseDate(ep.date)
  }));

  const daysBetween = getWeekdaysBetween(new Date(semesterStart), new Date(today), excludeRanges);

  const absences = await db.getAllAsync<{ subject_id: string }>(
    'SELECT subject_id FROM attendance_records WHERE student_id = ? AND semester_id = ? AND date >= ? AND date <= ? AND status = "absent";',
    [studentId, semId, semesterStart, today]
  );
  
  const cancellations = await db.getAllAsync<{ subject_id: string }>(
    'SELECT original_subject_id as subject_id FROM daily_overrides WHERE student_id = ? AND semester_id = ? AND date >= ? AND date <= ? AND status = "cancelled";',
    [studentId, semId, semesterStart, today]
  );

  const exBySubject: Record<string, { absences: number; cancellations: number }> = {};
  for (const a of absences) {
    if (!exBySubject[a.subject_id]) exBySubject[a.subject_id] = { absences: 0, cancellations: 0 };
    exBySubject[a.subject_id].absences++;
  }
  for (const c of cancellations) {
    if (!c.subject_id) continue;
    if (!exBySubject[c.subject_id]) exBySubject[c.subject_id] = { absences: 0, cancellations: 0 };
    exBySubject[c.subject_id].cancellations++;
  }

  const results: SubjectResult[] = [];
  for (const subject of subjects) {
    const daySlots = subjectDaySlots[subject.id] || {};
    let held = 0;
    for (const [day, count] of Object.entries(daysBetween)) {
      held += (daySlots[day] || 0) * count;
    }

    const subEx = exBySubject[subject.id] || { absences: 0, cancellations: 0 };
    held = held - subEx.cancellations;
    const attended = held - subEx.absences;
    const percentage = held > 0 ? (attended / held) * 100 : 100;
    const safeBunks = calculateSafeBunks(attended, held);
    const classesNeeded = calculateClassesNeeded(attended, held);

    results.push({
      subjectId: subject.id,
      subjectName: subject.name,
      held,
      attended,
      percentage,
      safeBunks,
      classesNeeded,
    });
  }

  results.sort((a, b) => a.percentage - b.percentage);
  return results;
}

// ============================================================
// Today's stats (quick summary for dashboard)
// ============================================================

export interface TodayStats {
  totalClasses: number;
  attended: number;
  absent: number;
  cancelled: number;
}

export async function getTodayStats(
  db: SQLiteDatabase,
  dayOfWeek: string,
  todayDate: string
): Promise<TodayStats> {
  const { studentId, semId } = await getActiveContext(db);
  if (!studentId || !semId) return { totalClasses: 0, attended: 0, absent: 0, cancelled: 0 };

  const slots = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM timetable_slots WHERE student_id = ? AND semester_id = ? AND day_or_day_order = ?;',
    [studentId, semId, dayOfWeek]
  );

  const absentRecords = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM attendance_records WHERE student_id = ? AND semester_id = ? AND date = ? AND status = "absent";',
    [studentId, semId, todayDate]
  );

  const cancelledRecords = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM daily_overrides WHERE student_id = ? AND semester_id = ? AND date = ? AND status = "cancelled";',
    [studentId, semId, todayDate]
  );

  const absent = absentRecords.length;
  const cancelled = cancelledRecords.length;
  const totalClasses = slots.length;
  const attended = totalClasses - absent - cancelled;

  return { totalClasses, attended, absent, cancelled };
}

// ============================================================
// Heatmap Data (FR-5.6)
// ============================================================

export interface HeatmapDay {
  date: string;
  intensity: number; // 0 to 4 (0: no classes, 1: 0-25%, 2: 25-50%, 3: 50-75%, 4: 75-100%)
}

export async function getHeatmapData(
  db: SQLiteDatabase,
  semesterStart: string,
  daysCount: number = 35 // default to 5 weeks
): Promise<HeatmapDay[]> {
  const { studentId, semId } = await getActiveContext(db);
  if (!studentId || !semId) return [];

  // Get last N days up to today
  const today = new Date();
  const days: Date[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  const results: HeatmapDay[] = [];
  
  for (const dateObj of days) {
    const dateStr = formatDate(dateObj);
    if (dateStr < semesterStart) {
      results.push({ date: dateStr, intensity: 0 });
      continue;
    }
    
    const dayOfWeek = getDayOfWeek(dateObj);
    const stats = await getTodayStats(db, dayOfWeek, dateStr);
    
    if (stats.totalClasses === 0) {
      results.push({ date: dateStr, intensity: 0 });
    } else {
      const percentage = (stats.attended / stats.totalClasses) * 100;
      let intensity = 1;
      if (percentage >= 75) intensity = 4;
      else if (percentage >= 50) intensity = 3;
      else if (percentage >= 25) intensity = 2;
      else intensity = 1;
      
      results.push({ date: dateStr, intensity });
    }
  }

  return results;
}
