// Remove unused import
// import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export const PIXEL_ID = '1512318086417813';

// Check if Meta Pixel is blocked by ad blockers
export function isMetaPixelBlocked(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check if fbq function exists and is callable
    if (!window.fbq || typeof window.fbq !== 'function') {
      return true;
    }
    
    // Check if the pixel script loaded successfully
    if (!window.fbq.loaded) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('🔍 Meta Pixel: Error checking if blocked:', error);
    return true;
  }
}

// Initialize Meta Pixel
export function initMetaPixel() {
  if (typeof window === 'undefined') {
    console.log('🔍 Meta Pixel: Window not available (SSR)');
    return;
  }

  // Check if Meta Pixel is already loaded from HTML
  if (window.fbq && window.fbq.loaded) {
    console.log('🔍 Meta Pixel: Already initialized from HTML');
    return;
  }

  // Check if Meta Pixel is already loaded
  if (window.fbq) {
    console.log('🔍 Meta Pixel: Already initialized');
    return;
  }

  // Load Meta Pixel script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://connect.facebook.net/en_US/fbevents.js`;
  
  // Add error handling for script loading
  script.onerror = () => {
    console.error('🔍 Meta Pixel: Failed to load script');
  };
  
  script.onload = () => {
    console.log('🔍 Meta Pixel: Script loaded successfully');
  };
  
  document.head.appendChild(script);

  // Initialize Meta Pixel
  window.fbq = function() {
    window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments);
  };
  window.fbq.push = window.fbq;
  window.fbq.loaded = true;
  window.fbq.version = '2.0';
  window.fbq.queue = [];

  // Track page view
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');

  console.log('🔍 Meta Pixel: Initialized with ID:', PIXEL_ID);
}

// We'll use the Supabase URL and anon key for the Meta Conversions API Edge Function

interface UserData {
  email?: string;
  external_id?: string;
}

export async function trackConversion(
  eventName: string,
  userData: UserData,
  customData: Record<string, any> = {}
) {
  try {
    // Client-side tracking
    trackPixelEvent(eventName, customData);

    // Server-side tracking via Supabase Edge Function
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-conversions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        event_name: eventName,
        user_data: userData,
        custom_data: customData,
      }),
    });
  } catch (error) {
    console.error('🔍 Meta Pixel: Error tracking conversion', { eventName, error });
  }
}

export function trackPixelEvent(eventName: string, parameters: Record<string, any> = {}) {
  if (typeof window === 'undefined') {
    console.log('🔍 Meta Pixel: Window not available (SSR)');
    return;
  }

  try {
    // Check if Meta Pixel is blocked
    if (isMetaPixelBlocked()) {
      console.warn('🔍 Meta Pixel: Pixel appears to be blocked by ad blocker or not loaded');
      // Still try to initialize
      initMetaPixel();
      setTimeout(() => {
        if (!isMetaPixelBlocked()) {
          trackPixelEvent(eventName, parameters);
        } else {
          console.error('🔍 Meta Pixel: Still blocked after retry - falling back to server-side tracking only');
        }
      }, 2000);
      return;
    }

    // Check if Meta Pixel is available
    if (!window.fbq) {
      console.warn('🔍 Meta Pixel: Not initialized, attempting to initialize...');
      initMetaPixel();
      // Wait a bit for initialization
      setTimeout(() => {
        if (window.fbq) {
          trackPixelEvent(eventName, parameters);
        } else {
          console.error('🔍 Meta Pixel: Failed to initialize after retry');
        }
      }, 1000);
      return;
    }

    // Standard events should use 'track', custom events should use 'trackCustom'
    const standardEvents = [
      'PageView',
      'ViewContent',
      'Search',
      'AddToCart',
      'AddToWishlist',
      'InitiateCheckout',
      'AddPaymentInfo',
      'Purchase',
      'Lead',
      'CompleteRegistration',
      'Subscribe',
      'StartTrial'
    ];

    const trackMethod = standardEvents.includes(eventName) ? 'track' : 'trackCustom';
    
    // Add debug mode for troubleshooting
    if (window.fbq && !window.fbq.debug) {
      window.fbq('set', 'debug', true);
    }
    
    window.fbq(trackMethod, eventName, parameters);
    
    console.log('🔍 Meta Pixel: Tracked event', { 
      method: trackMethod,
      eventName, 
      parameters,
      pixelLoaded: !!window.fbq?.loaded,
      pixelBlocked: isMetaPixelBlocked()
    });
  } catch (error) {
    console.error('🔍 Meta Pixel: Error tracking event', { eventName, parameters, error });
  }
}