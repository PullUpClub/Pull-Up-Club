import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.29.0";
import Stripe from "https://esm.sh/stripe@12.5.0";

// Create a Supabase client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Get the JWT from the Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid token');
    }

    // Get the user's subscription from the database
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (subError) {
      throw new Error(`Failed to get subscription: ${subError.message}`);
    }

    // Return the most recent active subscription if found
    let subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;
    
    // If there's a subscription and a Stripe subscription ID
    let stripeSubscriptionData: { id: string; status: Stripe.Subscription.Status; currentPeriodEnd: Date; cancelAtPeriodEnd: boolean; payment_method_brand?: string; payment_method_last4?: string } | null = null;
    
    // FALLBACK: If no subscription in DB, check if user has is_paid=true and stripe_customer_id
    if (!subscription) {
      console.log(`[subscription-status] No subscription found in DB for user ${user.id}, checking profiles table...`);
      
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('is_paid, stripe_customer_id, created_at, role')
        .eq('id', user.id)
        .single();

      // Skip subscription check for admins and influencers (they get free access)
      if (!profileError && profile && (profile.role === 'admin' || profile.role === 'influencer')) {
        console.log(`[subscription-status] User is ${profile.role}, returning null (free access, no subscription needed)`);
        return new Response(JSON.stringify({
          subscription: null,
          stripeSubscription: null
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!profileError && profile?.is_paid && profile?.stripe_customer_id) {
        console.log(`[subscription-status] User has is_paid=true and stripe_customer_id, fetching from Stripe...`);
        
        // Fetch active subscription from Stripe
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'active',
          limit: 1,
        });

        if (stripeSubscriptions.data.length > 0) {
          const stripeSub = stripeSubscriptions.data[0];
          console.log(`[subscription-status] Found active Stripe subscription: ${stripeSub.id}`);
          
          // Create a synthetic subscription object for compatibility
          subscription = {
            id: 'synthetic-' + user.id,
            user_id: user.id,
            stripe_subscription_id: stripeSub.id,
            status: 'active',
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            first_paid_date: profile.created_at,
            created_at: profile.created_at,
            updated_at: new Date().toISOString(),
          };

          // Get payment method details
          let paymentMethodBrand = '';
          let paymentMethodLast4 = '';
          
          if (stripeSub.default_payment_method) {
            try {
              const pm = await stripe.paymentMethods.retrieve(stripeSub.default_payment_method as string);
              paymentMethodBrand = pm.card?.brand || '';
              paymentMethodLast4 = pm.card?.last4 || '';
            } catch (pmError) {
              console.error('[subscription-status] Error fetching payment method:', pmError);
            }
          }

          stripeSubscriptionData = {
            id: stripeSub.id,
            status: stripeSub.status,
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            payment_method_brand: paymentMethodBrand,
            payment_method_last4: paymentMethodLast4,
          };
        }
      }
    } else if (subscription?.stripe_subscription_id) {
      // Normal path: subscription exists in DB, fetch latest from Stripe
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      if (stripeSub) {
        // Get payment method details
        let paymentMethodBrand = '';
        let paymentMethodLast4 = '';
        
        if (stripeSub.default_payment_method) {
          try {
            const pm = await stripe.paymentMethods.retrieve(stripeSub.default_payment_method as string);
            paymentMethodBrand = pm.card?.brand || '';
            paymentMethodLast4 = pm.card?.last4 || '';
          } catch (pmError) {
            console.error('[subscription-status] Error fetching payment method:', pmError);
          }
        }

        stripeSubscriptionData = {
          id: stripeSub.id,
          status: stripeSub.status,
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          payment_method_brand: paymentMethodBrand,
          payment_method_last4: paymentMethodLast4,
        };
      }
    }

    return new Response(JSON.stringify({
      subscription,
      stripeSubscription: stripeSubscriptionData
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 