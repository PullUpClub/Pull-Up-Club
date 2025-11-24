-- =====================================================
-- QUICK DIAGNOSIS - Run this first in Supabase SQL Editor
-- =====================================================

-- 1. Does weekly_earnings table exist?
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'weekly_earnings'
        ) 
        THEN '✅ weekly_earnings EXISTS'
        ELSE '❌ weekly_earnings MISSING - This is the main problem!'
    END as weekly_earnings_check;

-- 2. Check weekly_pools column names
SELECT 
    column_name,
    CASE 
        WHEN column_name IN ('week_start', 'week_end') THEN '✅ Correct'
        WHEN column_name IN ('week_start_date', 'week_end_date') THEN '⚠️ Wrong names'
        ELSE ''
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'weekly_pools'
  AND column_name LIKE '%week%'
ORDER BY column_name;

-- 3. Check if current week pool exists
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Current pool exists'
        ELSE '❌ No current pool - Need to run reset_weekly_pools()'
    END as pool_status,
    COALESCE(MAX(remaining_dollars)::text, 'N/A') as remaining_dollars,
    COALESCE(MAX(spent_dollars)::text, 'N/A') as spent_dollars
FROM weekly_pools 
WHERE is_current = true;

-- 4. Check user_earnings schema
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'user_earnings' AND column_name = 'submission_id'
        ) 
        THEN '✅ OLD schema (submission_id, pool_id)'
        WHEN EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'user_earnings' AND column_name = 'month_year'
        )
        THEN '✅ NEW schema (month_year, total_earned_dollars)'
        ELSE '❌ UNKNOWN schema'
    END as user_earnings_schema;

-- 5. Check active triggers on submissions
SELECT 
    trigger_name,
    CASE 
        WHEN action_statement LIKE '%weekly_earnings%' THEN '⚠️ References weekly_earnings (may fail)'
        ELSE '✅ OK'
    END as status
FROM information_schema.triggers
WHERE event_object_table = 'submissions'
  AND trigger_name LIKE '%earnings%';

-- 6. Check recent approved submissions vs earnings
SELECT 
    'Approved submissions (last 7 days):' as metric,
    COUNT(*)::text as value
FROM submissions
WHERE status = 'approved' 
  AND approved_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'Earnings created (last 7 days):' as metric,
    COALESCE(COUNT(*)::text, '0 (table may not exist)') as value
FROM user_earnings
WHERE created_at > NOW() - INTERVAL '7 days';

-- 7. Test if process_submission_earnings function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'process_submission_earnings'
        )
        THEN '✅ process_submission_earnings() RPC exists'
        ELSE '❌ process_submission_earnings() RPC missing'
    END as rpc_status;

-- 8. Show the actual pool draining issue
SELECT 
    id,
    week_start::date,
    week_end::date,
    total_dollars,
    remaining_dollars,
    spent_dollars,
    is_current,
    CASE 
        WHEN remaining_dollars = total_dollars AND spent_dollars = 0 
        THEN '❌ POOL NEVER DRAINED - No earnings processed'
        WHEN remaining_dollars < total_dollars 
        THEN '✅ Pool is draining correctly'
        ELSE '⚠️ Check manually'
    END as drain_status
FROM weekly_pools
ORDER BY created_at DESC
LIMIT 3;

-- =====================================================
-- SUMMARY
-- =====================================================
SELECT '
🔍 DIAGNOSIS SUMMARY:
1. If weekly_earnings is MISSING → Need to create it
2. If column names are wrong → Need to fix week_start_date references  
3. If pool never drains → Need to add UPDATE logic to trigger
4. If no current pool → Run: SELECT reset_weekly_pools();
5. If submissions > earnings → Earnings processing is broken
' as next_steps;
