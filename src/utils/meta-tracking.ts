import { useMetaTracking } from '../hooks/useMetaTracking';

// Standardized tracking functions for consistent event data
export const MetaTracking = {
  // Page view tracking
  trackPageView: (pageName: string, userData = {}) => {
    const { trackViewContent } = useMetaTracking();
    return trackViewContent(userData, {
      content_name: pageName,
      content_category: 'Page View',
      content_type: 'website',
    });
  },

  // Lead generation tracking
  trackLead: (source: string, userData = {}) => {
    const { trackLead } = useMetaTracking();
    return trackLead(userData, {
      content_name: `PUC Membership - ${source}`,
      content_category: 'Subscription',
      content_type: 'product',
      value: 9.99,
      currency: 'USD',
      source: source,
    });
  },

  // Checkout initiation tracking
  trackInitiateCheckout: (plan: 'monthly' | 'annual', userData = {}) => {
    const { trackEvent } = useMetaTracking();
    const value = plan === 'monthly' ? 9.99 : 99.99;
    return trackEvent('InitiateCheckout', userData, {
      value,
      currency: 'USD',
      content_name: `PUC ${plan === 'monthly' ? 'Monthly' : 'Annual'} Membership`,
      content_category: 'Subscription',
      content_ids: [plan],
      content_type: 'product',
      num_items: 1,
    });
  },

  // Purchase completion tracking
  trackPurchase: (plan: 'monthly' | 'annual', userData = {}, orderId?: string) => {
    const { trackPurchase } = useMetaTracking();
    const value = plan === 'monthly' ? 9.99 : 99.99;
    return trackPurchase(userData, {
      value,
      currency: 'USD',
      content_name: `PUC ${plan === 'monthly' ? 'Monthly' : 'Annual'} Membership`,
      content_category: 'Subscription',
      content_ids: [plan],
      content_type: 'product',
      num_items: 1,
      order_id: orderId,
      delivery_category: 'home_delivery',
    });
  },

  // Account creation tracking
  trackAccountCreation: (userData = {}) => {
    const { trackEvent } = useMetaTracking();
    return trackEvent('CompleteRegistration', userData, {
      content_name: 'PUC Account Creation',
      content_category: 'Account',
      content_type: 'product',
      value: 9.99,
      currency: 'USD',
    });
  },

  // Video submission tracking
  trackVideoSubmission: (userData = {}) => {
    const { trackEvent } = useMetaTracking();
    return trackEvent('SubmitApplication', userData, {
      content_name: 'PUC Video Submission',
      content_category: 'Competition',
      content_type: 'product',
    });
  },

  // Leaderboard view tracking
  trackLeaderboardView: (userData = {}) => {
    const { trackViewContent } = useMetaTracking();
    return trackViewContent(userData, {
      content_name: 'PUC Leaderboard',
      content_category: 'Competition',
      content_type: 'website',
    });
  },
};

// Helper function to get user data from auth context
export const getUserDataForTracking = (user: any) => {
  if (!user) return {};

  return {
    email: user.email,
    externalId: user.id,
    firstName: user.user_metadata?.full_name?.split(' ')[0],
    lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' '),
    phone: user.phone,
  };
};

// Helper function to track events with automatic user data
export const trackWithUserData = async (
  trackingFunction: (userData: any, ...args: any[]) => Promise<any>,
  user: any,
  ...args: any[]
) => {
  const userData = getUserDataForTracking(user);
  return trackingFunction(userData, ...args);
}; 