import React from 'react';
import { Download, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VideoEmbed from '../../components/ui/VideoEmbed';
import VideoErrorBoundary from '../../components/ui/VideoErrorBoundary';
import Layout from '../../components/Layout/Layout';

const FirstPullUpCourse: React.FC = () => {
  const { t } = useTranslation('common');

  // Open external links in new tab (only authenticated users can access this page)
  const handleButtonClick = (url: string) => {
    window.open(url, '_blank', 'noopener noreferrer');
  };

  return (
    <Layout>
      <div className="bg-black py-16 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              {t('navigation.firstPullUpCourse')}
            </h1>
            <div className="w-20 h-1 bg-[#9b9b6f] mx-auto mt-4 mb-6"></div>
            <p className="text-gray-400 max-w-2xl mx-auto">
              {t('firstPullUpCourse.subtitle')}
            </p>
          </div>
          
          {/* Video Section - Full Width */}
          <div className="max-w-4xl mx-auto mb-12">
            <VideoErrorBoundary>
              <VideoEmbed embedId="1117592929" platform="vimeo" autoplayOnScroll={true} />
            </VideoErrorBoundary>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center max-w-2xl mx-auto">
            {/* PDF Download Button */}
            <button
              onClick={() => handleButtonClick('https://cdn.shopify.com/s/files/1/0567/5237/3945/files/4_Week_First_Pullup.pdf?v=1757540144')}
              className="bg-[#9b9b6f] hover:bg-[#8f8f66] text-white px-8 py-4 rounded-lg font-semibold transition-colors flex items-center gap-3 min-w-[280px] justify-center transform hover:scale-105"
            >
              <Download size={24} />
              <span>{t('firstPullUpCourse.buttons.downloadGuide')}</span>
            </button>

            {/* App Store Button */}
            <button
              onClick={() => handleButtonClick('https://urlgeni.us/BattleBunkerTraining')}
              className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors flex items-center gap-3 min-w-[280px] justify-center border border-gray-600 transform hover:scale-105"
            >
              <Smartphone size={24} />
              <span>{t('firstPullUpCourse.buttons.freeCourse')}</span>
            </button>
          </div>

        </div>
      </div>
    </Layout>
  );
};

export default FirstPullUpCourse;
