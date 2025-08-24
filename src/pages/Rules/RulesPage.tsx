import React from "react";
import Layout from "../../components/Layout/Layout";
import CompetitionRules from "../Submission/CompetitionRules";
import { useTranslation } from "react-i18next";
import Head from "../../components/Layout/Head";

const RulesPage: React.FC = () => {
  const { t } = useTranslation('rules');

  return (
    <Layout>
      <Head>
        <title>{t("meta.title")}</title>
        <meta name="description" content={t("meta.description")} />
      </Head>
      <div className="bg-black py-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-extrabold text-white tracking-tight">{t('title')}</h1>
            <p className="mt-2 text-gray-400">
              {t('subtitle')}
            </p>
          </div>

          <CompetitionRules />
        </div>
      </div>
    </Layout>
  );
};

export default RulesPage;
