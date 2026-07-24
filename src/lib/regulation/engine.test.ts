import {
  computeEligibility,
  safeToSkip,
  classesNeededToRecover,
  worstCaseBurndown,
  computeQuorum,
  evaluateClaimStatus,
  computeHeroMetric,
  RegulationProfile,
  SubjectAttendance
} from './engine';

describe('Regulation Calculation Engine', () => {
  const profileAggregate: RegulationProfile = {
    mode: 'aggregate',
    threshold: 0.75,
    condonableFloor: 0.65,
    atRiskUnit: 'semester',
  };

  const profilePerSubject: RegulationProfile = {
    mode: 'per_subject',
    threshold: 0.75,
    condonableFloor: 0.65,
    atRiskUnit: 'subject',
  };

  describe('safeToSkip', () => {
    it('returns 0 when held is 0', () => {
      expect(safeToSkip(0, 0, 0.75)).toBe(0);
    });

    it('calculates positive buffer correctly', () => {
      // Attended 10, Held 10. Threshold 0.75
      // floor(10/0.75 - 10) = floor(13.33 - 10) = 3
      expect(safeToSkip(10, 10, 0.75)).toBe(3);
    });

    it('calculates negative buffer (deficit) correctly', () => {
      // Attended 5, Held 10 (50%). Threshold 0.75
      // floor(5/0.75 - 10) = floor(6.66 - 10) = -4
      expect(safeToSkip(5, 10, 0.75)).toBe(-4);
    });
  });

  describe('classesNeededToRecover', () => {
    it('returns 0 when held is 0', () => {
      expect(classesNeededToRecover(0, 0, 0.75)).toBe(0);
    });

    it('returns 0 when already at or above threshold', () => {
      expect(classesNeededToRecover(10, 10, 0.75)).toBe(0);
      expect(classesNeededToRecover(8, 10, 0.75)).toBe(0); // 80%
    });

    it('calculates classes needed to reach threshold', () => {
      // Attended 5, Held 10. Threshold 0.75
      // ceil((0.75 * 10 - 5) / (1 - 0.75)) = ceil((7.5 - 5) / 0.25) = ceil(2.5 / 0.25) = 10
      // Check: attend 10 more -> Attended 15, Held 20 -> 15/20 = 0.75
      expect(classesNeededToRecover(5, 10, 0.75)).toBe(10);
    });
  });

  describe('computeEligibility', () => {
    const subjects: SubjectAttendance[] = [
      { subjectId: '1', subjectName: 'Math', attended: 10, held: 10, isOptional: false }, // 100%
      { subjectId: '2', subjectName: 'Physics', attended: 5, held: 10, isOptional: false }, // 50%
      { subjectId: '3', subjectName: 'Optional Lab', attended: 0, held: 10, isOptional: true }, // ignored
    ];

    it('calculates aggregate mode correctly', () => {
      const result = computeEligibility(profileAggregate, subjects);
      
      expect(result.mode).toBe('aggregate');
      // Total attended: 15, Total held: 20 -> 75%
      expect(result.percentage).toBe(0.75);
      expect(result.isEligible).toBe(true);
      
      // Optional subject is excluded
      expect(result.subjects.length).toBe(2);
      
      const physics = result.subjects.find(s => s.subjectId === '2');
      expect(physics?.isEligible).toBe(false);
      expect(physics?.risk).toBe('critical'); // 50% < 65%
    });

    it('calculates per-subject mode correctly', () => {
      const result = computeEligibility(profilePerSubject, subjects);
      
      expect(result.mode).toBe('per_subject');
      expect(result.isEligible).toBe(false); // Because Physics is 50%
      expect(result.percentage).toBe(0.75); // overall display is still 75%
      
      // Sorted by least room first
      expect(result.subjects[0].subjectId).toBe('2'); // Physics is worse
      expect(result.subjects[1].subjectId).toBe('1');
    });
  });

  describe('worstCaseBurndown', () => {
    it('returns null if safe for entire semester', () => {
      // Attended 100, held 100
      const result = worstCaseBurndown(100, 100, 0.75, [
        { date: new Date('2023-11-01'), periodsCount: 5 },
        { date: new Date('2023-11-02'), periodsCount: 5 },
        { date: new Date('2023-11-03'), periodsCount: 5 },
      ]);
      // If misses all 15 remaining periods: 100 / 115 = 86.9% >= 75%
      expect(result.isSafeForSemester).toBe(true);
      expect(result.dangerDate).toBeNull();
    });

    it('returns the exact date threshold is crossed', () => {
      // Attended 100, held 100
      const schedule = [
        { date: new Date('2023-11-01'), periodsCount: 15 }, // held 115 -> 86%
        { date: new Date('2023-11-02'), periodsCount: 15 }, // held 130 -> 76%
        { date: new Date('2023-11-03'), periodsCount: 5 },  // held 135 -> 74% < 75%
      ];
      const result = worstCaseBurndown(100, 100, 0.75, schedule);
      
      expect(result.isSafeForSemester).toBe(false);
      expect(result.dangerDate).toEqual(new Date('2023-11-03'));
    });
  });

  describe('Quorum and Claims', () => {
    it('computes quorum correctly', () => {
      expect(computeQuorum(60)).toBe(30); // 50%
      expect(computeQuorum(5)).toBe(3);   // minimum 3
      expect(computeQuorum(2)).toBe(3);
    });

    it('evaluates claim status', () => {
      expect(evaluateClaimStatus(5, 2, 3, false).isApplied).toBe(true); // 3 >= 3
      expect(evaluateClaimStatus(2, 0, 3, false).isApplied).toBe(false); // 2 < 3
      expect(evaluateClaimStatus(2, 0, 3, true).isApplied).toBe(true); // CR assert bypasses quorum
    });
  });

  describe('computeHeroMetric', () => {
    const subjects: SubjectAttendance[] = [
      { subjectId: '1', subjectName: 'Math', attended: 10, held: 10, isOptional: false },
    ];
    
    it('returns aggregate metrics', () => {
      const eligibility = computeEligibility(profileAggregate, subjects);
      const hero = computeHeroMetric(eligibility, profileAggregate);
      
      expect(hero.mode).toBe('aggregate');
      expect(hero.aggregateSafeToSkip).toBe(3);
      expect(hero.aggregateClassesNeeded).toBeNull();
    });
  });
});
