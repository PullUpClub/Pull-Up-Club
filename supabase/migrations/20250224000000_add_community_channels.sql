-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- lucide icon name
  position INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channels
CREATE POLICY "Public channels are viewable by everyone" 
  ON channels FOR SELECT 
  USING (is_private = false);

CREATE POLICY "Authenticated users can view private channels" 
  ON channels FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Only admins can manage channels (insert/update/delete)
CREATE POLICY "Admins can manage channels" 
  ON channels FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Seed default channels
INSERT INTO channels (slug, name, description, icon, position) VALUES
('the-arena', 'The Arena', 'General discussion and community chat', 'MessageCircle', 0),
('form-check', 'Form Check', 'Get feedback on your technique', 'Video', 1),
('wins', 'Wins', 'Celebrate your PRs and milestones', 'Trophy', 2),
('nutrition', 'Nutrition', 'Fueling for performance', 'Utensils', 3),
('off-topic', 'Off Topic', 'Everything else', 'Coffee', 4)
ON CONFLICT (slug) DO NOTHING;

-- Add channel_id to community_posts
ALTER TABLE community_posts 
ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id);

-- Backfill existing posts to 'The Arena'
DO $$
DECLARE
  default_channel_id UUID;
BEGIN
  SELECT id INTO default_channel_id FROM channels WHERE slug = 'the-arena' LIMIT 1;
  
  UPDATE community_posts 
  SET channel_id = default_channel_id 
  WHERE channel_id IS NULL;
END $$;

-- Create index for channel_id
CREATE INDEX IF NOT EXISTS idx_community_posts_channel_id ON community_posts(channel_id);

-- Update or Create RPC for fetching feed with channel support
CREATE OR REPLACE FUNCTION get_channel_feed(
  channel_slug TEXT,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0,
  user_context_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  parent_id UUID,
  content TEXT,
  post_type TEXT,
  submission_id UUID,
  created_at TIMESTAMPTZ,
  full_name TEXT,
  organization TEXT,
  region TEXT,
  user_badges JSONB,
  like_count INTEGER,
  reply_count INTEGER,
  engagement_score NUMERIC,
  user_has_liked BOOLEAN,
  submission_data JSONB,
  load_time_ms INTEGER,
  replies JSONB -- First level of replies
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_channel_id UUID;
  start_time TIMESTAMPTZ;
BEGIN
  start_time := clock_timestamp();
  
  -- Get channel ID
  SELECT c.id INTO target_channel_id FROM channels c WHERE c.slug = channel_slug;
  
  RETURN QUERY
  WITH post_stats AS (
    SELECT 
      p.id,
      COUNT(DISTINCT l.id) as likes,
      COUNT(DISTINCT r.id) as replies,
      EXISTS(SELECT 1 FROM community_post_likes l2 WHERE l2.post_id = p.id AND l2.user_id = user_context_id) as has_liked
    FROM community_posts p
    LEFT JOIN community_post_likes l ON p.id = l.post_id
    LEFT JOIN community_posts r ON r.parent_id = p.id
    WHERE p.channel_id = target_channel_id 
    AND p.parent_id IS NULL
    AND p.is_deleted = false
    GROUP BY p.id
  ),
  user_badges_agg AS (
    SELECT 
      ub.user_id,
      jsonb_agg(
        jsonb_build_object(
          'name', b.name,
          'image_url', b.image_url,
          'min_pull_ups', b.min_pull_ups
        )
      ) as badges
    FROM user_badges ub
    JOIN badges b ON ub.badge_id = b.id
    GROUP BY ub.user_id
  )
  SELECT 
    p.id,
    p.user_id,
    p.parent_id,
    p.content,
    p.post_type,
    p.submission_id,
    p.created_at,
    pr.full_name,
    pr.organization,
    pr.region,
    COALESCE(uba.badges, '[]'::jsonb) as user_badges,
    COALESCE(ps.likes, 0)::INTEGER as like_count,
    COALESCE(ps.replies, 0)::INTEGER as reply_count,
    p.engagement_score,
    COALESCE(ps.has_liked, false) as user_has_liked,
    CASE 
      WHEN s.id IS NOT NULL THEN 
        jsonb_build_object(
          'pull_up_count', s.pull_up_count,
          'video_url', s.video_url,
          'platform', s.platform,
          'approved_at', s.approved_at
        )
      ELSE NULL
    END as submission_data,
    (EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000)::INTEGER as load_time_ms,
    '[]'::jsonb as replies -- We load replies separately or could include first few here
  FROM community_posts p
  JOIN post_stats ps ON p.id = ps.id
  JOIN profiles pr ON p.user_id = pr.id
  LEFT JOIN user_badges_agg uba ON p.user_id = uba.user_id
  LEFT JOIN submissions s ON p.submission_id = s.id
  WHERE p.channel_id = target_channel_id
  AND p.parent_id IS NULL
  AND p.is_deleted = false
  ORDER BY p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$;

