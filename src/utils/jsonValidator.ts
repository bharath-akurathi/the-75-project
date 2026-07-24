/**
 * The 75 Project — JSON Timetable Validator
 * Validates JSON output from LLM timetable extraction
 * Handles free periods (---) and lab detection (is_lab)
 */

export interface RawTimetableSlot {
  day: string;
  period_number: number;
  subject_raw: string;
  is_lab: boolean;
}

export interface ValidatedTimetableData {
  slots: RawTimetableSlot[];
}

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Patterns that indicate a free period / no class
const FREE_PERIOD_PATTERNS = ['...', '---', '-', 'free', 'free period', 'no class', 'break', 'lunch', ''];

export interface ValidationResult {
  valid: boolean;
  data?: ValidatedTimetableData;
  error?: string;
}

function isFreePeriod(subject: string): boolean {
  const normalized = subject.trim().toLowerCase();
  return FREE_PERIOD_PATTERNS.includes(normalized);
}

export function validateTimetableJson(jsonString: string): ValidationResult {
  // Try to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString.trim());
  } catch {
    return { valid: false, error: 'Invalid JSON. Please check formatting and try again.' };
  }

  // Check top-level structure
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'JSON must be an object with a "slots" array.' };
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.slots)) {
    return { valid: false, error: 'Missing "slots" array in the JSON.' };
  }

  if (obj.slots.length === 0) {
    return { valid: false, error: 'The "slots" array is empty. No classes found.' };
  }

  // Validate each slot
  const validatedSlots: RawTimetableSlot[] = [];

  for (let i = 0; i < obj.slots.length; i++) {
    const slot = obj.slots[i] as Record<string, unknown>;

    // Check required fields
    if (typeof slot.day !== 'string') {
      return { valid: false, error: `Slot ${i + 1}: "day" must be a string.` };
    }

    // Normalize day name
    const normalizedDay = slot.day.charAt(0).toUpperCase() + slot.day.slice(1).toLowerCase();
    if (!VALID_DAYS.includes(normalizedDay)) {
      return { valid: false, error: `Slot ${i + 1}: "${slot.day}" is not a valid day. Use Monday-Saturday.` };
    }

    if (typeof slot.period_number !== 'number' || slot.period_number < 1) {
      return { valid: false, error: `Slot ${i + 1}: "period_number" must be a positive number.` };
    }

    if (typeof slot.subject_raw !== 'string') {
      return { valid: false, error: `Slot ${i + 1}: "subject_raw" must be a string.` };
    }

    // Skip free periods (---, ..., etc.)
    if (isFreePeriod(slot.subject_raw)) {
      continue;
    }

    // Detect lab: either explicit is_lab field, or name contains "lab"
    const isLab = slot.is_lab === true ||
      slot.subject_raw.toLowerCase().includes('lab');

    validatedSlots.push({
      day: normalizedDay,
      period_number: slot.period_number,
      subject_raw: slot.subject_raw.trim(),
      is_lab: isLab,
    });
  }

  if (validatedSlots.length === 0) {
    return { valid: false, error: 'No actual classes found — all slots were free periods.' };
  }

  return {
    valid: true,
    data: { slots: validatedSlots },
  };
}

/**
 * Extract unique subject names from validated timetable data
 */
export function extractUniqueSubjects(data: ValidatedTimetableData): { name: string; isLab: boolean }[] {
  const subjectMap = new Map<string, boolean>();
  for (const slot of data.slots) {
    // If any slot for this subject is marked as lab, the subject is a lab
    const existing = subjectMap.get(slot.subject_raw);
    subjectMap.set(slot.subject_raw, existing || slot.is_lab);
  }
  return Array.from(subjectMap.entries())
    .map(([name, isLab]) => ({ name, isLab }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
