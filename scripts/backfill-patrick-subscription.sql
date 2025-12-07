-- Backfill Patrick Hayes' subscription
-- User ID: 13160705-4035-4f09-9a2c-aaed257fe6fb
-- Email: 74.hays@gmail.com
-- Stripe Customer: cus_SbLkU6Hw1toQ3i

-- This script manually creates a subscription record for Patrick
-- since the Stripe webhook didn't properly sync his subscription to the database

-- Note: You'll need to get the actual Stripe subscription ID from Stripe Dashboard
-- or by calling the backfill-user-subscription Edge Function

-- Example manual insert (replace with actual values from Stripe):
-- INSERT INTO public.subscriptions (
--   user_id,
--   stripe_subscription_id,
--   status,
--   current_period_start,
--   current_period_end,
--   first_paid_date
-- ) VALUES (
--   '13160705-4035-4f09-9a2c-aaed257fe6fb',
--   'sub_XXXXXXXXXX', -- Replace with actual Stripe subscription ID
--   'active',
--   '2025-07-01 18:36:57.083615+00', -- Adjust based on actual subscription
--   '2025-08-01 18:36:57.083615+00', -- Adjust based on actual subscription
--   '2025-07-01 18:36:57.083615+00'  -- Use user's created_at as first paid date
-- );

-- Better approach: Use the Edge Function
-- Call: supabase functions invoke backfill-user-subscription --data '{"user_id":"13160705-4035-4f09-9a2c-aaed257fe6fb"}'
