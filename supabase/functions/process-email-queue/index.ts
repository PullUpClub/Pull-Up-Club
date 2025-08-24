import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  console.log('Email Queue Processor started');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check environment variables
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get pending emails - broader time window for different email types
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
    
    const { data: pendingEmails, error: queryError } = await supabase
      .from('email_notifications')
      .select(`
        *,
        profiles!email_notifications_user_id_fkey(email, full_name)
      `)
      .is('sent_at', null)
      .gte('created_at', sevenDaysAgo)
      .lte('created_at', oneMinuteAgo)
      .in('email_type', [
        'rejection', 
        'resubmission', 
        'paypal_reminder', 
        'paypal_reminder_test', 
        'account_setup_reminder'
      ])
      .limit(50);

    if (queryError) {
      console.error('Database query error:', queryError);
      throw new Error(`Database error: ${queryError.message}`);
    }

    console.log(`Found ${pendingEmails?.length || 0} pending emails to process`);

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending emails to process',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each email
    for (let i = 0; i < pendingEmails.length; i++) {
      const email = pendingEmails[i];
      
      try {
        console.log(`Processing email ${i + 1}/${pendingEmails.length}: ${email.email_type} to ${email.recipient_email}`);

        // Validate email address
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.recipient_email)) {
          console.error(`Invalid email format: ${email.recipient_email}`);
          errorCount++;
          continue;
        }

        // Prepare email for Resend
        let emailHTML = email.message;
        
        // Handle different email types with proper HTML formatting
        if (email.email_type.includes('paypal') && !email.message.includes('<div')) {
          // PayPal reminders get simple wrapper if plain text
          emailHTML = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
              ${email.email_type.includes('test') ? 
                '<div style="background: #ffeb3b; color: #333; padding: 10px; border-radius: 4px; margin-bottom: 20px;"><strong>🧪 TEST EMAIL</strong></div>' : ''
              }
              <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${email.message.replace(/\n/g, '<br>')}
              </div>
            </div>
          `;
        } else if (email.email_type === 'rejection' || email.email_type === 'resubmission') {
          // Rejection and resubmission emails already have full HTML - use as is
          emailHTML = email.message;
        } else if (!email.message.includes('<div') && !email.message.includes('<html')) {
          // Other plain text emails get basic HTML wrapper
          emailHTML = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000; color: #ffffff;">
              <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; border-radius: 12px; border: 1px solid #333333;">
                ${email.message.replace(/\n/g, '<br>')}
              </div>
            </div>
          `;
        }

        // Send via Resend API
        const resendPayload = {
          from: 'Pull-Up Club <noreply@pullupclub.com>',
          to: [email.recipient_email],
          subject: email.subject,
          html: emailHTML
        };

        console.log('Sending email via Resend API...');
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify(resendPayload)
        });

        const resendResult = await resendResponse.json();
        console.log('Resend response status:', resendResponse.status);

        if (resendResponse.ok) {
          console.log('✅ Email sent successfully via Resend');
          
          // Update email as sent
          const { error: updateError } = await supabase
            .from('email_notifications')
            .update({
              sent_at: new Date().toISOString(),
              resend_id: resendResult.id || null
            })
            .eq('id', email.id);

          if (updateError) {
            console.error('Database update error:', updateError);
          } else {
            successCount++;
            console.log(`✅ Email ${i + 1}/${pendingEmails.length} processed successfully`);
          }
        } else {
          console.error('❌ Resend API error:', resendResult);
          errorCount++;
        }

        // Rate limiting: Wait between emails
        if (i < pendingEmails.length - 1) {
          console.log('Waiting 500ms before next email...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (emailError) {
        console.error(`Error processing email ${email.id}:`, emailError);
        errorCount++;
        
        // Continue with next email after a short delay
        if (i < pendingEmails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    const result = {
      success: true,
      processed: pendingEmails.length,
      sent: successCount,
      failed: errorCount,
      message: `Email processing complete: ${successCount} sent, ${errorCount} failed`
    };

    console.log('Email processing complete:', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email queue processor error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});