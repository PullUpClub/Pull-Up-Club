import { Clock, Trophy, Target, FileText, ChevronUp } from "lucide-react";
import { Submission } from "../../types";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMetaTracking } from '../../hooks/useMetaTracking';
import { useProfileValidation } from '../../hooks/useProfileValidation';

// Live countdown hook with seconds
const useLiveCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const difference = nextMonth.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  return timeLeft;
};

interface NextBeatTarget {
  fullName: string;
        organization: string;
  pullUpCount: number;
}

const NextToBeat = ({ bestScore }: { bestScore: number }) => {
  const { t } = useTranslation('profile');
  const { user } = useAuth();
  const [targets, setTargets] = useState<NextBeatTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLeading, setIsLeading] = useState(false);

  useEffect(() => {
    const fetchNextTargets = async () => {
      if (bestScore === 0 || !user) return;
      setLoading(true);
      try {
        // Query user_best_submissions to get only each user's best submission
        const { data, error } = await supabase
          .from("user_best_submissions")
          .select("actual_pull_up_count, full_name, organization")
          .gt('actual_pull_up_count', bestScore)
          .neq('user_id', user.id) // Exclude current user
          .order('actual_pull_up_count', { ascending: true })
          .limit(3);

        if (error) throw error;

        if (!data || data.length === 0) {
          setIsLeading(true);
          return;
        }

        const formattedTargets = data.map(target => ({
          fullName: target.full_name,
          organization: target.organization || 'Independent',
          pullUpCount: target.actual_pull_up_count
        }));

        setTargets(formattedTargets);
      } catch (err) {
        console.error("Failed to fetch next targets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNextTargets();
  }, [bestScore, user]);

  return (
    <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105">
      <div className="flex justify-center mb-4">
        <ChevronUp size={48} className="text-[#9b9b6f]" />
      </div>
      <h3 className="text-xl font-bold text-white mb-4">{t('dashboard.nextToBeat.title', 'Next to Beat')}</h3>
      
      {loading ? (
        <p className="text-gray-400">{t('dashboard.nextToBeat.loading', 'Loading...')}</p>
      ) : isLeading ? (
        <div className="text-center">
          <p className="text-2xl font-bold text-[#9b9b6f] mb-2">
            {t('dashboard.nextToBeat.leading', "You're Leading!")}
          </p>
          <p className="text-gray-400">
            {t('dashboard.nextToBeat.keepGoing', 'Keep pushing your limits!')}
          </p>
        </div>
      ) : targets.length > 0 ? (
        <div className="space-y-3">
          {targets.map((target, index) => (
            <div key={index} className="text-left bg-gray-800 p-3 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-white font-medium">
                    {target.fullName}
                  </span>
                  <span className="text-gray-400 text-sm ml-1">
                    ({target.organization})
                  </span>
                </div>
                <span className="text-[#9b9b6f] font-bold">
                  {target.pullUpCount} {t('dashboard.nextToBeat.pullUps', 'pull-ups')}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400">
          {t('dashboard.nextToBeat.noTargets', 'Start submitting to see your next targets!')}
        </p>
      )}
    </div>
  );
};

const SubmissionDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const timeLeft = useLiveCountdown();
  const { t } = useTranslation('profile');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [bestPerformance, setBestPerformance] = useState(0);
  const [currentMonthSubmission, setCurrentMonthSubmission] = useState<Submission | null>(null);
  const { trackViewContent } = useMetaTracking();
  const hasTracked = useRef(false);
  const { validateAndNotify } = useProfileValidation();

  const handleSubmitNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    if (validateAndNotify()) {
      navigate('/submit');
    }
  };

  const fetchUserSubmissions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data) {
        const formattedSubmissions: Submission[] = data.map((submission) => ({
          id: submission.id,
          userId: submission.user_id,
          fullName: submission.full_name || submission.email?.split('@')[0] || 'Unknown User',
          email: submission.email || 'unknown@example.com',
          phone: submission.phone ?? undefined,
          age: submission.age ?? 0,
          gender: (submission.gender as "Male" | "Female" | "Other") || "Other",
          region: submission.region || 'Unknown Region',
          organization: submission.organization || 'None',
          pullUpCount: submission.pull_up_count,
          actualPullUpCount: submission.actual_pull_up_count ?? undefined,
          videoUrl: submission.video_url,
          status: (submission.status.charAt(0).toUpperCase() + submission.status.slice(1)) as "Pending" | "Approved" | "Rejected",
          submittedAt: submission.created_at,
          approvedAt: submission.approved_at || undefined,
          notes: submission.notes ?? undefined,
          featured: submission.status === 'approved',
          socialHandle: submission.social_handle
        }));
        setSubmissions(formattedSubmissions);

        // Calculate best performance
        const approvedSubmissions = formattedSubmissions.filter(sub => sub.status.toLowerCase() === 'approved');
        const best = approvedSubmissions.reduce((max, sub) => {
          const count = sub.actualPullUpCount ?? sub.pullUpCount;
          return count > max ? count : max;
        }, 0);
        setBestPerformance(best);

        // Find current month submission
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const thisMonthSub = formattedSubmissions.find(sub => {
          const subDate = new Date(sub.submittedAt);
          return subDate.getMonth() === currentMonth && subDate.getFullYear() === currentYear;
        }) || null;
        setCurrentMonthSubmission(thisMonthSub);
      }
    } catch (err) {
      console.error("Failed to load submission history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackViewContent({}, {
        name: 'Submission Dashboard',
        category: 'profile',
        type: 'dashboard'
      }).catch(() => {});
    }
  }, [trackViewContent]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      case 'featured': return 'text-yellow-400';
      default: return 'text-yellow-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-600';
      case 'rejected': return 'bg-red-600';
      case 'featured': return 'bg-yellow-600';
      default: return 'bg-yellow-600';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {/* Monthly Competition Countdown */}
      <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105">
        <div className="flex justify-center mb-4">
          <Clock size={48} className="text-[#9b9b6f]" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{t('dashboard.countdown.title')}</h3>
        <p className="text-2xl font-bold text-white mb-1">
          {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
        </p>
        <p className="text-gray-400">{t('dashboard.countdown.remaining')}</p>
      </div>

      {/* Submission Status */}
      <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105">
        <div className="flex justify-center mb-4">
          <Target size={48} className="text-[#9b9b6f]" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          {currentMonthSubmission && currentMonthSubmission.status.toLowerCase() !== 'rejected' 
            ? t('dashboard.status.title')
            : t('dashboard.status.ready')}
        </h3>
        {currentMonthSubmission && currentMonthSubmission.status.toLowerCase() !== 'rejected' ? (
          <div>
            <p className="text-gray-400 mb-2">{t('dashboard.status.thisMonth')}</p>
            <p className={`font-semibold mb-2 capitalize ${getStatusColor(currentMonthSubmission.status)}`}> 
              {currentMonthSubmission.status}
            </p>
            <p className="text-2xl font-bold text-white">
              {t('dashboard.status.pullUps', { count: currentMonthSubmission.actualPullUpCount ?? currentMonthSubmission.pullUpCount })}
            </p>
            {currentMonthSubmission.status.toLowerCase() === 'approved' && (
              <div className="mt-4 text-sm text-gray-400">
                <p className="text-green-400">{t('dashboard.status.onLeaderboard')}</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            {currentMonthSubmission?.status.toLowerCase() === 'rejected' ? (
              <>
                <p className="text-gray-400 mb-2">{t('dashboard.status.rejected')}</p>
                <p className="text-red-400 mb-4">{t('dashboard.status.rejectedCTA')}</p>
              </>
            ) : (
              <p className="text-gray-400 mb-4">{t('dashboard.status.competeCTA')}</p>
            )}
            <button 
              onClick={handleSubmitNavigation}
              className="bg-[#9b9b6f] hover:bg-[#a5a575] text-black font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              {currentMonthSubmission?.status.toLowerCase() === 'rejected' ? t('dashboard.submitNewButton') : t('dashboard.submitButton')}
            </button>
          </div>
        )}
      </div>

      {/* Your Best Performance */}
      <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105">
        <div className="flex justify-center mb-4">
          <Trophy size={48} className="text-[#9b9b6f]" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{t('dashboard.best.title')}</h3>
        <p className="text-2xl font-bold text-white mb-1">{bestPerformance}</p>
        <p className="text-gray-400">{t('dashboard.best.unit')}</p>
        {bestPerformance > 0 && (
          <div className="mt-4 text-sm text-gray-400">
            <p className="text-[#9b9b6f]">{t('dashboard.status.onLeaderboard')}</p>
          </div>
        )}
      </div>

      {/* Next to Beat - Replacing This Month's Details */}
      <NextToBeat bestScore={bestPerformance} />

      {/* Submission History */}
      <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105 md:col-span-2">
        <div className="flex justify-center mb-4">
          <FileText size={48} className="text-[#9b9b6f]" />
        </div>
        <h3 className="text-xl font-bold text-white mb-4">{t('dashboard.history.title')}</h3>
        
        {loading ? (
          <p className="text-gray-400">{t('dashboard.history.loading')}</p>
        ) : submissions.length > 0 ? (
          <div className="space-y-3">
            {submissions.slice(0, 5).map((submission) => (
              <div key={submission.id} className="flex justify-between items-center text-sm bg-gray-800 p-3 rounded">
                <div className="flex items-center space-x-3">
                  <span className="text-white font-medium">
                    {new Date(submission.submittedAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric' 
                    })}
                  </span>
                  <span className={`text-white text-xs px-2 py-1 rounded capitalize ${getStatusBadgeColor(submission.status)}`}>
                    {submission.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-white font-bold">
                    {t('dashboard.status.pullUps', { count: submission.actualPullUpCount ?? submission.pullUpCount })}
                  </span>
                  {submission.videoUrl && (
                    <div className="mt-1">
                      <a 
                        href={submission.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#9b9b6f] hover:text-[#a5a575] text-xs"
                      >
                        {t('dashboard.history.viewVideo')}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {submissions.length > 5 && (
              <p className="text-gray-400 text-sm">{t('dashboard.history.andMore', { count: submissions.length - 5 })}</p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">{t('dashboard.noSubmissions')}</p>
            <p className="text-gray-500 text-sm mb-4">
              {t('dashboard.noSubmissionsCTA')}
            </p>
            <button 
              onClick={handleSubmitNavigation}
              className="bg-[#9b9b6f] hover:bg-[#a5a575] text-black font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {t('dashboard.submitFirstButton')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionDashboard;
