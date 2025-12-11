import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/**
 * Backfill Subscriptions Edge Function
 *
 * This function syncs Stripe subscriptions to the Supabase subscriptions table.
 * It finds all users with is_paid=true and stripe_customer_id, then fetches their
 * active subscriptions from Stripe and creates the corresponding database records.
 *
 * This ensures all paying users have their subscription records properly tracked
 * for features like the Patch Roadmap.
 */

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16'
    });

    // Parse request body for options
    let dryRun = false;
    let singleUserId: string | null = null;

    try {
      const body = await req.json();
      dryRun = body.dry_run === true;
      singleUserId = body.user_id || null;
    } catch {
      // No body provided, use defaults
    }

    console.log(`Starting subscription backfill... (dry_run: ${dryRun}, single_user: ${singleUserId || 'all'})`);

    // Step 1: Get all paid users with stripe_customer_id who DON'T have a subscription record
    let query = supabaseAdmin
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        stripe_customer_id,
        is_paid,
        created_at,
        role
      `)
      .eq('is_paid', true)
      .not('stripe_customer_id', 'is', null)
      .not('role', 'in', '("admin","influencer")'); // Exclude admin/influencer

    if (singleUserId) {
      query = query.eq('id', singleUserId);
    }

    const { data: paidUsers, error: usersError } = await query;

    if (usersError) {
      throw new Error(`Failed to fetch paid users: ${usersError.message}`);
    }

    console.log(`Found ${paidUsers?.length || 0} paid users to check`);

    // Step 2: Get existing subscription records
    const { data: existingSubscriptions, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, stripe_subscription_id');

    if (subError) {
      throw new Error(`Failed to fetch existing subscriptions: ${subError.message}`);
    }

    const existingUserIds = new Set(existingSubscriptions?.map(s => s.user_id) || []);
    const existingSubIds = new Set(existingSubscriptions?.map(s => s.stripe_subscription_id) || []);

    console.log(`Found ${existingUserIds.size} users with existing subscription records`);

    // Step 3: Filter to users needing backfill
    const usersNeedingBackfill = paidUsers?.filter(u => !existingUserIds.has(u.id)) || [];
    console.log(`${usersNeedingBackfill.length} users need subscription backfill`);

    const results = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as any[]
    };

    // Step 4: Process each user
    for (const user of usersNeedingBackfill) {
      results.processed++;

      try {
        console.log(`\nProcessing user: ${user.email} (${user.id})`);
        console.log(`  Stripe Customer ID: ${user.stripe_customer_id}`);

        // Fetch subscriptions from Stripe for this customer
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'active',
          limit: 10
        });

        if (stripeSubscriptions.data.length === 0) {
          // Try to get any subscription (including past_due, canceled, etc.)
          const allSubscriptions = await stripe.subscriptions.list({
            customer: user.stripe_customer_id,
            limit: 10
          });

          if (allSubscriptions.data.length === 0) {
            console.log(`  No subscriptions found in Stripe for customer`);
            results.skipped++;
            results.details.push({
              user_id: user.id,
              email: user.email,
              status: 'skipped',
              reason: 'No Stripe subscriptions found'
            });
            continue;
          }

          // Use the most recent subscription
          const subscription = allSubscriptions.data[0];
          console.log(`  Found inactive subscription: ${subscription.id} (${subscription.status})`);

          // Skip if already exists
          if (existingSubIds.has(subscription.id)) {
            console.log(`  Subscription already exists in database, skipping`);
            results.skipped++;
            continue;
          }

          // Calculate first_paid_date - MUST use first PAID invoice, not subscription created date
          // This is critical because subscription.created could be when a free trial started
          let firstPaidDate: Date | null = null;

          // Try to get the first invoice for this subscription for accurate first payment date
          try {
            const invoices = await stripe.invoices.list({
              subscription: subscription.id,
              status: 'paid',
              limit: 100
            });

            if (invoices.data.length > 0) {
              // Get the oldest paid invoice
              const sortedInvoices = invoices.data.sort((a, b) => a.created - b.created);
              const firstInvoice = sortedInvoices[0];
              if (firstInvoice.status_transitions?.paid_at) {
                firstPaidDate = new Date(firstInvoice.status_transitions.paid_at * 1000);
              } else {
                firstPaidDate = new Date(firstInvoice.created * 1000);
              }
              console.log(`  First paid invoice date: ${firstPaidDate.toISOString()}`);
            } else {
              console.log(`  No paid invoices found - user may have never paid (free trial only)`);
              // If no paid invoices, don't set first_paid_date - they haven't paid yet
              firstPaidDate = null;
            }
          } catch (invoiceError) {
            console.log(`  Could not fetch invoices: ${invoiceError.message}`);
            // Fall back to subscription created date only if we couldn't fetch invoices
            firstPaidDate = new Date(subscription.created * 1000);
          }

          const subscriptionRecord: Record<string, any> = {
            user_id: user.id,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Only set first_paid_date if we found a paid invoice
          if (firstPaidDate) {
            subscriptionRecord.first_paid_date = firstPaidDate.toISOString();
          }

          if (!dryRun) {
            const { error: insertError } = await supabaseAdmin
              .from('subscriptions')
              .insert(subscriptionRecord);

            if (insertError) {
              throw new Error(`Insert failed: ${insertError.message}`);
            }
          }

          results.created++;
          results.details.push({
            user_id: user.id,
            email: user.email,
            status: 'created',
            subscription_id: subscription.id,
            subscription_status: subscription.status,
            first_paid_date: firstPaidDate ? firstPaidDate.toISOString() : null,
            note: firstPaidDate ? undefined : 'No paid invoices found - free trial only'
          });

          console.log(`  ${dryRun ? '[DRY RUN] Would create' : 'Created'} subscription record`);

        } else {
          // Use the active subscription
          const subscription = stripeSubscriptions.data[0];
          console.log(`  Found active subscription: ${subscription.id}`);

          // Skip if already exists
          if (existingSubIds.has(subscription.id)) {
            console.log(`  Subscription already exists in database, skipping`);
            results.skipped++;
            continue;
          }

          // Calculate first_paid_date - use subscription created date
          // For more accurate first paid date, we could query invoices
          let firstPaidDate = new Date(subscription.created * 1000);

          // Try to get the first invoice for this subscription for accurate first payment date
          try {
            const invoices = await stripe.invoices.list({
              subscription: subscription.id,
              status: 'paid',
              limit: 100
            });

            if (invoices.data.length > 0) {
              // Get the oldest paid invoice
              const sortedInvoices = invoices.data.sort((a, b) => a.created - b.created);
              const firstInvoice = sortedInvoices[0];
              if (firstInvoice.status_transitions?.paid_at) {
                firstPaidDate = new Date(firstInvoice.status_transitions.paid_at * 1000);
              } else {
                firstPaidDate = new Date(firstInvoice.created * 1000);
              }
              console.log(`  First paid invoice date: ${firstPaidDate.toISOString()}`);
            }
          } catch (invoiceError) {
            console.log(`  Could not fetch invoices, using subscription created date`);
          }

          const subscriptionRecord = {
            user_id: user.id,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            first_paid_date: firstPaidDate.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          if (!dryRun) {
            const { error: insertError } = await supabaseAdmin
              .from('subscriptions')
              .insert(subscriptionRecord);

            if (insertError) {
              throw new Error(`Insert failed: ${insertError.message}`);
            }
          }

          results.created++;
          results.details.push({
            user_id: user.id,
            email: user.email,
            full_name: user.full_name,
            status: 'created',
            subscription_id: subscription.id,
            subscription_status: subscription.status,
            first_paid_date: firstPaidDate.toISOString()
          });

          console.log(`  ${dryRun ? '[DRY RUN] Would create' : 'Created'} subscription record`);
        }

      } catch (error) {
        console.error(`  Error processing user ${user.email}:`, error);
        results.errors.push(`${user.email}: ${error.message}`);
        results.details.push({
          user_id: user.id,
          email: user.email,
          status: 'error',
          error: error.message
        });
      }
    }

    // Final summary
    const summary = {
      dry_run: dryRun,
      total_paid_users: paidUsers?.length || 0,
      already_have_subscriptions: existingUserIds.size,
      needed_backfill: usersNeedingBackfill.length,
      processed: results.processed,
      created: results.created,
      skipped: results.skipped,
      errors: results.errors.length,
      error_messages: results.errors,
      details: results.details
    };

    console.log('\n=== BACKFILL COMPLETE ===');
    console.log(JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({
      error: 'Backfill failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
