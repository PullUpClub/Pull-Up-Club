import React from 'react';
import { Receipt } from 'lucide-react';
import { openCustomerPortal } from '../../lib/stripe';

const PaymentHistory: React.FC = () => {
  const handleViewHistory = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    }
  };

  return (
    <div className="bg-white/5 p-6 rounded-xl text-white">
      <h3 className="text-lg font-semibold mb-4">Payment History</h3>
      <p className="text-gray-400 mb-4">
        View your complete payment history and download receipts in the Stripe Customer Portal.
      </p>
      <button
        onClick={handleViewHistory}
        className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg transition flex items-center justify-center"
      >
        <Receipt className="h-4 w-4 mr-2" />
        View Payment History
      </button>
    </div>
  );
};

export default PaymentHistory; 