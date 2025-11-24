-- ============================================================================
-- Broadcast Trigger Functions
-- ============================================================================
-- This migration creates trigger functions that automatically broadcast
-- database changes to Realtime subscribers using realtime.broadcast_changes().
--
-- What this does:
-- 1. Creates broadcast_community_post_changes() function
-- 2. Creates broadcast_post_like_changes() function
--
-- How it works:
-- - When a row is inserted/updated/deleted in community_posts or 
--   community_post_likes, these functions are called
-- - They call realtime.broadcast_changes() which sends the change to 
--   all subscribers of the channel topic
-- - Topic format: 'private-channel:channel_slug' (e.g., 'private-channel:the-arena')
--
-- Benefits:
-- - Automatic real-time propagation without manual Broadcast calls
-- - Consistent message format
-- - Scales to 250k+ users and 800k+ msgs/sec
-- ============================================================================

-- ============================================================================
-- Function: broadcast_community_post_changes()
-- ============================================================================
-- Broadcasts INSERT, UPDATE, DELETE events for community_posts to the 
-- appropriate channel topic.
--
-- Trigger will be: AFTER INSERT OR UPDATE OR DELETE
-- ============================================================================
CREATE OR REPLACE FUNCTION broadcast_community_post_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  channel_slug_var TEXT;
  topic_name TEXT;
BEGIN
  -- Get the channel slug for this post
  IF TG_OP = 'DELETE' THEN
    SELECT c.slug INTO channel_slug_var
    FROM channels c
    WHERE c.id = OLD.channel_id;
    
    -- For DELETE, we only have OLD record
    topic_name := 'private-channel:' || channel_slug_var;
    
    -- Broadcast the deletion
    -- Format: realtime.broadcast_changes(topic, event, operation, table, schema, new, old)
    PERFORM realtime.broadcast_changes(
      topic_name,                -- topic: 'private-channel:the-arena'
      TG_OP,                     -- event: 'DELETE'
      TG_OP,                     -- operation: 'DELETE'
      TG_TABLE_NAME,             -- table: 'community_posts'
      TG_TABLE_SCHEMA,           -- schema: 'public'
      NULL,                      -- new record (NULL for DELETE)
      row_to_json(OLD)::jsonb    -- old record
    );
    
    RETURN OLD;
  ELSE
    -- For INSERT and UPDATE, we have NEW record
    SELECT c.slug INTO channel_slug_var
    FROM channels c
    WHERE c.id = NEW.channel_id;
    
    topic_name := 'private-channel:' || channel_slug_var;
    
    -- Broadcast the change
    PERFORM realtime.broadcast_changes(
      topic_name,                -- topic: 'private-channel:wins'
      TG_OP,                     -- event: 'INSERT' or 'UPDATE'
      TG_OP,                     -- operation: 'INSERT' or 'UPDATE'
      TG_TABLE_NAME,             -- table: 'community_posts'
      TG_TABLE_SCHEMA,           -- schema: 'public'
      row_to_json(NEW)::jsonb,   -- new record
      CASE 
        WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb 
        ELSE NULL 
      END                        -- old record (only for UPDATE)
    );
    
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION broadcast_community_post_changes() IS 
'Broadcasts community post changes (INSERT, UPDATE, DELETE) to the appropriate Realtime channel topic using realtime.broadcast_changes()';


-- ============================================================================
-- Function: broadcast_post_like_changes()
-- ============================================================================
-- Broadcasts INSERT (LIKE) and DELETE (UNLIKE) events for community_post_likes
-- to the appropriate channel topic.
--
-- Trigger will be: AFTER INSERT OR DELETE
-- ============================================================================
CREATE OR REPLACE FUNCTION broadcast_post_like_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  channel_slug_var TEXT;
  topic_name TEXT;
BEGIN
  -- Get the channel slug for the post that was liked/unliked
  IF TG_OP = 'DELETE' THEN
    SELECT c.slug INTO channel_slug_var
    FROM community_posts cp
    JOIN channels c ON cp.channel_id = c.id
    WHERE cp.id = OLD.post_id;
    
    topic_name := 'private-channel:' || channel_slug_var;
    
    -- Broadcast the unlike event
    -- We use a custom event name 'UNLIKE' to distinguish from DELETE
    PERFORM realtime.broadcast_changes(
      topic_name,
      'UNLIKE',                  -- custom event name
      TG_OP,                     -- operation: 'DELETE'
      TG_TABLE_NAME,             -- table: 'community_post_likes'
      TG_TABLE_SCHEMA,           -- schema: 'public'
      NULL,
      row_to_json(OLD)::jsonb
    );
    
    RETURN OLD;
  ELSE
    -- For INSERT (new like)
    SELECT c.slug INTO channel_slug_var
    FROM community_posts cp
    JOIN channels c ON cp.channel_id = c.id
    WHERE cp.id = NEW.post_id;
    
    topic_name := 'private-channel:' || channel_slug_var;
    
    -- Broadcast the like event
    -- We use a custom event name 'LIKE' to distinguish from INSERT
    PERFORM realtime.broadcast_changes(
      topic_name,
      'LIKE',                    -- custom event name
      TG_OP,                     -- operation: 'INSERT'
      TG_TABLE_NAME,             -- table: 'community_post_likes'
      TG_TABLE_SCHEMA,           -- schema: 'public'
      row_to_json(NEW)::jsonb,
      NULL
    );
    
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION broadcast_post_like_changes() IS 
'Broadcasts like/unlike events to the appropriate Realtime channel topic using realtime.broadcast_changes()';


-- ============================================================================
-- Verification Query (run this after migration to verify)
-- ============================================================================
-- SELECT 
--   proname as function_name,
--   pg_get_functiondef(oid) as definition
-- FROM pg_proc
-- WHERE proname IN ('broadcast_community_post_changes', 'broadcast_post_like_changes')
-- ORDER BY proname;

-- Expected result: You should see two functions with their full definitions

