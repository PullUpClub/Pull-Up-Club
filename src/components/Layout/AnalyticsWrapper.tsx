import { useEffect } from 'react';
import { initMetaPixel } from '../../utils/meta-pixel';

export default function AnalyticsWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Meta Pixel
    initMetaPixel();
  }, []);

  return <>{children}</>;
}