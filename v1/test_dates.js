const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayOfWeek(date) {
  return WEEKDAY_NAMES[date.getDay()];
}

function getWeekdaysBetween(start, end, excludeRanges = []) {
  const counts = {};
  for (const day of WEEKDAY_NAMES) {
    counts[day] = 0;
  }

  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  const normalizedExcludes = excludeRanges.map(r => {
    const s = new Date(r.start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(r.end);
    e.setHours(0, 0, 0, 0);
    return { start: s, end: e };
  });

  while (current <= endDate) {
    const isExcluded = normalizedExcludes.some(
      r => current >= r.start && current <= r.end
    );
    
    if (!isExcluded) {
      const dayName = getDayOfWeek(current);
      if (dayName !== 'Sunday') {
        counts[dayName] = (counts[dayName] || 0) + 1;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return counts;
}

// Example: Sem start Aug 1, Today Aug 31
const semStart = new Date('2026-08-01T00:00:00');
const today = new Date('2026-08-31T00:00:00');

console.log("No exams:", getWeekdaysBetween(semStart, today));
console.log("With exams (Aug 15 to Aug 25):", getWeekdaysBetween(semStart, today, [
  { start: new Date('2026-08-15T00:00:00'), end: new Date('2026-08-25T00:00:00') }
]));
