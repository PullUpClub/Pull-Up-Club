-- Fix the weekly pool drain issue
-- This migration ensures that weekly_pools.remaining_dollars and spent_dollars are updated when submissions are approved

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS auto_earnings_trigger ON public.submissions;
DROP FUNCTION IF EXISTS public.process_earnings_on_approval();

-- Create error logging table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    context_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_system_errors_unresolved 
ON system_errors(created_at DESC) 
WHERE resolved = FALSE;

-- Create improved earnings processing function with pool updates
CREATE OR REPLACE FUNCTION public.process_earnings_on_approval()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_pool_id UUID;
    v_earning_amount DECIMAL(10,2);
    v_is_first_submission BOOLEAN;
    v_pool_remaining DECIMAL(10,2);
BEGIN
    -- Only process when status changes to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        
        -- Check if earnings already exist for this submission
        IF EXISTS (SELECT 1 FROM weekly_earnings WHERE submission_id = NEW.id) THEN
            RAISE LOG 'Earnings already processed for submission %', NEW.id;
            RETURN NEW;
        END IF;
        
        -- Get the current week's pool
        SELECT id, remaining_dollars INTO v_pool_id, v_pool_remaining
        FROM weekly_pools 
        WHERE CURRENT_DATE BETWEEN week_start_date AND week_end_date
        LIMIT 1;
        
        IF v_pool_id IS NULL THEN
            RAISE EXCEPTION 'No active weekly pool found for current date %', CURRENT_DATE;
        END IF;
        
        -- Check if this is user's first submission this week
        v_is_first_submission := NOT EXISTS (
            SELECT 1 FROM weekly_earnings we2 
            WHERE we2.user_id = NEW.user_id 
            AND we2.weekly_pool_id = v_pool_id
        );
        
        -- Calculate earning amount: $5 base for any submission
        v_earning_amount := CASE 
            WHEN NEW.actual_pull_up_count >= 1 THEN 5
            ELSE 0
        END;
        
        -- Don't exceed available pool funds
        IF v_earning_amount > v_pool_remaining THEN
            v_earning_amount := v_pool_remaining;
            RAISE WARNING 'Pool % has insufficient funds. Capping earning at $%', v_pool_id, v_earning_amount;
        END IF;
        
        -- Insert weekly earnings record
        INSERT INTO weekly_earnings (
            user_id, 
            weekly_pool_id, 
            submission_id, 
            pull_up_count, 
            earning_amount_dollars,
            is_first_submission,
            created_at
        )
        VALUES (
            NEW.user_id,
            v_pool_id,
            NEW.id,
            NEW.actual_pull_up_count,
            v_earning_amount,
            v_is_first_submission,
            NOW()
        );
        
        -- 🔥 CRITICAL: Update the weekly pool to drain it
        UPDATE weekly_pools
        SET 
            remaining_dollars = remaining_dollars - v_earning_amount,
            spent_dollars = spent_dollars + v_earning_amount,
            updated_at = NOW()
        WHERE id = v_pool_id;
        
        -- Log success
        RAISE LOG 'Processed earnings for submission % (user %): $% from pool %. First submission: %. Pool remaining: $%', 
            NEW.id, NEW.user_id, v_earning_amount, v_pool_id, v_is_first_submission, (v_pool_remaining - v_earning_amount);
        
    END IF;
    
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the approval
        RAISE WARNING 'Failed to process earnings for submission %: %', NEW.id, SQLERRM;
        
        -- Insert into error log table for monitoring
        INSERT INTO system_errors (
            error_type,
            error_message,
            context_data,
            created_at
        ) VALUES (
            'earnings_processing_failed',
            SQLERRM,
            json_build_object(
                'submission_id', NEW.id,
                'user_id', NEW.user_id,
                'actual_pull_up_count', NEW.actual_pull_up_count,
                'approved_at', NEW.approved_at
            ),
            NOW()
        );
        
        RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER auto_earnings_trigger
    AFTER UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.process_earnings_on_approval();

-- Add comments for documentation
COMMENT ON FUNCTION public.process_earnings_on_approval() IS 
'Automatically creates weekly_earnings records and updates weekly_pools when submissions are approved. 
Includes error logging and handles edge cases like insufficient pool funds.';

COMMENT ON TABLE system_errors IS 
'Logs system errors for monitoring and debugging. Used by triggers and functions to track failures.';

-- Verify trigger exists
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname = 'auto_earnings_trigger';
    
    IF trigger_count = 0 THEN
        RAISE EXCEPTION 'Failed to create auto_earnings_trigger';
    ELSE
        RAISE NOTICE '✅ auto_earnings_trigger created successfully';
    END IF;
END $$;

