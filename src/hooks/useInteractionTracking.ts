import { useCallback } from 'react';
import { useMetaTracking } from './useMetaTracking';
import { useAuth } from '../context/AuthContext';

export const useInteractionTracking = () => {
  const { trackEvent } = useMetaTracking();
  const { user } = useAuth();

  const trackInteraction = useCallback(async (
    eventName: string,
    elementType: string,
    elementName: string,
    additionalData: Record<string, any> = {}
  ) => {
    try {
      await trackEvent(
        eventName,
        user ? {
          email: user.email,
          externalId: user.id
        } : {},
        {
          element_type: elementType,
          element_name: elementName,
          page_url: window.location.href,
          page_path: window.location.pathname,
          ...additionalData
        }
      );
    } catch (error) {
      console.error(`Failed to track ${eventName}:`, error);
    }
  }, [trackEvent, user]);

  const trackButtonClick = useCallback((
    buttonName: string,
    additionalData: Record<string, any> = {}
  ) => {
    return trackInteraction('button_click', 'button', buttonName, additionalData);
  }, [trackInteraction]);

  const trackLinkClick = useCallback((
    linkName: string,
    linkUrl: string,
    additionalData: Record<string, any> = {}
  ) => {
    return trackInteraction('link_click', 'link', linkName, {
      link_url: linkUrl,
      ...additionalData
    });
  }, [trackInteraction]);

  const trackFormSubmit = useCallback((
    formName: string,
    additionalData: Record<string, any> = {}
  ) => {
    return trackInteraction('form_submit', 'form', formName, additionalData);
  }, [trackInteraction]);

  const trackFormError = useCallback((
    formName: string,
    errorType: string,
    errorMessage: string,
    additionalData: Record<string, any> = {}
  ) => {
    return trackInteraction('form_error', 'form', formName, {
      error_type: errorType,
      error_message: errorMessage,
      ...additionalData
    });
  }, [trackInteraction]);

  const trackVideoInteraction = useCallback((
    action: 'play' | 'pause' | 'complete',
    videoName: string,
    additionalData: Record<string, any> = {}
  ) => {
    return trackInteraction(`video_${action}`, 'video', videoName, additionalData);
  }, [trackInteraction]);

  const trackFilter = useCallback((
    filterName: string,
    filterValue: string,
    additionalData: Record<string, any> = {}
  ) => {
    return trackInteraction('filter_change', 'filter', filterName, {
      filter_value: filterValue,
      ...additionalData
    });
  }, [trackInteraction]);

  const trackTabChange = useCallback((
    tabGroup: string,
    tabName: string,
    additionalData: Record<string, any> = {}
  ) => {
    return trackInteraction('tab_change', 'tab', tabName, {
      tab_group: tabGroup,
      ...additionalData
    });
  }, [trackInteraction]);

  const trackSearch = useCallback((
    searchTerm: string,
    searchCategory?: string,
    additionalData: Record<string, any> = {}
  ) => {
    return trackInteraction('search', 'search_box', 'site_search', {
      search_term: searchTerm,
      search_category: searchCategory,
      ...additionalData
    });
  }, [trackInteraction]);

  return {
    trackButtonClick,
    trackLinkClick,
    trackFormSubmit,
    trackFormError,
    trackVideoInteraction,
    trackFilter,
    trackTabChange,
    trackSearch,
    trackInteraction // Export the base function for custom events
  };
}; 