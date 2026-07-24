-- ============================================================================
-- The 75 Project — Seed Regulation Profiles
-- Migration 003: 4 profiles per SRS Section 3.1
-- These are data-driven rule sets, not hardcoded logic
-- ============================================================================

INSERT INTO regulation_profiles (name, mode, full_eligibility_threshold, condonable_floor, at_risk_unit)
VALUES
    -- B.Tech regular, all 4 years: aggregate across all subjects per semester
    ('btech_regular', 'aggregate', 0.75, 0.65, 'semester'),

    -- M.Tech regular, whole program: per subject individually
    ('mtech_regular', 'per_subject', 0.75, 0.65, 'subject'),

    -- IDP years 1-3: aggregate (same mechanism as B.Tech)
    ('idp_years_1_3', 'aggregate', 0.75, 0.65, 'semester'),

    -- IDP years 4-5: per subject (same mechanism as M.Tech)
    ('idp_years_4_5', 'per_subject', 0.75, 0.65, 'subject');
