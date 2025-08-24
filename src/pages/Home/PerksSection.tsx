import React from 'react';
import { Award, Shield, Trophy, Medal, ShoppingBag, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PerksSection: React.FC = () => {
  const { t } = useTranslation('home');

  const perks = [
    {
      icon: <Shield size={48} className="text-[#9b9b6f]" />,
      title: t('perks.perk1.title'),
      description: t('perks.perk1.description')
    },
    {
      icon: <Award size={48} className="text-[#9b9b6f]" />,
      title: t('perks.perk2.title'),
      description: t('perks.perk2.description')
    },
    {
      icon: <Trophy size={48} className="text-[#9b9b6f]" />,
      title: t('perks.perk3.title'),
      description: t('perks.perk3.description')
    },
    {
      icon: <Medal size={48} className="text-[#9b9b6f]" />,
      title: t('perks.perk4.title'),
      description: t('perks.perk4.description')
    },
    {
      icon: <ShoppingBag size={48} className="text-[#9b9b6f]" />,
      title: t('perks.perk5.title'),
      description: t('perks.perk5.description')
    },
    {
      icon: <Share2 size={48} className="text-[#9b9b6f]" />,
      title: t('perks.perk6.title'),
      description: t('perks.perk6.description')
    }
  ];

  return (
    <section className="bg-black py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">{t('perks.title')}</h2>
          <div className="w-20 h-1 bg-[#9b9b6f] mx-auto mt-4 mb-6"></div>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t('perks.subtitle')}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {perks.map((perk, index) => (
            <div 
              key={index} 
              className="bg-gray-900 p-6 rounded-lg transform transition-transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-4">
                  {perk.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{perk.title}</h3>
                <p className="text-gray-400">{perk.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PerksSection;