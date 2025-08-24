import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? '',
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { target_month, test_email } = await req.json();
    
    // Auto-calculate current month if not provided or set to "auto"
    let monthToUse;
    if (!target_month || target_month === "auto" || target_month === "current") {
      monthToUse = new Date().toISOString().slice(0, 7); // YYYY-MM format
    } else {
      monthToUse = target_month;
    }
    
    console.log(`Processing PayPal reminders for month: ${monthToUse}`);
    
    // If test_email is provided, only process that specific user
    if (test_email) {
      console.log(`TEST MODE: Only processing ${test_email}`);
    }

    // Calculate date range properly
    const startDate = `${monthToUse}-01`;
    
    // Calculate the first day of the next month
    const [year, month] = monthToUse.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
    
    console.log(`Date range: ${startDate} to ${endDate}`);

    // Get users with pending payouts but no PayPal email
    let query = supabaseAdmin
      .from('payout_requests')
      .select(`
        id,
        amount_dollars,
        user_id,
        profiles:user_id (
          full_name,
          email,
          paypal_email
        )
      `)
      .eq('status', 'pending')
      .gte('request_date', startDate)
      .lt('request_date', endDate)
      .is('profiles.paypal_email', null);

    // If test_email is provided, filter to only that user
    if (test_email) {
      query = query.eq('profiles.email', test_email);
    }

    const { data: usersNeedingPayPal, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!usersNeedingPayPal || usersNeedingPayPal.length === 0) {
      console.log(`No users need PayPal reminders for ${monthToUse}`);
      return new Response(JSON.stringify({
        success: true,
        message: "No users need PayPal reminders",
        emails_sent: 0,
        target_month: monthToUse
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`Found ${usersNeedingPayPal.length} users needing PayPal setup`);

    let emails_sent = 0;
    let errors = [];

    // Send email to each user
    for (const payout of usersNeedingPayPal) {
      try {
        const user = payout.profiles;
        if (!user?.email) {
          console.log(`Skipping user ${payout.user_id} - no email address`);
          continue;
        }

        // Create beautiful branded email notification
        const { error: emailError } = await supabaseAdmin
          .from('email_notifications')
          .insert({
            recipient_email: user.email,
            email_type: test_email ? 'paypal_reminder_test' : 'paypal_reminder',
            subject: test_email ? `[TEST] Your Pull-Up Club Earnings Are Ready! 💰` : `Your Pull-Up Club Earnings Are Ready! 💰`,
            message: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000; color: #ffffff;">
                ${test_email ? 
                  '<div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000000; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold;">🧪 TEST EMAIL - PayPal Reminder System</div>' 
                  : ''
                }
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px; padding: 30px 20px; background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); border-radius: 12px; border: 1px solid #333333;">
                  <h1 style="color: #918f6f; margin: 0; font-size: 32px; font-weight: bold; letter-spacing: -0.5px;">Pull-Up Club</h1>
                  <p style="color: #999999; margin: 8px 0 0 0; font-size: 16px;">Monthly Pull-Up Competition</p>
                </div>

                <!-- Main Content -->
                <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; border-radius: 12px; border-left: 4px solid #22c55e; margin-bottom: 30px; border: 1px solid #333333;">
                  <h2 style="color: #22c55e; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">💰 Your Earnings Are Ready!</h2>
                  
                  <p style="color: #ffffff; font-size: 18px; margin-bottom: 20px; line-height: 1.5;">
                    Great news, <strong style="color: #918f6f;">${user.full_name || 'there'}</strong>!
                  </p>
                  
                  <div style="background: rgba(34, 197, 94, 0.15); border: 2px solid #22c55e; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
                    <p style="color: #22c55e; margin: 0 0 10px 0; font-size: 16px; font-weight: 500;">
                      You've earned from your pull-up submissions this month:
                    </p>
                    <p style="color: #ffffff; font-size: 36px; font-weight: bold; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                      $${payout.amount_dollars}
                    </p>
                    <p style="color: #22c55e; margin: 10px 0 0 0; font-size: 14px;">
                      🎉 Congratulations!
                    </p>
                  </div>

                  <div style="background: linear-gradient(135deg, #2d1b0d 0%, #1a1a1a 100%); padding: 25px; border-radius: 12px; border-left: 4px solid #918f6f; margin: 25px 0; border: 1px solid #333333;">
                    <h3 style="color: #918f6f; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">
                      💳 To receive your payout:
                    </h3>
                    <ol style="color: #cccccc; font-size: 16px; margin: 0; padding-left: 20px; line-height: 1.8;">
                      <li style="margin-bottom: 8px;"><strong style="color: #ffffff;">Log into Pull-Up Club</strong></li>
                      <li style="margin-bottom: 8px;"><strong style="color: #ffffff;">Go to your Profile</strong></li>
                      <li style="margin-bottom: 8px;"><strong style="color: #ffffff;">Add your PayPal email</strong> in "Payout Settings"</li>
                    </ol>
                  </div>
                  
                  <p style="color: #ffffff; font-size: 16px; margin: 25px 0; line-height: 1.6; text-align: center;">
                    Once you add your PayPal email, we'll send your earnings within <strong style="color: #22c55e;">24 hours</strong>!
                  </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://pullupclub.com/profile" 
                     style="display: inline-block; 
                            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); 
                            color: #000000; 
                            padding: 18px 36px; 
                            text-decoration: none; 
                            border-radius: 8px; 
                            font-weight: 600; 
                            font-size: 18px; 
                            transition: all 0.3s ease;
                            box-shadow: 0 6px 20px rgba(34, 197, 94, 0.3);
                            text-transform: uppercase;
                            letter-spacing: 0.5px;">
                    Set Up PayPal Now →
                  </a>
                </div>

                <!-- PayPal Info -->
                <div style="background: rgba(145, 143, 111, 0.1); border: 1px solid #918f6f; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                  <p style="color: #cccccc; font-size: 14px; margin: 0; line-height: 1.5;">
                    Don't have PayPal? <a href="https://www.paypal.com/signup" target="_blank" style="color: #22c55e; text-decoration: none; font-weight: bold;">Sign up here</a> - it's free and takes just minutes!
                  </p>
                </div>

                <!-- Footer -->
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333333; text-align: center;">
                  <p style="color: #ffffff; font-size: 18px; margin: 0 0 10px 0; font-weight: 500;">
                    You've earned it! 💪
                  </p>
                  <p style="color: #918f6f; font-size: 16px; margin: 0 0 20px 0;">
                    The Pull-Up Club Team
                  </p>
                  <p style="color: #666666; font-size: 12px; margin: 0; line-height: 1.4;">
                    Questions? Contact us at <a href="mailto:support@pullupclub.com" style="color: #918f6f; text-decoration: none;">support@pullupclub.com</a>
                  </p>
                </div>
                
                ${test_email ? 
                  '<div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000000; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center; font-weight: bold;">This is a test of the PayPal reminder system!</div>' 
                  : ''
                }
              </div>
            `,
            metadata: {
              payout_request_id: payout.id,
              amount_dollars: payout.amount_dollars,
              reminder_type: 'paypal_setup',
              target_month: monthToUse,
              test_mode: !!test_email
            }
          });

        if (emailError) {
          console.error(`Failed to queue email for ${user.email}:`, emailError);
          errors.push(`${user.email}: ${emailError.message}`);
        } else {
          emails_sent++;
          console.log(`Queued PayPal reminder email for ${user.full_name} (${user.email}) - $${payout.amount_dollars}`);
        }

      } catch (err) {
        console.error(`Error processing user ${payout.user_id}:`, err);
        errors.push(`User ${payout.user_id}: ${err.message}`);
      }
    }

    const result = {
      success: true,
      message: `PayPal reminders processed for ${monthToUse}`,
      emails_sent,
      total_users_needing_paypal: usersNeedingPayPal.length,
      target_month: monthToUse,
      date_range: `${startDate} to ${endDate}`,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('PayPal reminders completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("PayPal reminder error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      message: "Failed to process PayPal reminders"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});