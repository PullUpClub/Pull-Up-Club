-- Add paid status to payouts table
ALTER TABLE IF EXISTS public.payouts 
ADD COLUMN IF NOT EXISTS paid_at timestamptz,
ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id);

-- Update the get_payouts_by_month function to include paid status
CREATE OR REPLACE FUNCTION public.get_payouts_by_month(target_month text)
RETURNS TABLE (
  payout_id uuid,
  full_name text,
  email text,
  amount_dollars text,
  payout_paypal_email text,
  user_paypal_email text,
  request_date timestamptz,
  status text,
  paid_at timestamptz,
  paid_by text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as payout_id,
    pr.full_name,
    u.email,
    p.amount::text as amount_dollars,
    p.paypal_email as payout_paypal_email,
    pr.paypal_email as user_paypal_email,
    p.created_at as request_date,
    CASE 
      WHEN p.paid_at IS NOT NULL THEN 'paid'
      WHEN p.paypal_email IS NOT NULL OR pr.paypal_email IS NOT NULL THEN 'ready'
      ELSE 'pending'
    END as status,
    p.paid_at,
    paid_users.email as paid_by
  FROM payouts p
  LEFT JOIN profiles pr ON p.user_id = pr.id
  LEFT JOIN auth.users u ON pr.id = u.id
  LEFT JOIN auth.users paid_users ON p.paid_by = paid_users.id
  WHERE TO_CHAR(p.created_at, 'YYYY-MM') = target_month
  ORDER BY p.created_at DESC;
END;
$$;

-- Function to mark a payout as paid
CREATE OR REPLACE FUNCTION public.mark_payout_as_paid(
  payout_id_param uuid,
  admin_user_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Check if the user is an admin
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = admin_user_id 
    AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can mark payouts as paid';
  END IF;

  -- Mark the payout as paid
  UPDATE payouts
  SET 
    paid_at = NOW(),
    paid_by = admin_user_id
  WHERE id = payout_id_param;

  RETURN FOUND;
END;
$$;

-- Add RLS policies for payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users to their own payouts"
ON public.payouts FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Enable admins to update payouts"
ON public.payouts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND role = 'admin'
  )
);