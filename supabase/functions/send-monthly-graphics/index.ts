import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface MonthlyGraphicData {
  id: string;
  email: string;
  full_name: string;
  month_year: string;
  current_pullups: number;
  current_badge_name: string;
  current_leaderboard_position: number;
  previous_pullups: number | null;
  pullup_increase: number | null;
  position_change: number | null;
  user_id: string;
}

Deno.serve(async (req) => {
  console.log('Monthly Graphics Email Handler started');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, graphicIds } = await req.json();

    let queuedCount = 0;
    const errors: string[] = [];

    // Process each graphic ID
    for (const graphicId of graphicIds) {
      try {
        // Fetch graphic data
        const { data: graphic, error } = await supabase
          .from('monthly_graphics')
          .select('*')
          .eq('id', graphicId)
          .single();

        if (error || !graphic) {
          errors.push(`Failed to fetch graphic ${graphicId}`);
          continue;
        }

        // Create email HTML
        const emailHtml = generateEmailHtml(graphic as MonthlyGraphicData);

        // Queue in email_notifications table
        const { error: insertError } = await supabase
          .from('email_notifications')
          .insert({
            user_id: graphic.user_id,
            email_type: 'monthly_graphic',
            recipient_email: graphic.email,
            subject: `Your ${formatMonth(graphic.month_year)} Pull-Up Club Results 💪`,
            message: emailHtml,
            metadata: {
              graphic_id: graphic.id,
              month_year: graphic.month_year,
              current_pullups: graphic.current_pullups,
              badge_name: graphic.current_badge_name
            }
          });

        if (!insertError) {
          queuedCount++;
          
          // Mark as sent in monthly_graphics
          await supabase
            .from('monthly_graphics')
            .update({ 
              email_sent: true, 
              email_sent_at: new Date().toISOString() 
            })
            .eq('id', graphicId);
        } else {
          errors.push(`Failed to queue email for ${graphic.full_name}: ${insertError.message}`);
        }
      } catch (err) {
        errors.push(`Error processing graphic ${graphicId}: ${err.message}`);
      }
    }

    // The existing process-email-queue function will handle actual sending
    return new Response(
      JSON.stringify({ 
        success: true, 
        queued: queuedCount,
        message: `${queuedCount} emails queued for delivery`,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in monthly graphics handler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateEmailHtml(graphic: MonthlyGraphicData): string {
  const hasImprovement = graphic.pullup_increase && graphic.pullup_increase > 0;
  const isFirstMonth = !graphic.previous_pullups;
  const monthName = formatMonth(graphic.month_year);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000; color: #ffffff;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; padding: 30px 20px; background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); border-radius: 12px; border: 1px solid #333333;">
        <h1 style="color: #918f6f; margin: 0; font-size: 32px; font-weight: bold; letter-spacing: -0.5px;">Pull-Up Club</h1>
        <p style="color: #999999; margin: 8px 0 0 0; font-size: 16px;">Your Monthly Performance Report</p>
      </div>

      <!-- Main Content -->
      <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #333333;">
        <h2 style="color: #918f6f; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">
          ${monthName} Results
        </h2>
        
        <p style="color: #ffffff; font-size: 18px; margin-bottom: 20px; line-height: 1.5;">
          Hi <strong style="color: #918f6f;">${graphic.full_name}</strong>,
        </p>

        ${isFirstMonth ? `
          <p style="color: #cccccc; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
            🎉 Congratulations on completing your first month with Pull-Up Club!
          </p>
        ` : hasImprovement ? `
          <p style="color: #cccccc; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
            🚀 Amazing progress! You improved by ${graphic.pullup_increase} pull-ups from last month!
          </p>
        ` : `
          <p style="color: #cccccc; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
            Keep pushing! Consistency is key to reaching your goals.
          </p>
        `}

        <!-- Stats Box -->
        <div style="background: rgba(145, 143, 111, 0.1); border: 1px solid #918f6f; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #918f6f; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Your Performance:</h3>
          
          <div style="display: table; width: 100%;">
            <div style="display: table-row;">
              <div style="display: table-cell; padding: 8px 0; color: #cccccc; font-weight: 500;">This Month:</div>
              <div style="display: table-cell; padding: 8px 0; text-align: right;">
                <span style="color: #918f6f; font-size: 24px; font-weight: bold;">${graphic.current_pullups}</span>
                <span style="color: #cccccc; font-size: 14px; margin-left: 4px;">pull-ups</span>
              </div>
            </div>

            ${!isFirstMonth ? `
              <div style="display: table-row;">
                <div style="display: table-cell; padding: 8px 0; color: #cccccc;">Last Month:</div>
                <div style="display: table-cell; padding: 8px 0; text-align: right; color: #ffffff;">
                  ${graphic.previous_pullups} pull-ups
                </div>
              </div>

              ${hasImprovement ? `
                <div style="display: table-row;">
                  <div style="display: table-cell; padding: 8px 0; color: #cccccc;">Improvement:</div>
                  <div style="display: table-cell; padding: 8px 0; text-align: right;">
                    <span style="color: #4ade80; font-weight: bold; font-size: 18px;">+${graphic.pullup_increase} 🎯</span>
                  </div>
                </div>
              ` : ''}
            ` : ''}

            <div style="display: table-row;">
              <div style="display: table-cell; padding: 8px 0; color: #cccccc;">Leaderboard:</div>
              <div style="display: table-cell; padding: 8px 0; text-align: right;">
                <span style="color: #918f6f; font-weight: bold; font-size: 18px;">#${graphic.current_leaderboard_position || 'N/A'}</span>
              </div>
            </div>

            <div style="display: table-row;">
              <div style="display: table-cell; padding: 8px 0; color: #cccccc;">Badge:</div>
              <div style="display: table-cell; padding: 8px 0; text-align: right;">
                <span style="color: #918f6f; font-weight: bold;">${graphic.current_badge_name}</span>
              </div>
            </div>
          </div>
        </div>

        <p style="color: #ffffff; font-size: 16px; margin-top: 25px; line-height: 1.6;">
          Ready for next month? Keep training and submit your next video to continue tracking your progress!
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://pullupclub.com/leaderboard" 
           style="display: inline-block; 
                  background: linear-gradient(135deg, #918f6f 0%, #a19f7f 100%); 
                  color: #000000; 
                  padding: 16px 32px; 
                  text-decoration: none; 
                  border-radius: 8px; 
                  font-weight: 600; 
                  font-size: 16px; 
                  transition: all 0.3s ease;
                  box-shadow: 0 4px 12px rgba(145, 143, 111, 0.3);">
          View Full Leaderboard →
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333333;">
        <p style="color: #ffffff; font-size: 18px; margin: 0 0 10px 0; font-weight: 500;">
          Keep pushing your limits!
        </p>
        <p style="color: #918f6f; font-size: 16px; margin: 0 0 20px 0;">
          The Pull-Up Club Team
        </p>
        <p style="color: #666666; font-size: 12px; margin: 0; line-height: 1.4;">
          Pull-Up Club • <a href="https://pullupclub.com" style="color: #918f6f; text-decoration: none;">pullupclub.com</a>
        </p>
      </div>
    </div>
  `;
}

function formatMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
