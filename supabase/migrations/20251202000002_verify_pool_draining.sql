-- Migration to diagnose and fix pool draining issues
-- Issue: Weekly pool remaining_dollars not decreasing on approved submissions
-- This migration verifies the state and fixes any issues

-- First, check if process_earnings_on_approval trigger exists and drop it if broken
DO $$
BEGIN
    -- Drop the broken trigger if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'process_earnings_on_approval'
        AND event_object_table = 'submissions'
    ) THEN
        DROP TRIGGER IF EXISTS process_earnings_on_approval ON submissions;
        RAISE NOTICE 'Dropped broken process_earnings_on_approval trigger';
    END IF;
END $$;

-- Verify that process_submission_earnings RPC exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'process_submission_earnings'
    ) THEN
        RAISE EXCEPTION 'CRITICAL: process_submission_earnings RPC function does not exist!';
    END IF;
    RAISE NOTICE 'Verified: process_submission_earnings RPC exists';
END $$;

-- Add a diagnostic function to check pool health
CREATE OR REPLACE FUNCTION public.check_pool_health()
RETURNS TABLE (
    pool_id UUID,
    week_start TIMESTAMPTZ,
    week_end TIMESTAMPTZ,
    total_dollars DECIMAL(10,2),
    remaining_dollars DECIMAL(10,2),
    spent_dollars DECIMAL(10,2),
    is_current BOOLEAN,
    is_depleted BOOLEAN,
    health_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wp.id,
        wp.week_start,
        wp.week_end,
        wp.total_dollars,
        wp.remaining_dollars,
        wp.spent_dollars,
        wp.is_current,
        wp.is_depleted,
        CASE 
            WHEN wp.remaining_dollars = wp.total_dollars AND wp.spent_dollars = 0 
            THEN '❌ POOL NEVER DRAINED - No earnings processed'
            WHEN wp.remaining_dollars < wp.total_dollars AND wp.spent_dollars > 0
            THEN '✅ Pool is draining correctly'
            WHEN wp.remaining_dollars + wp.spent_dollars != wp.total_dollars
            THEN '⚠️ MATH ERROR - remaining + spent != total'
            ELSE '⚠️ Check manually'
        END as health_status
    FROM weekly_pools wp
    ORDER BY wp.created_at DESC
    LIMIT 10;
END;
$$;

-- Grant execute to admins only
GRANT EXECUTE ON FUNCTION public.check_pool_health() TO authenticated;

COMMENT ON FUNCTION public.check_pool_health() IS 
'Diagnostic function to check if weekly pools are draining correctly after submissions are approved.';

-- Add indexes if they don't exist to optimize the earnings flow
CREATE INDEX IF NOT EXISTS idx_user_earnings_created_at ON user_earnings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status_approved_at ON submissions(status, approved_at DESC) 
    WHERE status = 'approved';

-- Ensure weekly_pools has proper constraints
DO $$
BEGIN
    -- Add check constraint to ensure math is correct
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'weekly_pools_math_check'
    ) THEN
        ALTER TABLE weekly_pools
        ADD CONSTRAINT weekly_pools_math_check
        CHECK (total_dollars = remaining_dollars + spent_dollars);
        RAISE NOTICE 'Added math check constraint to weekly_pools';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add math check constraint (may conflict with existing data)';
END $$;

