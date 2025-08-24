import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

interface PasswordChangeFormProps {
  onSuccess?: () => void;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { t } = useTranslation(['auth', 'common']);

  // Password validation
  const hasMinLength = password.length >= 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword;
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && passwordsMatch;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setError(t('errors.invalidPassword'));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log('Starting password update...');
      
      // Check current session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session:', { 
        hasSession: !!session, 
        sessionError: sessionError ? {
          message: sessionError.message,
          status: sessionError.status,
          details: sessionError
        } : null 
      });
      
      if (!session) {
        throw new Error('No valid session found. Please try the reset link again.');
      }

      // Log user details (safely)
      console.log('User details:', {
        id: session.user?.id,
        email: session.user?.email,
        lastSignIn: session.user?.last_sign_in_at,
      });
      
      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: password 
      });

      if (updateError) {
        console.error('Password update error details:', {
          message: updateError.message,
          status: updateError.status,
          details: updateError
        });
        throw updateError;
      }

      console.log('Password updated successfully');

      // Show success toast
      toast.success(t('passwordChange.success'), {
        duration: 4000,
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

      // Sign out the user after password change
      await supabase.auth.signOut();
      console.log('User signed out successfully');

      if (onSuccess) {
        onSuccess();
      } else {
        // Default behavior: redirect to login after 1.5s
        setTimeout(() => navigate("/login"), 1500);
      }
    } catch (err) {
      console.error('Password change error:', err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(t('errors.updateFailed', { message: errorMessage }));
      
      // More detailed error toast
      toast.error(errorMessage, {
        duration: 6000, // Longer duration for error messages
        style: {
          background: '#1f2937',
          color: '#ffffff',
          border: '1px solid #ef4444',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className="flex items-center space-x-2 text-sm">
      <CheckCircle2 size={16} className={met ? "text-green-500" : "text-gray-500"} />
      <span className={met ? "text-green-500" : "text-gray-500"}>{text}</span>
    </div>
  );

  return (
    <form onSubmit={handlePasswordChange} className="w-full flex flex-col gap-4">
      <div className="w-full">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordChange.newPassword')}
          className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
          required
        />
      </div>

      <div className="w-full">
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('passwordChange.confirmPassword')}
          className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
          required
        />
      </div>

      <div className="space-y-2 bg-white/5 p-4 rounded-xl">
        <p className="text-sm font-medium text-gray-300 mb-2">{t('passwordChange.requirements')}:</p>
        <PasswordRequirement met={hasMinLength} text={t('passwordChange.minLength')} />
        <PasswordRequirement met={hasUpperCase} text={t('passwordChange.upperCase')} />
        <PasswordRequirement met={hasLowerCase} text={t('passwordChange.lowerCase')} />
        <PasswordRequirement met={hasNumber} text={t('passwordChange.number')} />
        <PasswordRequirement met={passwordsMatch} text={t('passwordChange.match')} />
      </div>

      {error && <div className="text-sm text-red-400 text-left">{error}</div>}

      <button
        type="submit"
        disabled={isLoading || !isPasswordValid}
        className="w-full bg-[#9b9b6f] text-black font-medium px-5 py-3 rounded-full hover:bg-[#7a7a58] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? t('common:status.loading') : t('passwordChange.submit')}
      </button>
    </form>
  );
};

export default PasswordChangeForm; 