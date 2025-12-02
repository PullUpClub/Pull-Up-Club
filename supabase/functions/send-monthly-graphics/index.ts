import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@1.1.0';

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
  email_sent: boolean;
  email_sent_at: string | null;
  profiles?: { gender: string };
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
    const resend = new Resend(RESEND_API_KEY);

    const { action, graphicIds } = await req.json();

    let sentCount = 0;
    let queuedCount = 0; // For fallback
    const errors: string[] = [];

    for (const graphicId of graphicIds) {
      try {
        const { data: graphic, error: fetchError } = await supabase
          .from('monthly_graphics')
          .select(`
            *,
            profiles!monthly_graphics_user_id_fkey(gender)
          `)
          .eq('id', graphicId)
          .single();

        if (fetchError || !graphic) {
          errors.push(`Failed to fetch graphic ${graphicId}: ${fetchError?.message || 'Not found'}`);
          continue;
        }

        const { data: earningsData } = await supabase
          .from('user_earnings')
          .select('total_earned_dollars')
          .eq('user_id', graphic.user_id)
          .eq('month_year', graphic.month_year)
          .single();

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
        
        console.log(`Generated graphic image URL for ${graphic.full_name}:`, graphicImageUrl);
        
        const emailHtml = generateEmailWithGraphic(graphic as MonthlyGraphicData, graphicImageUrl);

        const emailPayload = {
          from: 'Pull-Up Club <noreply@pullupclub.com>',
          to: [graphic.email],
          subject: `Your ${formatMonth(graphic.month_year)} Pull-Up Club Achievement`,
          html: emailHtml,
        };

        console.log(`Attempting to send email to ${graphic.email} via Resend...`);
        const resendResponse = await resend.emails.send(emailPayload);

        if (resendResponse.data?.id) {
          console.log(`✅ Email sent successfully to ${graphic.email}. Resend ID: ${resendResponse.data.id}`);
          sentCount++;

          // Update monthly_graphics table to mark as sent
          const { error: updateError } = await supabase
            .from('monthly_graphics')
            .update({ 
              email_sent: true, 
              email_sent_at: new Date().toISOString() 
            })
            .eq('id', graphicId);
            
          if (updateError) {
            console.error(`Failed to update monthly_graphics status for ID ${graphicId}:`, updateError);
            errors.push(`Warning: Email sent to ${graphic.full_name} but failed to update status: ${updateError.message}`);
          } else {
            console.log(`✓ Updated monthly_graphics table for ${graphic.full_name} (ID: ${graphicId})`);
          }

          // Also log to email_notifications for record-keeping
          const { error: insertLogError } = await supabase.from('email_notifications').insert({
            user_id: graphic.user_id,
            email_type: 'monthly_graphic',
            recipient_email: graphic.email,
            subject: emailPayload.subject,
            message: emailHtml,
            sent_at: new Date().toISOString(),
            resend_id: resendResponse.data.id,
            status: 'sent',
            metadata: {
              graphic_id: graphic.id,
              month_year: graphic.month_year,
              current_pullups: graphic.current_pullups,
              badge_name: graphic.current_badge_name,
              graphic_image_url: graphicImageUrl
            }
          });
          if (insertLogError) {
            console.error(`Failed to log sent email to email_notifications for ID ${graphicId}:`, insertLogError);
          }

        } else {
          // Resend failed - attempt fallback queue
          console.error(`❌ Resend API failed for ${graphic.email}`);
          console.error(`❌ Resend error details:`, JSON.stringify(resendResponse.error, null, 2));
          
          const resendErrorMsg = resendResponse.error?.message || JSON.stringify(resendResponse.error) || 'Unknown Resend error';
          
          // Fallback to queuing if direct send fails
          const { error: insertError } = await supabase.from('email_notifications').insert({
            user_id: graphic.user_id,
            email_type: 'monthly_graphic',
            recipient_email: graphic.email,
            subject: emailPayload.subject,
            message: emailHtml,
            metadata: {
              graphic_id: graphic.id,
              month_year: graphic.month_year,
              current_pullups: graphic.current_pullups,
              badge_name: graphic.current_badge_name,
              graphic_image_url: graphicImageUrl,
              resend_error: resendErrorMsg
            }
          });
          
          if (!insertError) {
            // Successfully queued as fallback - mark as sent since it will be processed
            queuedCount++;
            console.log(`📧 Email queued for fallback delivery to ${graphic.full_name}`);
            
            const { error: updateError } = await supabase
              .from('monthly_graphics')
              .update({ 
                email_sent: true, 
                email_sent_at: new Date().toISOString() 
              })
              .eq('id', graphicId);
            
            if (updateError) {
              console.error(`Failed to update monthly_graphics in fallback mode for ID ${graphicId}:`, updateError);
              // Don't add to errors - the email is queued successfully
            } else {
              console.log(`✓ Updated monthly_graphics table in fallback mode for ${graphic.full_name}`);
            }
          } else {
            // Both Resend AND queue failed - this is a real error
            errors.push(`Failed to send email to ${graphic.full_name}: Direct send failed (${resendErrorMsg}) and queue failed (${insertError.message})`);
          }
        }
        
        // Add delay for bulk operations
        if (graphicIds.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

      } catch (err) {
        console.error(`Error processing graphic ${graphicId}:`, err);
        errors.push(`Error processing graphic ${graphicId}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount,
        queued: queuedCount,
        message: `${sentCount} emails sent, ${queuedCount} queued`,
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

    console.log(`🎨 Generating graphic for ${graphicData.full_name} (${graphicData.month_year})...`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-monthly-graphic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ graphicData })
    });

    if (!response.ok) {
      console.error(`❌ Generate-monthly-graphic HTTP error: ${response.status} ${response.statusText}`);
      return '';
    }

    const result = await response.json();
    
    console.log('📊 Generate-monthly-graphic response:', { 
      success: result.success, 
      hasImageUrl: !!result.imageUrl,
      hasHtml: !!result.html,
      imageUrl: result.imageUrl ? result.imageUrl.substring(0, 100) + '...' : null,
      message: result.message
    });
    
    if (!result.success) {
      console.error('❌ Generate-monthly-graphic failed:', result.error);
      return '';
    }

    if (result.imageUrl && result.imageUrl.trim() !== '') {
      console.log(`✅ Image URL received for ${graphicData.full_name}:`, result.imageUrl);
      return result.imageUrl;
    } else {
      console.log(`⚠️ No image URL in response for ${graphicData.full_name}, using HTML fallback`);
      return '';
    }
  } catch (error) {
    console.error(`❌ Error generating graphic image for ${graphicData.full_name}:`, error);
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

      <!-- Graphic Image -->
      <div style="text-align: center; margin-bottom: 30px;">
        ${graphicImageUrl && graphicImageUrl.trim() !== '' ? `
          <div style="display: inline-block; max-width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <img 
              src="${graphicImageUrl}" 
              alt="${graphic.full_name}'s Monthly Pull-Up Graphic for ${monthName}" 
              style="display: block; width: 100%; height: auto; max-width: 600px; border: none;"
            />
          </div>
          <p style="color: #666666; font-size: 12px; margin-top: 15px; font-style: italic; text-align: center;">
            Your personalized ${monthName} achievement graphic
          </p>
        ` : `
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; border: 1px solid #e9ecef; color: #495057; font-size: 16px; text-align: center;">
            <p style="margin-bottom: 15px;">Your graphic is being processed. Please check back in a few minutes or contact support if this issue persists.</p>
            <a href="mailto:support@pullupclub.com" style="display: inline-block; background: #007bff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600;">Contact Support</a>
          </div>
        `}
      </div>

      <!-- Social Sharing -->
      <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
        <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Share Your Achievement</h3>
        <p style="color: #495057; font-size: 14px; line-height: 1.6; margin: 0;">
          Save this graphic and share it on social media to inspire others and showcase your dedication to fitness. Tag us <strong>@PullUpClub</strong> to be featured!
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