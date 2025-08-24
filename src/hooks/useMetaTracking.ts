import { useState } from 'react';

interface ContentData {
  name?: string;
  category?: string;
  [key: string]: any;
}

export function useMetaTracking() {
  const [isLoading, setIsLoading] = useState(false);

  // Check if we're in production mode
  const isProduction = import.meta.env.MODE === 'production';
  
  // Get Facebook-specific parameters from cookies/localStorage
  const getFacebookParams = () => {
    if (typeof window === 'undefined') return {};
    
    const fbp = document.cookie.match(/_fbp=([^;]+)/)?.[1];
    const fbc = document.cookie.match(/_fbc=([^;]+)/)?.[1];
    const fb_login_id = localStorage.getItem('fb_login_id');

    return {
      fbp,
      fbc,
      fb_login_id,
    };
  };

  // Enhanced user data collection
  const getEnhancedUserData = (userData: any = {}) => {
    if (typeof window === 'undefined') return userData;

    const facebookParams = getFacebookParams();
    
    // Get additional browser/user data
    const enhancedData = {
      ...userData,
      ...facebookParams,
      // Add client IP if available (will be captured server-side)
      // Add user agent (will be captured server-side)
      // Remove referrer from user_data - it should go in custom_data instead
      // Add page URL for context
      page_url: window.location.href,
      page_path: window.location.pathname,
    };

    return enhancedData;
  };

  const trackEvent = async (eventName: string, userData = {}, customData = {}) => {
    // In development, we'll still track but log it
    if (!isProduction) {
      console.log('🔍 Meta tracking (dev mode):', { eventName, userData, customData });
      // Still track the event but mark it as test data
      if (window.fbq) {
        window.fbq('track', eventName, {
          ...customData,
          test_event_code: 'TEST12345', // Add your test event code here
          is_test: true
        });
      }
      return { success: true, dev: true };
    }

    setIsLoading(true);
    try {
      // Enhance user data with Facebook parameters and additional context
      const enrichedUserData = getEnhancedUserData(userData);

      // Add referrer to custom_data instead of user_data
      const enrichedCustomData = {
        ...customData,
        referrer: typeof window !== 'undefined' ? document.referrer || '' : '',
      };

      const response = await fetch('/api/meta/track-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventName,
          userData: enrichedUserData,
          customData: enrichedCustomData, // Use enriched custom data
          eventSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Meta tracking success:', result);
      return result;
    } catch (error: any) {
      console.warn('Meta tracking failed:', error.message);
      // Return success to prevent error loops
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const trackViewContent = async (userData = {}, contentData: ContentData = {}) => {
    return trackEvent('ViewContent', userData, {
      content_name: contentData.name || (typeof document !== 'undefined' ? document.title : ''),
      content_category: contentData.category,
      ...contentData,
    });
  };

  // Enhanced purchase tracking
  const trackPurchase = async (userData = {}, purchaseData = {}) => {
    return trackEvent('Purchase', userData, {
      currency: 'USD',
      ...purchaseData,
    });
  };

  // Enhanced lead tracking
  const trackLead = async (userData = {}, leadData = {}) => {
    return trackEvent('Lead', userData, {
      content_name: 'PUC Membership',
      content_category: 'Subscription',
      ...leadData,
    });
  };

  return {
    trackEvent,
    trackViewContent,
    trackPurchase,
    trackLead,
    isLoading,
  };
} 