import * as SQLite from 'expo-sqlite';
import { INITIALIZE_DB_SQL, SEED_PROFILES_SQL } from './schema';

/**
 * The 75 Project — Database Provider
 * Local SQLite instance used for all reads/writes.
 */

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await SQLite.openDatabaseAsync('the75project.db');
  
  // Initialize schema
  await dbInstance.execAsync(INITIALIZE_DB_SQL);
  await dbInstance.execAsync(SEED_PROFILES_SQL);

  return dbInstance;
}

/**
 * Execute an atomic transaction (FR-12.1).
 * Crucial for the dual-write pattern: update real table + append to outbox.
 */
export async function withTransaction<T>(
  work: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDB();
  try {
    await db.execAsync('BEGIN TRANSACTION;');
    const result = await work(db);
    await db.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * Clears all user data. Used during testing or guest mode clear.
 */
export async function clearDatabase(): Promise<void> {
  const db = await getDB();
  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM students;
    DELETE FROM semesters;
    DELETE FROM subjects;
    DELETE FROM timetable_slots;
    DELETE FROM daily_overrides;
    DELETE FROM attendance_records;
    DELETE FROM academic_calendar;
    DELETE FROM class_groups;
    DELETE FROM class_group_members;
    DELETE FROM crowd_reports;
    DELETE FROM pending_sync;
    PRAGMA foreign_keys = ON;
  `);
}
