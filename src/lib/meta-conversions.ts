import crypto from 'crypto';

// Meta Pixel Events Configuration
export const META_EVENTS = {
  PURCHASE: 'Purchase',
  COMPLETE_REGISTRATION: 'CompleteRegistration',
  VIEW_CONTENT: 'ViewContent',
  START_TRIAL: 'StartTrial',
  SUBSCRIBE: 'Subscribe',
  LEAD: 'Lead',
  ADD_TO_CART: 'AddToCart',
  INITIATE_CHECKOUT: 'InitiateCheckout',
} as const;

// Meta Pixel Content Types
export const CONTENT_TYPES = {
  PAGE: 'page',
  PRODUCT: 'product',
  SERVICE: 'service',
  ARTICLE: 'article',
  VIDEO: 'video',
} as const;

// Meta Pixel Content Categories
export const CONTENT_CATEGORIES = {
  SUBSCRIPTION: 'subscription',
  MEMBERSHIP: 'membership',
  TRAINING: 'training',
  COMPETITION: 'competition',
} as const;

// Meta Pixel Event Parameters
export interface MetaEventParams {
  eventName: string;
  userData?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    externalId?: string;
    fbp?: string;
  };
  customData?: Record<string, any>;
  eventSourceUrl?: string;
}

// Meta Pixel Purchase Parameters
export interface MetaPurchaseParams {
  value: number;
  currency?: string;
  orderId?: string;
  contentType?: string;
  contentCategory?: string;
  [key: string]: any;
}

// Meta Pixel Content Parameters
export interface MetaContentParams {
  name?: string;
  category?: string;
  type?: string;
  id?: string;
  [key: string]: any;
}

// Meta Pixel Trial Parameters
export interface MetaTrialParams {
  predictedValue?: number;
  type?: string;
  duration?: number;
  [key: string]: any;
}

// Meta Pixel Subscription Parameters
export interface MetaSubscriptionParams {
  plan?: string;
  value?: number;
  currency?: string;
  billingCycle?: string;
  [key: string]: any;
}

// Meta Pixel Lead Parameters
export interface MetaLeadParams {
  source?: string;
  type?: string;
  value?: number;
  [key: string]: any;
}

// Meta Pixel Cart Parameters
export interface MetaCartParams {
  value?: number;
  currency?: string;
  contentIds?: string[];
  contents?: Array<{
    id: string;
    quantity: number;
    [key: string]: any;
  }>;
  [key: string]: any;
}

// Helper function to validate event parameters
export function validateEventParams(params: MetaEventParams): boolean {
  if (!params.eventName) {
    console.error('Event name is required');
    return false;
  }

  if (params.userData?.email && !isValidEmail(params.userData.email)) {
    console.error('Invalid email format');
    return false;
  }

  return true;
}

// Helper function to validate purchase parameters
export function validatePurchaseParams(params: MetaPurchaseParams): boolean {
  if (typeof params.value !== 'number' || params.value <= 0) {
    console.error('Valid purchase value is required');
    return false;
  }

  if (params.currency && !isValidCurrency(params.currency)) {
    console.error('Invalid currency code');
    return false;
  }

  return true;
}

// Helper function to validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to validate currency code
function isValidCurrency(currency: string): boolean {
  const currencyRegex = /^[A-Z]{3}$/;
  return currencyRegex.test(currency);
}

// Helper function to format purchase data
export function formatPurchaseData(params: MetaPurchaseParams): Record<string, any> {
  const { value, currency = 'USD', orderId, contentType, contentCategory, ...rest } = params;
  return {
    value,
    currency,
    content_ids: orderId ? [orderId] : undefined,
    content_type: contentType || CONTENT_TYPES.PRODUCT,
    content_category: contentCategory || CONTENT_CATEGORIES.SUBSCRIPTION,
    ...rest,
  };
}

// Helper function to format content data
export function formatContentData(params: MetaContentParams): Record<string, any> {
  const { name, category, type, id, ...rest } = params;
  return {
    content_name: name || document.title,
    content_category: category,
    content_type: type || CONTENT_TYPES.PAGE,
    content_ids: id ? [id] : undefined,
    ...rest,
  };
}

// Helper function to format trial data
export function formatTrialData(params: MetaTrialParams): Record<string, any> {
  const { predictedValue, type, duration, ...rest } = params;
  return {
    predicted_ltv: predictedValue,
    trial_type: type,
    trial_duration: duration,
    ...rest,
  };
}

// Helper function to format subscription data
export function formatSubscriptionData(params: MetaSubscriptionParams): Record<string, any> {
  const { plan, value, currency = 'USD', billingCycle, ...rest } = params;
  return {
    subscription_plan: plan,
    predicted_ltv: value,
    currency,
    billing_cycle: billingCycle,
    ...rest,
  };
}

// Helper function to format lead data
export function formatLeadData(params: MetaLeadParams): Record<string, any> {
  const { source, type, value, ...rest } = params;
  return {
    lead_source: source,
    lead_type: type,
    lead_value: value,
    ...rest,
  };
}

// Helper function to format cart data
export function formatCartData(params: MetaCartParams): Record<string, any> {
  const { value, currency = 'USD', contentIds, contents, ...rest } = params;
  return {
    value,
    currency,
    content_ids: contentIds,
    contents,
    ...rest,
  };
}

export class MetaConversionsAPI {
  private pixelId: string;
  private accessToken: string;
  private apiVersion: string;
  private baseUrl: string;

  constructor() {
    this.pixelId = process.env.META_PIXEL_ID!;
    this.accessToken = process.env.META_ACCESS_TOKEN!;
    this.apiVersion = process.env.META_API_VERSION || 'v21.0';
    this.baseUrl = 'https://graph.facebook.com';
  }

  private hashData(data: string): string | null {
    if (!data) return null;
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
  }

  private generateEventId(userId: string | undefined, eventName: string, timestamp: number): string {
    const baseString = `${userId || 'anonymous'}_${eventName}_${timestamp}`;
    return crypto.createHash('md5').update(baseString).digest('hex');
  }

  async sendEvents(events: any[]): Promise<any> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${this.pixelId}/events`;
      
      const payload = {
        data: events,
        access_token: this.accessToken
      };

      console.log('🔍 Meta API called from:', typeof window !== 'undefined' ? window.navigator.userAgent : 'Server');
      console.log('📤 Sending to Meta:', {
        eventName: events[0]?.event_name,
        pixelId: this.pixelId,
        hasUserData: !!events[0]?.user_data
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Meta API Error: ${JSON.stringify(result)}`);
      }

      return result;
    } catch (error) {
      console.error('Meta Conversions API Error:', error);
      throw error;
    }
  }

  createEvent({
    eventName,
    eventTime = Math.floor(Date.now() / 1000),
    eventSourceUrl,
    userAgent,
    ipAddress,
    userData = {},
    customData = {},
    eventId,
  }: {
    eventName: string;
    eventTime?: number;
    eventSourceUrl?: string;
    userAgent?: string;
    ipAddress?: string;
    userData?: any;
    customData?: any;
    eventId?: string;
  }) {
    const hashedUserData: any = {};
    
    if (userData.email) {
      hashedUserData.em = [this.hashData(userData.email)];
    }
    if (userData.phone) {
      hashedUserData.ph = [this.hashData(userData.phone)];
    }
    if (userData.firstName) {
      hashedUserData.fn = [this.hashData(userData.firstName)];
    }
    if (userData.lastName) {
      hashedUserData.ln = [this.hashData(userData.lastName)];
    }
    if (userData.externalId) {
      hashedUserData.external_id = [userData.externalId];
    }
    if (userData.fbp) {
      hashedUserData.fbp = userData.fbp;
    }
    if (userAgent) {
      hashedUserData.client_user_agent = userAgent;
    }
    if (ipAddress) {
      hashedUserData.client_ip_address = ipAddress;
    }

    return {
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId || this.generateEventId(userData.externalId, eventName, eventTime),
      event_source_url: eventSourceUrl,
      action_source: 'website',
      user_data: hashedUserData,
      custom_data: customData,
    };
  }

  createPurchaseEvent(userData: any, customData: any, eventDetails = {}) {
    return this.createEvent({
      eventName: 'Purchase',
      userData,
      customData: {
        currency: customData.currency || 'USD',
        value: customData.value,
        ...customData
      },
      ...eventDetails
    });
  }

  createStartTrialEvent(userData: any, eventDetails = {}) {
    return this.createEvent({
      eventName: 'StartTrial',
      userData,
      ...eventDetails
    });
  }

  createViewContentEvent(userData: any, customData: any, eventDetails = {}) {
    return this.createEvent({
      eventName: 'ViewContent',
      userData,
      customData: {
        content_name: customData.contentName,
        content_category: customData.contentCategory,
        ...customData
      },
      ...eventDetails
    });
  }

  createCompleteRegistrationEvent(userData: any, eventDetails = {}) {
    return this.createEvent({
      eventName: 'CompleteRegistration',
      userData,
      ...eventDetails
    });
  }

  createLeadEvent(userData: any, customData: any, eventDetails = {}) {
    return this.createEvent({
      eventName: 'Lead',
      userData,
      customData,
      ...eventDetails
    });
  }
} 