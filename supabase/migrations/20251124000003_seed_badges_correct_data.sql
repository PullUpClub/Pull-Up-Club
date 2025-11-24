-- Clear existing badges and user_badges
TRUNCATE TABLE public.user_badges CASCADE;
TRUNCATE TABLE public.badges CASCADE;

-- Drop the old unique constraint on name if it exists
ALTER TABLE public.badges DROP CONSTRAINT IF EXISTS badges_name_key;

-- Add a unique constraint on name + gender combination
ALTER TABLE public.badges ADD CONSTRAINT badges_name_gender_key UNIQUE (name, gender);

-- Insert Male Badges with correct thresholds
INSERT INTO public.badges (name, description, image_url, min_pull_ups, gender, requirements) VALUES
('Recruit', 'Completed 5 pull-ups', '/Male-Badges/Recruit.png', 5, 'Male', '5+ pull-ups'),
('Proven', 'Completed 10 pull-ups', '/Male-Badges/Proven.png', 10, 'Male', '10+ pull-ups'),
('Hardened', 'Completed 15 pull-ups', '/Male-Badges/Hardened.png', 15, 'Male', '15+ pull-ups'),
('Operator', 'Completed 20 pull-ups', '/Male-Badges/Operator.png', 20, 'Male', '20+ pull-ups'),
('Elite', 'Completed 25 pull-ups', '/Male-Badges/Elite.png', 25, 'Male', '25+ pull-ups');

-- Insert Female Badges with correct thresholds (SAME NAMES, different thresholds)
INSERT INTO public.badges (name, description, image_url, min_pull_ups, gender, requirements) VALUES
('Recruit', 'Completed 3 pull-ups', '/Female-Badges/Recruit_-_Female.webp', 3, 'Female', '3+ pull-ups'),
('Proven', 'Completed 7 pull-ups', '/Female-Badges/Proven_-_Female.webp', 7, 'Female', '7+ pull-ups'),
('Hardened', 'Completed 12 pull-ups', '/Female-Badges/Hardened_1_-_Female.webp', 12, 'Female', '12+ pull-ups'),
('Operator', 'Completed 15 pull-ups', '/Female-Badges/Operator_-_Female.webp', 15, 'Female', '15+ pull-ups'),
('Elite', 'Completed 20 pull-ups', '/Female-Badges/Elite_Female.webp', 20, 'Female', '20+ pull-ups');

-- Re-award badges to all users based on their approved submissions
DO $$
DECLARE
  submission_record RECORD;
  user_gender TEXT;
  badge_record RECORD;
BEGIN
  FOR submission_record IN 
    SELECT DISTINCT ON (user_id) 
      id, user_id, actual_pull_up_count, status
    FROM public.submissions 
    WHERE status = 'approved'
    ORDER BY user_id, actual_pull_up_count DESC, approved_at ASC
  LOOP
    -- Get user's gender
    SELECT gender INTO user_gender FROM public.profiles WHERE id = submission_record.user_id;
    
    -- Award all eligible badges for this user
    FOR badge_record IN 
      SELECT * FROM public.badges 
      WHERE gender = user_gender
        AND min_pull_ups <= submission_record.actual_pull_up_count
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id, submission_id)
      VALUES (submission_record.user_id, badge_record.id, submission_record.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
