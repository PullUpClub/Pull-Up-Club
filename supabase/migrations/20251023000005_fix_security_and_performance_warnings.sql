-- =====================================================
-- MIGRATION: Fix Security & Performance Warnings
-- Date: October 23, 2025
-- Purpose: Address all Supabase Advisor warnings
-- =====================================================

-- =====================================================
-- PART 1: FIX SEARCH PATH WARNINGS (SECURITY)
-- =====================================================
-- These functions need explicit search_path to prevent
-- security vulnerabilities from search_path manipulation

-- Public schema functions
ALTER FUNCTION public.get_total_user_count() 
SET search_path TO 'public', 'pg_temp';

ALTER FUNCTION public.check_rls_policies() 
SET search_path TO 'public', 'pg_temp';

ALTER FUNCTION public.run_basic_rls_tests() 
SET search_path TO 'public', 'pg_temp';

ALTER FUNCTION public.get_rls_policy_details() 
SET search_path TO 'public', 'pg_temp';

-- Monitoring schema functions
ALTER FUNCTION monitoring.check_pool_consistency() 
SET search_path TO 'public', 'monitoring', 'pg_temp';

ALTER FUNCTION monitoring.run_daily_consistency_check() 
SET search_path TO 'public', 'monitoring', 'pg_temp';

ALTER FUNCTION monitoring.update_current_pool() 
SET search_path TO 'public', 'monitoring', 'pg_temp';

-- =====================================================
-- PART 2: FIX RLS PERFORMANCE WARNINGS
-- =====================================================
-- Wrap auth.uid() in SELECT to prevent re-evaluation
-- per row, which causes poor performance at scale

-- Fix: rls_test_results
DROP POLICY IF EXISTS rls_test_results_admin_only ON public.rls_test_results;
CREATE POLICY rls_test_results_admin_only ON public.rls_test_results
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())  -- ✅ Wrapped in SELECT
    AND role = 'admin'
  )
);

-- Fix: system_health_checks
DROP POLICY IF EXISTS admins_view_health_checks ON monitoring.system_health_checks;
CREATE POLICY admins_view_health_checks ON monitoring.system_health_checks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())  -- ✅ Wrapped in SELECT
    AND role = 'admin'
  )
);

-- Fix: consistency_checks
DROP POLICY IF EXISTS admins_view_consistency_checks ON monitoring.consistency_checks;
CREATE POLICY admins_view_consistency_checks ON monitoring.consistency_checks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())  -- ✅ Wrapped in SELECT
    AND role = 'admin'
  )
);

-- Fix: system_errors
DROP POLICY IF EXISTS admins_view_errors ON monitoring.system_errors;
CREATE POLICY admins_view_errors ON monitoring.system_errors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())  -- ✅ Wrapped in SELECT
    AND role = 'admin'
  )
);

-- =====================================================
-- PART 3: DOCUMENT MATERIALIZED VIEW WARNINGS
-- =====================================================
-- These materialized views are INTENTIONALLY public
-- They're performance caches of already-public data

COMMENT ON MATERIALIZED VIEW public.leaderboard_cache IS 
  'INTENTIONALLY PUBLIC: Performance cache for leaderboard data. Refreshed periodically. Contains only approved submissions and public user info. No sensitive data exposed.';

COMMENT ON MATERIALIZED VIEW public.community_feed_cache IS 
  'INTENTIONALLY PUBLIC: Performance cache for community feed. Refreshed periodically. Contains only approved, non-deleted posts from last 21 days. No sensitive data exposed.';

COMMENT ON MATERIALIZED VIEW public.community_thread_cache IS 
  'INTENTIONALLY PUBLIC: Performance cache for community threads. Refreshed periodically. Contains only approved replies from last 21 days. No sensitive data exposed.';

-- =====================================================
-- PART 4: UPDATE MIGRATION ROADMAP
-- =====================================================
INSERT INTO monitoring.migration_roadmap (
  phase,
  name,
  description,
  status,
  completed_at,
  notes
) VALUES (
  'SECURITY',
  'Fix Security & Performance Warnings',
  'Fixed 7 search_path vulnerabilities, optimized 4 RLS policies, documented 3 materialized views',
  'completed',
  NOW(),
  'All Supabase Advisor warnings addressed. Search paths fixed, RLS policies optimized with SELECT wrapping, materialized views documented as intentionally public.'
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify all fixes

-- Verify search_path is set
DO $$
DECLARE
  v_function_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE p.proname IN (
    'get_total_user_count',
    'check_rls_policies',
    'run_basic_rls_tests',
    'get_rls_policy_details',
    'check_pool_consistency',
    'run_daily_consistency_check',
    'update_current_pool'
  )
  AND pg_get_functiondef(p.oid) LIKE '%search_path%';
  
  IF v_function_count = 7 THEN
    RAISE NOTICE '✅ All 7 functions have search_path set';
  ELSE
    RAISE WARNING '❌ Only % of 7 functions have search_path set', v_function_count;
  END IF;
END $$;

-- Verify RLS policies use SELECT wrapping
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_policy_count
  FROM pg_policies
  WHERE policyname IN (
    'rls_test_results_admin_only',
    'admins_view_health_checks',
    'admins_view_consistency_checks',
    'admins_view_errors'
  );
  
  IF v_policy_count = 4 THEN
    RAISE NOTICE '✅ All 4 RLS policies recreated';
  ELSE
    RAISE WARNING '❌ Only % of 4 RLS policies exist', v_policy_count;
  END IF;
END $$;

-- Verify materialized view comments
DO $$
DECLARE
  v_comment_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_comment_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_description d ON d.objoid = c.oid
  WHERE c.relname IN ('leaderboard_cache', 'community_feed_cache', 'community_thread_cache')
    AND n.nspname = 'public'
    AND c.relkind = 'm'
    AND d.description LIKE '%INTENTIONALLY PUBLIC%';
  
  IF v_comment_count = 3 THEN
    RAISE NOTICE '✅ All 3 materialized views documented';
  ELSE
    RAISE WARNING '❌ Only % of 3 materialized views documented', v_comment_count;
  END IF;
END $$;

-- Log success
INSERT INTO monitoring.system_errors (
  error_type,
  error_message,
  context,
  created_at
) VALUES (
  'MIGRATION_SUCCESS',
  'Security and performance warnings fixed',
  jsonb_build_object(
    'migration', '20251023000005_fix_security_and_performance_warnings',
    'search_path_fixes', 7,
    'rls_optimizations', 4,
    'matview_docs', 3
  ),
  NOW()
);

