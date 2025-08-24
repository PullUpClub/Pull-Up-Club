import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";

interface ResetPasswordFormProps {
  onBackToLogin: () => void;
  onResetSent: (email: string) => void;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  onBackToLogin,
  onResetSent,
}) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { resetPassword } = useAuth();
  const { t } = useTranslation(['auth', 'common']);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError(t('errors.invalidEmail'));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Supabase auth reset (creates secure tokens and sends branded email via SMTP)
      await resetPassword(email);
      onResetSent(email);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      if (errorMessage.includes("User not found")) {
        setError(t('errors.userNotFound'));
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handlePasswordReset} className="w-full flex flex-col gap-4">
      <p className="text-sm text-gray-300 text-center mb-2">
        {t('resetPassword.instructions')}
      </p>
      <div className="w-full">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('resetPassword.emailLabel')}
          className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b9b6f]"
          required
        />
      </div>

      {error && <div className="text-sm text-red-400 text-left">{error}</div>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-white/10 text-white font-medium px-5 py-3 rounded-full shadow hover:bg-white/20 transition mb-3 text-sm"
      >
        {isLoading ? t('common:status.loading') : t('resetPassword.submitButton')}
      </button>

      <div className="text-center mt-2">
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-xs text-gray-400 hover:text-white underline"
        >
          {t('resetSent.backToLogin')}
        </button>
      </div>
    </form>
  );
};

export default ResetPasswordForm;