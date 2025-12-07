import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.29.0";
import Stripe from "https://esm.sh/stripe@12.5.0";

/**
 * Edge Function: Backfill User Subscription
 * 
 * Purpose: Syncs Stripe subscription data to Supabase subscriptions table
 * for users who have stripe_customer_id and is_paid=true but no subscription record.
 * 
 * This fixes the issue where users like Patrick Hayes paid via Stripe but their
 * subscription wasn't synced to the database, causing patch progress and rewards
 * to show "Subscription Required" incorrectly.
 * 
 * Usage:
 * - Call with user_id to backfill specific user
 * - Call without user_id to backfill ALL users missing subscriptions
 */

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillResult {
  user_id: string;
  email: string;
  success: boolean;
  subscription_id?: string;
  error?: string;
}

async function backfillUserSubscription(userId: string, email: string, stripeCustomerId: string): Promise<BackfillResult> {
  try {
    console.log(`[Backfill] Processing user: ${email} (${userId}), Stripe Customer: ${stripeCustomerId}`);

    // Check if subscription already exists
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingSub) {
      console.log(`[Backfill] User ${email} already has subscription record, skipping`);
      return {
        user_id: userId,
        email,
        success: true,
        subscription_id: existingSub.id,
      };
    }

    // Fetch subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Try to get ANY subscription (including past_due, canceled, etc.)
      const allSubs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 1,
      });

      if (allSubs.data.length === 0) {
        console.error(`[Backfill] No Stripe subscriptions found for customer ${stripeCustomerId}`);
        return {
          user_id: userId,
          email,
          success: false,
          error: 'No Stripe subscription found',
        };
      }

      const latestSub = allSubs.data[0];
      console.log(`[Backfill] Found ${latestSub.status} subscription for ${email}: ${latestSub.id}`);

      // Insert subscription record
      const { data: newSub, error: insertError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: userId,
          stripe_subscription_id: latestSub.id,
          status: latestSub.status === 'active' || latestSub.status === 'trialing' ? 'active' : 
                  latestSub.status === 'past_due' ? 'past_due' : 'canceled',
          current_period_start: new Date(latestSub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(latestSub.current_period_end * 1000).toISOString(),
          first_paid_date: new Date(latestSub.created * 1000).toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[Backfill] Error inserting subscription for ${email}:`, insertError);
        return {
          user_id: userId,
          email,
          success: false,
          error: insertError.message,
        };
      }

      console.log(`[Backfill] ✅ Successfully backfilled subscription for ${email}`);
      return {
        user_id: userId,
        email,
        success: true,
        subscription_id: newSub.id,
      };
    }

    const stripeSub = subscriptions.data[0];
    console.log(`[Backfill] Found active subscription for ${email}: ${stripeSub.id}`);

    // Insert subscription record
    const { data: newSub, error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        stripe_subscription_id: stripeSub.id,
        status: 'active',
        current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        first_paid_date: new Date(stripeSub.created * 1000).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[Backfill] Error inserting subscription for ${email}:`, insertError);
      return {
        user_id: userId,
        email,
        success: false,
        error: insertError.message,
      };
    }

    console.log(`[Backfill] ✅ Successfully backfilled subscription for ${email}`);
    return {
      user_id: userId,
      email,
      success: true,
      subscription_id: newSub.id,
    };

  } catch (error) {
    console.error(`[Backfill] Exception processing user ${email}:`, error);
    return {
      user_id: userId,
      email,
      success: false,
      error: error.message,
    };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json().catch(() => ({}));

    if (user_id) {
      // Backfill specific user
      console.log(`[Backfill] Backfilling specific user: ${user_id}`);

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, stripe_customer_id, is_paid')
        .eq('id', user_id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profile.stripe_customer_id) {
        return new Response(
          JSON.stringify({ error: 'User has no Stripe customer ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await backfillUserSubscription(
        profile.id,
        profile.email,
        profile.stripe_customer_id
      );

      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Backfill ALL users with is_paid=true and stripe_customer_id but no subscription
    console.log('[Backfill] Backfilling all users missing subscriptions...');

    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, stripe_customer_id, is_paid')
      .eq('is_paid', true)
      .not('stripe_customer_id', 'is', null);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    console.log(`[Backfill] Found ${users?.length || 0} paid users with Stripe customer IDs`);

    const results: BackfillResult[] = [];

    for (const user of users || []) {
      const result = await backfillUserSubscription(
        user.id,
        user.email,
        user.stripe_customer_id
      );
      results.push(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        total: results.length,
        successful,
        failed,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Backfill] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
