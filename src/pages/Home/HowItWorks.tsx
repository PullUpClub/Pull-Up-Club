import React from 'react';
import { Camera, Award, Medal } from 'lucide-react';
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
        
        {/* Enhanced Download Buttons */}
        <div className="flex flex-col lg:flex-row gap-6 justify-center items-center mb-16">
          {/* PDF Download Button - Primary CTA */}
          <div className="group relative">
            <a
              href="https://cdn.shopify.com/s/files/1/0567/5237/3945/files/4_Week_First_Pullup.pdf?v=1757540144"
              target="_blank"
              rel="noopener noreferrer"
              className="relative bg-gradient-to-r from-[#9b9b6f] to-[#8f8f66] hover:from-[#8f8f66] hover:to-[#7d7d5c] text-white px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-4 min-w-[280px] justify-center shadow-2xl hover:shadow-[#9b9b6f]/25 hover:scale-105 transform border-2 border-[#9b9b6f]/20"
            >
              <div className="text-2xl">📘</div>
              <div className="flex flex-col items-start">
                <span className="text-xl">{t('howItWorks.downloadButtons.pdfGuide')}</span>
                <span className="text-sm text-[#f0f0e6] font-normal">Instant download • No signup required</span>
              </div>
              <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </a>
          </div>

          {/* App Course Button - Secondary CTA */}
          <div className="group relative">
            <a
              href="https://urlgeni.us/BattleBunkerTraining"
              target="_blank"
              rel="noopener noreferrer"
              className="relative bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-4 min-w-[280px] justify-center shadow-2xl hover:shadow-gray-500/25 hover:scale-105 transform border-2 border-gray-600/30"
            >
              <div className="text-2xl">🎯</div>
              <div className="flex flex-col items-start">
                <span className="text-xl">{t('howItWorks.downloadButtons.freeCourse')}</span>
                <span className="text-sm text-gray-300 font-normal">Free inside Battle Bunker app • Start today</span>
              </div>
              <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </a>
          </div>
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