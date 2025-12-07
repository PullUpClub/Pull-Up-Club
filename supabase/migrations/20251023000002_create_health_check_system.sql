-- Create system health monitoring infrastructure
-- This migration establishes comprehensive health checking and error tracking

-- ============================================
-- 1. System Health Checks Table
-- ============================================
CREATE TABLE IF NOT EXISTS system_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    overall_status TEXT NOT NULL CHECK (overall_status IN ('HEALTHY', 'NEEDS ATTENTION', 'CRITICAL')),
    health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    critical_issues INTEGER DEFAULT 0,
    warnings INTEGER DEFAULT 0,
    results JSONB NOT NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_health_checks_date ON system_health_checks(check_date DESC);
CREATE INDEX idx_system_health_checks_status ON system_health_checks(overall_status, check_date DESC);

COMMENT ON TABLE system_health_checks IS 
'Stores weekly health check results for system monitoring and historical analysis';

-- ============================================
-- 2. RLS Policies Check Function (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION public.check_rls_policies()
RETURNS TABLE (
    table_name TEXT,
    rls_enabled BOOLEAN,
    policy_count INTEGER,
    issue TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.relname::TEXT,
        c.relrowsecurity,
        COUNT(p.polname)::INTEGER,
        CASE 
            WHEN NOT c.relrowsecurity THEN 'RLS not enabled'
            WHEN COUNT(p.polname) = 0 THEN 'No policies defined'
            ELSE NULL
        END::TEXT
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'pg_%'
    AND c.relname NOT LIKE 'sql_%'
    GROUP BY c.relname, c.relrowsecurity
    HAVING NOT c.relrowsecurity OR COUNT(p.polname) = 0;
END;
$$;

-- ============================================
-- 3. CREATE THE MISSING AUTO_EARNINGS_TRIGGER
-- This is the CRITICAL fix for the pool draining issue
-- ============================================

-- Drop existing if present (idempotent)
DROP TRIGGER IF EXISTS auto_earnings_trigger ON public.submissions;
DROP FUNCTION IF EXISTS public.process_earnings_on_approval_v2();

-- Create the trigger function that ACTUALLY DRAINS THE POOL
CREATE OR REPLACE FUNCTION public.process_earnings_on_approval_v2()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Only process when status changes to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        
        -- Call the comprehensive earnings processing function
        SELECT process_submission_earnings(
            NEW.id,
            NEW.user_id,
            COALESCE(NEW.actual_pull_up_count, 0)
        ) INTO v_result;
        
        -- Log the result
        RAISE LOG 'Auto-earnings trigger processed submission %: %', 
            NEW.id, v_result::TEXT;
        
        -- If processing failed, log to system_errors
        IF v_result->>'success' = 'false' THEN
            INSERT INTO system_errors (
                error_type,
                error_message,
                context_data,
                created_at
            ) VALUES (
                'auto_earnings_trigger_failed',
                v_result->>'message',
                jsonb_build_object(
                    'submission_id', NEW.id,
                    'user_id', NEW.user_id,
                    'result', v_result
                ),
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log critical errors but don't fail the approval
        RAISE WARNING 'Critical error in auto_earnings_trigger for submission %: %', 
            NEW.id, SQLERRM;
        
        INSERT INTO system_errors (
            error_type,
            error_message,
            context_data,
            created_at
        ) VALUES (
            'auto_earnings_trigger_exception',
            SQLERRM,
            jsonb_build_object(
                'submission_id', NEW.id,
                'user_id', NEW.user_id,
                'actual_pull_up_count', NEW.actual_pull_up_count
            ),
            NOW()
        );
        
        RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER auto_earnings_trigger
    AFTER UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.process_earnings_on_approval_v2();

COMMENT ON FUNCTION public.process_earnings_on_approval_v2() IS 
'Automatically processes earnings when submissions are approved. 
Calls process_submission_earnings() which updates weekly_pools, user_earnings, and payout_requests.
Logs all failures to system_errors table for monitoring.';

-- ============================================
-- 4. Verify Critical Infrastructure
-- ============================================
DO $$
DECLARE
    trigger_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Check trigger exists
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname = 'auto_earnings_trigger';
    
    IF trigger_count = 0 THEN
        RAISE EXCEPTION 'Failed to create auto_earnings_trigger';
    ELSE
        RAISE NOTICE '✅ auto_earnings_trigger created successfully';
    END IF;
    
    -- Check earnings processing function exists
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'process_submission_earnings';
    
    IF function_count = 0 THEN
        RAISE WARNING '⚠️  process_submission_earnings function not found - trigger will fail!';
    ELSE
        RAISE NOTICE '✅ process_submission_earnings function exists';
    END IF;
    
    -- Check system_errors table exists
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_errors') THEN
        RAISE WARNING '⚠️  system_errors table not found - creating it now';
        
        CREATE TABLE system_errors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            error_type TEXT NOT NULL,
            error_message TEXT NOT NULL,
            context_data JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            resolved BOOLEAN DEFAULT FALSE,
            resolved_at TIMESTAMPTZ,
            resolved_by UUID REFERENCES auth.users(id)
        );
        
        CREATE INDEX idx_system_errors_unresolved 
        ON system_errors(created_at DESC) 
        WHERE resolved = FALSE;
        
        RAISE NOTICE '✅ system_errors table created';
    END IF;
END $$;

-- ============================================
-- 5. Grant necessary permissions
-- ============================================
GRANT SELECT ON system_health_checks TO authenticated;
GRANT SELECT ON system_errors TO authenticated;

-- Admins can manage health checks and errors
CREATE POLICY "admins_all_system_health_checks"
ON system_health_checks
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

CREATE POLICY "admins_all_system_errors"
ON system_errors
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Enable RLS
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_errors ENABLE ROW LEVEL SECURITY;

