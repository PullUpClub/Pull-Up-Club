export const config = {
  runtime: 'edge',
};

import { MetaConversionsAPI } from './_meta-api.js';

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Check if Meta tracking is properly configured
  const isMetaConfigured = process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN;
  
  if (!isMetaConfigured) {
    console.warn('⚠️ Meta tracking not configured - missing environment variables');
    return new Response(JSON.stringify({ 
      success: true, 
      warning: 'Meta tracking not configured',
      dev: true 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const body = await req.json();
    const { 
      userId, 
      userEmail, 
      customerId, 
      amount, 
      currency = 'USD', 
      subscriptionId,
      sessionId,
      plan = 'monthly',
      source = 'stripe_webhook'
    } = body;

    if (!userEmail || !amount) {
      return new Response(JSON.stringify({ error: 'userEmail and amount are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('💰 Tracking purchase event:', {
      userEmail,
      amount,
      currency,
      plan,
      source
    });

    const meta = new MetaConversionsAPI();
    
    // Create purchase event with enhanced data
    const event = await meta.createEvent({
      eventName: 'Purchase',
      eventSourceUrl: 'https://pullupclub.com/subscription',
      userAgent: req.headers.get('user-agent'),
      ipAddress: req.headers.get('x-forwarded-for') || 
                req.headers.get('x-real-ip') || 
                req.headers.get('cf-connecting-ip') ||
                '127.0.0.1',
      userData: {
        email: userEmail,
        externalId: userId,
        // Add any additional user data available
      },
      customData: {
        value: amount,
        currency: currency,
        content_name: `PUC ${plan === 'monthly' ? 'Monthly' : 'Annual'} Membership`,
        content_category: 'Subscription',
        content_ids: [plan],
        content_type: 'product',
        num_items: 1,
        order_id: sessionId || subscriptionId,
        delivery_category: 'home_delivery',
        // Stripe-specific data
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_session_id: sessionId,
        source: source
      }
    });

    const result = await meta.sendEvents([event]);

    return new Response(JSON.stringify({ 
      success: true,
      result,
      eventId: event.event_id,
      purchase: {
        amount,
        currency,
        plan,
        userEmail
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('❌ Purchase tracking error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to track purchase',
      details: error instanceof Error ? error.message : 'Unknown error',
      dev: process.env.NODE_ENV === 'development'
    }), {
      status: 200, // Return 200 to prevent webhook failures
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
} 