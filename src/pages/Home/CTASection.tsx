import React, { memo } from "react";
import { Button } from "../../components/ui/Button";
import { Link } from "../../components/ui/Link";
import { useTranslation } from "react-i18next";
import { useMetaTracking } from "../../hooks/useMetaTracking";

const CTASection: React.FC = memo(() => {
  const { t } = useTranslation('home');
  const { trackEvent } = useMetaTracking();

  const handleCTAClick = async () => {
    // Track Lead event when user clicks CTA
    await trackEvent('Lead', {}, {
      content_name: 'PUC Membership CTA',
      content_category: 'Subscription',
      content_type: 'product',
      value: 9.99,
      currency: 'USD',
      page_url: window.location.href,
      page_path: window.location.pathname,
    });
  };

  return (
    <section className="bg-[#9b9b6f] py-16">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-black mb-6">
          {t('ctaSection.title')}
        </h2>
        <p className="text-black text-xl mb-8 max-w-2xl mx-auto">
          {t('ctaSection.subtitle')}
        </p>
        <Button 
          variant="secondary" 
          size="lg" 
          className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-full px-8 py-3 touch-target"
          onClick={handleCTAClick}
        >
          <Link href="/subscription" className="text-white">
            {t('ctaSection.cta')}
          </Link>
        </Button>
      </div>
    </section>
  );
});

export default CTASection;
