import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@1.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface HealthCheckResult {
  category: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: Record<string, any>;
  action_required?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('🏥 Weekly Health Check Started');

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RECIPIENT_EMAIL = 'parkergawne10@gmail.com';

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(RESEND_API_KEY);
    const results: HealthCheckResult[] = [];

    // ============================================
    // 1. CHECK DATABASE TRIGGERS
    // ============================================
    console.log('🔍 Checking database triggers...');
    const { data: triggers, error: triggerError } = await supabaseAdmin.rpc('execute_sql', {
      query: `
        SELECT 
          c.relname as table_name,
          t.tgname as trigger_name,
          CASE t.tgenabled 
            WHEN 'O' THEN 'enabled'
            WHEN 'D' THEN 'disabled'
          END as status,
          p.proname as function_name
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        LEFT JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE n.nspname = 'public'
        AND NOT tgisinternal
        ORDER BY c.relname, t.tgname;
      `
    });

    const criticalTriggers = [
      'auto_earnings_trigger',
      'cleanup_earnings_trigger',
      'on_submission_approved_award_badges',
      'trigger_populate_monthly_graphics'
    ];

    const foundTriggers = triggers?.map((t: any) => t.trigger_name) || [];
    const missingTriggers = criticalTriggers.filter(t => !foundTriggers.includes(t));

    if (missingTriggers.length > 0) {
      results.push({
        category: 'Database Triggers',
        status: 'critical',
        message: `${missingTriggers.length} critical triggers are MISSING`,
        details: { missing_triggers: missingTriggers },
        action_required: 'Apply missing trigger migrations immediately'
      });
    } else {
      results.push({
        category: 'Database Triggers',
        status: 'healthy',
        message: `All ${criticalTriggers.length} critical triggers are active`,
        details: { active_triggers: foundTriggers.length }
      });
    }

    // ============================================
    // 2. CHECK EARNINGS PROCESSING INTEGRITY
    // ============================================
    console.log('💰 Checking earnings processing...');
    const { data: approvedWithoutEarnings } = await supabaseAdmin
      .from('submissions')
      .select(`
        id,
        user_id,
        status,
        actual_pull_up_count,
        approved_at,
        profiles!inner(full_name, email)
      `)
      .eq('status', 'approved')
      .gte('approved_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    let missingEarningsCount = 0;
    const missingEarningsDetails: any[] = [];

    if (approvedWithoutEarnings) {
      for (const submission of approvedWithoutEarnings) {
        const { data: earnings } = await supabaseAdmin
          .from('weekly_earnings')
          .select('id')
          .eq('submission_id', submission.id)
          .maybeSingle();

        if (!earnings) {
          missingEarningsCount++;
          missingEarningsDetails.push({
            submission_id: submission.id,
            user: submission.profiles.full_name,
            pull_ups: submission.actual_pull_up_count,
            approved_at: submission.approved_at
          });
        }
      }
    }

    if (missingEarningsCount > 0) {
      results.push({
        category: 'Earnings Processing',
        status: 'critical',
        message: `${missingEarningsCount} approved submissions have NO earnings records`,
        details: { 
          missing_count: missingEarningsCount,
          examples: missingEarningsDetails.slice(0, 5)
        },
        action_required: 'Run recovery function or manually process earnings'
      });
    } else {
      results.push({
        category: 'Earnings Processing',
        status: 'healthy',
        message: 'All approved submissions have earnings records',
        details: { checked_submissions: approvedWithoutEarnings?.length || 0 }
      });
    }

    // ============================================
    // 3. CHECK WEEKLY POOL INTEGRITY
    // ============================================
    console.log('🏊 Checking weekly pools...');
    const { data: currentPool } = await supabaseAdmin
      .from('weekly_pools')
      .select('*')
      .eq('is_current', true)
      .maybeSingle();

    if (!currentPool) {
      results.push({
        category: 'Weekly Pools',
        status: 'critical',
        message: 'NO active weekly pool found',
        action_required: 'Run pool creation function immediately'
      });
    } else {
      // Calculate expected spent_dollars from weekly_earnings
      const { data: poolEarnings } = await supabaseAdmin
        .from('weekly_earnings')
        .select('earning_amount_dollars')
        .eq('weekly_pool_id', currentPool.id);

      const calculatedSpent = poolEarnings?.reduce(
        (sum, e) => sum + parseFloat(e.earning_amount_dollars || '0'),
        0
      ) || 0;

      const dbSpent = parseFloat(currentPool.spent_dollars || '0');
      const difference = Math.abs(calculatedSpent - dbSpent);

      if (difference > 0.01) {
        results.push({
          category: 'Weekly Pools',
          status: 'warning',
          message: `Pool spent_dollars mismatch detected`,
          details: {
            pool_id: currentPool.id,
            db_spent: dbSpent,
            calculated_spent: calculatedSpent,
            difference: difference,
            remaining: currentPool.remaining_dollars
          },
          action_required: 'Reconcile pool amounts'
        });
      } else {
        results.push({
          category: 'Weekly Pools',
          status: 'healthy',
          message: 'Weekly pool amounts are accurate',
          details: {
            pool_id: currentPool.id,
            remaining: currentPool.remaining_dollars,
            spent: dbSpent
          }
        });
      }
    }

    // ============================================
    // 4. CHECK MONTHLY PAYOUTS INTEGRITY
    // ============================================
    console.log('📊 Checking monthly payouts...');
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const { data: monthlyEarnings } = await supabaseAdmin
      .from('user_earnings')
      .select('*')
      .eq('month_year', currentMonth);

    const { data: payoutRequests } = await supabaseAdmin
      .from('payout_requests')
      .select('*')
      .eq('payout_month', currentMonth);

    const earningsCount = monthlyEarnings?.length || 0;
    const payoutCount = payoutRequests?.length || 0;

    if (earningsCount !== payoutCount) {
      results.push({
        category: 'Monthly Payouts',
        status: 'warning',
        message: `Mismatch between user_earnings (${earningsCount}) and payout_requests (${payoutCount})`,
        details: {
          month: currentMonth,
          earnings_count: earningsCount,
          payout_count: payoutCount
        },
        action_required: 'Regenerate monthly payouts'
      });
    } else {
      results.push({
        category: 'Monthly Payouts',
        status: 'healthy',
        message: `Monthly payouts are in sync (${payoutCount} users)`,
        details: {
          month: currentMonth,
          total_users: payoutCount
        }
      });
    }

    // ============================================
    // 5. CHECK MONTHLY GRAPHICS
    // ============================================
    console.log('🎨 Checking monthly graphics...');
    const { data: monthlyGraphics } = await supabaseAdmin
      .from('monthly_graphics')
      .select('*')
      .eq('month_year', currentMonth);

    const graphicsCount = monthlyGraphics?.length || 0;

    if (graphicsCount < earningsCount) {
      results.push({
        category: 'Monthly Graphics',
        status: 'warning',
        message: `Missing graphics: ${earningsCount - graphicsCount} users need graphics`,
        details: {
          month: currentMonth,
          expected: earningsCount,
          actual: graphicsCount
        },
        action_required: 'Generate missing monthly graphics'
      });
    } else {
      results.push({
        category: 'Monthly Graphics',
        status: 'healthy',
        message: `All ${graphicsCount} monthly graphics generated`,
        details: { month: currentMonth }
      });
    }

    // ============================================
    // 6. CHECK SYSTEM ERRORS
    // ============================================
    console.log('🚨 Checking system errors...');
    const { data: recentErrors } = await supabaseAdmin
      .from('system_errors')
      .select('*')
      .eq('resolved', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    const errorCount = recentErrors?.length || 0;

    if (errorCount > 0) {
      results.push({
        category: 'System Errors',
        status: 'warning',
        message: `${errorCount} unresolved errors in the past 7 days`,
        details: {
          recent_errors: recentErrors.map(e => ({
            type: e.error_type,
            message: e.error_message,
            created_at: e.created_at
          }))
        },
        action_required: 'Review and resolve errors'
      });
    } else {
      results.push({
        category: 'System Errors',
        status: 'healthy',
        message: 'No unresolved system errors in the past 7 days'
      });
    }

    // ============================================
    // 7. CHECK RLS POLICIES
    // ============================================
    console.log('🔒 Checking RLS policies...');
    const { data: rlsIssues } = await supabaseAdmin.rpc('check_rls_policies');

    if (rlsIssues && rlsIssues.length > 0) {
      results.push({
        category: 'RLS Policies',
        status: 'critical',
        message: `${rlsIssues.length} RLS policy issues detected`,
        details: { issues: rlsIssues },
        action_required: 'Review and fix RLS policies'
      });
    } else {
      results.push({
        category: 'RLS Policies',
        status: 'healthy',
        message: 'All RLS policies are properly configured'
      });
    }

    // ============================================
    // 8. CHECK STRIPE INTEGRATION
    // ============================================
    console.log('💳 Checking Stripe integration...');
    const { data: usersWithoutStripe } = await supabaseAdmin
      .from('profiles')
      .select('id, email, is_paid')
      .eq('is_paid', true)
      .is('stripe_customer_id', null)
      .limit(10);

    if (usersWithoutStripe && usersWithoutStripe.length > 0) {
      results.push({
        category: 'Stripe Integration',
        status: 'warning',
        message: `${usersWithoutStripe.length} paid users missing Stripe customer IDs`,
        details: {
          affected_users: usersWithoutStripe.map(u => u.email)
        },
        action_required: 'Investigate Stripe webhook processing'
      });
    } else {
      results.push({
        category: 'Stripe Integration',
        status: 'healthy',
        message: 'All paid users have Stripe customer IDs'
      });
    }

    // ============================================
    // GENERATE HEALTH SCORE
    // ============================================
    const criticalCount = results.filter(r => r.status === 'critical').length;
    const warningCount = results.filter(r => r.status === 'warning').length;
    const healthyCount = results.filter(r => r.status === 'healthy').length;

    const overallStatus = criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'NEEDS ATTENTION' : 'HEALTHY';
    const healthScore = Math.round((healthyCount / results.length) * 100);

    // ============================================
    // SEND EMAIL REPORT
    // ============================================
    const emailHtml = generateHealthReportEmail(results, overallStatus, healthScore);

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'Pull-Up Club System <noreply@pullupclub.com>',
      to: [RECIPIENT_EMAIL],
      subject: `🏥 Weekly Health Check: ${overallStatus} (${healthScore}% healthy)`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Failed to send email:', emailError);
    } else {
      console.log('✅ Health report email sent successfully');
    }

    // ============================================
    // LOG TO DATABASE
    // ============================================
    await supabaseAdmin.from('system_health_checks').insert({
      check_date: new Date().toISOString(),
      overall_status: overallStatus,
      health_score: healthScore,
      critical_issues: criticalCount,
      warnings: warningCount,
      results: results,
      email_sent: !emailError,
    });

    return new Response(
      JSON.stringify({
        success: true,
        overall_status: overallStatus,
        health_score: healthScore,
        critical_issues: criticalCount,
        warnings: warningCount,
        healthy_checks: healthyCount,
        results: results,
        email_sent: !emailError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateHealthReportEmail(
  results: HealthCheckResult[],
  overallStatus: string,
  healthScore: number
): string {
  const statusColor = overallStatus === 'CRITICAL' ? '#dc2626' : overallStatus === 'NEEDS ATTENTION' ? '#f59e0b' : '#16a34a';

  let resultsHtml = '';
  for (const result of results) {
    const icon = result.status === 'critical' ? '🔴' : result.status === 'warning' ? '🟡' : '🟢';
    const bgColor = result.status === 'critical' ? '#fef2f2' : result.status === 'warning' ? '#fffbeb' : '#f0fdf4';
    const borderColor = result.status === 'critical' ? '#fecaca' : result.status === 'warning' ? '#fde68a' : '#bbf7d0';

    resultsHtml += `
      <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
        <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px;">
          ${icon} ${result.category}
        </div>
        <div style="color: #4b5563; margin-bottom: 8px;">
          ${result.message}
        </div>
        ${result.action_required ? `
          <div style="background: white; padding: 10px; border-radius: 4px; margin-top: 10px; border: 1px solid ${borderColor};">
            <strong style="color: #dc2626;">Action Required:</strong> ${result.action_required}
          </div>
        ` : ''}
        ${result.details ? `
          <details style="margin-top: 10px;">
            <summary style="cursor: pointer; color: #6b7280; font-size: 14px;">View Details</summary>
            <pre style="background: white; padding: 10px; border-radius: 4px; margin-top: 8px; overflow-x: auto; font-size: 12px;">${JSON.stringify(result.details, null, 2)}</pre>
          </details>
        ` : ''}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
        <h1 style="margin: 0 0 10px 0; font-size: 28px;">🏥 Weekly Health Check</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">Pull-Up Club System Status Report</p>
        <div style="margin-top: 20px; font-size: 14px; opacity: 0.8;">
          ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <!-- Overall Status Card -->
      <div style="background: white; border: 2px solid ${statusColor}; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
        <div style="font-size: 18px; color: #6b7280; margin-bottom: 10px;">Overall Status</div>
        <div style="font-size: 36px; font-weight: bold; color: ${statusColor}; margin-bottom: 10px;">
          ${overallStatus}
        </div>
        <div style="font-size: 24px; color: #4b5563;">
          Health Score: ${healthScore}%
        </div>
      </div>

      <!-- Results -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">System Checks</h2>
        ${resultsHtml}
      </div>

      <!-- Prevention Tips -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="color: #1f2937; margin-top: 0;">💡 Prevention Tips</h3>
        <ul style="color: #4b5563; padding-left: 20px;">
          <li>Apply the fixed migration to add the <code>auto_earnings_trigger</code></li>
          <li>Enable error logging to catch silent failures</li>
          <li>Run weekly pool reconciliation scripts</li>
          <li>Monitor the <code>system_errors</code> table daily</li>
          <li>Test RLS policies after every migration</li>
        </ul>
      </div>

      <!-- Quick Actions -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="color: #1e40af; margin-top: 0;">🔧 Quick Actions</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="https://supabase.com/dashboard/project/yqnikgupiaghgjtsaypr/editor" 
             style="background: #3b82f6; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; text-align: center; font-weight: 600;">
            Open Supabase Dashboard
          </a>
          <a href="https://pullupclub.com/admin-dashboard" 
             style="background: #9b9b6f; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; text-align: center; font-weight: 600;">
            Open Admin Dashboard
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; color: #6b7280; font-size: 14px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p>This is an automated weekly health check report for Pull-Up Club.</p>
        <p>Questions? Reply to this email or contact the development team.</p>
      </div>

    </body>
    </html>
  `;
}

