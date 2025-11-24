-- =====================================================
-- PULL-UP CLUB DATABASE DIAGNOSTIC CHECK
-- Project ID: yqnikgupiaghgjtsaypr
-- =====================================================

-- 1. CHECK WHICH TABLES EXIST
-- =====================================================
SELECT 'TABLES THAT EXIST' as check_type;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('weekly_pools', 'weekly_earnings', 'user_earnings', 'payout_requests', 'submissions')
ORDER BY table_name;

-- 2. CHECK TABLE SCHEMAS
-- =====================================================
SELECT '---' as separator, 'TABLE SCHEMAS' as check_type;

-- Check weekly_pools schema
SELECT 'weekly_pools schema:' as table_check;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'weekly_pools'
ORDER BY ordinal_position;

-- Check weekly_earnings schema (if exists)
SELECT 'weekly_earnings schema:' as table_check;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'weekly_earnings'
ORDER BY ordinal_position;

-- Check user_earnings schema
SELECT 'user_earnings schema:' as table_check;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_earnings'
ORDER BY ordinal_position;

-- Check payout_requests schema
SELECT 'payout_requests schema:' as table_check;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payout_requests'
ORDER BY ordinal_position;

-- 3. CHECK ACTIVE TRIGGERS ON SUBMISSIONS TABLE
-- =====================================================
SELECT '---' as separator, 'ACTIVE TRIGGERS' as check_type;
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing, 
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'submissions'
  AND event_object_schema = 'public'
ORDER BY trigger_name;

-- 4. CHECK WEEKLY POOLS DATA
-- =====================================================
SELECT '---' as separator, 'WEEKLY POOLS DATA' as check_type;
SELECT 
    id,
    week_start,
    week_end,
    total_dollars,
    remaining_dollars,
    spent_dollars,
    is_current,
    is_depleted,
    created_at
FROM weekly_pools
ORDER BY created_at DESC
LIMIT 5;

-- 5. CHECK IF WEEKLY_EARNINGS TABLE EXISTS AND HAS DATA
-- =====================================================
SELECT '---' as separator, 'WEEKLY EARNINGS CHECK' as check_type;
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'weekly_earnings'
    ) THEN
        RAISE NOTICE 'weekly_earnings table EXISTS';
        -- Show count
        PERFORM count(*) FROM weekly_earnings;
    ELSE
        RAISE NOTICE 'weekly_earnings table DOES NOT EXIST';
    END IF;
END $$;

-- Try to query weekly_earnings if it exists
SELECT 
    id,
    user_id,
    weekly_pool_id,
    submission_id,
    earning_amount_dollars,
    is_first_submission,
    created_at
FROM weekly_earnings
ORDER BY created_at DESC
LIMIT 5;

-- 6. CHECK USER_EARNINGS DATA
-- =====================================================
SELECT '---' as separator, 'USER EARNINGS DATA' as check_type;
SELECT 
    id,
    user_id,
    month_year,
    total_earned_dollars,
    total_submissions,
    created_at
FROM user_earnings
ORDER BY created_at DESC
LIMIT 5;

-- 7. CHECK PAYOUT_REQUESTS DATA
-- =====================================================
SELECT '---' as separator, 'PAYOUT REQUESTS DATA' as check_type;
SELECT 
    id,
    user_id,
    amount_dollars,
    status,
    paypal_email,
    payout_month,
    request_date
FROM payout_requests
ORDER BY request_date DESC
LIMIT 5;

-- 8. CHECK RECENT APPROVED SUBMISSIONS
-- =====================================================
SELECT '---' as separator, 'RECENT APPROVED SUBMISSIONS' as check_type;
SELECT 
    id,
    user_id,
    actual_pull_up_count,
    status,
    approved_at,
    created_at
FROM submissions
WHERE status = 'approved'
ORDER BY approved_at DESC NULLS LAST
LIMIT 10;

-- 9. CHECK RPC FUNCTIONS
-- =====================================================
SELECT '---' as separator, 'RPC FUNCTIONS' as check_type;
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'process_submission_earnings',
    'process_earnings_on_approval',
    'generate_monthly_payouts',
    'generate_monthly_payouts_smart',
    'get_payouts_by_month'
  )
ORDER BY routine_name;

-- 10. CHECK RLS POLICIES
-- =====================================================
SELECT '---' as separator, 'RLS POLICIES' as check_type;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('weekly_pools', 'weekly_earnings', 'user_earnings', 'payout_requests')
ORDER BY tablename, policyname;

-- 11. TEST PROCESS_SUBMISSION_EARNINGS FUNCTION (if exists)
-- =====================================================
SELECT '---' as separator, 'FUNCTION SIGNATURE CHECK' as check_type;
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('process_submission_earnings', 'process_earnings_on_approval')
ORDER BY p.proname;

-- 12. CHECK FOR CURRENT WEEK POOL
-- =====================================================
SELECT '---' as separator, 'CURRENT WEEK POOL STATUS' as check_type;
SELECT 
    id,
    week_start,
    week_end,
    total_dollars,
    remaining_dollars,
    is_current,
    is_depleted,
    CASE 
        WHEN CURRENT_DATE BETWEEN week_start AND week_end THEN 'ACTIVE'
        WHEN week_end < CURRENT_DATE THEN 'PAST'
        ELSE 'FUTURE'
    END as pool_status
FROM weekly_pools
WHERE is_current = true 
   OR CURRENT_DATE BETWEEN week_start AND week_end
ORDER BY week_start DESC;

-- 13. CHECK EARNINGS FLOW FOR A RECENT SUBMISSION
-- =====================================================
SELECT '---' as separator, 'EARNINGS FLOW TEST' as check_type;
WITH recent_approved AS (
    SELECT id, user_id, actual_pull_up_count, approved_at
    FROM submissions
    WHERE status = 'approved'
    ORDER BY approved_at DESC NULLS LAST
    LIMIT 1
)
SELECT 
    'Submission' as record_type,
    s.id,
    s.user_id,
    s.actual_pull_up_count,
    s.approved_at
FROM recent_approved s
UNION ALL
SELECT 
    'Weekly Earning (if exists)' as record_type,
    we.id,
    we.user_id,
    we.earning_amount_dollars::integer,
    we.created_at
FROM recent_approved s
JOIN weekly_earnings we ON we.submission_id = s.id
UNION ALL
SELECT 
    'User Earning (if exists)' as record_type,
    ue.id,
    ue.user_id,
    ue.total_earned_dollars,
    ue.created_at
FROM recent_approved s
JOIN user_earnings ue ON ue.user_id = s.user_id;

-- =====================================================
-- END OF DIAGNOSTIC CHECK
-- =====================================================
SELECT '---' as separator, 'DIAGNOSTIC CHECK COMPLETE' as status;
