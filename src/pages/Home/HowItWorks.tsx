import React from 'react';
import { Camera, Award, Medal, Download, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VideoEmbed from '../../components/ui/VideoEmbed';
import VideoErrorBoundary from '../../components/ui/VideoErrorBoundary';

const HowItWorks: React.FC = () => {
  const { t } = useTranslation('home');

  const steps = [
    {
      icon: <Camera size={48} className="text-[#9b9b6f]" />,
      title: t('howItWorks.step1.title'),
      description: t('howItWorks.step1.description')
    },
    {
      icon: <Award size={48} className="text-[#9b9b6f]" />,
      title: t('howItWorks.step2.title'),
      description: t('howItWorks.step2.description')
    },
    {
      icon: <Medal size={48} className="text-[#9b9b6f]" />,
      title: t('howItWorks.step3.title'),
      description: t('howItWorks.step3.description')
    }
  ];

  return (
    <section className="bg-black py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">{t('howItWorks.title')}</h2>
          <div className="w-20 h-1 bg-[#9b9b6f] mx-auto mt-4 mb-6"></div>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t('howItWorks.subtitle')}
          </p>
        </div>
        
        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          {/* PDF Download Button */}
          <a
            href="https://cdn.shopify.com/s/files/1/0567/5237/3945/files/4_Week_First_Pullup.pdf?v=1757540144"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#9b9b6f] hover:bg-[#8f8f66] text-white px-8 py-4 rounded-lg font-semibold transition-colors flex items-center gap-3 min-w-[250px] justify-center"
          >
            <Download size={24} />
            <span>{t('howItWorks.downloadButtons.pdfGuide')}</span>
          </a>

          {/* App Store Button */}
          <a
            href="https://urlgeni.us/BattleBunkerTraining"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors flex items-center gap-3 min-w-[250px] justify-center border border-gray-600"
          >
            <Smartphone size={24} />
            <span>{t('howItWorks.downloadButtons.freeCourse')}</span>
          </a>
        </div>
        
        {/* Video Section - Full Width */}
        <div className="max-w-4xl mx-auto mb-12">
          <VideoErrorBoundary>
            <VideoEmbed embedId="1117592929" platform="vimeo" autoplayOnScroll={true} />
          </VideoErrorBoundary>
        </div>

        {/* Steps - Horizontal on Desktop, Vertical on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105"
            >
              <div className="flex justify-center mb-4">
                {step.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {index + 1}. {step.title}
              </h3>
              <p className="text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;