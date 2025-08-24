import React from "react";
import badges, { femaleBadges } from "../../data/mockData";
import { Award } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";

const BadgeLegend: React.FC = () => {
  const { t } = useTranslation('leaderboard');
  
  // Helper function to get requirements for both genders
  const getBadgeRequirements = (badgeId: string) => {
    const maleBadge = badges.find(b => b.id === badgeId);
    const femaleBadge = femaleBadges.find(b => b.id === badgeId);
    return {
      male: maleBadge?.criteria.value || 0,
      female: femaleBadge?.criteria.value || 0
    };
  };
  
  // Helper function to get the correct image path for new cropped badges
  const getBadgeImagePath = (badgeId: string) => {
    const imageMap: { [key: string]: string } = {
      'elite': '/optimized-avatars/New Cropped Elite.webp',
      'hardened': '/optimized-avatars/New Cropped Hardened.webp',
      'operator': '/optimized-avatars/New Cropped Operator.webp',
      'proven': '/optimized-avatars/New Cropped Proven (1).webp',
      'recruit': '/optimized-avatars/New Cropped Recruit.webp'
    };
    return imageMap[badgeId.toLowerCase()] || `/badge-${badgeId.toLowerCase()}-men-256.webp`;
  };
  
  // Sort badges to ensure Elite is last for mobile layout
  const sortedBadges = [...badges].sort((a, b) => {
    if (a.id.toLowerCase() === 'elite') return 1;
    if (b.id.toLowerCase() === 'elite') return -1;
    return 0;
  });
  
  return (
    <div className="bg-gray-900 p-4 rounded-lg mb-6">
      <div className="flex items-center mb-4">
        <Award size={20} className="text-[#9b9b6f] mr-2" />
        <h3 className="text-white text-lg font-medium">{t('badgeLegend.title')}</h3>
      </div>
      
      {/* Mobile layout: 2-2-1 */}
      <div className="mt-4 sm:hidden">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {sortedBadges.slice(0, 4).map((badge: any) => (
            <div
              key={badge.id}
              className="flex flex-col items-center text-center"
            >
              <img
                src={getBadgeImagePath(badge.id)}
                alt={badge.name}
                className="w-40 h-40 mb-0 object-contain"
              />
              <div className="text-white text-sm space-y-0">
                <div className="font-bold">
                  <Trans
                    i18nKey="badgeLegend.menPullUps"
                    t={t}
                    values={{ count: getBadgeRequirements(badge.id).male }}
                    components={[<span className="font-bold text-white"/>]}
                  />
                </div>
                <div className="font-bold">
                  <Trans
                    i18nKey="badgeLegend.womenPullUps"
                    t={t}
                    values={{ count: getBadgeRequirements(badge.id).female }}
                    components={[<span className="font-bold text-white"/>]}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Elite badge centered */}
        <div className="flex justify-center">
          {sortedBadges.slice(4).map((badge: any) => (
            <div
              key={badge.id}
              className="flex flex-col items-center text-center"
            >
              <img
                src={getBadgeImagePath(badge.id)}
                alt={badge.name}
                className="w-40 h-40 mb-0 object-contain"
              />
              <div className="text-white text-sm space-y-0">
                <div className="font-bold">
                  <Trans
                    i18nKey="badgeLegend.menPullUps"
                    t={t}
                    values={{ count: getBadgeRequirements(badge.id).male }}
                    components={[<span className="font-bold text-white"/>]}
                  />
                </div>
                <div className="font-bold">
                  <Trans
                    i18nKey="badgeLegend.womenPullUps"
                    t={t}
                    values={{ count: getBadgeRequirements(badge.id).female }}
                    components={[<span className="font-bold text-white"/>]}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Tablet and Desktop layout: unchanged */}
      <div className="mt-4 hidden sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {badges.map((badge: any) => (
          <div
            key={badge.id}
            className="flex flex-col items-center text-center"
          >
            <img
              src={getBadgeImagePath(badge.id)}
              alt={badge.name}
              className="w-40 h-40 lg:w-36 lg:h-36 mb-0 object-contain"
            />
            <div className="text-white text-sm space-y-0">
              <div className="font-bold">
                <Trans
                  i18nKey="badgeLegend.menPullUps"
                  t={t}
                  values={{ count: getBadgeRequirements(badge.id).male }}
                  components={[<span className="font-bold text-white"/>]}
                />
              </div>
              <div className="font-bold">
                <Trans
                  i18nKey="badgeLegend.womenPullUps"
                  t={t}
                  values={{ count: getBadgeRequirements(badge.id).female }}
                  components={[<span className="font-bold text-white"/>]}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BadgeLegend;
