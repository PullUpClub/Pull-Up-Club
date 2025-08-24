import ReactGA from 'react-ga4';

// For simplicity, the Measurement ID is hardcoded here.
// For production applications, it's highly recommended to store this
// in an environment variable (e.g., VITE_APP_GA4_MEASUREMENT_ID in a .env file)
// and access it via `import.meta.env.VITE_APP_GA4_MEASUREMENT_ID`.
const MEASUREMENT_ID = "G-5NV54P8K1L";
let isInitialized = false;

interface AnalyticsEventParams {
  category: string;
  action: string;
  label?: string;
  value?: number;
}

/**
 * Initializes Google Analytics. This should be called once when the app starts.
 */
export const initializeGA = () => {
  if (MEASUREMENT_ID && !isInitialized) {
    ReactGA.initialize(MEASUREMENT_ID);
    isInitialized = true;
    console.log("GA Initialized");
  } else if (!MEASUREMENT_ID) {
    console.warn("Google Analytics Measurement ID is not set. Tracking is disabled.");
  }
};

/**
 * Tracks a page view in Google Analytics. Should be called on route changes.
 */
export const trackPageView = () => {
  if (isInitialized) {
    ReactGA.send({ hitType: 'pageview', page: window.location.pathname + window.location.search });
  }
};

/**
 * Tracks a custom event in Google Analytics.
 * Supports both object-style and parameter-style calls for backward compatibility.
 */
export const trackEvent = (
  categoryOrParams: string | AnalyticsEventParams,
  action?: string,
  label?: string,
  value?: number
) => {
  if (!isInitialized) return;

  if (typeof categoryOrParams === 'object') {
    // Handle object-style call
    const params = categoryOrParams;
    ReactGA.event({
      category: params.category,
      action: params.action,
      label: params.label,
      value: params.value
    });
  } else {
    // Handle parameter-style call
    ReactGA.event({
      category: categoryOrParams,
      action: action || '',
      label,
      value
    });
  }
};

/**
 * Tracks exceptions/errors in Google Analytics.
 */
export const trackException = (description: string) => {
  if (isInitialized) {
    ReactGA.event({
      category: 'Error',
      action: 'Exception',
      label: description
    });
  }
};

/**
 * Set user properties in Google Analytics.
 */
export const setUserProperties = (properties: { [key: string]: any }) => {
  if (isInitialized) {
    ReactGA.set(properties);
  }
};