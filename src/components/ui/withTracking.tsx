import React from 'react';
import { useInteractionTracking } from '../../hooks/useInteractionTracking';

interface TrackingProps {
  trackingName: string;
  trackingType?: string;
  trackingData?: Record<string, any>;
}

export function withTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  defaultTrackingType?: string
) {
  return function TrackingComponent(props: P & TrackingProps) {
    const {
      trackingName,
      trackingType = defaultTrackingType || 'component',
      trackingData = {},
      ...componentProps
    } = props;

    const { trackInteraction } = useInteractionTracking();

    const handleInteraction = async (
      eventName: string,
      additionalData: Record<string, any> = {}
    ) => {
      await trackInteraction(
        eventName,
        trackingType,
        trackingName,
        {
          ...trackingData,
          ...additionalData
        }
      );
    };

    return (
      <WrappedComponent
        {...(componentProps as P)}
        onTrack={handleInteraction}
      />
    );
  };
} 