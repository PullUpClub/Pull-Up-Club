-- ============================================================================
-- Attach Broadcast Triggers
-- ============================================================================
-- This migration attaches the trigger functions to the community_posts and
-- community_post_likes tables so that database changes are automatically
-- broadcast to Realtime subscribers.
--
-- What this does:
-- 1. Creates trigger on community_posts for INSERT, UPDATE, DELETE
-- 2. Creates trigger on community_post_likes for INSERT, DELETE
--
-- Result:
-- - Every time a message is sent, updated, or deleted, it broadcasts to subscribers
-- - Every time a like is added or removed, it broadcasts to subscribers
-- - No manual Broadcast calls needed in application code
-- ============================================================================

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS community_post_broadcast_trigger ON community_posts;
DROP TRIGGER IF EXISTS community_post_like_broadcast_trigger ON community_post_likes;


-- ============================================================================
-- Trigger: community_post_broadcast_trigger
-- ============================================================================
-- Automatically broadcasts community_posts changes to Realtime subscribers.
--
-- Events: INSERT, UPDATE, DELETE
-- Timing: AFTER (so the change is committed before broadcasting)
-- Scope: FOR EACH ROW (broadcasts each individual change)
-- ============================================================================
CREATE TRIGGER community_post_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE
  ON community_posts
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_community_post_changes();

COMMENT ON TRIGGER community_post_broadcast_trigger ON community_posts IS
'Automatically broadcasts INSERT, UPDATE, DELETE events to Realtime subscribers via realtime.broadcast_changes()';


-- ============================================================================
-- Trigger: community_post_like_broadcast_trigger
-- ============================================================================
-- Automatically broadcasts like/unlike events to Realtime subscribers.
--
-- Events: INSERT (like), DELETE (unlike)
-- Timing: AFTER (so the change is committed before broadcasting)
-- Scope: FOR EACH ROW (broadcasts each individual like/unlike)
-- ============================================================================
CREATE TRIGGER community_post_like_broadcast_trigger
  AFTER INSERT OR DELETE
  ON community_post_likes
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_post_like_changes();

COMMENT ON TRIGGER community_post_like_broadcast_trigger ON community_post_likes IS
'Automatically broadcasts LIKE/UNLIKE events to Realtime subscribers via realtime.broadcast_changes()';


-- ============================================================================
-- Verification Query (run this after migration to verify)
-- ============================================================================
-- SELECT 
--   tgname as trigger_name,
--   tgrelid::regclass as table_name,
--   tgenabled as enabled,
--   pg_get_triggerdef(oid) as definition
-- FROM pg_trigger
-- WHERE tgname IN ('community_post_broadcast_trigger', 'community_post_like_broadcast_trigger')
-- ORDER BY tgname;

-- Expected result: You should see two triggers attached and enabled
-- 'community_post_broadcast_trigger' on 'community_posts'
-- 'community_post_like_broadcast_trigger' on 'community_post_likes'


-- ============================================================================
-- Test Query (optional - run this to test the triggers)
-- ============================================================================
-- This will insert a test message and verify the trigger fires.
-- Make sure you have a Realtime subscriber listening to test this end-to-end.
--
-- -- Get a test channel ID
-- DO $$
-- DECLARE
--   test_channel_id UUID;
--   test_user_id UUID;
--   test_post_id UUID;
-- BEGIN
--   -- Get the arena channel
--   SELECT id INTO test_channel_id FROM channels WHERE slug = 'the-arena' LIMIT 1;
--   
--   -- Get a test user (you)
--   SELECT id INTO test_user_id FROM profiles WHERE email = 'parkergawne10@gmail.com' LIMIT 1;
--   
--   -- Insert a test message
--   -- This should trigger the broadcast to 'private-channel:the-arena'
--   INSERT INTO community_posts (channel_id, user_id, content, post_type)
--   VALUES (test_channel_id, test_user_id, 'Test broadcast message!', 'user_post')
--   RETURNING id INTO test_post_id;
--   
--   RAISE NOTICE 'Test message inserted with ID: %', test_post_id;
--   
--   -- Clean up (optional)
--   -- DELETE FROM community_posts WHERE id = test_post_id;
-- END $$;

