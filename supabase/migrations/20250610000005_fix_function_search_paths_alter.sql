-- Fix function search paths using ALTER FUNCTION
-- Migration: 20250610000005_fix_function_search_paths_alter.sql

-- Fix search path for update_payout_paypal_email
ALTER FUNCTION public.update_payout_paypal_email(uuid, text)
    SET search_path = public;

-- Fix search path for update_pending_payouts_paypal_email
ALTER FUNCTION public.update_pending_payouts_paypal_email(uuid, text)
    SET search_path = public;

-- Fix search path for set_payout_month
ALTER FUNCTION public.set_payout_month(text)
    SET search_path = public;

-- Fix search path for generate_monthly_payouts_smart
ALTER FUNCTION public.generate_monthly_payouts_smart(text)
    SET search_path = public;