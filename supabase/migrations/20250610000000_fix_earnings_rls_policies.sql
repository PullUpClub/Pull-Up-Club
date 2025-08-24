-- Fix RLS policies for earnings tables
-- Migration: 20250610000000_fix_earnings_rls_policies.sql

-- 1. Fix RLS policies for weekly_earnings table
-- Add INSERT policy for admins
CREATE POLICY "Admins can insert weekly earnings" ON public.weekly_earnings
    FOR INSERT 
    WITH CHECK (
        (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
    );

-- Add UPDATE policy for admins
CREATE POLICY "Admins can update weekly earnings" ON public.weekly_earnings
    FOR UPDATE 
    USING (
        (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
    )
    WITH CHECK (
        (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
    );

-- Add DELETE policy for admins
CREATE POLICY "Admins can delete weekly earnings" ON public.weekly_earnings
    FOR DELETE 
    USING (
        (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
    );

-- 2. Fix RLS policies for user_earnings table
-- Add INSERT policy for admins
CREATE POLICY "Admins can insert user earnings" ON public.user_earnings
    FOR INSERT 
    WITH CHECK (
        (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
    );

-- Add UPDATE policy for admins
CREATE POLICY "Admins can update user earnings" ON public.user_earnings
    FOR UPDATE 
    USING (
        (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
    )
    WITH CHECK (
        (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
    );

-- Add DELETE policy for admins
CREATE POLICY "Admins can delete user earnings" ON public.user_earnings
    FOR DELETE 
    USING (
        (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
    );

-- 3. Add unique constraint to user_earnings to prevent duplicates
ALTER TABLE public.user_earnings 
ADD CONSTRAINT unique_user_month_earnings 
UNIQUE (user_id, month_year);

-- 4. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_weekly_earnings_user_id ON public.weekly_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_earnings_submission_id ON public.weekly_earnings(submission_id);
CREATE INDEX IF NOT EXISTS idx_weekly_earnings_weekly_pool_id ON public.weekly_earnings(weekly_pool_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_user_id ON public.user_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_month_year ON public.user_earnings(month_year);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON public.payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_payout_month ON public.payout_requests(payout_month);

-- 5. Add comments for documentation
COMMENT ON TABLE public.weekly_earnings IS 'Weekly competition earnings for individual submissions';
COMMENT ON TABLE public.user_earnings IS 'Monthly aggregated earnings for payout processing';
COMMENT ON TABLE public.payout_requests IS 'PayPal payout requests for monthly earnings'; 