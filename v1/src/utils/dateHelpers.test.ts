import { formatDate, parseDate, formatDateDisplay, getWeekdaysBetween } from './dateHelpers';

describe('dateHelpers', () => {
  describe('formatDate', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date(2026, 7, 30); // August 30, 2026
      expect(formatDate(date)).toBe('2026-08-30');
    });
  });

  describe('parseDate', () => {
    it('parses YYYY-MM-DD into a local Date object', () => {
      const dateStr = '2026-08-30';
      const date = parseDate(dateStr);
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(7);
      expect(date.getDate()).toBe(30);
    });
  });

  describe('formatDateDisplay', () => {
    it('formats date into a readable string', () => {
      const dateStr = '2026-08-30';
      expect(formatDateDisplay(parseDate(dateStr))).toBe('Sun, Aug 30');
    });
  });

  describe('getWeekdaysBetween', () => {
    it('counts weekdays correctly excluding Sundays', () => {
      const start = new Date(2026, 7, 1); // Aug 1, 2026 (Saturday)
      const end = new Date(2026, 7, 31); // Aug 31, 2026 (Monday)
      const counts = getWeekdaysBetween(start, end, []);
      
      expect(counts.Sunday).toBeUndefined();
      expect(counts.Monday).toBe(5);
      expect(counts.Tuesday).toBe(4);
      expect(counts.Saturday).toBe(5);
    });

    it('excludes specified date ranges', () => {
      const start = new Date(2026, 7, 1);
      const end = new Date(2026, 7, 31);
      
      // Exclude Aug 15 to Aug 25
      const excludeRanges = [
        { start: new Date(2026, 7, 15), end: new Date(2026, 7, 25) }
      ];

      const counts = getWeekdaysBetween(start, end, excludeRanges);
      
      expect(counts.Sunday).toBeUndefined();
      expect(counts.Monday).toBe(3); // Drops from 5 to 3
      expect(counts.Tuesday).toBe(2); // Drops from 4 to 2
      expect(counts.Saturday).toBe(3); // Drops from 5 to 3
    });
  });
});
