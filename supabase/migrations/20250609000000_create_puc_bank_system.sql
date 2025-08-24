-- Create weekly_pools table to track the $250 weekly pool
CREATE TABLE IF NOT EXISTS weekly_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  total_dollars DECIMAL(10,2) NOT NULL DEFAULT 250.00,
  remaining_dollars DECIMAL(10,2) NOT NULL DEFAULT 250.00,
  spent_dollars DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_current BOOLEAN NOT NULL DEFAULT false,
  is_depleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_earnings table to track individual user earnings
CREATE TABLE IF NOT EXISTS user_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES weekly_pools(id) ON DELETE CASCADE,
  pull_up_count INTEGER NOT NULL,
  dollars_earned DECIMAL(10,2) NOT NULL,
  is_first_submission BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one earning record per submission
  UNIQUE(submission_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_weekly_pools_current ON weekly_pools(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_weekly_pools_dates ON weekly_pools(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_user_earnings_user_id ON user_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_pool_id ON user_earnings(pool_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_submission_id ON user_earnings(submission_id);

-- Function to process submission earnings
CREATE OR REPLACE FUNCTION process_submission_earnings(
  p_submission_id UUID,
  p_user_id UUID,
  p_pull_up_count INTEGER
) RETURNS JSON AS $$
DECLARE
  v_pool_id UUID;
  v_remaining_dollars DECIMAL(10,2);
  v_dollars_earned DECIMAL(10,2);
  v_is_first_submission BOOLEAN := false;
  v_existing_earning_id UUID;
  v_result JSON;
BEGIN
  -- Check if earnings already processed for this submission
  SELECT id INTO v_existing_earning_id 
  FROM user_earnings 
  WHERE submission_id = p_submission_id;
  
  IF v_existing_earning_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Earnings already processed',
      'earning_id', v_existing_earning_id
    );
  END IF;
  
  -- Get current week's pool
  SELECT id, remaining_dollars INTO v_pool_id, v_remaining_dollars
  FROM weekly_pools 
  WHERE is_current = true AND NOT is_depleted
  LIMIT 1;
  
  -- If no current pool or pool is depleted, return early
  IF v_pool_id IS NULL OR v_remaining_dollars <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No active pool or pool is depleted',
      'pool_id', v_pool_id,
      'remaining_dollars', v_remaining_dollars
    );
  END IF;
  
  -- Check if this is user's first submission this week
  IF NOT EXISTS (
    SELECT 1 FROM user_earnings ue 
    JOIN weekly_pools wp ON ue.pool_id = wp.id 
    WHERE ue.user_id = p_user_id AND wp.is_current = true
  ) THEN
    v_is_first_submission := true;
  END IF;
  
  -- Calculate earnings: $1 per pull-up, but first submission is free
  IF v_is_first_submission THEN
    v_dollars_earned := 0;
  ELSE
    v_dollars_earned := LEAST(p_pull_up_count::DECIMAL, v_remaining_dollars);
  END IF;
  
  -- Insert earning record
  INSERT INTO user_earnings (
    user_id, 
    submission_id, 
    pool_id, 
    pull_up_count, 
    dollars_earned, 
    is_first_submission
  ) VALUES (
    p_user_id, 
    p_submission_id, 
    v_pool_id, 
    p_pull_up_count, 
    v_dollars_earned, 
    v_is_first_submission
  ) RETURNING id INTO v_existing_earning_id;
  
  -- Update pool remaining dollars
  UPDATE weekly_pools 
  SET 
    remaining_dollars = remaining_dollars - v_dollars_earned,
    spent_dollars = spent_dollars + v_dollars_earned,
    is_depleted = (remaining_dollars - v_dollars_earned) <= 0,
    updated_at = NOW()
  WHERE id = v_pool_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Earnings processed successfully',
    'earning_id', v_existing_earning_id,
    'dollars_earned', v_dollars_earned,
    'is_first_submission', v_is_first_submission,
    'pool_id', v_pool_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error processing earnings'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset weekly pools (can be called by CRON or manually)
CREATE OR REPLACE FUNCTION reset_weekly_pools() RETURNS JSON AS $$
DECLARE
  v_new_pool_id UUID;
  v_week_start TIMESTAMPTZ;
  v_week_end TIMESTAMPTZ;
BEGIN
  -- Calculate this week's start and end
  v_week_start := DATE_TRUNC('week', NOW());
  v_week_end := v_week_start + INTERVAL '6 days 23 hours 59 minutes 59 seconds';
  
  -- Mark all pools as not current
  UPDATE weekly_pools SET is_current = false WHERE is_current = true;
  
  -- Create new pool for this week
  INSERT INTO weekly_pools (
    week_start,
    week_end,
    total_dollars,
    remaining_dollars,
    spent_dollars,
    is_current,
    is_depleted
  ) VALUES (
    v_week_start,
    v_week_end,
    250.00,
    250.00,
    0.00,
    true,
    false
  ) RETURNING id INTO v_new_pool_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Weekly pool reset successfully',
    'new_pool_id', v_new_pool_id,
    'week_start', v_week_start,
    'week_end', v_week_end
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error resetting weekly pools'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE weekly_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_earnings ENABLE ROW LEVEL SECURITY;

-- Weekly pools are readable by everyone (for leaderboard banner)
CREATE POLICY "Weekly pools are readable by everyone" ON weekly_pools
  FOR SELECT USING (true);

-- Only admins can modify weekly pools
CREATE POLICY "Only admins can modify weekly pools" ON weekly_pools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Users can read their own earnings
CREATE POLICY "Users can read their own earnings" ON user_earnings
  FOR SELECT USING (user_id = auth.uid());

-- Admins can read all earnings
CREATE POLICY "Admins can read all earnings" ON user_earnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Only system/functions can insert earnings (via RPC)
CREATE POLICY "Only system can insert earnings" ON user_earnings
  FOR INSERT WITH CHECK (false);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON weekly_pools TO authenticated;
GRANT SELECT ON user_earnings TO authenticated;
GRANT EXECUTE ON FUNCTION process_submission_earnings TO authenticated;
GRANT EXECUTE ON FUNCTION reset_weekly_pools TO authenticated; 