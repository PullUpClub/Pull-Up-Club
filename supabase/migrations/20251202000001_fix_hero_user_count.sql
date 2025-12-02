-- Migration to fix Hero section user count display
-- Issue: Anonymous users cannot count profiles due to RLS
-- Solution: Create a public function that returns total user count

-- Create a SECURITY DEFINER function to get total user count
-- This bypasses RLS and allows anonymous users to get the count
CREATE OR REPLACE FUNCTION public.get_total_user_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Get total count of profiles
  SELECT COUNT(*)::INTEGER INTO user_count
  FROM public.profiles;
  
  RETURN user_count;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_total_user_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_total_user_count() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_total_user_count() IS 
'Returns the total count of registered users. Safe for public access as it only exposes a single aggregate number.';

