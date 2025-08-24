import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { SubmitVideoParams } from '../types';

interface SubmitVideoResult {
  success: boolean;
  error?: string;
}

export const useVideoSubmission = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshProfile } = useAuth();

  const submitVideo = async ({ videoUrl, pullUpCount, userId, organization, region, gender, age }: SubmitVideoParams): Promise<SubmitVideoResult> => {
    try {
      setUploading(true);
      setError(null);

      // Insert submission with all data including organization
      const { error } = await supabase.from('submissions').insert([
        {
          user_id: userId,
          video_url: videoUrl,
          pull_up_count: pullUpCount,
          organization: organization,
          region: region,
          gender: gender,
          age: age,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      // Refresh profile data to pick up any trigger updates (like organization)
      try {
        await refreshProfile();
      } catch (refreshError) {
        console.warn('Failed to refresh profile after submission:', refreshError);
        // Don't fail the submission if profile refresh fails
      }

      setUploading(false);
      return { success: true };
    } catch (err: any) {
      setUploading(false);
      setError(err.message || 'Submission failed');
      return { success: false, error: err.message };
    }
  };

  return {
    submitVideo,
    uploading,
    error
  };
};

export default useVideoSubmission; 