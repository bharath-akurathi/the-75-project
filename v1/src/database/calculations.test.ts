import { calculateSafeBunks, calculateClassesNeeded } from './calculations';

describe('calculations', () => {
  describe('calculateSafeBunks', () => {
    it('returns 0 if 0 classes held', () => {
      expect(calculateSafeBunks(0, 0)).toBe(0);
    });

    it('returns 0 if exact 75% attendance', () => {
      // 3 attended out of 4 held is 75%
      expect(calculateSafeBunks(3, 4)).toBe(0);
    });

    it('returns positive integer for safe skips', () => {
      // 9 attended out of 9 held
      // Math.floor(9 / 0.75 - 9) = Math.floor(12 - 9) = 3
      expect(calculateSafeBunks(9, 9)).toBe(3);
    });

    it('returns negative integer if below 75%', () => {
      // 2 attended out of 4 held is 50%
      // Math.floor(2 / 0.75 - 4) = Math.floor(2.66 - 4) = -2
      expect(calculateSafeBunks(2, 4)).toBe(-2);
    });
  });

  describe('calculateClassesNeeded', () => {
    it('returns 0 if 0 classes held', () => {
      expect(calculateClassesNeeded(0, 0)).toBe(0);
    });

    it('returns 0 if attendance is already >= 75%', () => {
      expect(calculateClassesNeeded(3, 4)).toBe(0);
      expect(calculateClassesNeeded(9, 9)).toBe(0);
    });

    it('calculates the exact number of consecutive classes needed', () => {
      // 2 attended out of 4 held. Percentage = 50%
      // Next class: 3/5 = 60%
      // Next class: 4/6 = 66%
      // Next class: 5/7 = 71%
      // Next class: 6/8 = 75%
      // So we need 4 classes.
      expect(calculateClassesNeeded(2, 4)).toBe(4);
    });

    it('handles edge cases just below 75%', () => {
      // 22 attended out of 30 held. Percentage = 73.33%
      // Need x where (22 + x) / (30 + x) >= 0.75
      // 22 + x >= 22.5 + 0.75x
      // 0.25x >= 0.5
      // x >= 2
      // Let's verify: 23/31 = 74.19%. 24/32 = 75%. So 2 classes needed.
      expect(calculateClassesNeeded(22, 30)).toBe(2);
    });
  });
});
