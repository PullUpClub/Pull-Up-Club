-- Optimize indexes for performance
-- Migration: 20250610000007_optimize_indexes.sql

-- 1. Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_badge_assignment_metrics_badge_id ON public.badge_assignment_metrics(badge_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id ON public.email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_log_user_id ON public.messages_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_template_id ON public.notification_queue(template_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON public.notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_claimed_by_user_id ON public.pending_payments(claimed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_admin_role_id ON public.profiles(admin_role_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_submission_id ON public.user_badges(submission_id);
CREATE INDEX IF NOT EXISTS idx_your_table_name_admin_role_id ON public.your_table_name(admin_role_id);

-- 2. Drop unused indexes
-- Note: Only dropping indexes that are truly redundant or not critical for performance
DROP INDEX IF EXISTS public.idx_pending_payments_customer_email;  -- Email lookups are rare
DROP INDEX IF EXISTS public.idx_pending_payments_stripe_customer_id;  -- Stripe customer ID lookups are rare
DROP INDEX IF EXISTS public.idx_email_notifications_metadata;  -- JSONB metadata queries are rare

-- 3. Keep but monitor these indexes as they might be needed for future performance
-- Weekly pools week_start is important for date-based queries
COMMENT ON INDEX public.idx_weekly_pools_week_start IS 'Retained for date-based queries and reporting';

-- Weekly earnings indexes are important for payout calculations
COMMENT ON INDEX public.idx_weekly_earnings_user_id IS 'Retained for user earnings aggregation';
COMMENT ON INDEX public.idx_weekly_earnings_submission_id IS 'Retained for submission tracking';
COMMENT ON INDEX public.idx_weekly_earnings_weekly_pool_id IS 'Retained for pool aggregation';

-- User earnings indexes are important for payout management
COMMENT ON INDEX public.idx_user_earnings_user_id IS 'Retained for user earnings lookup';
COMMENT ON INDEX public.idx_user_earnings_month_year IS 'Retained for monthly reporting';

-- Payout request indexes are critical for payment processing
COMMENT ON INDEX public.idx_payout_requests_user_id IS 'Retained for user payout lookup';
COMMENT ON INDEX public.idx_payout_requests_payout_month IS 'Retained for monthly payout processing';

-- 4. Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_weekly_earnings_user_pool ON public.weekly_earnings(user_id, weekly_pool_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_user_month ON public.user_earnings(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_month ON public.payout_requests(user_id, payout_month);

-- 5. Add partial indexes for common filtered queries
CREATE INDEX IF NOT EXISTS idx_pending_payments_unclaimed ON public.pending_payments(expires_at)
WHERE claimed_by_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_pending ON public.submissions(user_id)
WHERE status = 'pending';

-- 6. Add documentation
COMMENT ON TABLE public.weekly_earnings IS 'Stores weekly earnings for user submissions with indexes optimized for payout processing';
COMMENT ON TABLE public.user_earnings IS 'Stores monthly aggregated earnings with indexes optimized for reporting';
COMMENT ON TABLE public.payout_requests IS 'Stores payout requests with indexes optimized for payment processing';