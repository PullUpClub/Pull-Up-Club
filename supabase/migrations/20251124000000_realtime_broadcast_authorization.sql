-- ============================================================================
-- Realtime Broadcast Authorization
-- ============================================================================
-- This migration enables private channels with RLS authorization for 
-- Supabase Realtime Broadcast. This is CRITICAL for the community messaging
-- system to work securely and correctly.
--
-- What this does:
-- 1. Enables RLS on realtime.messages table
-- 2. Allows authenticated users to receive broadcasts (SELECT)
-- 3. Allows authenticated users to send broadcasts (INSERT)
--
-- Why this is needed:
-- - Private channels require RLS policies to enforce authorization
-- - Without these policies, { config: { private: true } } won't work
-- - This is the foundation for secure channel-based messaging
-- ============================================================================

-- Enable RLS on realtime.messages if not already enabled
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "authenticated_can_receive_broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated_can_send_broadcasts" ON realtime.messages;

-- ============================================================================
-- Policy: Allow authenticated users to receive broadcasts (SELECT)
-- ============================================================================
-- This policy allows any authenticated user to receive Broadcast messages.
-- This is required for private channels to work.
-- You can make this more restrictive later based on channel membership.
CREATE POLICY "authenticated_can_receive_broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- Policy: Allow authenticated users to send broadcasts (INSERT)
-- ============================================================================
-- This policy allows any authenticated user to send Broadcast messages.
-- This is required for private channels to work.
-- You can make this more restrictive later based on channel permissions.
CREATE POLICY "authenticated_can_send_broadcasts"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Verification Query (run this after migration to verify)
-- ============================================================================
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'realtime' AND tablename = 'messages';

-- Expected result: You should see two policies:
-- 1. authenticated_can_receive_broadcasts (SELECT)
-- 2. authenticated_can_send_broadcasts (INSERT)

