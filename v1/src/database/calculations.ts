/**
 * The 75 Project — Attendance Calculation Engine
 * Core 75% logic from SRS §3.1 and §4.4
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { DailyException, TimetableSlotWithSubject, ExamPeriod } from './queries';
import { formatDate, getWeekdaysBetween, parseDate } from '@/utils/dateHelpers';

// ============================================================
// Types
// ============================================================

export interface AggregateResult {
  totalHeld: number;
  totalAttended: number;
  percentage: number;
  safeBunks: number;
  classesNeeded: number; // classes needed to reach 75% if below
}

export interface SubjectResult {
  subjectId: number;
  subjectName: string;
  held: number;
  attended: number;
  percentage: number;
  safeBunks: number;
  classesNeeded: number;
}

// ============================================================
// Safe-to-Skip Formula: ⌊attended / 0.75 - held⌋
// If negative, it means you need that many classes to reach 75%
// ============================================================

export function calculateSafeBunks(attended: number, held: number): number {
  if (held === 0) return 0;
  return Math.floor(attended / 0.75 - held);
}

export function calculateClassesNeeded(attended: number, held: number): number {
  if (held === 0) return 0;
  const percentage = attended / held;
  if (percentage >= 0.75) return 0;
  // Need x more classes where (attended + x) / (held + x) >= 0.75
  // attended + x >= 0.75 * (held + x)
  // x - 0.75x >= 0.75*held - attended
  // 0.25x >= 0.75*held - attended
  // x >= (0.75*held - attended) / 0.25
  return Math.ceil((0.75 * held - attended) / 0.25);
}

// ============================================================
// Aggregate Calculation
// ============================================================

export async function calculateAggregate(
  db: SQLiteDatabase,
  semesterStart: string
): Promise<AggregateResult> {
  const today = formatDate(new Date());

  // Get all slots to understand weekly schedule
  const allSlots = await db.getAllAsync<TimetableSlotWithSubject>(
    `SELECT ts.*, s.name as subject_name, s.type as subject_type
     FROM TimetableSlots ts
     JOIN Subjects s ON ts.subject_id = s.id;`
  );

  if (allSlots.length === 0) {
    return { totalHeld: 0, totalAttended: 0, percentage: 100, safeBunks: 0, classesNeeded: 0 };
  }

  // Count slots per day of week
  const slotsPerDay: Record<string, number> = {};
  for (const slot of allSlots) {
    slotsPerDay[slot.day_of_week] = (slotsPerDay[slot.day_of_week] || 0) + 1;
  }

  // Fetch exam periods
  const examPeriods = await db.getAllAsync<ExamPeriod>('SELECT * FROM ExamPeriods;');
  const excludeRanges = examPeriods.map(ep => ({
    start: parseDate(ep.start_date),
    end: parseDate(ep.end_date)
  }));

  // Calculate total held periods from semester start to today
  const daysBetween = getWeekdaysBetween(new Date(semesterStart), new Date(today), excludeRanges);
  let totalHeld = 0;
  for (const [day, count] of Object.entries(daysBetween)) {
    totalHeld += (slotsPerDay[day] || 0) * count;
  }

  // Subtract cancellations, count absences
  const exceptions = await db.getAllAsync<DailyException>(
    'SELECT * FROM DailyExceptions WHERE date >= ? AND date <= ?;',
    [semesterStart, today]
  );

  let cancellations = 0;
  let absences = 0;
  for (const ex of exceptions) {
    if (ex.status === 'cancelled') cancellations++;
    if (ex.status === 'absent') absences++;
  }

  // Get manual offsets
  const offsets = await db.getFirstAsync<{ h: number; a: number }>(
    'SELECT SUM(manual_held_offset) as h, SUM(manual_attended_offset) as a FROM Subjects;'
  );
  const manualHeld = offsets?.h || 0;
  const manualAttended = offsets?.a || 0;

  totalHeld = totalHeld - cancellations + manualHeld;
  const totalAttended = totalHeld - manualHeld - absences + manualAttended;
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

  // Get all subjects
  const subjects = await db.getAllAsync<{ id: number; name: string; manual_held_offset: number; manual_attended_offset: number }>(
    'SELECT id, name, manual_held_offset, manual_attended_offset FROM Subjects ORDER BY name;'
  );

  if (subjects.length === 0) return [];

  // Get slots grouped by subject
  const allSlots = await db.getAllAsync<{ subject_id: number; day_of_week: string }>(
    'SELECT subject_id, day_of_week FROM TimetableSlots;'
  );

  // Count slots per subject per day
  const subjectDaySlots: Record<number, Record<string, number>> = {};
  for (const slot of allSlots) {
    if (!subjectDaySlots[slot.subject_id]) subjectDaySlots[slot.subject_id] = {};
    subjectDaySlots[slot.subject_id][slot.day_of_week] =
      (subjectDaySlots[slot.subject_id][slot.day_of_week] || 0) + 1;
  }

  // Fetch exam periods
  const examPeriods = await db.getAllAsync<ExamPeriod>('SELECT * FROM ExamPeriods;');
  const excludeRanges = examPeriods.map(ep => ({
    start: parseDate(ep.start_date),
    end: parseDate(ep.end_date)
  }));

  // Day counts
  const daysBetween = getWeekdaysBetween(new Date(semesterStart), new Date(today), excludeRanges);

  // Get all exceptions
  const exceptions = await db.getAllAsync<DailyException>(
    'SELECT * FROM DailyExceptions WHERE date >= ? AND date <= ?;',
    [semesterStart, today]
  );

  // Group exceptions by subject
  const exBySubject: Record<number, { absences: number; cancellations: number }> = {};
  for (const ex of exceptions) {
    if (!exBySubject[ex.subject_id]) exBySubject[ex.subject_id] = { absences: 0, cancellations: 0 };
    if (ex.status === 'absent') exBySubject[ex.subject_id].absences++;
    if (ex.status === 'cancelled') exBySubject[ex.subject_id].cancellations++;
  }

  // Calculate per subject
  const results: SubjectResult[] = [];
  for (const subject of subjects) {
    const daySlots = subjectDaySlots[subject.id] || {};
    let held = 0;
    for (const [day, count] of Object.entries(daysBetween)) {
      held += (daySlots[day] || 0) * count;
    }

    const subEx = exBySubject[subject.id] || { absences: 0, cancellations: 0 };
    held = held - subEx.cancellations + subject.manual_held_offset;
    const attended = held - subject.manual_held_offset - subEx.absences + subject.manual_attended_offset;
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

  // Sort by danger (lowest percentage first)
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
  const slots = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM TimetableSlots WHERE day_of_week = ?;',
    [dayOfWeek]
  );

  const exceptions = await db.getAllAsync<DailyException>(
    'SELECT * FROM DailyExceptions WHERE date = ?;',
    [todayDate]
  );

  let absent = 0;
  let cancelled = 0;
  for (const ex of exceptions) {
    if (ex.status === 'absent') absent++;
    if (ex.status === 'cancelled') cancelled++;
  }

  const totalClasses = slots.length;
  const attended = totalClasses - absent - cancelled;

  return { totalClasses, attended, absent, cancelled };
}
