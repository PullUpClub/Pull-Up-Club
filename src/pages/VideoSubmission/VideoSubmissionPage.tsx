import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Info, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import useVideoSubmission from '../../hooks/useVideoSubmission';
import useSubmissions from '../../hooks/useSubmissions';
import { Alert } from '../../components/ui/Alert';
import { LinkButton } from '../../components/ui/LinkButton';
import { useNavigate } from 'react-router-dom';
import type { Submission } from '../../types';
import { clubs, regions } from '../../data/mockData';
import toast from 'react-hot-toast';
import { Link } from '../../components/ui/Link';
import { useTranslation } from 'react-i18next';
import Head from '../../components/Layout/Head';
import { useMetaTracking } from '../../hooks/useMetaTracking';


interface FormData {
  pullUpCount: number;
  videoUrl: string;
  organization: string;
  region: string;
  gender: 'Male' | 'Female' | 'Other';
}

// Eligibility status type
interface EligibilityStatus {
  can_submit: boolean;
  status: 'eligible' | 'rejected' | 'pending' | 'approved_waiting' | 'error';
  message: string;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
}

// Add monthly countdown hook
const useMonthlyCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const difference = nextMonth.getTime() - now.getTime();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60)
        });
      }
    };
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(timer);
  }, []);
  return timeLeft;
};

// Add eligibility message component
const EligibilityMessage: React.FC<{ status: EligibilityStatus; countdown: Countdown }> = ({ status, countdown }) => {
  const { t } = useTranslation('submission');
  if (!status) return null;
  switch (status.status) {
    case 'eligible':
      return (
        <div className="bg-green-900 border border-green-700 text-white p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-lg mb-2">{t('eligibility.eligible.title')}</h3>
          <p className="mb-3">{status.message}</p>
          <div className="bg-green-800 p-3 rounded">
            <p className="text-sm font-medium">{t('eligibility.eligible.deadline')}</p>
            <p className="text-lg">{t('eligibility.eligible.remaining', { days: countdown.days, hours: countdown.hours, minutes: countdown.minutes })}</p>
          </div>
        </div>
      );
    case 'rejected':
      return (
        <div className="bg-yellow-900 border border-yellow-700 text-white p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-lg mb-2">🔄 {t('eligibility.rejected.title')}</h3>
          <p className="mb-3">{status.message}</p>
          <div className="bg-yellow-800 p-3 rounded">
            <p className="text-sm">{t('eligibility.rejected.message')}</p>
          </div>
        </div>
      );
    case 'pending':
      return (
        <div className="bg-blue-900 border border-blue-700 text-white p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-lg mb-2">⏳ {t('eligibility.pending.title')}</h3>
          <p className="mb-3">{status.message}</p>
          <div className="bg-blue-800 p-3 rounded">
            <p className="text-sm">{t('eligibility.pending.message')}</p>
          </div>
        </div>
      );
    case 'approved_waiting':
      return (
        <div className="bg-gray-900 border border-gray-700 text-white p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-lg mb-2">🎉 {t('eligibility.approved.title')}</h3>
          <p className="mb-3">{t('eligibility.approved.message')}</p>
          <div className="bg-gray-800 p-3 rounded">
            <p className="text-sm font-medium">{t('eligibility.approved.nextSubmission')}</p>
            <p className="text-lg">{t('eligibility.approved.remaining', { days: countdown.days, hours: countdown.hours, minutes: countdown.minutes })}</p>
          </div>
        </div>
      );
    case 'error':
      return (
        <div className="bg-red-900 border border-red-700 text-white p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-lg mb-2">❌ {t('common:status.error')}</h3>
          <p>{status.message}</p>
          <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-sm">
            {t('eligibility.retry')}
          </button>
        </div>
      );
    default:
      return null;
  }
};

const VideoSubmissionPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation(['submission', 'common']);
  const { submitVideo, uploading } = useVideoSubmission();
  const navigate = useNavigate();
  const { trackEvent } = useMetaTracking();

  const [formData, setFormData] = useState<FormData & { otherOrganization?: string }>({
    pullUpCount: 0,
    videoUrl: '',
    organization: '',
    region: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    otherOrganization: '',
  });
  const [isChecked, setIsChecked] = useState({
    checkbox1: false,
    checkbox2: false,
    checkbox3: false,
    checkbox4: false,
  });
  
  const { submissions } = useSubmissions({ 
    status: 'Pending',
    limit: 3  
  });

  // Add eligibility status and checking logic
  const [eligibilityStatus, setEligibilityStatus] = useState<EligibilityStatus | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);
  const monthlyCountdown = useMonthlyCountdown();

  const checkSubmissionEligibility = async () => {
    if (!user?.id) return;
    setIsCheckingEligibility(true);
    try {
      const { data, error } = await supabase.rpc('get_submission_status', {
        input_user_id: user.id
      });
      if (error) throw error;
      setEligibilityStatus(data);
    } catch (error) {
      console.error('Error checking eligibility:', error);
      setEligibilityStatus({
        can_submit: false,
        status: 'error',
        message: 'Unable to check submission eligibility. Please try again.'
      });
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  useEffect(() => {
    checkSubmissionEligibility();
  }, [user?.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setIsChecked(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.pullUpCount < 1) {
      return;
    }

    if (!user) {
      return;
    }



    // Track video submission event
    await trackEvent('SubmitApplication', {
      externalId: user.id,
      email: user.email
    }, {
      content_name: 'PUC Video Submission',
      content_category: 'Competition',
      content_type: 'product',
      value: 0,
      currency: 'USD',
      pull_up_count: formData.pullUpCount,
      region: formData.region,
      gender: formData.gender,
      page_url: window.location.href,
      page_path: window.location.pathname,
    });

    const result = await submitVideo({
      videoUrl: formData.videoUrl,
      pullUpCount: formData.pullUpCount,
      userId: user.id,
      organization: formData.organization === 'Other' ? formData.otherOrganization : formData.organization,
      region: formData.region,
      gender: formData.gender,
      age: 0 // Default age for now, could be enhanced later
    });

    if (result.success) {
      toast.success(t('successToast'));
      navigate('/profile');
    }
  };

  // Validate form
  const isFormValid = () => {
    return (
      formData.pullUpCount > 0 &&
      formData.videoUrl.trim() !== '' &&
      isChecked.checkbox1 &&
      isChecked.checkbox2 &&
      isChecked.checkbox3 &&
      isChecked.checkbox4 &&
      formData.gender &&
      formData.region
    );
  };

  if (!user) {
    return (
      <Layout>
        <div className="bg-black min-h-screen py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mx-auto">
            <Alert
              variant="warning"
              title={t('noAuth.title')}
              description={t('noAuth.description')}
              icon={<Info size={24} />}
            />
            
            <div className="mt-6 flex justify-center space-x-4">
              <LinkButton to="/login">{t('noAuth.login')}</LinkButton>
              <LinkButton to="/create-account" variant="outline">{t('noAuth.createAccount')}</LinkButton>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isCheckingEligibility) {
    return (
      <Layout>
        <Head><title>{t('meta.title')}</title><meta name="description" content={t('meta.description')} /></Head>
        <div className="bg-black min-h-screen py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center mb-8 gap-4">
              <img src="/PUClogo (1).webp" alt={t('common:misc.logoAlt')} style={{ height: 48, width: 48 }} className="mr-2" />
              <h1 className="text-3xl font-bold text-white text-center">{t('title')}</h1>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg mb-6 text-center">
              <p className="text-white">{t('eligibility.checking')}</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isCheckingEligibility && eligibilityStatus) {
    return (
      <Layout>
        <Head><title>{t('meta.title')}</title><meta name="description" content={t('meta.description')} /></Head>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">{t('title')}</h1>
            <p className="text-gray-300">{t('subtitle')}</p>
          </div>
          <EligibilityMessage 
            status={eligibilityStatus} 
            countdown={monthlyCountdown}
          />
          {eligibilityStatus.can_submit ? (
            <div className="bg-gray-800 rounded-lg p-6">

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="pullUpCount" className="block text-gray-300 font-medium mb-2">{t('form.pullUpCount')} <span className="text-[#9b9b6f]">*</span></label>
                    <input
                      type="number"
                      id="pullUpCount"
                      name="pullUpCount"
                      value={formData.pullUpCount || ''}
                      onChange={handleInputChange}
                      min="1"
                      max="100"
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-400">{t('form.pullUpCountDesc')}</p>
                  </div>

                  <div>
                    <label htmlFor="gender" className="block text-gray-300 font-medium mb-2">{t('form.gender')} <span className="text-[#9b9b6f]">*</span></label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                      required
                    >
                      <option value="Male">{t('form.male')}</option>
                      <option value="Female">{t('form.female')}</option>
                      <option value="Other">{t('form.other')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="region" className="block text-gray-300 font-medium mb-2">{t('form.region')} <span className="text-[#9b9b6f]">*</span></label>
                    <select
                      id="region"
                      name="region"
                      value={formData.region}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                      required
                    >
                      <option value="">{t('form.selectRegion')}</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="organization" className="block text-gray-300 font-medium mb-2">{t('form.club')}</label>
                    <select
                      id="organization"
                      name="organization"
                      value={formData.organization}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                    >
                      <option value="">{t('form.selectClub')}</option>
                      {clubs.map((club) => (
                        <option key={club} value={club}>{club}</option>
                      ))}
                      <option value="Other">{t('form.other')}</option>
                    </select>
                    {formData.organization === 'Other' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          id="otherOrganization"
                          name="otherOrganization"
                          value={formData.otherOrganization || ''}
                          onChange={handleInputChange}
                          placeholder={t('form.otherClubPlaceholder')}
                          className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="videoUrl" className="block text-gray-300 font-medium mb-2">{t('form.videoUrl')} <span className="text-[#9b9b6f]">*</span></label>
                  <input
                    type="url"
                    id="videoUrl"
                    name="videoUrl"
                    value={formData.videoUrl}
                    onChange={handleInputChange}
                    placeholder={t('form.videoUrlPlaceholder')}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                    required
                  />
                  <div className="mt-1 text-sm text-gray-400 flex items-start">
                    <Info className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                    <span>{t('form.videoUrlDesc')}</span>
                  </div>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-medium text-white mb-3">{t('form.requirementsTitle')}</h3>
                  <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm ml-1">
                    <li>{t('form.req1')}</li>
                    <li>{t('form.req2')}</li>
                    <li>{t('form.req3')}</li>
                    <li>{t('form.req4')}</li>
                    <li>{t('form.req5')}</li>
                    <li>{t('form.req6')}</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="checkbox1"
                      name="checkbox1"
                      checked={isChecked.checkbox1}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 rounded border-gray-700 text-[#9b9b6f] focus:ring-[#9b9b6f]"
                      required
                    />
                    <label htmlFor="checkbox1" className="ml-2 block text-sm text-gray-300">{t('form.checkbox1')}<span className="text-[#9b9b6f]">*</span></label>
                  </div>
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="checkbox2"
                      name="checkbox2"
                      checked={isChecked.checkbox2}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 rounded border-gray-700 text-[#9b9b6f] focus:ring-[#9b9b6f]"
                      required
                    />
                    <label htmlFor="checkbox2" className="ml-2 block text-sm text-gray-300">{t('form.checkbox2')}<span className="text-[#9b9b6f]">*</span></label>
                  </div>
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="checkbox3"
                      name="checkbox3"
                      checked={isChecked.checkbox3}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 rounded border-gray-700 text-[#9b9b6f] focus:ring-[#9b9b6f]"
                      required
                    />
                    <label htmlFor="checkbox3" className="ml-2 block text-sm text-gray-300">{t('form.checkbox3')}<span className="text-[#9b9b6f]">*</span></label>
                  </div>
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="checkbox4"
                      name="checkbox4"
                      checked={isChecked.checkbox4}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 rounded border-gray-700 text-[#9b9b6f] focus:ring-[#9b9b6f]"
                      required
                    />
                    <label htmlFor="checkbox4" className="ml-2 block text-sm text-gray-300">{t('form.checkbox4')}<span className="text-[#9b9b6f]">*</span></label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400 mb-4 text-center">{t('form.reviewTime')}</p>
                  <Button
                    type="submit"
                    disabled={!isFormValid() || uploading}
                    className="w-full bg-[#9b9b6f] text-black hover:bg-[#a5a575] font-semibold py-3 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <><Loader2 className="animate-spin mr-2" />{t('form.submittingButton')}</>
                    ) : (t('form.submitButton'))}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-white mb-4">{t('eligibility.notAvailable.title')}</h3>
              <p className="text-gray-300 mb-4">{t('eligibility.notAvailable.message')}</p>
              <Link 
                href="/leaderboard" 
                className="inline-block px-6 py-3 bg-[#918f6f] hover:bg-[#a19f7f] text-black font-semibold rounded-lg"
              >
                {t('eligibility.notAvailable.viewLeaderboard')}
              </Link>
            </div>
          )}

          {/* Recent submissions section */}
          {submissions.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-bold text-white mb-6">{t('recentSubmissions.title')}</h2>
              <div className="space-y-4">
                {submissions.map((submission: Submission) => (
                  <div key={submission.id} className="bg-gray-800 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white">
                          <span className="font-medium">{submission.pullUpCount} pull-ups</span>
                          {submission.actualPullUpCount !== undefined && submission.pullUpCount !== submission.actualPullUpCount && (
                            <span className="text-gray-400 ml-2">
                              ({t('recentSubmissions.verified')}: {submission.actualPullUpCount})
                            </span>
                          )}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {t('recentSubmissions.submittedOn')} {new Date(submission.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            submission.status === 'Approved'
                              ? 'bg-green-900 text-green-300'
                              : submission.status === 'Rejected'
                              ? 'bg-red-900 text-red-300'
                              : 'bg-yellow-900 text-yellow-300'
                          }`}
                        >
                          {submission.status}
                        </span>
                      </div>
                    </div>
                    
                    {submission.notes && (
                      <div className="mt-3 p-3 bg-gray-700 rounded-lg text-sm">
                        <p className="text-gray-300 font-medium">{t('recentSubmissions.reviewNotes')}:</p>
                        <p className="text-white">{submission.notes}</p>
                      </div>
                    )}
                    
                    <div className="mt-3 flex justify-between">
                      <a
                        href={submission.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#9b9b6f] hover:text-[#7a7a58] text-sm flex items-center"
                      >
                        <Info className="h-3 w-3 mr-1" /> {t('recentSubmissions.viewVideo')}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              {submissions.length >= 3 && (
                <div className="mt-4 text-center">
                  <LinkButton 
                    to="/profile" 
                    variant="outline" 
                    size="sm"
                  >
                    {t('recentSubmissions.viewAll')}
                  </LinkButton>
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-black min-h-screen py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-white text-center py-12">{t('eligibility.checking')}</div>
      </div>
    </Layout>
  );
};

export default VideoSubmissionPage;