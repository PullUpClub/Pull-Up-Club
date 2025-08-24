export class MetaConversionsAPI {
  constructor() {
    this.pixelId = process.env.META_PIXEL_ID;
    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.apiVersion = process.env.META_API_VERSION || 'v21.0';
    this.baseUrl = 'https://graph.facebook.com';
    
    // Validate configuration
    if (!this.pixelId || !this.accessToken) {
      console.warn('⚠️ Meta API not properly configured - missing credentials');
    }
  }

  async sendEvents(events) {
    // If not configured, return a mock success response
    if (!this.pixelId || !this.accessToken) {
      console.warn('⚠️ Meta API not configured - returning mock response');
      return {
        events_received: events.length,
        mock: true,
        message: 'Meta API not configured'
      };
    }

    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${this.pixelId}/events`;
      
      const payload = {
        data: events,
        access_token: this.accessToken
      };

      console.log('📤 Sending to Meta API:', {
        url: `${this.baseUrl}/${this.apiVersion}/${this.pixelId}/events`,
        eventCount: events.length,
        firstEventName: events[0]?.event_name
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
        console.error('❌ Meta API Error Response:', result);
        throw new Error(`Meta API Error: ${JSON.stringify(result)}`);
      }

      console.log('✅ Meta API Success:', result);
      return result;
    } catch (error) {
      console.error('❌ Meta API Error:', error);
      
      // Return a graceful error response instead of throwing
      return {
        error: true,
        message: error.message,
        events_received: events.length,
        fallback: true
      };
    }
  }

  async hashData(data) {
    if (!data) return null;
    
    try {
      // Use Web Crypto API instead of Node's crypto module for Edge Runtime
      const encoder = new TextEncoder();
      const data_buffer = encoder.encode(data.toLowerCase().trim());
      const hash = await crypto.subtle.digest('SHA-256', data_buffer);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.warn('⚠️ Failed to hash data:', error);
      return null;
    }
  }

  async generateEventId(userId, eventName, timestamp) {
    try {
      const baseString = `${userId || 'anonymous'}_${eventName}_${timestamp}`;
      const encoder = new TextEncoder();
      const data_buffer = encoder.encode(baseString);
      const hash = await crypto.subtle.digest('MD5', data_buffer);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.warn('⚠️ Failed to generate event ID:', error);
      return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  async createEvent({
    eventName,
    eventTime = Math.floor(Date.now() / 1000),
    eventSourceUrl,
    userAgent,
    ipAddress,
    userData = {},
    customData = {},
    eventId,
  }) {
    const hashedUserData = {};
    
    try {
      // Basic user data - hash all personal information
      if (userData.email) {
        const hashedEmail = await this.hashData(userData.email);
        if (hashedEmail) hashedUserData.em = [hashedEmail];
      }
      if (userData.phone) {
        const hashedPhone = await this.hashData(userData.phone);
        if (hashedPhone) hashedUserData.ph = [hashedPhone];
      }
      if (userData.firstName) {
        const hashedFirstName = await this.hashData(userData.firstName);
        if (hashedFirstName) hashedUserData.fn = [hashedFirstName];
      }
      if (userData.lastName) {
        const hashedLastName = await this.hashData(userData.lastName);
        if (hashedLastName) hashedUserData.ln = [hashedLastName];
      }
      if (userData.externalId) {
        hashedUserData.external_id = [userData.externalId];
      }

      // Facebook-specific parameters (don't hash these)
      if (userData.fbc) {
        hashedUserData.fbc = userData.fbc;
      }
      if (userData.fb_login_id) {
        hashedUserData.fb_login_id = userData.fb_login_id;
      }
      if (userData.fbp) {
        hashedUserData.fbp = userData.fbp;
      }

      // Location data - hash all location information
      if (userData.zip) {
        const hashedZip = await this.hashData(userData.zip);
        if (hashedZip) hashedUserData.zp = [hashedZip];
      }
      if (userData.city) {
        const hashedCity = await this.hashData(userData.city);
        if (hashedCity) hashedUserData.ct = [hashedCity];
      }
      if (userData.state) {
        const hashedState = await this.hashData(userData.state);
        if (hashedState) hashedUserData.st = [hashedState];
      }
      
      // Date of birth - hash
      if (userData.dob) {
        const hashedDob = await this.hashData(userData.dob);
        if (hashedDob) hashedUserData.db = [hashedDob];
      }

      // Client info - don't hash these
      if (userAgent) {
        hashedUserData.client_user_agent = userAgent;
      }
      if (ipAddress) {
        hashedUserData.client_ip_address = ipAddress;
      }

      // Remove these from user_data - they should be in custom_data instead
      // if (userData.referrer) {
      //   hashedUserData.referrer = userData.referrer;
      // }
      // if (userData.page_url) {
      //   hashedUserData.page_url = userData.page_url;
      // }

      const generatedEventId = eventId || await this.generateEventId(userData.externalId, eventName, eventTime);

      // Move referrer and page_url to custom_data
      const enrichedCustomData = {
        ...customData,
        ...(userData.referrer && { referrer: userData.referrer }),
        ...(userData.page_url && { page_url: userData.page_url }),
        ...(userData.page_path && { page_path: userData.page_path }),
      };

      return {
        event_name: eventName,
        event_time: eventTime,
        event_id: generatedEventId,
        event_source_url: eventSourceUrl,
        action_source: 'website',
        user_data: hashedUserData,
        custom_data: enrichedCustomData,
      };
    } catch (error) {
      console.error('❌ Error creating event:', error);
      
      // Return a basic event structure as fallback
      return {
        event_name: eventName,
        event_time: eventTime,
        event_id: `fallback_${Date.now()}`,
        event_source_url: eventSourceUrl,
        action_source: 'website',
        user_data: {},
        custom_data: customData,
        fallback: true
      };
    }
  }
} 