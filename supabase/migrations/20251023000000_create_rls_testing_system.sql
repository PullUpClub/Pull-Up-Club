-- ============================================
-- RLS POLICY TESTING SYSTEM
-- ============================================
-- This migration creates a comprehensive testing system for RLS policies
-- Run this after any migration that modifies RLS policies

-- Create table to store RLS test results
CREATE TABLE IF NOT EXISTS rls_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
    user_role TEXT NOT NULL, -- owner, admin, public, authenticated
    expected_result BOOLEAN NOT NULL,
    actual_result BOOLEAN,
    success BOOLEAN,
    error_message TEXT,
    test_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on test results (admins only)
ALTER TABLE rls_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_test_results_admin_only" ON rls_test_results
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1 FROM admin_roles
            WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- RLS TESTING FUNCTIONS
-- ============================================

-- Function to test profiles table RLS policies
CREATE OR REPLACE FUNCTION test_profiles_rls_policies()
RETURNS TABLE(
    test_name TEXT,
    table_name TEXT,
    operation TEXT,
    user_role TEXT,
    expected_result BOOLEAN,
    actual_result BOOLEAN,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    test_user_id UUID;
    other_user_id UUID;
    admin_user_id UUID;
    test_record RECORD;
BEGIN
    -- Clean up any existing test data
    DELETE FROM profiles WHERE email LIKE '%rls-test%';
    DELETE FROM admin_roles WHERE user_id IN (
        SELECT id FROM auth.users WHERE email LIKE '%rls-test%'
    );
    
    -- Create test users in auth.users (simulate auth trigger)
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), 'rls-test-user@test.com', 'dummy', NOW(), NOW(), NOW()),
        (gen_random_uuid(), 'rls-test-other@test.com', 'dummy', NOW(), NOW(), NOW()),
        (gen_random_uuid(), 'rls-test-admin@test.com', 'dummy', NOW(), NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
    RETURNING id;
    
    -- Get the test user IDs
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'rls-test-user@test.com';
    SELECT id INTO other_user_id FROM auth.users WHERE email = 'rls-test-other@test.com';
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'rls-test-admin@test.com';
    
    -- Create test profiles
    INSERT INTO profiles (id, email, full_name, is_profile_completed)
    VALUES 
        (test_user_id, 'rls-test-user@test.com', 'Test User', true),
        (other_user_id, 'rls-test-other@test.com', 'Other User', true),
        (admin_user_id, 'rls-test-admin@test.com', 'Admin User', true)
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    
    -- Make admin user an admin
    INSERT INTO admin_roles (user_id, role, is_active)
    VALUES (admin_user_id, 'admin', true)
    ON CONFLICT (user_id) DO UPDATE SET is_active = true;
    
    -- Test 1: User can SELECT their own profile
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
        PERFORM set_config('role', 'authenticated', true);
        
        PERFORM * FROM profiles WHERE id = test_user_id;
        
        RETURN QUERY SELECT 
            'user_select_own_profile'::TEXT,
            'profiles'::TEXT,
            'SELECT'::TEXT,
            'owner'::TEXT,
            true::BOOLEAN,
            true::BOOLEAN,
            true::BOOLEAN,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'user_select_own_profile'::TEXT,
            'profiles'::TEXT,
            'SELECT'::TEXT,
            'owner'::TEXT,
            true::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            SQLERRM::TEXT;
    END;
    
    -- Test 2: User can UPDATE their own profile
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
        PERFORM set_config('role', 'authenticated', true);
        
        UPDATE profiles SET full_name = 'Updated Name' WHERE id = test_user_id;
        
        RETURN QUERY SELECT 
            'user_update_own_profile'::TEXT,
            'profiles'::TEXT,
            'UPDATE'::TEXT,
            'owner'::TEXT,
            true::BOOLEAN,
            true::BOOLEAN,
            true::BOOLEAN,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'user_update_own_profile'::TEXT,
            'profiles'::TEXT,
            'UPDATE'::TEXT,
            'owner'::TEXT,
            true::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            SQLERRM::TEXT;
    END;
    
    -- Test 3: User CANNOT UPDATE other user's profile
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
        PERFORM set_config('role', 'authenticated', true);
        
        UPDATE profiles SET full_name = 'Hacked Name' WHERE id = other_user_id;
        
        -- If we get here, the policy failed (should have been blocked)
        RETURN QUERY SELECT 
            'user_cannot_update_other_profile'::TEXT,
            'profiles'::TEXT,
            'UPDATE'::TEXT,
            'other'::TEXT,
            false::BOOLEAN,
            true::BOOLEAN,
            false::BOOLEAN,
            'Policy allowed unauthorized update'::TEXT;
    EXCEPTION WHEN insufficient_privilege THEN
        -- This is expected - policy correctly blocked the update
        RETURN QUERY SELECT 
            'user_cannot_update_other_profile'::TEXT,
            'profiles'::TEXT,
            'UPDATE'::TEXT,
            'other'::TEXT,
            false::BOOLEAN,
            false::BOOLEAN,
            true::BOOLEAN,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'user_cannot_update_other_profile'::TEXT,
            'profiles'::TEXT,
            'UPDATE'::TEXT,
            'other'::TEXT,
            false::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            SQLERRM::TEXT;
    END;
    
    -- Test 4: Admin can UPDATE any profile
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_user_id)::text, true);
        PERFORM set_config('role', 'authenticated', true);
        
        UPDATE profiles SET full_name = 'Admin Updated' WHERE id = test_user_id;
        
        RETURN QUERY SELECT 
            'admin_can_update_any_profile'::TEXT,
            'profiles'::TEXT,
            'UPDATE'::TEXT,
            'admin'::TEXT,
            true::BOOLEAN,
            true::BOOLEAN,
            true::BOOLEAN,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'admin_can_update_any_profile'::TEXT,
            'profiles'::TEXT,
            'UPDATE'::TEXT,
            'admin'::TEXT,
            true::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            SQLERRM::TEXT;
    END;
    
    -- Test 5: Public can SELECT approved users (for leaderboard)
    BEGIN
        -- First create an approved submission for test_user
        INSERT INTO submissions (id, user_id, video_url, pull_up_count, status, actual_pull_up_count)
        VALUES (gen_random_uuid(), test_user_id, 'test-video.mp4', 10, 'approved', 10);
        
        PERFORM set_config('request.jwt.claims', NULL, true);
        PERFORM set_config('role', 'anon', true);
        
        PERFORM * FROM profiles WHERE id = test_user_id;
        
        RETURN QUERY SELECT 
            'public_can_select_approved_users'::TEXT,
            'profiles'::TEXT,
            'SELECT'::TEXT,
            'public'::TEXT,
            true::BOOLEAN,
            true::BOOLEAN,
            true::BOOLEAN,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'public_can_select_approved_users'::TEXT,
            'profiles'::TEXT,
            'SELECT'::TEXT,
            'public'::TEXT,
            true::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            SQLERRM::TEXT;
    END;
    
    -- Clean up test data
    DELETE FROM submissions WHERE user_id IN (test_user_id, other_user_id, admin_user_id);
    DELETE FROM admin_roles WHERE user_id = admin_user_id;
    DELETE FROM profiles WHERE id IN (test_user_id, other_user_id, admin_user_id);
    DELETE FROM auth.users WHERE email LIKE '%rls-test%';
    
    -- Reset session
    PERFORM set_config('request.jwt.claims', NULL, true);
    PERFORM set_config('role', 'authenticated', true);
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to test submissions table RLS policies
CREATE OR REPLACE FUNCTION test_submissions_rls_policies()
RETURNS TABLE(
    test_name TEXT,
    table_name TEXT,
    operation TEXT,
    user_role TEXT,
    expected_result BOOLEAN,
    actual_result BOOLEAN,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    test_user_id UUID;
    other_user_id UUID;
    admin_user_id UUID;
    test_submission_id UUID;
BEGIN
    -- Create test users and profiles (similar setup as profiles test)
    DELETE FROM profiles WHERE email LIKE '%rls-test%';
    DELETE FROM admin_roles WHERE user_id IN (
        SELECT id FROM auth.users WHERE email LIKE '%rls-test%'
    );
    
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), 'rls-test-user@test.com', 'dummy', NOW(), NOW(), NOW()),
        (gen_random_uuid(), 'rls-test-other@test.com', 'dummy', NOW(), NOW(), NOW()),
        (gen_random_uuid(), 'rls-test-admin@test.com', 'dummy', NOW(), NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET updated_at = NOW();
    
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'rls-test-user@test.com';
    SELECT id INTO other_user_id FROM auth.users WHERE email = 'rls-test-other@test.com';
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'rls-test-admin@test.com';
    
    INSERT INTO profiles (id, email, full_name, is_profile_completed)
    VALUES 
        (test_user_id, 'rls-test-user@test.com', 'Test User', true),
        (other_user_id, 'rls-test-other@test.com', 'Other User', true),
        (admin_user_id, 'rls-test-admin@test.com', 'Admin User', true)
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    
    INSERT INTO admin_roles (user_id, role, is_active)
    VALUES (admin_user_id, 'admin', true)
    ON CONFLICT (user_id) DO UPDATE SET is_active = true;
    
    -- Create test submission
    INSERT INTO submissions (id, user_id, video_url, pull_up_count, status)
    VALUES (gen_random_uuid(), test_user_id, 'test-video.mp4', 10, 'rejected')
    RETURNING id INTO test_submission_id;
    
    -- Test 1: User can UPDATE their rejected submission
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
        PERFORM set_config('role', 'authenticated', true);
        
        UPDATE submissions SET pull_up_count = 15 WHERE id = test_submission_id;
        
        RETURN QUERY SELECT 
            'user_update_rejected_submission'::TEXT,
            'submissions'::TEXT,
            'UPDATE'::TEXT,
            'owner'::TEXT,
            true::BOOLEAN,
            true::BOOLEAN,
            true::BOOLEAN,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'user_update_rejected_submission'::TEXT,
            'submissions'::TEXT,
            'UPDATE'::TEXT,
            'owner'::TEXT,
            true::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            SQLERRM::TEXT;
    END;
    
    -- Test 2: Admin can UPDATE any submission
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_user_id)::text, true);
        PERFORM set_config('role', 'authenticated', true);
        
        UPDATE submissions SET status = 'approved', actual_pull_up_count = 15 WHERE id = test_submission_id;
        
        RETURN QUERY SELECT 
            'admin_update_any_submission'::TEXT,
            'submissions'::TEXT,
            'UPDATE'::TEXT,
            'admin'::TEXT,
            true::BOOLEAN,
            true::BOOLEAN,
            true::BOOLEAN,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'admin_update_any_submission'::TEXT,
            'submissions'::TEXT,
            'UPDATE'::TEXT,
            'admin'::TEXT,
            true::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            SQLERRM::TEXT;
    END;
    
    -- Clean up
    DELETE FROM submissions WHERE user_id IN (test_user_id, other_user_id, admin_user_id);
    DELETE FROM admin_roles WHERE user_id = admin_user_id;
    DELETE FROM profiles WHERE id IN (test_user_id, other_user_id, admin_user_id);
    DELETE FROM auth.users WHERE email LIKE '%rls-test%';
    
    PERFORM set_config('request.jwt.claims', NULL, true);
    PERFORM set_config('role', 'authenticated', true);
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master function to run all RLS tests
CREATE OR REPLACE FUNCTION run_all_rls_tests()
RETURNS TABLE(
    test_summary TEXT,
    total_tests INTEGER,
    passed_tests INTEGER,
    failed_tests INTEGER,
    success_rate NUMERIC
) AS $$
DECLARE
    total_count INTEGER := 0;
    passed_count INTEGER := 0;
    failed_count INTEGER := 0;
    success_percentage NUMERIC;
BEGIN
    -- Clear previous test results
    DELETE FROM rls_test_results WHERE created_at < NOW() - INTERVAL '1 hour';
    
    -- Insert profiles test results
    INSERT INTO rls_test_results (test_name, table_name, operation, user_role, expected_result, actual_result, success, error_message)
    SELECT * FROM test_profiles_rls_policies();
    
    -- Insert submissions test results
    INSERT INTO rls_test_results (test_name, table_name, operation, user_role, expected_result, actual_result, success, error_message)
    SELECT * FROM test_submissions_rls_policies();
    
    -- Calculate summary
    SELECT COUNT(*), COUNT(*) FILTER (WHERE success = true), COUNT(*) FILTER (WHERE success = false)
    INTO total_count, passed_count, failed_count
    FROM rls_test_results
    WHERE created_at > NOW() - INTERVAL '5 minutes';
    
    success_percentage := CASE 
        WHEN total_count = 0 THEN 0 
        ELSE ROUND((passed_count::NUMERIC / total_count::NUMERIC) * 100, 2) 
    END;
    
    RETURN QUERY SELECT 
        'RLS Policy Test Summary'::TEXT,
        total_count,
        passed_count,
        failed_count,
        success_percentage;
        
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get detailed test results
CREATE OR REPLACE FUNCTION get_rls_test_details()
RETURNS TABLE(
    test_name TEXT,
    table_name TEXT,
    operation TEXT,
    user_role TEXT,
    expected_result BOOLEAN,
    actual_result BOOLEAN,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        r.test_name,
        r.table_name,
        r.operation,
        r.user_role,
        r.expected_result,
        r.actual_result,
        r.success,
        r.error_message,
        r.created_at
    FROM rls_test_results r
    WHERE r.created_at > NOW() - INTERVAL '1 hour'
    ORDER BY r.created_at DESC, r.success ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log the creation of the testing system
INSERT INTO system_logs (operation, details) 
VALUES (
    'rls_testing_system_created', 
    json_build_object(
        'timestamp', NOW(),
        'description', 'Comprehensive RLS policy testing system created',
        'functions_created', ARRAY[
            'test_profiles_rls_policies()',
            'test_submissions_rls_policies()',
            'run_all_rls_tests()',
            'get_rls_test_details()'
        ],
        'usage', 'Run SELECT * FROM run_all_rls_tests(); after any RLS policy changes'
    )
);
