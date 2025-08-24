import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN')!;
const META_PIXEL_ID = Deno.env.get('META_PIXEL_ID') || '1512318086417813';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface ConversionEvent {
  event_name: string;
  event_time: number;
  event_id?: string;
  user_data: {
    em?: string[];
    external_id?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
    fb_login_id?: string;
  };
  custom_data?: Record<string, any>;
  action_source: 'website' | 'system';
}

// Hash data using Web Crypto API
async function hashData(data: string): Promise<string | null> {
  if (!data) return null;
  
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data.toLowerCase().trim());
    const hash = await crypto.subtle.digest('SHA-256', dataBuffer);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.warn('Failed to hash data:', error);
    return null;
  }
}

// Generate event ID
async function generateEventId(userId: string, eventName: string, timestamp: number): Promise<string> {
  try {
    const baseString = `${userId || 'anonymous'}_${eventName}_${timestamp}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(baseString);
    const hash = await crypto.subtle.digest('MD5', dataBuffer);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.warn('Failed to generate event ID:', error);
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

async function sendToMetaConversionsAPI(event: ConversionEvent) {
  // Check if Meta tracking is properly configured
  if (!META_ACCESS_TOKEN || !META_PIXEL_ID) {
    console.warn('⚠️ Meta tracking not configured - missing credentials');
    return {
      events_received: 1,
      mock: true,
      message: 'Meta API not configured'
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          data: [event],
          test_event_code: 'TEST12345' // Remove in production
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Meta API Error Response:', error);
      throw new Error(`Meta API Error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log('✅ Meta API Success:', result);
    return result;
  } catch (error) {
    console.error('❌ Meta API Error:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
      events_received: 1,
      fallback: true
    };
  }
}

Deno.serve(async (req) => {
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const { event_name, user_data, custom_data, event_id } = await req.json();

    // Basic validation
    if (!event_name) {
      return new Response(JSON.stringify({ error: 'event_name is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('🔍 Meta Conversions API called:', {
      event_name,
      hasUserData: !!user_data,
      hasCustomData: !!custom_data
    });

    // Process user data with hashing
    const processedUserData: ConversionEvent['user_data'] = {};
    
    if (user_data) {
      // Hash email if provided
      if (user_data.email) {
        const hashedEmail = await hashData(user_data.email);
        if (hashedEmail) processedUserData.em = [hashedEmail];
      }
      
      // Add external ID (don't hash)
      if (user_data.external_id) {
        processedUserData.external_id = [user_data.external_id];
      }
      
      // Facebook-specific parameters (don't hash)
      if (user_data.fbc) processedUserData.fbc = user_data.fbc;
      if (user_data.fbp) processedUserData.fbp = user_data.fbp;
      if (user_data.fb_login_id) processedUserData.fb_login_id = user_data.fb_login_id;
    }

    // Generate event ID if not provided
    const generatedEventId = event_id || await generateEventId(
      user_data?.external_id, 
      event_name, 
      Math.floor(Date.now() / 1000)
    );

    const event: ConversionEvent = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: generatedEventId,
      user_data: {
        ...processedUserData,
        client_ip_address: req.headers.get('cf-connecting-ip') || 
                          req.headers.get('x-real-ip') || 
                          req.headers.get('x-forwarded-for'),
        client_user_agent: req.headers.get('user-agent'),
      },
      custom_data,
      action_source: 'website'
    };

    const result = await sendToMetaConversionsAPI(event);

    return new Response(JSON.stringify({
      success: true,
      result,
      event_id: generatedEventId
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Meta Conversions API Error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to process event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 200, // Return 200 to prevent webhook failures
    });
  }
});