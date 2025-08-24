-- Fix remaining security issues
-- Migration: 20250610000003_fix_remaining_security_issues.sql

-- 1. Add RLS policies for tables that have RLS enabled but no policies
-- Function performance tests - only admins can access
CREATE POLICY "admins_can_access_function_tests" ON public.function_performance_tests
    FOR ALL USING ((SELECT auth.uid()) IN (SELECT user_id FROM admin_roles));

-- Query performance tests - only admins can access
CREATE POLICY "admins_can_access_query_tests" ON public.query_performance_tests
    FOR ALL USING ((SELECT auth.uid()) IN (SELECT user_id FROM admin_roles));

-- System documentation - only admins can access
CREATE POLICY "admins_can_access_documentation" ON public.system_documentation
    FOR ALL USING ((SELECT auth.uid()) IN (SELECT user_id FROM admin_roles));

-- Webhook registry - only admins can access
CREATE POLICY "admins_can_access_webhooks" ON public.webhook_registry
    FOR ALL USING ((SELECT auth.uid()) IN (SELECT user_id FROM admin_roles));

-- Your table name - only admins can access
CREATE POLICY "admins_can_access_your_table" ON public.your_table_name
    FOR ALL USING ((SELECT auth.uid()) IN (SELECT user_id FROM admin_roles));

-- 2. Fix remaining function search paths
DROP FUNCTION IF EXISTS public.update_payout_paypal_email(uuid, text);
CREATE OR REPLACE FUNCTION public.update_payout_paypal_email(user_uuid uuid, new_paypal_email text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE payout_requests 
    SET paypal_email = new_paypal_email 
    WHERE user_id = user_uuid;
END;
$$;

DROP FUNCTION IF EXISTS public.update_pending_payouts_paypal_email(uuid, text);
CREATE OR REPLACE FUNCTION public.update_pending_payouts_paypal_email(user_uuid uuid, new_paypal_email text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE payout_requests 
    SET paypal_email = new_paypal_email 
    WHERE user_id = user_uuid AND status = 'pending';
END;
$$;

DROP FUNCTION IF EXISTS public.set_payout_month(text);
CREATE OR REPLACE FUNCTION public.set_payout_month(payout_month text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- This function can be used to set payout month for testing
    PERFORM generate_monthly_payouts_smart(payout_month);
END;
$$;

DROP FUNCTION IF EXISTS public.generate_monthly_payouts_smart(text);
CREATE OR REPLACE FUNCTION public.generate_monthly_payouts_smart(payout_month text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    user_record RECORD;
    total_earned INTEGER;
    total_submissions INTEGER;
    user_paypal_email TEXT;
BEGIN
    -- Loop through all users with earnings for the specified month
    FOR user_record IN 
        SELECT DISTINCT we.user_id, p.paypal_email
        FROM weekly_earnings we
        JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
        JOIN profiles p ON we.user_id = p.id
        WHERE to_char(wp.week_start_date, 'YYYY-MM') = payout_month
    LOOP
        -- Calculate total earnings and submissions for this user in this month
        SELECT 
            COALESCE(SUM(earning_amount_dollars), 0),
            COUNT(*)
        INTO total_earned, total_submissions
        FROM weekly_earnings we
        JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
        WHERE we.user_id = user_record.user_id 
        AND to_char(wp.week_start_date, 'YYYY-MM') = payout_month;
        
        -- Insert or update user_earnings record
        INSERT INTO user_earnings (user_id, month_year, total_earned_dollars, total_submissions)
        VALUES (user_record.user_id, payout_month, total_earned, total_submissions)
        ON CONFLICT (user_id, month_year) 
        DO UPDATE SET 
            total_earned_dollars = EXCLUDED.total_earned_dollars,
            total_submissions = EXCLUDED.total_submissions,
            updated_at = NOW();
            
        -- Auto-create payout request if user has PayPal email and earnings >= $10
        IF user_record.paypal_email IS NOT NULL AND total_earned >= 10 THEN
            INSERT INTO payout_requests (
                user_id, 
                amount_dollars, 
                status, 
                paypal_email, 
                payout_month
            )
            VALUES (
                user_record.user_id, 
                total_earned, 
                'pending', 
                user_record.paypal_email, 
                payout_month
            )
            ON CONFLICT (user_id, payout_month) DO NOTHING;
        END IF;
    END LOOP;
END;
$$;

-- 3. Add comments for documentation
COMMENT ON TABLE public.function_performance_tests IS 'Performance test results for database functions';
COMMENT ON TABLE public.query_performance_tests IS 'Performance test results for database queries';
COMMENT ON TABLE public.system_documentation IS 'System-wide documentation and configuration';
COMMENT ON TABLE public.webhook_registry IS 'Registry of webhook endpoints and configurations';
COMMENT ON TABLE public.your_table_name IS 'Template table for future use';