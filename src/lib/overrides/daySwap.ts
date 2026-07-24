/**
 * Day Swap Engine (FR-4.1a)
 * 
 * Handles resolving which template a specific date should follow.
 * Example: "Follow Saturday's timetable today."
 */

export interface DayOverride {
  date: Date;
  sourceDayKey: string; // e.g., 'monday', 'tuesday'
}

/**
 * Resolves the natural day key for a given date (e.g. 'monday' for a Monday date).
 */
export function naturalDayKey(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

/**
 * Returns the effective day key for a given date, respecting any whole-day template swaps.
 * 
 * Precedence rule:
 * 1. If an override exists for this specific date with status = 'day_template_swap', use its source_day_key.
 * 2. Otherwise, use the natural day of the week.
 * 
 * Note: Per-period overrides (FR-4.1) are handled at the UI rendering level and take precedence 
 * over the day swap for that *specific period* only.
 */
export function getEffectiveDayKey(date: Date, overrides: DayOverride[]): string {
  const dateStr = date.toISOString().split('T')[0];
  
  const swapOverride = overrides.find(o => 
    o.date.toISOString().split('T')[0] === dateStr
  );

  if (swapOverride && swapOverride.sourceDayKey) {
    return swapOverride.sourceDayKey;
  }

  return naturalDayKey(date);
}
