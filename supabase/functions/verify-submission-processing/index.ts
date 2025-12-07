import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface VerificationResult {
  success: boolean;
  verified: boolean;
  recovered?: boolean;
  issues: string[];
  details: {
    submission_id: string;
    status: string;
    earnings_exist: boolean;
    pool_updated: boolean;
    user_earnings_updated: boolean;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { submissionId, autoRecover = true } = await req.json();
    
    if (!submissionId) {
      throw new Error('submissionId is required');
    }

    console.log(`🔍 Verifying submission processing for: ${submissionId}`);

    const result: VerificationResult = {
      success: true,
      verified: true,
      issues: [],
      details: {
        submission_id: submissionId,
        status: '',
        earnings_exist: false,
        pool_updated: false,
        user_earnings_updated: false,
      },
    };

    // 1. Get the submission
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    result.details.status = submission.status;
    console.log(`📄 Submission status: ${submission.status}`);

    // Only verify if approved
    if (submission.status !== 'approved') {
      return new Response(
        JSON.stringify({ 
          ...result,
          message: 'Submission not yet approved - no verification needed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if weekly_earnings exists
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('weekly_earnings')
      .select('*')
      .eq('submission_id', submissionId)
      .maybeSingle();

    if (earnings) {
      result.details.earnings_exist = true;
      console.log(`✅ Weekly earnings exist: $${earnings.earning_amount_dollars}`);
    } else {
      result.verified = false;
      result.issues.push('Weekly earnings record missing for approved submission');
      console.error(`❌ MISSING EARNINGS for submission ${submissionId}`);
    }

    // 3. Verify pool was updated (if earnings exist)
    if (earnings) {
      const { data: pool } = await supabaseAdmin
        .from('weekly_pools')
        .select('*')
        .eq('id', earnings.weekly_pool_id)
        .single();

      if (pool) {
        // Check if pool's spent_dollars is consistent
        const { data: poolEarnings } = await supabaseAdmin
          .from('weekly_earnings')
          .select('earning_amount_dollars')
          .eq('weekly_pool_id', pool.id);

        const totalSpent = poolEarnings?.reduce(
          (sum, e) => sum + parseFloat(e.earning_amount_dollars || '0'),
          0
        ) || 0;

        if (Math.abs(totalSpent - parseFloat(pool.spent_dollars || '0')) < 0.01) {
          result.details.pool_updated = true;
          console.log(`✅ Pool updated correctly. Spent: $${pool.spent_dollars}, Remaining: $${pool.remaining_dollars}`);
        } else {
          result.verified = false;
          result.issues.push(
            `Pool spent_dollars mismatch. Expected: $${totalSpent}, Actual: $${pool.spent_dollars}`
          );
          console.error(`❌ Pool spent_dollars mismatch!`);
        }
      }
    }

    // 4. Attempt auto-recovery if enabled and issues found
    if (!result.verified && autoRecover && !earnings) {
      console.log(`🔧 Attempting auto-recovery for submission ${submissionId}...`);

      // Find the correct weekly pool based on approval date
      const approvalDate = new Date(submission.approved_at || submission.updated_at);
      const { data: pool } = await supabaseAdmin
        .from('weekly_pools')
        .select('*')
        .gte('week_end_date', approvalDate.toISOString())
        .lte('week_start_date', approvalDate.toISOString())
        .single();

      if (pool) {
        const earningAmount = submission.actual_pull_up_count >= 1 ? 5 : 0;

        // Check if this would be user's first submission that week
        const { data: existingEarnings } = await supabaseAdmin
          .from('weekly_earnings')
          .select('id')
          .eq('user_id', submission.user_id)
          .eq('weekly_pool_id', pool.id);

        const isFirstSubmission = !existingEarnings || existingEarnings.length === 0;

        // Insert missing earnings
        const { error: insertError } = await supabaseAdmin
          .from('weekly_earnings')
          .insert({
            user_id: submission.user_id,
            weekly_pool_id: pool.id,
            submission_id: submission.id,
            pull_up_count: submission.actual_pull_up_count,
            earning_amount_dollars: earningAmount,
            is_first_submission: isFirstSubmission,
          });

        if (!insertError) {
          // Update pool
          await supabaseAdmin
            .from('weekly_pools')
            .update({
              remaining_dollars: parseFloat(pool.remaining_dollars) - earningAmount,
              spent_dollars: parseFloat(pool.spent_dollars) + earningAmount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pool.id);

          // Log the recovery
          await supabaseAdmin.from('system_errors').insert({
            error_type: 'earnings_missing_recovered',
            error_message: `Auto-recovered missing earnings for submission ${submissionId}`,
            context_data: {
              submission_id: submissionId,
              user_id: submission.user_id,
              earning_amount: earningAmount,
              pool_id: pool.id,
              recovery_timestamp: new Date().toISOString(),
            },
          });

          result.recovered = true;
          result.verified = true;
          result.issues = [];
          result.details.earnings_exist = true;
          result.details.pool_updated = true;

          console.log(`✅ Successfully recovered missing earnings: $${earningAmount}`);
        } else {
          result.issues.push(`Failed to insert recovery earnings: ${insertError.message}`);
          console.error(`❌ Recovery failed:`, insertError);
        }
      } else {
        result.issues.push('No matching weekly pool found for approval date');
        console.error(`❌ No pool found for date: ${approvalDate}`);
      }
    }

    // 5. Return result
    const statusCode = result.verified ? 200 : 500;
    const message = result.recovered
      ? 'Issues detected and automatically recovered'
      : result.verified
      ? 'Submission processing verified successfully'
      : 'Issues detected - manual intervention required';

    return new Response(
      JSON.stringify({
        ...result,
        message,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

