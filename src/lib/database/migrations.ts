import type { SQLiteDatabase } from 'expo-sqlite';
import { INITIALIZE_DB_SQL, SEED_PROFILES_SQL } from './schema';

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  // Enable WAL mode for better performance
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Check for V1 database by looking for user_preferences
  const v1Check = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences';"
  );
  
  if (v1Check) {
    console.log('V1 Database detected. Wiping local data to apply V2 schema...');
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS user_preferences;
      DROP TABLE IF EXISTS period_timings;
      DROP TABLE IF EXISTS subjects;
      DROP TABLE IF EXISTS timetable;
      DROP TABLE IF EXISTS daily_exceptions;
      DROP TABLE IF EXISTS exam_periods;
      PRAGMA foreign_keys = ON;
    `);
  }

  // Create all V2 tables
  await db.execAsync(INITIALIZE_DB_SQL);

  // Seed default regulation profiles
  await db.execAsync(SEED_PROFILES_SQL);
}
