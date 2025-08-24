import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout/Layout';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';
import Head from '../../components/Layout/Head';
import { useMetaTracking } from '../../hooks/useMetaTracking';

interface VerificationResult {
  isValid: boolean;
  customerEmail?: string;
  subscriptionId?: string;
  customerId?: string;
  error?: string;
  sessionData?: {
    paymentStatus: string;
    status: string;
    amountTotal: number;
    currency: string;
  };
}

const SignupAccessPage: React.FC = () => {
  const { t } = useTranslation('subscription');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trackEvent } = useMetaTracking();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isClaimingPayment, setIsClaimingPayment] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (user) {
      // If user is already logged in, try to claim the payment
      if (sessionId) {
        claimPayment(sessionId);
      } else {
        navigate('/profile');
      }
      return;
    }
    if (!sessionId) {
      navigate('/subscription');
      return;
    }
    verifyStripeSession();
  }, [sessionId, user, navigate]);

  const verifyStripeSession = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-stripe-session', {
        body: { sessionId }
      });
      if (error) {
        console.error('Error verifying session:', error);
        setVerificationStatus('invalid');
        setVerificationResult({ isValid: false, error: 'Failed to verify payment session' });
        return;
      }
      if (data.success && data.isValid) {
        setVerificationStatus('valid');
        setVerificationResult(data);
        if (data.customerEmail) {
          setFormData(prev => ({ ...prev, email: data.customerEmail }));
        }
      } else {
        setVerificationStatus('invalid');
        setVerificationResult({ isValid: false, error: 'Payment session is not valid or expired' });
      }
    } catch (error) {
      console.error('Error verifying session:', error);
      setVerificationStatus('invalid');
      setVerificationResult({ isValid: false, error: 'Failed to verify payment session' });
    }
  };

  const claimPayment = async (sessionId: string) => {
    setIsClaimingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('claim-payment', {
        body: { sessionId }
      });

      if (error) {
        console.error('Error claiming payment:', error);
        toast.error('Failed to claim payment. Please contact support.');
        return;
      }

      if (data.success) {
        // Track Purchase event
        await trackEvent('Purchase', {
          email: user?.email,
          externalId: verificationResult?.customerId,
        }, {
          value: verificationResult?.sessionData?.amountTotal,
          currency: verificationResult?.sessionData?.currency,
          content_name: 'Pull-Up Club Membership',
          content_type: 'subscription',
          content_ids: [verificationResult?.subscriptionId],
          predicted_ltv: '119.88' // $9.99 * 12 months
        });

        toast.success('Payment claimed successfully!');
        navigate('/profile');
      }
    } catch (error) {
      console.error('Error in payment claiming:', error);
      toast.error('Failed to claim payment. Please contact support.');
    } finally {
      setIsClaimingPayment(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAccount(true);
    try {
      if (formData.password !== formData.confirmPassword) {
        toast.error(t('common:errors.passwordMismatch'));
        return;
      }
      if (!isPasswordValid) {
        toast.error(t('common:errors.passwordRequirementsNotMet'));
        return;
      }

      // Track StartTrial event before account creation
      await trackEvent('StartTrial', {
        email: formData.email,
        externalId: verificationResult?.customerId,
      }, {
        value: verificationResult?.sessionData?.amountTotal,
        currency: verificationResult?.sessionData?.currency,
        predicted_ltv: '119.88' // $9.99 * 12 months
      });

      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            stripe_customer_id: verificationResult?.customerId,
            is_paid: true
          }
        }
      });
      if (authError) {
        console.error('Error creating account:', authError);
        toast.error(`Failed to create account: ${authError.message}`);
        return;
      }

      // Track CompleteRegistration event
      await trackEvent('CompleteRegistration', {
        email: formData.email,
        externalId: verificationResult?.customerId,
      });

      toast.success(t('common:status.success'));
      // The payment will be claimed automatically when the user is logged in
      // due to the useEffect hook above
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error(t('common:errors.generic'));
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Password validation logic
  const hasMinLength = formData.password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(formData.password);
  const hasLowerCase = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword && formData.password.length > 0;
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && passwordsMatch;

  const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className="flex items-center space-x-2 text-sm">
      <CheckCircle2 size={16} className={met ? "text-green-500" : "text-gray-500"} />
      <span className={met ? "text-green-500" : "text-gray-500"}>{text}</span>
    </div>
  );

  if (verificationStatus === 'loading') {
    return (
      <Layout>
        <Head><title>{t('meta.title')}</title></Head>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#9b9b6f] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">{t('signup.verifying')}</h2>
            <p className="text-gray-400">{t('signup.verifyingDesc')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (verificationStatus === 'invalid') {
    return (
      <Layout>
        <Head><title>{t('meta.title')}</title></Head>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="max-w-md mx-auto text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">{t('signup.failedTitle')}</h2>
            <p className="text-gray-400 mb-6">
              {verificationResult?.error || t('signup.failedDesc')}
            </p>
            <Button onClick={() => navigate('/subscription')} className="bg-[#9b9b6f] text-black hover:bg-[#7a7a58]">
              {t('signup.backButton')}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (isClaimingPayment) {
    return (
      <Layout>
        <Head><title>{t('meta.title')}</title></Head>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#9b9b6f] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Claiming Payment...</h2>
            <p className="text-gray-400">Please wait while we set up your subscription.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head><title>{t('meta.title')}</title></Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden w-full">
        <div className="relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-r from-[#ffffff10] to-[#121212] backdrop-blur-sm shadow-2xl p-8 flex flex-col items-center">
          <div className="flex items-center justify-center mb-6">
            <img src="/PUClogo-optimized.webp" alt="Pull-Up Club Logo" className="h-16 w-auto" />
          </div>
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-[#9b9b6f] mb-2 text-center">{t('signup.successTitle')}</h1>
          <p className="text-gray-400 text-sm mb-6 text-center">{t('signup.successDesc')}</p>
          <div className="w-full">
            <form onSubmit={handleCreateAccount} className="flex flex-col w-full gap-4">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                readOnly={!!verificationResult?.customerEmail}
                className={`w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b9b6f] ${verificationResult?.customerEmail ? 'opacity-75 cursor-not-allowed' : ''}`}
                placeholder={t('common:labels.email')}
              />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength={8}
                className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                placeholder={t('signup.passwordPlaceholder')}
              />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                minLength={8}
                className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                placeholder={t('signup.confirmPasswordPlaceholder')}
              />
              <div className="space-y-2 bg-white/5 p-4 rounded-xl">
                <p className="text-sm font-medium text-gray-300 mb-2">{t('signup.requirementsTitle')}</p>
                <PasswordRequirement met={hasMinLength} text={t('signup.reqMinLength')} />
                <PasswordRequirement met={hasUpperCase} text={t('signup.reqUpperCase')} />
                <PasswordRequirement met={hasLowerCase} text={t('signup.reqLowerCase')} />
                <PasswordRequirement met={hasNumber} text={t('signup.reqNumber')} />
                <PasswordRequirement met={passwordsMatch} text={t('signup.reqMatch')} />
              </div>
              <Button
                type="submit"
                disabled={isCreatingAccount || !isPasswordValid}
                className="w-full bg-[#9b9b6f] text-black hover:bg-[#7a7a58] font-medium py-3"
              >
                {isCreatingAccount ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('signup.creatingButton')}
                  </span>
                ) : (
                  t('signup.createButton')
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SignupAccessPage; 