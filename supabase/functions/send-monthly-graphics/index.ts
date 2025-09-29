import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
        // Fetch graphic data with profile info for gender
        const { data: graphic, error } = await supabase
          .from('monthly_graphics')
          .select(`
            *,
            profiles!monthly_graphics_user_id_fkey(gender)
          `)
          .eq('id', graphicId)
          .single();

        if (error || !graphic) {
          errors.push(`Failed to fetch graphic ${graphicId}`);
          continue;
        }

        // Get user earnings
        const { data: earningsData } = await supabase
          .from('user_earnings')
          .select('total_earned_dollars')
          .eq('user_id', graphic.user_id)
          .eq('month_year', graphic.month_year)
          .single();

        // Generate the graphic image
        const graphicImageUrl = await generateGraphicImage({
          full_name: graphic.full_name,
          month_year: graphic.month_year,
          current_pullups: graphic.current_pullups,
          current_badge_name: graphic.current_badge_name,
          pullup_increase: graphic.pullup_increase,
          previous_pullups: graphic.previous_pullups,
          total_earned: earningsData?.total_earned_dollars || 0,
          gender: graphic.profiles?.gender || 'Male',
          current_leaderboard_position: graphic.current_leaderboard_position
        });
        
        // Create email HTML with embedded graphic
        const emailHtml = generateEmailWithGraphic(graphic as MonthlyGraphicData, graphicImageUrl);

        // Queue in email_notifications table
        const { error: insertError } = await supabase
          .from('email_notifications')
          .insert({
            user_id: graphic.user_id,
            email_type: 'monthly_graphic',
            recipient_email: graphic.email,
            subject: `Your ${formatMonth(graphic.month_year)} Pull-Up Club Achievement`,
            message: emailHtml,
            metadata: {
              graphic_id: graphic.id,
              month_year: graphic.month_year,
              current_pullups: graphic.current_pullups,
              badge_name: graphic.current_badge_name,
              graphic_image_url: graphicImageUrl
            }
          });

        if (!insertError) {
          queuedCount++;
          
          // Mark as sent in monthly_graphics (only if not already sent)
          if (!graphic.email_sent) {
            const { error: updateError } = await supabase
              .from('monthly_graphics')
              .update({ 
                email_sent: true, 
                email_sent_at: new Date().toISOString() 
              })
              .eq('id', graphicId);
              
            if (updateError) {
              console.error(`Failed to update monthly_graphics for ID ${graphicId}:`, updateError);
              errors.push(`Warning: Email queued for ${graphic.full_name} but failed to update status: ${updateError.message}`);
            }
          } else {
            console.log(`Resending email for ${graphic.full_name} - not updating monthly_graphics status`);
          }
        } else {
          errors.push(`Failed to queue email for ${graphic.full_name}: ${insertError.message}`);
        }
      } catch (err) {
        errors.push(`Error processing graphic ${graphicId}: ${err.message}`);
      }
    }

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

async function generateGraphicImage(graphicData: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-monthly-graphic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ graphicData })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Failed to generate graphic: ${result.error}`);
    }

    return result.imageUrl || '';
  } catch (error) {
    console.error('Error generating graphic image:', error);
    return '';
  }
}

function generateEmailWithGraphic(graphic: MonthlyGraphicData, graphicImageUrl: string): string {
  const monthName = formatMonth(graphic.month_year);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">Hi ${graphic.full_name}!</h1>
        <p style="color: #666666; margin: 0; font-size: 16px;">Your ${monthName} Pull-Up Club graphic is ready</p>
      </div>

      <!-- Download Section -->
      <div style="text-align: center; background: #f8f9fa; padding: 40px 30px; border-radius: 12px; border: 1px solid #e9ecef;">
        ${graphicImageUrl ? `
          <p style="color: #495057; font-size: 16px; margin: 0 0 30px 0;">
            Click the button below to download your personalized graphic
          </p>
          
          <a href="${graphicImageUrl}" 
             download="${graphic.full_name.replace(/\s+/g, '_')}_${graphic.month_year}_PullUpClub.png"
             style="display: inline-block; 
                    background: #28a745; 
                    color: #ffffff; 
                    padding: 16px 32px; 
                    text-decoration: none; 
                    border-radius: 6px; 
                    font-weight: 600; 
                    font-size: 16px;">
            Download My Graphic
          </a>
        ` : `
          <p style="color: #dc3545; font-size: 16px; margin: 0;">We couldn't generate your graphic. Please contact support.</p>
        `}
      </div>

      <!-- Social Sharing -->
      <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
        <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Share Your Achievement</h3>
        <p style="color: #495057; font-size: 14px; line-height: 1.6; margin: 0;">
          Download your graphic and share it on social media to inspire others and showcase your dedication to fitness. Tag us <strong>@PullUpClub</strong> to be featured!
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef;">
        <p style="color: #2c3e50; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">Pull-Up Club</p>
        <p style="color: #6c757d; font-size: 14px; margin: 0 0 15px 0;">Building stronger communities, one pull-up at a time</p>
        
        <div style="margin: 15px 0;">
          <a href="https://pullupclub.com" style="color: #28a745; text-decoration: none; margin: 0 15px; font-size: 14px;">Visit Website</a>
          <a href="https://pullupclub.com/leaderboard" style="color: #28a745; text-decoration: none; margin: 0 15px; font-size: 14px;">View Leaderboard</a>
        </div>
        
        <p style="color: #6c757d; font-size: 12px; margin: 15px 0 0 0; line-height: 1.4;">
          Keep pushing your limits. See you next month!<br>
          <em>If you have any questions, reply to this email or contact our support team.</em>
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