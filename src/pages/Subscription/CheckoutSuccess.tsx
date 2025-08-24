import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useMetaTracking } from "../../hooks/useMetaTracking";

interface CheckoutSuccessProps {
  subscriptionType?: 'monthly' | 'annual';
  customerName?: string;
  redirectTo?: string;
  redirectLabel?: string;
}

const CheckoutSuccess: React.FC<CheckoutSuccessProps> = ({
  subscriptionType = 'monthly',
  customerName,
  redirectTo,
  redirectLabel
}) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { trackEvent } = useMetaTracking();
  
  useEffect(() => {
    // Track Purchase event with enhanced user data
    const trackPurchase = async () => {
      if (!user) return;

      const userData = {
        email: user.email,
        externalId: user.id,
        firstName: profile?.full_name?.split(' ')[0] || '',
        lastName: profile?.full_name?.split(' ').slice(1).join(' ') || '',
        phone: profile?.phone || '',
      };

      const value = subscriptionType === 'monthly' ? 9.99 : 99.99;

      await trackEvent('Purchase', userData, {
        value,
        currency: 'USD',
        content_name: `PUC ${subscriptionType === 'monthly' ? 'Monthly' : 'Annual'} Membership`,
        content_category: 'Subscription',
        content_ids: [subscriptionType],
        content_type: 'product',
        num_items: 1,
        order_id: `order_${user.id}_${Date.now()}`,
        delivery_category: 'home_delivery',
      });
    };

    trackPurchase();
  }, [user, subscriptionType, trackEvent]);
  
  const handleNavigate = () => {
    if (redirectTo) {
      navigate(redirectTo);
    } else {
      navigate("/profile");
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <h2 className="text-2xl font-bold text-green-500 mb-4">Payment Successful!</h2>
      <p className="text-gray-200 mb-6">
        {customerName 
          ? `Welcome to Pull-Up Club, ${customerName}!` 
          : 'Your subscription is now active. Welcome to Pull-Up Club!'}
      </p>
      <button
        className="bg-[#9b9b6f] text-black px-6 py-2 rounded-full font-semibold hover:bg-[#7a7a58] transition"
        onClick={handleNavigate}
      >
        {redirectLabel || 'Go to Dashboard'}
      </button>
    </div>
  );
};

export default CheckoutSuccess; 