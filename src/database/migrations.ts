/**
 * The 75 Project — Database Migrations
 * Called from SQLiteProvider onInit
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, SEED_PREFERENCES_SQL } from './schema';

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  // Enable WAL mode for better performance
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create all tables
  await db.execAsync(CREATE_TABLES_SQL);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion === 0) {
    // V1 to V2 Migration
    try { await db.execAsync('ALTER TABLE UserPreferences ADD COLUMN semester_end TEXT NOT NULL DEFAULT "";'); } catch {}
    try { await db.execAsync('ALTER TABLE UserPreferences ADD COLUMN exam_start TEXT;'); } catch {}
    try { await db.execAsync('ALTER TABLE UserPreferences ADD COLUMN exam_end TEXT;'); } catch {}
    try { await db.execAsync('ALTER TABLE Subjects ADD COLUMN manual_held_offset INTEGER NOT NULL DEFAULT 0;'); } catch {}
    try { await db.execAsync('ALTER TABLE Subjects ADD COLUMN manual_attended_offset INTEGER NOT NULL DEFAULT 0;'); } catch {}
    await db.execAsync('PRAGMA user_version = 1;');
  }
  
  if (currentVersion <= 1) {
    // V2 to V3 Migration (Exam Periods Table)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ExamPeriods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL
      );
    `);
    
    // Migrate old exam_start/end if they exist
    const prefs = await db.getFirstAsync<{ exam_start: string | null; exam_end: string | null }>('SELECT exam_start, exam_end FROM UserPreferences LIMIT 1');
    if (prefs?.exam_start && prefs?.exam_end) {
      await db.runAsync('INSERT INTO ExamPeriods (name, start_date, end_date) VALUES (?, ?, ?)', ['Migrated Exam', prefs.exam_start, prefs.exam_end]);
    }
    
    await db.execAsync('PRAGMA user_version = 2;');
  }

  // Seed default preferences row
  await db.execAsync(SEED_PREFERENCES_SQL);
}
