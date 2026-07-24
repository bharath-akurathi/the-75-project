-- ============================================================================
-- The 75 Project — Row Level Security Policies
-- Migration 002: RLS on every table (SRS Section 11, item 1)
-- 
-- CRITICAL: Tables created via SQL/migrations do NOT get RLS automatically.
-- Skipping this means anyone with the anon key can read/write every row.
-- ============================================================================

-- ============================================================================
-- Enable RLS on ALL tables
-- ============================================================================
ALTER TABLE regulation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crowd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_sync ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Regulation Profiles — readable by everyone (public reference data)
-- ============================================================================
CREATE POLICY "regulation_profiles_read_all"
    ON regulation_profiles FOR SELECT
    USING (true);

-- ============================================================================
-- Students — owner-only access via auth.uid()
-- ============================================================================
CREATE POLICY "students_read_own"
    ON students FOR SELECT
    USING (auth.uid() = auth_id);

CREATE POLICY "students_insert_own"
    ON students FOR INSERT
    WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "students_update_own"
    ON students FOR UPDATE
    USING (auth.uid() = auth_id)
    WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "students_delete_own"
    ON students FOR DELETE
    USING (auth.uid() = auth_id);

-- ============================================================================
-- Semesters — owner-only via student lookup
-- ============================================================================
CREATE POLICY "semesters_read_own"
    ON semesters FOR SELECT
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "semesters_insert_own"
    ON semesters FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "semesters_update_own"
    ON semesters FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "semesters_delete_own"
    ON semesters FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Subjects — owner-only via student lookup
-- ============================================================================
CREATE POLICY "subjects_read_own"
    ON subjects FOR SELECT
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "subjects_insert_own"
    ON subjects FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "subjects_update_own"
    ON subjects FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "subjects_delete_own"
    ON subjects FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Timetable Slots — owner-only via student lookup
-- ============================================================================
CREATE POLICY "timetable_slots_read_own"
    ON timetable_slots FOR SELECT
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "timetable_slots_insert_own"
    ON timetable_slots FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "timetable_slots_update_own"
    ON timetable_slots FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "timetable_slots_delete_own"
    ON timetable_slots FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Daily Overrides — owner-only via student lookup
-- ============================================================================
CREATE POLICY "daily_overrides_read_own"
    ON daily_overrides FOR SELECT
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "daily_overrides_insert_own"
    ON daily_overrides FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "daily_overrides_update_own"
    ON daily_overrides FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "daily_overrides_delete_own"
    ON daily_overrides FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Attendance Records — owner-only via student lookup
-- ============================================================================
CREATE POLICY "attendance_records_read_own"
    ON attendance_records FOR SELECT
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "attendance_records_insert_own"
    ON attendance_records FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "attendance_records_update_own"
    ON attendance_records FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "attendance_records_delete_own"
    ON attendance_records FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Academic Calendar — owner-only via student lookup
-- ============================================================================
CREATE POLICY "academic_calendar_read_own"
    ON academic_calendar FOR SELECT
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "academic_calendar_insert_own"
    ON academic_calendar FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "academic_calendar_update_own"
    ON academic_calendar FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "academic_calendar_delete_own"
    ON academic_calendar FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Class Groups — creator can manage; members can read
-- ============================================================================
CREATE POLICY "class_groups_read_member"
    ON class_groups FOR SELECT
    USING (
        id IN (SELECT class_group_id FROM class_group_members WHERE student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
        OR creator_id IN (SELECT id FROM students WHERE auth_id = auth.uid())
    );

CREATE POLICY "class_groups_read_by_share_code"
    ON class_groups FOR SELECT
    USING (true); -- share code lookup needs to be public for joining

CREATE POLICY "class_groups_insert_own"
    ON class_groups FOR INSERT
    WITH CHECK (creator_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "class_groups_update_creator"
    ON class_groups FOR UPDATE
    USING (creator_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (creator_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "class_groups_delete_creator"
    ON class_groups FOR DELETE
    USING (creator_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Class Group Members — membership-scoped access
-- ============================================================================
CREATE POLICY "class_group_members_read_group"
    ON class_group_members FOR SELECT
    USING (
        class_group_id IN (
            SELECT class_group_id FROM class_group_members
            WHERE student_id IN (SELECT id FROM students WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "class_group_members_insert_self"
    ON class_group_members FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "class_group_members_update_self"
    ON class_group_members FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "class_group_members_delete_self"
    ON class_group_members FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Crowd Reports — membership-scoped read; own-student write
-- ============================================================================
CREATE POLICY "crowd_reports_read_group_member"
    ON crowd_reports FOR SELECT
    USING (
        class_group_id IN (
            SELECT class_group_id FROM class_group_members
            WHERE student_id IN (SELECT id FROM students WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "crowd_reports_insert_own"
    ON crowd_reports FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "crowd_reports_update_own"
    ON crowd_reports FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "crowd_reports_delete_own"
    ON crowd_reports FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Pending Sync — owner-only (outbox is personal)
-- ============================================================================
CREATE POLICY "pending_sync_read_own"
    ON pending_sync FOR SELECT
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "pending_sync_insert_own"
    ON pending_sync FOR INSERT
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "pending_sync_update_own"
    ON pending_sync FOR UPDATE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()))
    WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

CREATE POLICY "pending_sync_delete_own"
    ON pending_sync FOR DELETE
    USING (student_id IN (SELECT id FROM students WHERE auth_id = auth.uid()));

-- ============================================================================
-- Verify: all tables should show rowsecurity = true
-- ============================================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
