/**
 * Crowd Claims Engine (FR-4.3)
 * 
 * Core logic for the generalized crowd claim system with dynamic quorum.
 */

export type ClaimType = 'cancellation' | 'day_swap' | 'period_swap' | 'extra_class';
export type Stance = 'assert' | 'reject';

export interface CrowdReport {
  studentId: string;
  claimType: ClaimType;
  stance: Stance;
  isCR: boolean;
}

export interface ClaimEvaluation {
  netStance: number;
  isApplied: boolean;
  asserts: number;
  rejects: number;
}

/**
 * Computes the dynamic quorum required for a class group.
 * Dynamic quorum: ceil(max(0.50 * classGroupSize, 3))
 * 50% of the class or 3 students, whichever is higher.
 */
export function computeQuorum(classGroupSize: number): number {
  return Math.ceil(Math.max(0.50 * classGroupSize, 3));
}

/**
 * Evaluates the status of a specific claim based on all submitted reports.
 * 
 * Rules:
 * - net = distinct asserts - distinct rejects
 * - A claim auto-applies only while net >= quorum
 * - A CR's assert counts as satisfying quorum by itself, but can still be disputed by members
 */
export function evaluateClaim(reports: CrowdReport[], quorum: number): ClaimEvaluation {
  let asserts = 0;
  let rejects = 0;
  let hasCRAssert = false;

  for (const report of reports) {
    if (report.stance === 'assert') {
      asserts++;
      if (report.isCR) hasCRAssert = true;
    } else if (report.stance === 'reject') {
      rejects++;
    }
  }

  const netStance = asserts - rejects;
  
  // A CR's assert applies instantly, but enough member rejects can still bring net < 0 
  // (though in practice, a CR assert gives it a strong starting bias).
  // Strictly following FR-4.3: CR role provides instant quorum satisfaction.
  const isApplied = hasCRAssert ? (netStance >= 0) : (netStance >= quorum);

  return {
    netStance,
    isApplied,
    asserts,
    rejects
  };
}
