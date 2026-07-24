import { getDB } from './db';

// Pure Math Functions (FR-5.2, FR-5.3)
export function calculateSafeToSkip(attended: number, held: number, threshold: number): number {
  if (held === 0) return 0;
  // Floor(attended / threshold - held)
  return Math.floor((attended / threshold) - held);
}

export function calculateNeededToRecover(attended: number, held: number, threshold: number): number {
  if (held === 0) return 0;
  // Ceil((threshold * held - attended) / (1 - threshold))
  return Math.ceil(((threshold * held) - attended) / (1 - threshold));
}

export function calculateWorstCaseBurndown(
  attended: number,
  held: number,
  threshold: number,
  futureClasses: { date: string; count: number }[]
): string | null {
  let runningHeld = held;
  let runningAttended = attended;

  // If already below threshold, we're in danger today
  if (held > 0 && (runningAttended / runningHeld) < threshold) {
    return 'Already in danger';
  }

  for (const day of futureClasses) {
    runningHeld += day.count;
    // Assume 0 attended
    if (runningHeld > 0 && (runningAttended / runningHeld) < threshold) {
      return day.date;
    }
  }

  return null; // Safe for the whole semester
}

// Database Aggregate Functions
export interface SubjectMetrics {
  subject_id: string;
  name: string;
  attended: number;
  held: number;
  percentage: number;
  buffer: number; // Positive means safe to skip, Negative means needed to recover
  risk: 'safe' | 'warning' | 'danger' | 'critical';
}

export async function getInsightMetrics(studentId: string | null, semesterId: string | null, threshold: number = 0.75) {
  if (!studentId || !semesterId) {
    return { overall: null, subjects: [] };
  }

  const db = await getDB();

  // 1. Get attended and held per subject
  // We compute "held" by counting how many times the timetable slot occurred historically minus holidays/cancellations.
  // For MVP, we will simplify: "held" is exactly the count of attendance records for that subject 
  // (since we retro-fill non-marked as present or explicitly mark them).
  // This avoids complex calendar math in SQL for now.
  
  const stats = await db.getAllAsync<{ subject_id: string, name: string, attended: number, held: number }>(
    `SELECT 
        s.id as subject_id, 
        s.name,
        COUNT(a.id) as held,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as attended
     FROM subjects s
     LEFT JOIN attendance_records a ON a.subject_id = s.id AND a.student_id = ? AND a.semester_id = ?
     WHERE s.student_id = ? AND s.semester_id = ? AND s.is_optional = 0
     GROUP BY s.id`,
    [studentId, semesterId, studentId, semesterId]
  );

  let totalAttended = 0;
  let totalHeld = 0;

  const subjects: SubjectMetrics[] = stats.map(stat => {
    totalAttended += stat.attended;
    totalHeld += stat.held;

    const percentage = stat.held > 0 ? stat.attended / stat.held : 1;
    let buffer = 0;
    
    if (percentage >= threshold) {
      buffer = calculateSafeToSkip(stat.attended, stat.held, threshold);
    } else {
      buffer = -calculateNeededToRecover(stat.attended, stat.held, threshold);
    }

    let risk: SubjectMetrics['risk'] = 'safe';
    if (percentage < 0.65) risk = 'critical';
    else if (percentage < threshold) risk = 'danger';
    else if (percentage < threshold + 0.05) risk = 'warning';

    return {
      subject_id: stat.subject_id,
      name: stat.name,
      attended: stat.attended,
      held: stat.held,
      percentage,
      buffer,
      risk
    };
  });

  const overallPercentage = totalHeld > 0 ? totalAttended / totalHeld : 1;
  const overallBuffer = overallPercentage >= threshold 
    ? calculateSafeToSkip(totalAttended, totalHeld, threshold)
    : -calculateNeededToRecover(totalAttended, totalHeld, threshold);

  return {
    overall: {
      attended: totalAttended,
      held: totalHeld,
      percentage: overallPercentage,
      buffer: overallBuffer
    },
    subjects
  };
}
