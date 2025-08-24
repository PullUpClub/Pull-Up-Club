import React, { useRef, useEffect } from "react";
import Layout from "../components/Layout/Layout";
import Head from "../components/Layout/Head";
import { Shield, Users, Activity } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { useMetaTracking } from '../hooks/useMetaTracking';

const EthosPage: React.FC = () => {
  const { t } = useTranslation("ethos");
  const { trackViewContent } = useMetaTracking();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackViewContent({}, {
        name: 'Ethos Page',
        category: 'ethos',
        type: 'page'
      }).catch(() => {});
    }
  }, [trackViewContent]);
  return (
    <Layout>
      <Head>
        <title>{t("hero.title")} | Pull-Up Club</title>
        <meta name="description" content={t("cta.subtitle")}/>
        <meta property="og:image" content="/NewWebp-Pics/TheLegendofAlkeios-min.webp" />
        <meta property="og:title" content={`${t("hero.title")} | Pull-Up Club`} />
        <meta property="og:description" content={t("cta.subtitle")} />
        <link rel="canonical" href="https://yourdomain.com/ethos" />
      </Head>
      {/* Hero/Legend Section - Two Column Layout */}
      <section className="bg-black py-0 md:py-20 px-0 md:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12 items-stretch min-h-[60vh]">
          {/* Image Left */}
          <div className="relative min-h-[320px] md:min-h-0 flex items-stretch">
            <img
              src="/NewWebp-Pics/TheLegendofAlkeios-min.webp"
              alt="The Legend of Alkeios - Battle Bunker"
              className="w-full h-full object-cover object-center rounded-none md:rounded-l-2xl shadow-xl brightness-110"
              style={{ minHeight: '320px', maxHeight: '600px' }}
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60 md:from-black/20 md:to-black/60" />
          </div>
          {/* Story Right */}
          <div className="flex flex-col justify-center px-6 py-12 md:py-0 bg-[#181818] md:bg-transparent rounded-none md:rounded-r-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-[#9b9b6f] mb-2 text-left md:text-left">
              {t("legend.title")}
            </h2>
            <div className="text-lg md:text-xl text-gray-400 mb-6 font-semibold tracking-wide text-left md:text-left">
              (Battle Bunker Official Lore)
            </div>
            <div className="text-lg md:text-xl text-gray-300 leading-relaxed md:leading-relaxed font-serif space-y-4" style={{lineHeight:1.7}}>
              <p>
                <Trans i18nKey="legend.quote1" t={t} components={[<strong className="text-white"/>]} />
              </p>
              <p>{t("legend.quote2")}</p>
              <p>{t("legend.summary")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Purpose Section */}
      <section className="bg-black py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[#9b9b6f] mb-8 text-center">
            {t("purpose.title")}
          </h2>
          <p className="text-gray-200 text-lg md:text-xl text-center mb-10 max-w-2xl mx-auto">
            {t("purpose.intro")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105">
              <div className="flex justify-center mb-4">
                <Shield size={48} className="text-[#9b9b6f]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t("purpose.pillars.trainToSave.title")}</h3>
              <p className="text-gray-400">{t("purpose.pillars.trainToSave.desc")}</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105">
              <div className="flex justify-center mb-4">
                <Users size={48} className="text-[#9b9b6f]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t("purpose.pillars.strengthToLift.title")}</h3>
              <p className="text-gray-400">{t("purpose.pillars.strengthToLift.desc")}</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg text-center transform transition-transform hover:scale-105">
              <div className="flex justify-center mb-4">
                <Activity size={48} className="text-[#9b9b6f]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t("purpose.pillars.disciplineToOvercome.title")}</h3>
              <p className="text-gray-400">{t("purpose.pillars.disciplineToOvercome.desc")}</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default EthosPage; 