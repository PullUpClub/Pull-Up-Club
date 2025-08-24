import React from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ResetSentConfirmationProps {
  email: string;
  onBackToLogin: () => void;
}

const ResetSentConfirmation: React.FC<ResetSentConfirmationProps> = ({
  email,
  onBackToLogin,
}) => {
  const { t } = useTranslation('auth');

  return (
    <div className="text-center">
      <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
      <h2 className="text-2xl font-bold text-white">{t('resetSent.title')}</h2>
      <p className="text-gray-300 mt-2">
        {t('resetSent.message', { email })}
      </p>

      <div className="space-y-4 w-full mt-6">
        <p className="text-gray-400 text-sm">
          {t('resetSent.additionalInfo')}
        </p>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full bg-white/10 text-white font-medium px-5 py-3 rounded-full shadow hover:bg-white/20 transition mb-3 text-sm"
        >
          {t('resetSent.backToLogin')}
        </button>
      </div>
    </div>
  );
};

export default ResetSentConfirmation;
