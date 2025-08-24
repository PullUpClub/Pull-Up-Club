import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { products } from "../../lib/stripe-config";
import { trackEvent } from "../../utils/analytics";
import { useTranslation } from "react-i18next";
import Head from "../../components/Layout/Head";
import { useMetaTracking } from '../../hooks/useMetaTracking';

// Payment links - hardcoded since they are public and don't change between environments
const PAYMENT_LINKS = {
  monthly: "https://buy.stripe.com/dRmdR9dos2kmaQcdHGejK00",
  annual: "https://buy.stripe.com/28EcN5dosf784rO0UUejK01"
};

const SubscriptionPlans: React.FC = () => {
  const { t } = useTranslation('subscription');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("monthly");
  const { trackViewContent, trackEvent: trackMetaEvent } = useMetaTracking();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackViewContent({}, {
        name: 'Subscription Plans',
        category: 'subscription',
        type: 'page'
      }).catch(() => {});
    }
  }, [trackViewContent]);

  const handleSubscribe = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Fire analytics for checkout attempt
      trackEvent({
        action: 'subscription_plan_selected',
        category: 'stripe',
        label: selectedPlan,
      });

      // Track InitiateCheckout event for Meta
      await trackMetaEvent('InitiateCheckout', {}, {
        value: selectedPlan === 'monthly' ? 9.99 : 99.99,
        currency: 'USD',
        content_name: `PUC ${selectedPlan === 'monthly' ? 'Monthly' : 'Annual'} Membership`,
        content_category: 'Subscription',
        content_ids: [selectedPlan],
        content_type: 'product',
        num_items: 1,
        page_url: window.location.href,
        page_path: window.location.pathname,
      });

      console.log(`Redirecting to Stripe payment link for ${selectedPlan} plan`);
      
      // Use the appropriate payment link based on the selected plan
      const paymentLink = PAYMENT_LINKS[selectedPlan];
      
      trackEvent({
        action: 'stripe_checkout_redirect',
        category: 'stripe',
        label: selectedPlan,
      });
      
      // Redirect to Stripe Payment Link
      window.location.href = paymentLink;
      
    } catch (err) {
      console.error("Redirect error:", err);
      
      let errorMessage = "Failed to redirect to payment page. Please try again.";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Head>
        <title>{t("meta.title")}</title>
        <meta name="description" content={t("meta.description")} />
      </Head>
      <div className="max-w-2xl mx-auto mb-8 bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
        <p className="text-gray-300">{t('plans.intro')}</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="bg-gray-800 p-1 rounded-full">
          <button
            onClick={() => setSelectedPlan("monthly")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedPlan === "monthly"
                ? "bg-[#9b9b6f] text-black"
                : "text-white hover:bg-gray-700"
            }`}
          >
            {t('plans.monthly')}
          </button>
          <button
            onClick={() => setSelectedPlan("annual")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedPlan === "annual"
                ? "bg-[#9b9b6f] text-black"
                : "text-white hover:bg-gray-700"
            }`}
          >
            {t('plans.annual')}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div
          className={`relative rounded-xl overflow-hidden ${
            selectedPlan === "monthly"
              ? "border-2 border-[#9b9b6f] shadow-lg shadow-[#9b9b6f]/20"
              : "border border-gray-700"
          } flex flex-col h-full`}
        >
          <div className="bg-gradient-to-r from-[#ffffff10] to-[#121212] backdrop-blur-sm p-6 flex flex-col h-full">
            <h3 className="text-xl font-bold text-white mb-2">
              {t('plans.monthlyTitle')}
            </h3>
            <div className="flex items-baseline mb-4">
              <span className="text-3xl font-bold text-white">
                ${products.pullUpClub.price}
              </span>
              <span className="text-gray-400 ml-1">{t('plans.monthlyPrice')}</span>
            </div>

            <ul className="space-y-3 mb-6 flex-grow">
              {(t('plans.monthlyFeatures', { returnObjects: true }) as string[]).map((feature: string, index: number) => (
                <li key={index} className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 text-[#9b9b6f] mr-2 flex-shrink-0" />
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

              <button
              onClick={selectedPlan === "monthly" ? handleSubscribe : undefined}
                disabled={isLoading || selectedPlan !== "monthly"}
              className={`w-full font-medium py-3 rounded-md transition flex items-center justify-center ${
                selectedPlan === "monthly"
                  ? "bg-[#9b9b6f] text-black hover:bg-[#7a7a58]"
                  : "bg-gray-700 text-white cursor-not-allowed opacity-50"
              }`}
              >
              {isLoading && selectedPlan === "monthly" ? (
                  <span className="flex items-center">
                    <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {t('plans.processing')}
                  </span>
                ) : (
                  <span className="flex items-center">
                    {t('plans.button')} <ChevronRight size={18} className="ml-1" />
                  </span>
                )}
              </button>
          </div>
        </div>

        <div
          className={`relative rounded-xl overflow-hidden ${
            selectedPlan === "annual"
              ? "border-2 border-[#9b9b6f] shadow-lg shadow-[#9b9b6f]/20"
              : "border border-gray-700"
          } flex flex-col h-full`}
        >
          <div className="absolute top-0 right-0 bg-[#9b9b6f] text-black px-3 py-1 text-xs font-semibold">
            {t('plans.bestValue')}
          </div>

          <div className="bg-gradient-to-r from-[#ffffff10] to-[#121212] backdrop-blur-sm p-6 flex flex-col h-full">
            <h3 className="text-xl font-bold text-white mb-2">
              {t('plans.annualTitle')}
            </h3>
            <div className="flex items-baseline mb-4">
              <span className="text-3xl font-bold text-white">
                ${products.pullUpClubAnnual.price}
              </span>
              <span className="text-gray-400 ml-1">{t('plans.annualPrice')}</span>
            </div>

            <ul className="space-y-3 mb-6 flex-grow">
              {(t('plans.annualFeatures', { returnObjects: true }) as string[]).map((feature: string, index: number) => (
                <li key={index} className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 text-[#9b9b6f] mr-2 flex-shrink-0" />
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

              <button
              onClick={selectedPlan === "annual" ? handleSubscribe : undefined}
                disabled={isLoading || selectedPlan !== "annual"}
              className={`w-full font-medium py-3 rounded-md transition flex items-center justify-center ${
                selectedPlan === "annual"
                  ? "bg-[#9b9b6f] text-black hover:bg-[#7a7a58]"
                  : "bg-gray-700 text-white cursor-not-allowed opacity-50"
              }`}
              >
              {isLoading && selectedPlan === "annual" ? (
                  <span className="flex items-center">
                    <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {t('plans.processing')}
                  </span>
                ) : (
                  <span className="flex items-center">
                  {t('plans.button')} <ChevronRight size={18} className="ml-1" />
                  </span>
                )}
              </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 bg-red-900/50 border border-red-700 text-white p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center">
        <div className="flex items-center space-x-4 mb-2">
          <ShieldCheck className="h-5 w-5 text-[#9b9b6f]" />
          <CreditCard className="h-5 w-5 text-[#9b9b6f]" />
        </div>
        <p className="text-sm text-gray-400 text-center">
          {t('securePayment')}
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPlans;
