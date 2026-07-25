import { computeQuorum, evaluateClaim, ClaimType, CrowdReport } from './crowdClaims';

describe('Crowd Claims Engine (FR-4.3)', () => {
  describe('computeQuorum', () => {
    it('returns 50% for large groups', () => {
      expect(computeQuorum(60)).toBe(30);
      expect(computeQuorum(100)).toBe(50);
    });

    it('returns minimum 3 for small groups', () => {
      expect(computeQuorum(1)).toBe(3);
      expect(computeQuorum(2)).toBe(3);
      expect(computeQuorum(5)).toBe(3);
      expect(computeQuorum(6)).toBe(3); // ceil(3) = 3
    });

    it('handles edge case of exactly 6 students', () => {
      // 50% of 6 = 3, ceil(3) = 3
      expect(computeQuorum(6)).toBe(3);
    });

    it('handles odd group sizes', () => {
      // 50% of 7 = 3.5, ceil(3.5) = 4
      expect(computeQuorum(7)).toBe(4);
      // 50% of 9 = 4.5, ceil(4.5) = 5
      expect(computeQuorum(9)).toBe(5);
    });

    it('returns 0 for empty group', () => {
      // Edge case: 50% of 0 = 0, max(0, 3) = 3, ceil(3) = 3
      expect(computeQuorum(0)).toBe(3);
    });
  });

  describe('evaluateClaim', () => {
    const makeReport = (
      studentId: string,
      stance: 'assert' | 'reject',
      isCR: boolean = false
    ): CrowdReport => ({
      studentId,
      claimType: 'cancellation' as ClaimType,
      stance,
      isCR,
    });

    describe('basic quorum logic', () => {
      it('applies claim when asserts meet quorum', () => {
        const reports = [
          makeReport('s1', 'assert'),
          makeReport('s2', 'assert'),
          makeReport('s3', 'assert'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(true);
        expect(result.netStance).toBe(3);
        expect(result.asserts).toBe(3);
        expect(result.rejects).toBe(0);
      });

      it('does not apply when asserts below quorum', () => {
        const reports = [
          makeReport('s1', 'assert'),
          makeReport('s2', 'assert'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(2);
      });

      it('applies when asserts exceed quorum', () => {
        const reports = [
          makeReport('s1', 'assert'),
          makeReport('s2', 'assert'),
          makeReport('s3', 'assert'),
          makeReport('s4', 'assert'),
          makeReport('s5', 'assert'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(true);
        expect(result.netStance).toBe(5);
      });
    });

    describe('reject logic', () => {
      it('reduces net stance by rejects', () => {
        const reports = [
          makeReport('s1', 'assert'),
          makeReport('s2', 'assert'),
          makeReport('s3', 'assert'),
          makeReport('s4', 'reject'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(2); // 3 asserts - 1 reject
      });

      it('can push net negative', () => {
        const reports = [
          makeReport('s1', 'assert'),
          makeReport('s2', 'reject'),
          makeReport('s3', 'reject'),
          makeReport('s4', 'reject'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(-2); // 1 assert - 3 rejects
      });

      it('rejects cancel out asserts', () => {
        const reports = [
          makeReport('s1', 'assert'),
          makeReport('s2', 'assert'),
          makeReport('s3', 'reject'),
          makeReport('s4', 'reject'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(0);
      });
    });

    describe('CR (Class Representative) logic', () => {
      it('CR assert applies claim instantly when net >= 0', () => {
        const reports = [
          makeReport('cr1', 'assert', true),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(true);
        expect(result.netStance).toBe(1);
      });

      it('CR assert still applies with some rejects (net >= 0)', () => {
        const reports = [
          makeReport('cr1', 'assert', true),
          makeReport('s1', 'reject'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(true);
        expect(result.netStance).toBe(0);
      });

      it('CR assert does NOT apply when overwhelmed by rejects (net < 0)', () => {
        const reports = [
          makeReport('cr1', 'assert', true),
          makeReport('s1', 'reject'),
          makeReport('s2', 'reject'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(-1);
      });

      it('CR reject counts normally', () => {
        const reports = [
          makeReport('s1', 'assert'),
          makeReport('s2', 'assert'),
          makeReport('s3', 'assert'),
          makeReport('cr1', 'reject', true),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(2);
      });

      it('multiple CR asserts count as single assert', () => {
        const reports = [
          makeReport('cr1', 'assert', true),
          makeReport('cr2', 'assert', true),
        ];
        const result = evaluateClaim(reports, 3);
        // Both CR asserts count, net = 2, but CR flag makes it apply
        expect(result.isApplied).toBe(true);
        expect(result.asserts).toBe(2);
      });
    });

    describe('edge cases', () => {
      it('empty reports does not apply', () => {
        const result = evaluateClaim([], 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(0);
        expect(result.asserts).toBe(0);
        expect(result.rejects).toBe(0);
      });

      it('single assert meets minimum quorum of 3', () => {
        const reports = [makeReport('s1', 'assert')];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(1);
      });

      it('all rejects results in negative net', () => {
        const reports = [
          makeReport('s1', 'reject'),
          makeReport('s2', 'reject'),
          makeReport('s3', 'reject'),
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(false);
        expect(result.netStance).toBe(-3);
      });

      it('deduplicates reports from same student (uses latest)', () => {
        // Student s1 first asserts, then rejects - only reject should count
        const reports = [
          makeReport('s1', 'assert'),
          makeReport('s1', 'reject'),
          makeReport('s2', 'assert'),
          makeReport('s3', 'assert'),
        ];
        const result = evaluateClaim(reports, 3);
        // s1's reject is latest, s2 and s3 assert = 2 asserts, 1 reject = net 1
        expect(result.asserts).toBe(2);
        expect(result.rejects).toBe(1);
        expect(result.netStance).toBe(1);
        expect(result.isApplied).toBe(false);
      });

      it('deduplication keeps only last report per student', () => {
        // Multiple reports from same student - only last one counts
        const reports = [
          makeReport('s1', 'reject'),
          makeReport('s1', 'assert'),
          makeReport('s1', 'assert'),
        ];
        const result = evaluateClaim(reports, 3);
        // Only s1's last assert counts
        expect(result.asserts).toBe(1);
        expect(result.rejects).toBe(0);
        expect(result.netStance).toBe(1);
      });
    });

    describe('claim types', () => {
      it('works for cancellation claims', () => {
        const reports: CrowdReport[] = [
          { studentId: 's1', claimType: 'cancellation', stance: 'assert', isCR: false },
          { studentId: 's2', claimType: 'cancellation', stance: 'assert', isCR: false },
          { studentId: 's3', claimType: 'cancellation', stance: 'assert', isCR: false },
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(true);
      });

      it('works for day_swap claims', () => {
        const reports: CrowdReport[] = [
          { studentId: 's1', claimType: 'day_swap', stance: 'assert', isCR: false },
          { studentId: 's2', claimType: 'day_swap', stance: 'assert', isCR: false },
          { studentId: 's3', claimType: 'day_swap', stance: 'assert', isCR: false },
          { studentId: 's4', claimType: 'day_swap', stance: 'assert', isCR: false },
        ];
        const result = evaluateClaim(reports, 3);
        expect(result.isApplied).toBe(true);
        expect(result.asserts).toBe(4);
      });
    });
  });
});
