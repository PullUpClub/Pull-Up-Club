-- Fix function search paths with explicit schema qualification
-- Migration: 20250610000006_fix_function_search_paths_final.sql

-- Drop and recreate update_payout_paypal_email
DROP FUNCTION IF EXISTS public.update_payout_paypal_email(uuid, text);
CREATE OR REPLACE FUNCTION public.update_payout_paypal_email(user_uuid uuid, new_paypal_email text)
RETURNS void
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.payout_requests 
    SET paypal_email = new_paypal_email 
    WHERE user_id = user_uuid;
END;
$$;

-- Drop and recreate update_pending_payouts_paypal_email
DROP FUNCTION IF EXISTS public.update_pending_payouts_paypal_email(uuid, text);
CREATE OR REPLACE FUNCTION public.update_pending_payouts_paypal_email(user_uuid uuid, new_paypal_email text)
RETURNS void
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.payout_requests 
    SET paypal_email = new_paypal_email 
    WHERE user_id = user_uuid AND status = 'pending';
END;
$$;

-- Drop and recreate set_payout_month
DROP FUNCTION IF EXISTS public.set_payout_month(text);
CREATE OR REPLACE FUNCTION public.set_payout_month(payout_month text)
RETURNS void
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
    -- This function can be used to set payout month for testing
    PERFORM public.generate_monthly_payouts_smart(payout_month);
END;
$$;

-- Drop and recreate generate_monthly_payouts_smart
DROP FUNCTION IF EXISTS public.generate_monthly_payouts_smart(text);
CREATE OR REPLACE FUNCTION public.generate_monthly_payouts_smart(payout_month text)
RETURNS void
SECURITY DEFINER
SET search_path = ''
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
        FROM public.weekly_earnings we
        JOIN public.weekly_pools wp ON we.weekly_pool_id = wp.id
        JOIN public.profiles p ON we.user_id = p.id
        WHERE to_char(wp.week_start_date, 'YYYY-MM') = payout_month
    LOOP
        -- Calculate total earnings and submissions for this user in this month
        SELECT 
            COALESCE(SUM(earning_amount_dollars), 0),
            COUNT(*)
        INTO total_earned, total_submissions
        FROM public.weekly_earnings we
        JOIN public.weekly_pools wp ON we.weekly_pool_id = wp.id
        WHERE we.user_id = user_record.user_id 
        AND to_char(wp.week_start_date, 'YYYY-MM') = payout_month;
        
        -- Insert or update user_earnings record
        INSERT INTO public.user_earnings (user_id, month_year, total_earned_dollars, total_submissions)
        VALUES (user_record.user_id, payout_month, total_earned, total_submissions)
        ON CONFLICT (user_id, month_year) 
        DO UPDATE SET 
            total_earned_dollars = EXCLUDED.total_earned_dollars,
            total_submissions = EXCLUDED.total_submissions,
            updated_at = NOW();
            
        -- Auto-create payout request if user has PayPal email and earnings >= $10
        IF user_record.paypal_email IS NOT NULL AND total_earned >= 10 THEN
            INSERT INTO public.payout_requests (
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