import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { clubs, regions } from '../../data/mockData';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useMetaTracking } from '../../hooks/useMetaTracking';

interface VideoSubmissionFormProps {
  onSubmissionComplete?: () => void;
}

const VideoSubmissionForm: React.FC<VideoSubmissionFormProps> = ({
  onSubmissionComplete,
}) => {
  const { t } = useTranslation('submission');
  const { user, refreshProfile } = useAuth();
  const { trackEvent } = useMetaTracking();
  const [pullUpCount, setPullUpCount] = useState<number>(0);
  const [videoLink, setVideoLink] = useState("");
  const [videoConfirmed, setVideoConfirmed] = useState(false);
  const [videoAuthenticity, setVideoAuthenticity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [region, setRegion] = useState('');
  const [organization, setOrganization] = useState('');
  const [otherOrganization, setOtherOrganization] = useState('');
  const [age, setAge] = useState<number>(0);
  const [gender, setGender] = useState<string>('Male');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to submit a video.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const { error: submissionError } = await supabase.from("submissions").insert({
        user_id: user.id,
        pull_up_count: pullUpCount,
        video_url: videoLink,
        status: "pending",
        region: region,
        age: age,
        gender: gender,
        organization: organization === 'Other' ? otherOrganization : organization,
      });

      if (submissionError) {
        throw submissionError;
      }

      // Refresh profile data to pick up any trigger updates (like organization)
      try {
        await refreshProfile();
      } catch (refreshError) {
        console.warn('Failed to refresh profile after submission:', refreshError);
        // Don't fail the submission if profile refresh fails
      }

      // Track video submission
      await trackEvent(
        'VideoSubmission',
        {
          email: user?.email,
          externalId: user?.id
        },
        {
          pull_up_count: pullUpCount,
          video_duration: 0, // Placeholder, actual duration would need to be fetched or passed
          platform: 'web' // Placeholder, could be 'mobile', 'desktop'
        }
      );

      if (onSubmissionComplete) {
        toast.success('Video submitted successfully!', {
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#ffffff',
            border: '1px solid #9b9b6f',
          },
          iconTheme: {
            primary: '#9b9b6f',
            secondary: '#ffffff',
          },
        });
        onSubmissionComplete();
      } else {
        navigate("/profile");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-gray-800 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          Submit Your Video
        </h2>

        {error && (
          <div className="bg-red-900 border border-red-700 text-white p-4 rounded-lg mb-6 flex items-center">
            <AlertTriangle size={20} className="mr-2" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="pullUpCount" className="block text-white mb-1">
              Pull-Up Count <span className="text-[#9b9b6f]">*</span>
            </label>
            <input
              type="number"
              id="pullUpCount"
              min="1"
              max="100"
              value={pullUpCount || ""}
              onChange={(e) => setPullUpCount(Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
              required
            />
          </div>

          <div>
            <label htmlFor="videoLink" className="block text-white mb-1">
              Video Link <span className="text-[#9b9b6f]">*</span>
            </label>
            <input
              type="url"
              id="videoLink"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
              required
            />
            <p className="mt-1 text-sm text-gray-400">
              Please upload your video to YouTube, Instagram, or TikTok and
              paste the public link here.
            </p>
          </div>

          <div>
            <label htmlFor="region" className="block text-white mb-1">
              Region <span className="text-[#9b9b6f]">*</span>
            </label>
            <select
              id="region"
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
              required
            >
              <option value="">Select your region</option>
              {regions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="age" className="block text-white mb-1">
                Age <span className="text-[#9b9b6f]">*</span>
              </label>
              <input
                type="number"
                id="age"
                min="16"
                max="100"
                value={age || ""}
                onChange={e => setAge(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                required
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-white mb-1">
                Gender <span className="text-[#9b9b6f]">*</span>
              </label>
              <select
                id="gender"
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="organization" className="block text-white mb-1">
              {t('form.club')}
            </label>
            <select
              id="organization"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
            >
              <option value="">{t('form.selectClub')}</option>
              {clubs.map((club) => (
                <option key={club} value={club}>{club}</option>
              ))}
              <option value="Other">{t('form.otherClub')}</option>
              <option value="None">{t('form.none')}</option>
            </select>
            {organization === 'Other' && (
              <div className="mt-2">
                <input
                  type="text"
                  id="otherOrganization"
                  value={otherOrganization}
                  onChange={e => setOtherOrganization(e.target.value)}
                  placeholder={t('form.otherClubPlaceholder')}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
                  required
                />
              </div>
            )}
          </div>

          <div className="flex items-start mt-4">
            <input
              type="checkbox"
              id="videoConfirmed"
              checked={videoConfirmed}
              onChange={(e) => setVideoConfirmed(e.target.checked)}
              className="w-5 h-5 mt-1 mr-3 rounded border-gray-300 text-[#9b9b6f] focus:ring-[#9b9b6f] cursor-pointer"
              required
            />
            <label htmlFor="videoConfirmed" className="text-gray-300 text-sm">
              I confirm that the video link I have provided is correct and
              publicly accessible.
              <span className="text-[#9b9b6f]">*</span>
            </label>
          </div>

          <div className="flex items-start mt-4">
            <input
              type="checkbox"
              id="videoAuthenticity"
              checked={videoAuthenticity}
              onChange={(e) => setVideoAuthenticity(e.target.checked)}
              className="w-5 h-5 mt-1 mr-3 rounded border-gray-300 text-[#9b9b6f] focus:ring-[#9b9b6f] cursor-pointer"
              required
            />
            <label
              htmlFor="videoAuthenticity"
              className="text-gray-300 text-sm"
            >
              I confirm this is an authentic video of my performance.
              <span className="text-[#9b9b6f]">*</span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={
              !pullUpCount ||
              !videoLink ||
              !videoConfirmed ||
              !videoAuthenticity ||
              isSubmitting
            }
            className="w-full"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Video
          </Button>
        </form>
      </div>
    </div>
  );
};

export default VideoSubmissionForm;
