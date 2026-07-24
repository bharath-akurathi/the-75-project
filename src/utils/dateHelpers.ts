/**
 * The 75 Project — Date Helper Utilities
 */

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Returns the day name for a Date object (e.g., "Monday")
 */
export function getDayOfWeek(date: Date): string {
  return DAYS_OF_WEEK[date.getDay()];
}

/**
 * Formats a Date to YYYY-MM-DD string for DB storage
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string back to a Date
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Returns the count of each weekday between start and end (inclusive)
 * Result: { Monday: 5, Tuesday: 4, ... }
 * Optionally excludes dates that fall within provided ranges.
 */
export function getWeekdaysBetween(
  start: Date,
  end: Date,
  excludeRanges: { start: Date; end: Date }[] = []
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const day of WEEKDAY_NAMES) {
    counts[day] = 0;
  }

  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  // Normalize exclude ranges
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

/**
 * Format a date for display (e.g., "Tue, Jul 22")
 */
export function formatDateDisplay(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format time like "9:00 AM"
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Get an array of dates from semester start up to today
 */
export function getDatesFromStart(startDateStr: string): Date[] {
  const dates: Date[] = [];
  if (!startDateStr) return dates;
  
  const start = parseDate(startDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  // Failsafe limit to prevent infinite loops or massive arrays (e.g. 1 year max)
  let count = 0;
  while (current <= today && count < 365) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
    count++;
  }
  
  return dates;
}
