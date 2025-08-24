-- Fix performance and security issues
-- Migration: 20250610000001_fix_performance_and_security_issues.sql

-- 1. Fix RLS initialization plan issues for pending_payments
DROP POLICY IF EXISTS "admin_read_pending_payments" ON public.pending_payments;
DROP POLICY IF EXISTS "user_read_pending_payments" ON public.pending_payments;

-- Create a single consolidated policy for both admins and users
CREATE POLICY "read_pending_payments" ON public.pending_payments
    FOR SELECT 
    USING (
        (claimed_by_user_id = (SELECT auth.uid())) OR 
        ((SELECT auth.uid()) IN (SELECT user_id FROM admin_roles))
    );

-- 2. Remove duplicate indexes and constraints
DROP INDEX IF EXISTS idx_payout_requests_month;
ALTER TABLE public.user_earnings DROP CONSTRAINT IF EXISTS user_earnings_user_id_month_year_key;
DROP INDEX IF EXISTS idx_weekly_earnings_submission;

-- 3. Fix materialized view security
-- Remove public access from materialized views
REVOKE ALL ON public.badge_statistics FROM PUBLIC;
REVOKE ALL ON public.leaderboard_cache FROM PUBLIC;

-- Grant access to authenticated users only
GRANT SELECT ON public.badge_statistics TO authenticated;
GRANT SELECT ON public.leaderboard_cache TO authenticated;

-- 4. Add comments for documentation
COMMENT ON POLICY "read_pending_payments" ON public.pending_payments IS 'Users can read their own pending payments, admins can read all';
COMMENT ON MATERIALIZED VIEW public.badge_statistics IS 'Badge statistics for authenticated users';
COMMENT ON MATERIALIZED VIEW public.leaderboard_cache IS 'Cached leaderboard data for authenticated users';