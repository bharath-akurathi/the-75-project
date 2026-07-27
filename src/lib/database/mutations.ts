import { getDB, withTransaction } from './db';
import * as Crypto from 'expo-crypto';

export async function markAttendance(
  studentId: string,
  semesterId: string,
  date: string,
  period: number,
  subjectId: string,
  status: 'present' | 'absent',
  evidenceTag: string | null = null,
  evidenceAttachment: string | null = null
): Promise<void> {
  await withTransaction(async (db) => {
    // 1. Write to attendance_records (upsert)
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM attendance_records WHERE student_id = ? AND date = ? AND period = ?`,
      [studentId, date, period]
    );

    const recordId = existing?.id || Crypto.randomUUID();
    const now = new Date().toISOString();

    if (existing) {
      await db.runAsync(
        `UPDATE attendance_records 
         SET status = ?, evidence_tag = ?, evidence_attachment = ?, updated_at = ?
         WHERE id = ?`,
        [status, evidenceTag, evidenceAttachment, now, recordId]
      );
    } else {
      await db.runAsync(
        `INSERT INTO attendance_records (id, student_id, semester_id, date, period, subject_id, status, evidence_tag, evidence_attachment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [recordId, studentId, semesterId, date, period, subjectId, status, evidenceTag, evidenceAttachment, now, now]
      );
    }

    // 2. Write to outbox (PendingSync)
    const payload = JSON.stringify({
      id: recordId,
      student_id: studentId,
      semester_id: semesterId,
      date,
      period,
      subject_id: subjectId,
      status,
      evidence_tag: evidenceTag,
      evidence_attachment: evidenceAttachment,
      updated_at: now
    });

    const syncId = Crypto.randomUUID();
    await db.runAsync(
      `INSERT INTO pending_sync (id, student_id, entity_type, operation, payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [syncId, studentId, 'attendance_records', 'UPSERT', payload, now, now]
    );
  });
}

export async function updateEvidence(
  recordId: string,
  evidenceTag: string | null = null,
  evidenceAttachment: string | null = null
): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  await withTransaction(async (transactionDb) => {
    // 1. Write to attendance_records
    await transactionDb.runAsync(
      `UPDATE attendance_records 
       SET evidence_tag = ?, evidence_attachment = ?, updated_at = ?
       WHERE id = ?`,
      [evidenceTag, evidenceAttachment, now, recordId]
    );

    // 2. We need the full record for sync outbox
    const record = await transactionDb.getFirstAsync<any>(
      `SELECT * FROM attendance_records WHERE id = ?`,
      [recordId]
    );

    if (record) {
      const payload = JSON.stringify(record);
      await transactionDb.runAsync(
        `INSERT INTO sync_outbox (id, table_name, operation, payload, created_at)
         VALUES (?, 'attendance_records', 'UPSERT', ?, ?)`,
        [Crypto.randomUUID(), payload, now]
      );
    }
  });
}

export interface SlotData {
  day: string;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_raw: string;
  room: string | null;
  is_lab: boolean;
  period_span: number;
}

export async function saveTimetable(
  studentId: string,
  semesterId: string,
  slots: SlotData[]
): Promise<void> {
  await withTransaction(async (db) => {
    const now = new Date().toISOString();
    
    // 1. Get unique subjects
    const uniqueSubjects = new Set<string>();
    slots.forEach(s => {
      if (s.subject_raw && s.subject_raw.trim() !== '') {
        uniqueSubjects.add(s.subject_raw.trim());
      }
    });

    const subjectMap = new Map<string, string>(); // name -> id

    // 2. Insert subjects
    for (const subName of Array.from(uniqueSubjects)) {
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM subjects WHERE student_id = ? AND semester_id = ? AND name = ?`,
        [studentId, semesterId, subName]
      );
      
      let subId = existing?.id;
      if (!subId) {
        subId = Crypto.randomUUID();
        // Default to UG, not optional
        await db.runAsync(
          `INSERT INTO subjects (id, student_id, semester_id, name, type, is_lab, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [subId, studentId, semesterId, subName, 'UG', 0, now, now]
        );
      }
      subjectMap.set(subName, subId);
    }

    // 3. Clear existing slots for this semester if any?
    // Actually for a clean setup we should clear existing slots or just append.
    // For MVP, we'll clear all slots so "Save Timetable" replaces it.
    await db.runAsync(
      `DELETE FROM timetable_slots WHERE student_id = ? AND semester_id = ?`,
      [studentId, semesterId]
    );

    // 4. Insert slots
    for (const slot of slots) {
      if (!slot.subject_raw || slot.subject_raw.trim() === '') continue;
      
      const subjectId = subjectMap.get(slot.subject_raw.trim());
      if (!subjectId) continue;

      const slotId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO timetable_slots (
           id, student_id, semester_id, day_or_day_order, period, 
           start_time, end_time, subject_id, room, is_lab, period_span, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          slotId, studentId, semesterId, slot.day, slot.period_number,
          slot.start_time, slot.end_time, subjectId, slot.room, 
          slot.is_lab ? 1 : 0, slot.period_span, now, now
        ]
      );
    }
  });
}

export async function addDaySwapOverride(
  studentId: string,
  semesterId: string,
  date: string,
  sourceDayKey: string
): Promise<void> {
  const db = await getDB();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO daily_overrides (id, student_id, semester_id, date, status, source_day_key, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, studentId, semesterId, date, 'day_template_swap', sourceDayKey, 'personal', now, now]
  );
}

export async function addExtraClass(
  studentId: string,
  semesterId: string,
  date: string,
  subjectId: string,
  period: number,
  span: number = 1
): Promise<void> {
  const db = await getDB();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  // Instead of an override, an extra class is just a one-off timetable slot for this date.
  await db.runAsync(
    `INSERT INTO timetable_slots (id, student_id, semester_id, day_or_day_order, period, subject_id, period_span, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, studentId, semesterId, date, period, subjectId, span, now, now]
  );
}

export async function setupStudentProfile(
  authId: string | null,
  localUserId: string,
  programType: string,
  year: number,
  branch: string
): Promise<{ studentId: string; semesterId: string }> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  // Basic inference of regulation profile (hardcoded to standard btech for mvp, unless idp)
  let regulationId = 'd6b412b1-6a27-4a0b-9df2-51a8bc2e9d29'; // btech_regular
  const lowerProgram = programType.toLowerCase();
  if (lowerProgram.includes('m.tech') || lowerProgram.includes('mtech')) {
    regulationId = 'c8d48e1a-9f44-4b95-a226-7bc2b8813a34'; // mtech_regular
  } else if (lowerProgram.includes('idp')) {
    regulationId = year <= 3 ? 'b9f36a4b-8d54-4a2a-89a1-7c9c0c3b1e3e' : 'a2f57b6c-3e2a-4c8d-9b1b-8c8a1d2e5f3c';
  }

  const studentId = authId || localUserId;
  const semesterId = Crypto.randomUUID();

  await withTransaction(async (transactionDb) => {
    await transactionDb.runAsync(
      `INSERT INTO students (id, auth_id, local_user_id, year, program_type, branch, regulation_profile_id, current_semester_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET 
         year = excluded.year, program_type = excluded.program_type, branch = excluded.branch, 
         regulation_profile_id = excluded.regulation_profile_id, current_semester_id = excluded.current_semester_id,
         updated_at = excluded.updated_at`,
      [studentId, authId, localUserId, year, programType, branch, regulationId, semesterId, now, now]
    );

    await transactionDb.runAsync(
      `INSERT INTO semesters (id, student_id, semester_number, start_date, end_date, is_active, regulation_profile_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        semesterId, studentId, year * 2 - 1,
        now,
        new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
        1, regulationId, now, now
      ]
    );
  });

  return { studentId, semesterId };
}
