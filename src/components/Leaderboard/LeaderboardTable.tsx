import React from "react";
import { Submission } from "../../types";
import { getBadgesForSubmission } from "../../data/mockData";

interface LeaderboardTableProps {
  data: Submission[];
  loading?: boolean;
  currentPage?: number;
  itemsPerPage?: number;
  showFilters?: boolean;
  filters?: any;
  onFilterChange?: (filters: any) => void;
  mobileCardMode?: boolean;
}

const PAGE_SIZE = 20;

// Helper function for gender-based badge image selection
const getBadgeImageUrl = (badgeName: string, gender: string): string => {
  if (gender === "Female") {
    // Use new female badge paths
    return `/${badgeName.toLowerCase()}femalebadge.webp`;
  } else {
    // Keep the same male badge paths
    return `/badge-${badgeName.toLowerCase()}-men-256.webp`;
  }
};

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  data,
  loading = false,
  currentPage = 1,
  itemsPerPage = PAGE_SIZE,
  mobileCardMode = false,
}) => {
  if (loading) {
    return <div className="text-center text-white py-8">Loading...</div>;
  }

  // Slim Mobile Card layout - MILITARY STYLE
  if (mobileCardMode) {
    return (
      <div className="space-y-4">
        {data.map((submission, index) => {
          const rank = (currentPage - 1) * itemsPerPage + index + 1;
          const badges = getBadgesForSubmission(submission.actualPullUpCount ?? submission.pullUpCount, submission.gender);
          const highestBadge = badges.length > 0 ? badges[badges.length - 1] : null;
          const pullUpCount = submission.actualPullUpCount ?? submission.pullUpCount ?? 0;

          // Enhanced rank styling for top performers
          const getRankStyling = (rank: number) => {
            if (rank === 1) return "bg-gradient-to-r from-yellow-600 to-yellow-500 text-black shadow-lg shadow-yellow-500/30";
            if (rank === 2) return "bg-gradient-to-r from-gray-400 to-gray-300 text-black shadow-lg shadow-gray-400/30";
            if (rank === 3) return "bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/30";
            return "bg-[#9b9b6f] text-black";
          };

          const getCardStyling = (rank: number) => {
            if (rank <= 3) return "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-l-4 border-l-[#9b9b6f] border border-[#9b9b6f]/30 shadow-xl shadow-[#9b9b6f]/20 rounded-lg";
            return "bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 border-l-4 border-l-[#9b9b6f] border border-gray-700 rounded-lg";
          };

          return (
            <div key={submission.id} className={`${getCardStyling(rank)} p-4 hover:bg-gray-800 hover:border-l-[#918f6f] hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`}>
              
              {/* TACTICAL HEADER BAR */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                  {/* RANK BADGE - MILITARY STYLE */}
                  <div className={`${getRankStyling(rank)} px-3 py-1 font-black text-lg font-mono tracking-widest shadow-lg`} 
                       style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)' }}>
                    #{rank.toString().padStart(2, '0')}
                  </div>
                  
                  {/* OPERATIVE NAME */}
                  <div>
                    <div className="text-white font-black text-xl uppercase tracking-wider font-mono">
                      {submission.fullName}
                    </div>
                    <div className="text-[#9b9b6f] text-sm font-mono tracking-widest">
                      OPERATIVE • ID: {submission.id ? submission.id.toString().slice(-4) : '0000'}
                    </div>
                  </div>
                </div>

                {/* PERFORMANCE METRICS */}
                <div className="text-right">
                  <div className="text-4xl font-black text-[#9b9b6f] font-mono leading-none">
                    {pullUpCount.toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-[0.2em] font-mono font-bold">
                    REPS COMPLETED
                  </div>
                </div>
              </div>

              {/* MAIN CONTENT GRID */}
              <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
                
                {/* ACHIEVEMENT BADGE - PROMINENT */}
                <div className="flex flex-col items-center">
                  {highestBadge ? (
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-full border-4 border-[#9b9b6f] shadow-2xl shadow-[#9b9b6f]/40 overflow-hidden bg-gray-900/90 group-hover:scale-105 transition-transform duration-300">
                        <img
                          src={getBadgeImageUrl(highestBadge.id, submission.gender)}
                          alt={highestBadge.name}
                          title={highestBadge.name}
                          className="w-full h-full scale-125 object-contain p-1"
                          onError={(e) => {
                            console.error('Badge image failed to load:', e.currentTarget.src);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-[#9b9b6f] text-black px-2 py-0.5 rounded-full text-xs font-bold font-mono">
                        {highestBadge.name.toUpperCase()}
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gray-700 border-4 border-gray-600 flex flex-col items-center justify-center shadow-lg">
                      <div className="text-gray-500 text-xs font-mono font-bold">NO RANK</div>
                      <div className="text-gray-600 text-xs font-mono">EARNED</div>
                    </div>
                  )}
                </div>

                {/* INTEL SECTION */}
                <div className="space-y-1.5">
                  
                  {/* PERSONAL DATA */}
                  <div className="bg-gray-800/60 border border-gray-600/50 rounded p-1.5">
                    <div className="text-[#9b9b6f] text-xs font-mono font-bold tracking-widest mb-0.5 uppercase">
                      PERSONAL DATA
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-900 border border-[#9b9b6f]/40 text-sm text-gray-300 font-mono tracking-wider rounded">
                        <span className="w-2 h-2 bg-[#9b9b6f] rounded-full animate-pulse"></span>
                        AGE: {submission.age || 0}Y
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-900 border border-[#9b9b6f]/40 text-sm text-gray-300 font-mono tracking-wider rounded">
                        <span className="w-2 h-2 bg-[#9b9b6f] rounded-full animate-pulse"></span>
                        {(submission.gender || 'UNKNOWN').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* DEPLOYMENT INFO */}
                  <div className="grid grid-cols-2 gap-1">
                    <div className="bg-gray-800/40 border border-gray-600/30 rounded p-1">
                      <div className="text-[#9b9b6f] text-xs font-mono font-bold uppercase tracking-wider mb-0.5">
                        CLUB
                      </div>
                      <div className="text-white text-base font-mono font-bold truncate">
                        {submission.organization || 'INDEPENDENT'}
                      </div>
                    </div>
                    <div className="bg-gray-800/40 border border-gray-600/30 rounded p-1">
                      <div className="text-[#9b9b6f] text-xs font-mono font-bold uppercase tracking-wider mb-0.5">
                        REGION
                      </div>
                      <div className="text-white text-base font-mono font-bold truncate">
                        {(submission.region || 'UNKNOWN').toUpperCase()}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* ACTION BAR */}
              <div className="mt-4 pt-3 border-t border-gray-700/50 flex justify-end">
                {submission.videoUrl ? (
                  <a
                    href={submission.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gradient-to-r from-[#9b9b6f] to-[#918f6f] hover:from-[#918f6f] hover:to-[#7a7a58] text-black px-6 py-2 font-black font-mono uppercase tracking-widest transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)' }}
                  >
                    ► REVIEW FOOTAGE
                  </a>
                ) : (
                  <div className="bg-gray-700 text-gray-400 px-6 py-2 font-mono uppercase tracking-widest text-sm">
                    NO FOOTAGE AVAILABLE
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>
    );
  }

  // Table layout for desktop
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-gray-800 text-gray-400 text-left text-sm uppercase">
            <th className="px-6 py-3">Rank</th>
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Club</th>
            <th className="px-6 py-3">Region</th>
            <th className="px-6 py-3">Details</th>
            <th className="px-6 py-3 text-center">Pull-Ups</th>
            <th className="px-6 py-3 text-center">Badge</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">VIDEO</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {data.map((submission, index) => {
            const rank = (currentPage - 1) * itemsPerPage + index + 1;
            const badges = getBadgesForSubmission(submission.actualPullUpCount ?? submission.pullUpCount, submission.gender);
            const highestBadge = badges.length > 0 ? badges[badges.length - 1] : null;
            return (
              <tr key={submission.id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-[#9b9b6f]">{rank}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-white font-medium">{submission.fullName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-300">{submission.organization || 'None'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-300">{submission.region}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <div className="text-gray-500">{submission.age} years • {submission.gender}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-xl font-bold text-white">{submission.actualPullUpCount ?? submission.pullUpCount}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {highestBadge ? (
                      <img
                        key={highestBadge.id}
                        src={getBadgeImageUrl(highestBadge.id, submission.gender)}
                        alt={highestBadge.name}
                        title={highestBadge.name}
                        className="h-24 w-24 object-contain"
                        onError={(e) => {
                          console.error('Badge image failed to load:', e.currentTarget.src);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  {submission.videoUrl ? (
                    <a
                      href={submission.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-[#9b9b6f] text-[#9b9b6f] hover:bg-[#9b9b6f] hover:text-black transition-colors"
                    >
                      View Video
                    </a>
                  ) : (
                    <span className="text-gray-500 text-sm">No video</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LeaderboardTable; 