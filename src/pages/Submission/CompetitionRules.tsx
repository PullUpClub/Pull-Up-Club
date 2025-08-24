import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMetaTracking } from '../../hooks/useMetaTracking';
import { ExternalLink, Download, FileText } from 'lucide-react';

const CompetitionRules: React.FC = () => {
  const { t } = useTranslation('rules');
  const { trackViewContent } = useMetaTracking();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackViewContent({}, {
        name: 'Competition Rules',
        category: 'rules',
        type: 'page'
      }).catch(() => {});
    }
  }, [trackViewContent]);

  const handleDownloadRulebook = () => {
    trackViewContent({}, {
      name: 'Download Official Rulebook',
      category: 'rules',
      type: 'download'
    }).catch(() => {});
    
    window.open('https://cdn.shopify.com/s/files/1/0567/5237/3945/files/Pull-Up_Club_Official_Rulebook.pdf?v=1753397785', '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 rounded-lg p-8 border border-gray-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {t('mainTitle')}
          </h2>
          <p className="text-gray-300 text-lg">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={handleDownloadRulebook}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          <Download size={20} />
          {t('downloadRulebook')}
          <ExternalLink size={16} />
        </button>
      </div>

      <div className="space-y-8">
        {/* What Is Pull-Up Club */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText size={24} />
            {t('whatIs.title')}
          </h3>
          <p className="text-gray-300 mb-6">{t('whatIs.description')}</p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-2">{t('whatIs.step1.title')}</h4>
              <p className="text-gray-300 text-sm">{t('whatIs.step1.description')}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-2">{t('whatIs.step2.title')}</h4>
              <p className="text-gray-300 text-sm">{t('whatIs.step2.description')}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-2">{t('whatIs.step3.title')}</h4>
              <p className="text-gray-300 text-sm">{t('whatIs.step3.description')}</p>
            </div>
          </div>
        </section>

        {/* Pull-Up Standards */}
        <section>
          <h3 className="text-xl font-bold text-white mb-6">{t('pullUpStandards.title')}</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-white mb-4">{t('pullUpStandards.requirements.title')}</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-gray-300">{t('pullUpStandards.requirements.grip')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-gray-300">{t('pullUpStandards.requirements.chin')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-gray-300">{t('pullUpStandards.requirements.lockout')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-gray-300">{t('pullUpStandards.requirements.form')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-gray-300">{t('pullUpStandards.requirements.speed')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-gray-300">{t('pullUpStandards.requirements.feet')}</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">{t('pullUpStandards.equipment.title')}</h4>
              <div className="space-y-4">
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <h5 className="font-medium text-red-400 mb-2">{t('pullUpStandards.equipment.notAllowed.title')}</h5>
                  <p className="text-gray-300 text-sm">{t('pullUpStandards.equipment.notAllowed.description')}</p>
                </div>
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <h5 className="font-medium text-green-400 mb-2">{t('pullUpStandards.equipment.allowed.title')}</h5>
                  <p className="text-gray-300 text-sm">{t('pullUpStandards.equipment.allowed.description')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Video Submission Rules */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">{t('videoSubmission.title')}</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('videoSubmission.fullBody')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('videoSubmission.unbroken')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('videoSubmission.deadHang')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('videoSubmission.straightBar')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('videoSubmission.chinVisible')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('videoSubmission.publicUpload')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('videoSubmission.tagRequired')}</span>
            </li>
          </ul>
        </section>

        {/* Tier System */}
        <section>
          <h3 className="text-xl font-bold text-white mb-6">{t('tierSystem.title')}</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="font-semibold text-white mb-4">{t('tierSystem.men.title')}</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-medium">Recruit</span>
                  <span className="text-gray-300">{t('tierSystem.men.recruit')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-medium">Proven</span>
                  <span className="text-gray-300">{t('tierSystem.men.proven')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-medium">Hardened</span>
                  <span className="text-gray-300">{t('tierSystem.men.hardened')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-medium">Operator</span>
                  <span className="text-gray-300">{t('tierSystem.men.operator')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-medium">Elite</span>
                  <span className="text-gray-300">{t('tierSystem.men.elite')}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="font-semibold text-white mb-4">{t('tierSystem.women.title')}</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-pink-400 font-medium">Recruit</span>
                  <span className="text-gray-300">{t('tierSystem.women.recruit')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-pink-400 font-medium">Proven</span>
                  <span className="text-gray-300">{t('tierSystem.women.proven')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-pink-400 font-medium">Hardened</span>
                  <span className="text-gray-300">{t('tierSystem.women.hardened')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-pink-400 font-medium">Operator</span>
                  <span className="text-gray-300">{t('tierSystem.women.operator')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-pink-400 font-medium">Elite</span>
                  <span className="text-gray-300">{t('tierSystem.women.elite')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PUC Bank */}
        <section className="bg-gradient-to-r from-green-900 to-blue-900 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">{t('pucBank.title')}</h3>
          <p className="text-gray-300 mb-4">{t('pucBank.description')}</p>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-gray-300 text-sm">{t('pucBank.payoutInfo')}</p>
          </div>
        </section>

        {/* Leaderboard Rules */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">{t('leaderboard.title')}</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('leaderboard.verifiedOnly')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('leaderboard.weeklyUpdates')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('leaderboard.resubmitAllowed')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('leaderboard.onePerMonth')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span className="text-gray-300">{t('leaderboard.monthlyFeature')}</span>
            </li>
          </ul>
        </section>

        {/* Rejection Reasons */}
        <section className="bg-red-900/20 border border-red-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">{t('rejections.title')}</h3>
          <p className="text-gray-300 mb-4">{t('rejections.intro')}</p>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-1">•</span>
              <span className="text-gray-300">{t('rejections.grip')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-1">•</span>
              <span className="text-gray-300">{t('rejections.chin')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-1">•</span>
              <span className="text-gray-300">{t('rejections.lockout')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-1">•</span>
              <span className="text-gray-300">{t('rejections.momentum')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-1">•</span>
              <span className="text-gray-300">{t('rejections.videoQuality')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-1">•</span>
              <span className="text-gray-300">{t('rejections.tagging')}</span>
            </li>
          </ul>
        </section>
      </div>

      {/* Support */}
      <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-600">
        <h3 className="text-xl font-bold text-white mb-4">{t('support.title')}</h3>
        <p className="text-gray-300 mb-4">{t('support.description')}</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a 
            href="mailto:support@pullupclub.com" 
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink size={16} />
            support@pullupclub.com
          </a>
          <a 
            href="https://instagram.com/battlebunkerpullupclub" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink size={16} />
            @battlebunkerpullupclub
          </a>
        </div>
      </div>
    </div>
  );
};

export default CompetitionRules;