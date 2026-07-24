-- ============================================================================
-- The 75 Project — Initial Database Schema
-- Migration 001: All core tables per SRS Section 6
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Regulation Profiles
-- Data-driven rule sets (SRS Section 3) — not hardcoded
-- ============================================================================
CREATE TABLE regulation_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL CHECK (mode IN ('aggregate', 'per_subject')),
    full_eligibility_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.75,
    condonable_floor NUMERIC(5,4) NOT NULL DEFAULT 0.65,
    at_risk_unit TEXT NOT NULL CHECK (at_risk_unit IN ('semester', 'subject')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Students
-- auth_id nullable for guest mode (FR-1.5); local_user_id for guest ownership
-- ============================================================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    local_user_id TEXT,
    year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 5),
    program_type TEXT NOT NULL CHECK (program_type IN ('btech', 'mtech', 'idp')),
    branch TEXT NOT NULL,
    pg_specialization TEXT, -- IDP only
    regulation_profile_id UUID NOT NULL REFERENCES regulation_profiles(id),
    current_semester_id UUID, -- FK added after semesters table if needed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT student_identity CHECK (auth_id IS NOT NULL OR local_user_id IS NOT NULL)
);

CREATE INDEX idx_students_auth_id ON students(auth_id);
CREATE INDEX idx_students_local_user_id ON students(local_user_id);

-- ============================================================================
-- 3. Semesters
-- Track semester boundaries for historical data (FR-10)
-- ============================================================================
CREATE TABLE semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_number INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    exam_start_date DATE,
    exam_end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    regulation_profile_id UUID NOT NULL REFERENCES regulation_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_semesters_student_id ON semesters(student_id);

-- ============================================================================
-- 4. Subjects
-- Per-subject metadata (FR-2.6): UG/PG, optional flag, threshold override
-- ============================================================================
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT NOT NULL CHECK (type IN ('ug', 'pg')),
    credits INTEGER,
    is_lab BOOLEAN NOT NULL DEFAULT false,
    is_optional BOOLEAN NOT NULL DEFAULT false,
    min_attendance_override NUMERIC(5,4), -- custom threshold per subject
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subjects_student_id ON subjects(student_id);
CREATE INDEX idx_subjects_semester_id ON subjects(semester_id);

-- ============================================================================
-- 5. Timetable Slots
-- Recurring weekly schedule template (FR-2)
-- batch field for Lab Batch Divide (FR-2.11)
-- period_span for multi-period blocks
-- ============================================================================
CREATE TABLE timetable_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    day_or_day_order TEXT NOT NULL, -- 'monday', 'tuesday', etc. or 'day_1', 'day_2'
    period INTEGER NOT NULL,
    start_time TIME,
    end_time TIME,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    room TEXT,
    is_lab BOOLEAN NOT NULL DEFAULT false,
    batch TEXT, -- 'A', 'B', or null
    period_span INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timetable_slots_student_id ON timetable_slots(student_id);
CREATE INDEX idx_timetable_slots_semester_id ON timetable_slots(semester_id);
CREATE INDEX idx_timetable_slots_subject_id ON timetable_slots(subject_id);

-- ============================================================================
-- 6. Daily Overrides
-- Real-world exceptions vs. the template (FR-4.1, FR-4.1a)
-- period nullable for day-level rows (day swap, holiday)
-- source_day_key for day-template swaps
-- ============================================================================
CREATE TABLE daily_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period INTEGER, -- null for whole-day overrides
    status TEXT NOT NULL CHECK (status IN (
        'held', 'cancelled', 'holiday', 'extra',
        'exam_mode', 'day_template_swap', 'substitution'
    )),
    original_subject_id UUID REFERENCES subjects(id),
    replacement_subject_id UUID REFERENCES subjects(id), -- for substitutions
    source_day_key TEXT, -- for day_template_swap: which day's template to follow
    source TEXT NOT NULL DEFAULT 'personal' CHECK (source IN ('personal', 'crowd')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_overrides_student_id ON daily_overrides(student_id);
CREATE INDEX idx_daily_overrides_date ON daily_overrides(date);
CREATE INDEX idx_daily_overrides_semester_id ON daily_overrides(semester_id);

-- ============================================================================
-- 7. Attendance Records
-- The actual marks (FR-3); present is default, rows mostly written for absences
-- ============================================================================
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period INTEGER NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, date, period)
);

CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_records_date ON attendance_records(date);
CREATE INDEX idx_attendance_records_subject_id ON attendance_records(subject_id);
CREATE INDEX idx_attendance_records_semester_id ON attendance_records(semester_id);

-- ============================================================================
-- 8. Academic Calendar
-- Working days, holidays, exam windows (FR-6)
-- ============================================================================
CREATE TABLE academic_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('working', 'holiday', 'exam')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_academic_calendar_student_id ON academic_calendar(student_id);
CREATE INDEX idx_academic_calendar_semester_id ON academic_calendar(semester_id);
CREATE INDEX idx_academic_calendar_date ON academic_calendar(date);

-- ============================================================================
-- 9. Class Groups
-- Powers clone-by-code and crowd claims (FR-7)
-- ============================================================================
CREATE TABLE class_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    share_code TEXT NOT NULL UNIQUE,
    creator_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_class_groups_share_code ON class_groups(share_code);
CREATE INDEX idx_class_groups_creator_id ON class_groups(creator_id);

-- ============================================================================
-- 10. Class Group Members
-- role: 'member' or 'cr' — CR gets instant quorum (FR-4.3)
-- ============================================================================
CREATE TABLE class_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_group_id UUID NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'cr')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (class_group_id, student_id)
);

CREATE INDEX idx_class_group_members_class_group_id ON class_group_members(class_group_id);
CREATE INDEX idx_class_group_members_student_id ON class_group_members(student_id);

-- ============================================================================
-- 11. Crowd Reports
-- Generalized claim system: 4 types, assert/reject stances (FR-4.3)
-- One active report per student per claim
-- ============================================================================
CREATE TABLE crowd_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_group_id UUID NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period INTEGER, -- null for whole-day claims (day_swap)
    claim_type TEXT NOT NULL CHECK (claim_type IN (
        'cancellation', 'day_swap', 'period_swap', 'extra_class'
    )),
    claim_payload JSONB NOT NULL DEFAULT '{}',
    stance TEXT NOT NULL CHECK (stance IN ('assert', 'reject')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One active report per student per unique claim
    UNIQUE (class_group_id, student_id, date, period, claim_type)
);

CREATE INDEX idx_crowd_reports_class_group_id ON crowd_reports(class_group_id);
CREATE INDEX idx_crowd_reports_student_id ON crowd_reports(student_id);
CREATE INDEX idx_crowd_reports_date ON crowd_reports(date);

-- ============================================================================
-- 12. Pending Sync (Outbox)
-- Offline outbox queue (SRS Section 8)
-- Client-generated UUIDs for idempotency
-- ============================================================================
CREATE TABLE pending_sync (
    id UUID PRIMARY KEY, -- client-generated, NOT auto-generated
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    payload JSONB NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN (
        'pending', 'syncing', 'synced', 'error'
    )),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pending_sync_student_id ON pending_sync(student_id);
CREATE INDEX idx_pending_sync_status ON pending_sync(sync_status);

-- ============================================================================
-- Updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_timetable_slots_updated_at BEFORE UPDATE ON timetable_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_overrides_updated_at BEFORE UPDATE ON daily_overrides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_academic_calendar_updated_at BEFORE UPDATE ON academic_calendar FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_class_groups_updated_at BEFORE UPDATE ON class_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crowd_reports_updated_at BEFORE UPDATE ON crowd_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pending_sync_updated_at BEFORE UPDATE ON pending_sync FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_semesters_updated_at BEFORE UPDATE ON semesters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_regulation_profiles_updated_at BEFORE UPDATE ON regulation_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
