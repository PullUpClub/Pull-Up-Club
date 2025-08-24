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
        
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          {/* YouTube Video */}
          <div className="w-full lg:w-1/2 order-last lg:order-first">
            <VideoErrorBoundary>
              <VideoEmbed embedId="1099844021" platform="vimeo" autoplayOnScroll={true} />
            </VideoErrorBoundary>
          </div>

          {/* Steps */}
          <div className="w-full lg:w-1/2">
            <div className="grid grid-cols-1 gap-8">
              {steps.map((step, index) => (
                <div 
                  key={index} 
                  className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105"
                >
                  <div className="flex justify-center mb-4">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;