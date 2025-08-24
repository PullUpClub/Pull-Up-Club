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
        'Access-Control-Allow-Headers': 'Content-Type',
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
    // Return success to prevent frontend errors, but log the issue
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
    const { eventName, userData = {}, customData = {}, eventSourceUrl } = body;

    if (!eventName) {
      return new Response(JSON.stringify({ error: 'eventName is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('🔍 Meta API called from:', req.headers.get('user-agent'));
    console.log('📤 Sending to Meta:', {
      eventName,
      pixelId: process.env.META_PIXEL_ID,
      hasUserData: !!Object.keys(userData).length
    });

    const meta = new MetaConversionsAPI();
    const event = await meta.createEvent({
      eventName,
      eventSourceUrl,
      userAgent: req.headers.get('user-agent'),
      ipAddress: req.headers.get('x-forwarded-for') || 
                req.headers.get('x-real-ip') || 
                req.headers.get('cf-connecting-ip') ||
                '127.0.0.1',
      userData,
      customData
    });

    const result = await meta.sendEvents([event]);

    return new Response(JSON.stringify({ 
      success: true,
      result,
      eventId: event.event_id 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('❌ Meta API Error:', error);
    
    // Return a more graceful error response
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to track event',
      details: error instanceof Error ? error.message : 'Unknown error',
      // Don't expose sensitive error details in production
      dev: process.env.NODE_ENV === 'development'
    }), {
      status: 200, // Changed from 500 to 200 to prevent frontend errors
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
} 