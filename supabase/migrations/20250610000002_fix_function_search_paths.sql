-- Fix function search path issues
-- Migration: 20250610000002_fix_function_search_paths.sql

-- Drop triggers first to avoid dependency issues
DROP TRIGGER IF EXISTS auto_earnings_trigger ON public.submissions;
DROP TRIGGER IF EXISTS cleanup_earnings_trigger ON public.submissions;
DROP TRIGGER IF EXISTS auto_cleanup_trigger ON public.submissions;

-- Drop and recreate functions with fixed search paths
DROP FUNCTION IF EXISTS public.cleanup_expired_pending_payments();
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_payments()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM pending_payments 
    WHERE expires_at < NOW() 
    AND claimed_by_user_id IS NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.test_monthly_payouts_logic();
CREATE OR REPLACE FUNCTION public.test_monthly_payouts_logic()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Test function for monthly payouts logic
    PERFORM generate_monthly_payouts_smart('2024-01');
END;
$$;

DROP FUNCTION IF EXISTS public.process_earnings_on_approval();
CREATE OR REPLACE FUNCTION public.process_earnings_on_approval()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Only process when status changes to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Check if earnings already exist for this submission
        IF NOT EXISTS (
            SELECT 1 FROM weekly_earnings 
            WHERE submission_id = NEW.id
        ) THEN
            -- Get the current week's pool
            INSERT INTO weekly_earnings (
                user_id, 
                weekly_pool_id, 
                submission_id, 
                pull_up_count, 
                earning_amount_dollars,
                is_first_submission
            )
            SELECT 
                NEW.user_id,
                wp.id,
                NEW.id,
                NEW.actual_pull_up_count,
                CASE 
                    WHEN NEW.actual_pull_up_count >= 1 THEN 5  -- Base $5 for any submission
                    ELSE 0
                END,
                NOT EXISTS (
                    SELECT 1 FROM weekly_earnings we2 
                    WHERE we2.user_id = NEW.user_id 
                    AND we2.weekly_pool_id = wp.id
                )
            FROM weekly_pools wp
            WHERE CURRENT_DATE BETWEEN wp.week_start_date AND wp.week_end_date
            LIMIT 1;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.generate_monthly_payouts(text);
CREATE OR REPLACE FUNCTION public.generate_monthly_payouts(payout_month text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    user_record RECORD;
    total_earned INTEGER;
    total_submissions INTEGER;
BEGIN
    -- Loop through all users with earnings for the specified month
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM weekly_earnings we
        JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
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
    END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.cleanup_earnings_on_rejection();
CREATE OR REPLACE FUNCTION public.cleanup_earnings_on_rejection()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Only process when status changes to 'rejected'
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
        -- Remove earnings for this submission
        DELETE FROM weekly_earnings 
        WHERE submission_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

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

DROP FUNCTION IF EXISTS public.get_payout_months();
CREATE OR REPLACE FUNCTION public.get_payout_months()
RETURNS TABLE(month_year text)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT month_year 
    FROM user_earnings 
    ORDER BY month_year DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_payouts_by_month(text);
CREATE OR REPLACE FUNCTION public.get_payouts_by_month(payout_month text)
RETURNS TABLE(
    user_id uuid,
    full_name text,
    paypal_email text,
    amount_dollars integer,
    status text,
    request_date timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.user_id,
        p.full_name,
        pr.paypal_email,
        pr.amount_dollars,
        pr.status,
        pr.request_date
    FROM payout_requests pr
    JOIN profiles p ON pr.user_id = p.id
    WHERE pr.payout_month = get_payouts_by_month.payout_month
    ORDER BY pr.request_date DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.is_excluded_from_payouts(uuid);
CREATE OR REPLACE FUNCTION public.is_excluded_from_payouts(user_uuid uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Check if user is excluded from payouts (can be customized based on business rules)
    RETURN FALSE; -- Default: no exclusions
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

-- Recreate triggers
CREATE TRIGGER auto_earnings_trigger
    AFTER UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.process_earnings_on_approval();

CREATE TRIGGER cleanup_earnings_trigger
    AFTER UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_earnings_on_rejection();