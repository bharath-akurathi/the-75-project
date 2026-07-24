/**
 * The 75 Project — Regulation Calculation Engine
 *
 * Pure functions implementing the attendance formulas from SRS Section 3.3 and FR-5.
 * No side effects, no database access — takes data in, returns computed results.
 *
 * All computations happen entirely on-device, even in guest mode.
 */

// ============================================================================
// Types
// ============================================================================

export type RegulationMode = 'aggregate' | 'per_subject';

export interface RegulationProfile {
  mode: RegulationMode;
  threshold: number;         // e.g. 0.75
  condonableFloor: number;   // e.g. 0.65
  atRiskUnit: 'semester' | 'subject';
}

export interface SubjectAttendance {
  subjectId: string;
  subjectName: string;
  attended: number;    // periods attended
  held: number;        // periods held (actually took place)
  isOptional: boolean; // excluded from calculations if true (FR-2.6)
}

export interface EligibilityResult {
  mode: RegulationMode;
  /** Aggregate mode: overall eligibility; Per-subject: all subjects eligible */
  isEligible: boolean;
  /** Current attendance percentage (0-1) */
  percentage: number;
  /** Per-subject results (populated in both modes for display) */
  subjects: SubjectEligibility[];
  /** Overall display percentage in per-subject mode (informational only) */
  overallDisplayPercentage: number | null;
}

export interface SubjectEligibility {
  subjectId: string;
  subjectName: string;
  attended: number;
  held: number;
  percentage: number;
  isEligible: boolean;
  /** Positive = safe to skip that many; negative = needs recovery */
  buffer: number;
  /** Number of classes needed to recover (only when below threshold) */
  classesNeeded: number | null;
  /** Risk level for display */
  risk: 'safe' | 'warning' | 'danger' | 'critical';
  isOptional: boolean;
}

export interface BurndownResult {
  /** The date the student would cross the threshold if they never attend again */
  dangerDate: Date | null;
  /** Safe for the rest of the semester even in worst case */
  isSafeForSemester: boolean;
  /** Number of remaining working days */
  remainingDays: number;
}

// ============================================================================
// Core Computation (SRS Section 3.3)
// ============================================================================

/**
 * Compute eligibility based on the student's regulation profile.
 *
 * Aggregate mode: sum(attended) / sum(held) >= threshold
 * Per-subject mode: each subject checked individually
 */
export function computeEligibility(
  profile: RegulationProfile,
  subjects: SubjectAttendance[]
): EligibilityResult {
  // Filter out optional subjects (FR-2.6)
  const activeSubjects = subjects.filter(s => !s.isOptional);

  const subjectResults: SubjectEligibility[] = activeSubjects.map(s => {
    const percentage = s.held > 0 ? s.attended / s.held : 1;
    const isEligible = percentage >= profile.threshold;
    const buffer = safeToSkip(s.attended, s.held, profile.threshold);
    const classesNeeded = buffer < 0
      ? classesNeededToRecover(s.attended, s.held, profile.threshold)
      : null;

    return {
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      attended: s.attended,
      held: s.held,
      percentage,
      isEligible,
      buffer,
      classesNeeded,
      risk: computeRisk(percentage, profile.threshold, profile.condonableFloor),
      isOptional: false,
    };
  });

  if (profile.mode === 'aggregate') {
    const totalAttended = activeSubjects.reduce((sum, s) => sum + s.attended, 0);
    const totalHeld = activeSubjects.reduce((sum, s) => sum + s.held, 0);
    const percentage = totalHeld > 0 ? totalAttended / totalHeld : 1;
    const isEligible = percentage >= profile.threshold;

    return {
      mode: 'aggregate',
      isEligible,
      percentage,
      subjects: subjectResults,
      overallDisplayPercentage: null,
    };
  } else {
    // Per-subject mode
    const isEligible = subjectResults.every(s => s.isEligible);
    const totalAttended = activeSubjects.reduce((sum, s) => sum + s.attended, 0);
    const totalHeld = activeSubjects.reduce((sum, s) => sum + s.held, 0);
    const overallDisplay = totalHeld > 0 ? totalAttended / totalHeld : 1;

    // Sort by buffer ascending (least room first) — FR-5.1
    subjectResults.sort((a, b) => a.buffer - b.buffer);

    return {
      mode: 'per_subject',
      isEligible,
      percentage: overallDisplay,
      subjects: subjectResults,
      overallDisplayPercentage: overallDisplay,
    };
  }
}

// ============================================================================
// N_max — Safe to Skip Count (FR-5.2)
// ============================================================================

/**
 * How many more classes the student can safely skip.
 * Formula: floor(attended / threshold − held)
 *
 * Positive = safe room. Negative = already below threshold.
 */
export function safeToSkip(
  attended: number,
  held: number,
  threshold: number
): number {
  if (held === 0) return 0;
  return Math.floor(attended / threshold - held);
}

// ============================================================================
// M_min — Classes Needed to Recover (FR-5.3)
// ============================================================================

/**
 * How many consecutive classes the student must attend to reach the threshold.
 * Formula: ceil((threshold × held − attended) / (1 − threshold))
 *
 * Only meaningful when the student is already below threshold.
 * Returns 0 if already at or above threshold.
 */
export function classesNeededToRecover(
  attended: number,
  held: number,
  threshold: number
): number {
  if (held === 0) return 0;
  const currentPercentage = attended / held;
  if (currentPercentage >= threshold) return 0;
  return Math.ceil((threshold * held - attended) / (1 - threshold));
}

// ============================================================================
// Worst-Case Burndown (FR-5.4)
// ============================================================================

/**
 * The exact date the student would cross the threshold if they never
 * attended another class from today on.
 *
 * This is stable by construction — it only ever gets better as classes
 * are actually attended, never worse from a bad-but-recovered stretch.
 *
 * @param attended - Current total periods attended
 * @param held - Current total periods held
 * @param threshold - The eligibility threshold (e.g. 0.75)
 * @param remainingSchedule - Array of { date, periodsCount } for remaining working days
 * @returns The danger date, or null if safe for the entire semester
 */
export function worstCaseBurndown(
  attended: number,
  held: number,
  threshold: number,
  remainingSchedule: { date: Date; periodsCount: number }[]
): BurndownResult {
  let runningAttended = attended;
  let runningHeld = held;

  for (const day of remainingSchedule) {
    runningHeld += day.periodsCount;
    // Worst case: assume zero of these are attended, ever
    if (runningHeld > 0 && runningAttended / runningHeld < threshold) {
      return {
        dangerDate: day.date,
        isSafeForSemester: false,
        remainingDays: remainingSchedule.length,
      };
    }
  }

  return {
    dangerDate: null,
    isSafeForSemester: true,
    remainingDays: remainingSchedule.length,
  };
}

// ============================================================================
// Quorum Computation (FR-4.3)
// ============================================================================

/**
 * Dynamic quorum: ceil(max(0.50 × class_group_size, 3))
 * 50% of the class or 3 students, whichever is higher.
 */
export function computeQuorum(classGroupSize: number): number {
  return Math.ceil(Math.max(0.50 * classGroupSize, 3));
}

/**
 * Evaluate a claim's net stance against quorum.
 * net = distinct "assert" stances − distinct "reject" stances
 *
 * A claim auto-applies only while net >= quorum.
 * A CR's assert counts as satisfying quorum by itself.
 */
export function evaluateClaimStatus(
  assertCount: number,
  rejectCount: number,
  quorum: number,
  hasCrAssert: boolean
): { net: number; isApplied: boolean } {
  const net = assertCount - rejectCount;
  const isApplied = hasCrAssert || net >= quorum;
  return { net, isApplied };
}

// ============================================================================
// Risk Level Computation
// ============================================================================

/**
 * Determine the risk level for display purposes.
 * - safe: above threshold with comfortable buffer
 * - warning: above threshold but buffer is thin
 * - danger: in the condonable band (65–74%)
 * - critical: below condonable floor (<65%)
 */
function computeRisk(
  percentage: number,
  threshold: number,
  condonableFloor: number
): 'safe' | 'warning' | 'danger' | 'critical' {
  if (percentage < condonableFloor) return 'critical';
  if (percentage < threshold) return 'danger';
  // Within 3% of threshold = warning
  if (percentage < threshold + 0.03) return 'warning';
  return 'safe';
}

// ============================================================================
// Hero Metric (FR-5.1)
// ============================================================================

/**
 * The home-screen hero metric, phase-aware per regulation profile.
 * - Aggregate mode: single "safe to skip N more" number
 * - Per-subject mode: ranked per-subject list (least buffer first)
 */
export function computeHeroMetric(
  eligibility: EligibilityResult,
  profile: RegulationProfile
): {
  mode: RegulationMode;
  /** Aggregate: total safe-to-skip count */
  aggregateSafeToSkip: number | null;
  /** Aggregate: total classes needed to recover */
  aggregateClassesNeeded: number | null;
  /** Per-subject: sorted list with buffer info */
  subjectRanking: SubjectEligibility[] | null;
} {
  if (profile.mode === 'aggregate') {
    const totalAttended = eligibility.subjects.reduce((sum, s) => sum + s.attended, 0);
    const totalHeld = eligibility.subjects.reduce((sum, s) => sum + s.held, 0);
    const skip = safeToSkip(totalAttended, totalHeld, profile.threshold);
    const needed = skip < 0
      ? classesNeededToRecover(totalAttended, totalHeld, profile.threshold)
      : null;

    return {
      mode: 'aggregate',
      aggregateSafeToSkip: skip >= 0 ? skip : null,
      aggregateClassesNeeded: needed,
      subjectRanking: null,
    };
  } else {
    return {
      mode: 'per_subject',
      aggregateSafeToSkip: null,
      aggregateClassesNeeded: null,
      subjectRanking: [...eligibility.subjects].sort((a, b) => a.buffer - b.buffer),
    };
  }
}
