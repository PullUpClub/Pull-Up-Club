import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ExternalLink, Lock, CheckCircle, Star, Target, Shield, Circle, Trophy } from 'lucide-react';

interface PatchConfig {
  id: string;
  name: string;
  description: string;
  requiredBillingDays: number;
  tier: string;
  icon: string;
  position: 'top' | 'bottom';
  shopifyUrl: string;
}

interface PatchStatus {
  config: PatchConfig;
  isUnlocked: boolean;
  isClaimed: boolean;
  daysRemaining: number;
}

interface EligibilityData {
  isEligible: boolean;
  reason?: string;
  billingDays: number;
  billingStartDate: string | null;
  stripeCustomerId: string | null;
  patches: PatchStatus[];
}

// Icon mapping function to convert string names to components
const getIconComponent = (iconName: string | React.ComponentType<any>) => {
  if (typeof iconName === 'string') {
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      'Shield': Shield,
      'Trophy': Trophy,
      'Target': Target,
      'Star': Star,
      'Circle': Circle
    };
    return iconMap[iconName] || Circle;
  }
  return iconName || Circle;
};

const PATCH_ROADMAP: PatchConfig[] = [
  {
    id: 'warrior',
    name: 'Warrior Patch', 
    description: '3 months of battle-tested commitment',
    requiredBillingDays: 90,
    tier: '3-Month',
    icon: 'Shield',
    position: 'bottom',
    shopifyUrl: 'https://shop.thebattlebunker.com/discount/PULLUPCLUB100?redirect=/products/3-months-in-pullupclub-com'
  },
  {
    id: 'champion',
    name: 'Champion Patch',
    description: '6 months of unwavering dedication',
    requiredBillingDays: 180,
    tier: '6-Month',
    icon: 'Trophy',
    position: 'top',
    shopifyUrl: 'https://shop.thebattlebunker.com/discount/PULLUPCLUB100?redirect=/products/6-months-in-patch-pullupclub-com'
  },
  {
    id: 'guardian',
    name: 'Guardian Patch',
    description: '9 months of defending excellence', 
    requiredBillingDays: 270,
    tier: '9-Month',
    icon: 'Target',
    position: 'bottom',
    shopifyUrl: 'https://shop.thebattlebunker.com/discount/PULLUPCLUB100?redirect=/products/9-months-in-patch-pullupclub-com'
  },
  {
    id: 'immortal',
    name: 'Immortal Patch',
    description: 'Full year of legendary status',
    requiredBillingDays: 365,
    tier: '12-Month',
    icon: 'Star',
    position: 'top',
    shopifyUrl: 'https://shop.thebattlebunker.com/discount/PULLUPCLUB100?redirect=/products/12-months-in-patch-pullupclub-com'
  }
];

const PatchCard: React.FC<{
  patch: PatchStatus;
  onClaim: () => void;
  isLoading: boolean;
  index: number;
}> = ({ patch, onClaim, isLoading, index }) => {
  const getCardState = () => {
    if (patch.isClaimed) return 'claimed';
    if (patch.isUnlocked) return 'unlocked';
    return 'locked';
  };

  const cardState = getCardState();
  const IconComponent = getIconComponent(patch.config.icon);
  
  // Organized staggering pattern for 4 cards - creates a smooth wave
  const staggerOffsets = [0, -12, 8, -16]; // Specific offsets for each card position
  const wavyOffset = staggerOffsets[index] || 0;

  return (
    <div 
      className="flex flex-col items-center relative"
      style={{
        transform: `translateY(${wavyOffset}px)`,
        zIndex: cardState === 'unlocked' ? 10 : cardState === 'claimed' ? 8 : 5
      }}
    >
      {/* Connection Line to Next Patch */}
      {index < PATCH_ROADMAP.length - 1 && (
        <div className="absolute top-1/2 left-full w-8 lg:w-10 xl:w-12">
          <svg 
            className="w-full h-4" 
            viewBox="0 0 100 16" 
            preserveAspectRatio="none"
          >
            <path
              d={`M 0 8 Q 25 ${index === 0 ? 12 : index === 1 ? 2 : index === 2 ? 14 : 8} 50 8 Q 75 ${index === 0 ? 4 : index === 1 ? 14 : index === 2 ? 2 : 8} 100 8`}
              stroke={cardState === 'claimed' ? '#9b9b6f' : '#374151'}
              strokeWidth="1.5"
              fill="none"
              className="transition-colors duration-500"
            />
          </svg>
        </div>
      )}

      {/* Patch Card */}
      <div className={`
        relative rounded-xl p-4 w-36 md:w-40 lg:w-44 transition-all duration-500 group backdrop-blur-sm
        ${cardState === 'claimed' ? 'border border-[#9b9b6f] bg-gradient-to-br from-[#9b9b6f]/20 to-[#9b9b6f]/5 shadow-[0_0_15px_rgba(155,155,111,0.2)]' : 
          cardState === 'unlocked' ? 'border border-[#9b9b6f] bg-gradient-to-b from-gray-800 to-gray-900 hover:shadow-[0_0_20px_rgba(155,155,111,0.15)] hover:scale-105 cursor-pointer' :
          'border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 opacity-60'}
      `}>
        
        {/* Icon and Content */}
        <div className="text-center space-y-3">
          {/* Badge Icon */}
          <div className={`
            flex justify-center transition-all duration-500
            ${cardState === 'claimed' ? '' :
              cardState === 'unlocked' ? 'drop-shadow-[0_0_8px_rgba(155,155,111,0.5)]' : 'grayscale opacity-40'}
          `}>
            <div className={`
              p-3 rounded-full border transition-all duration-500
              ${cardState === 'claimed' ? 'border-[#9b9b6f] bg-[#9b9b6f]/20 shadow-[0_0_10px_rgba(155,155,111,0.3)]' :
                cardState === 'unlocked' ? 'border-[#9b9b6f] bg-[#9b9b6f]/10' :
                'border-gray-800 bg-gray-900'}
            `}>
              <IconComponent 
                size={20} 
                className={`
                  transition-colors duration-500
                  ${cardState === 'claimed' ? 'text-[#9b9b6f]' :
                    cardState === 'unlocked' ? 'text-[#9b9b6f]' :
                    'text-gray-500'}
                `}
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <h4 className={`
              font-bold text-sm leading-tight transition-colors duration-300
              ${cardState === 'claimed' ? 'text-[#9b9b6f]' :
                cardState === 'unlocked' ? 'text-white' : 'text-gray-500'}
            `}>
              {patch.config.name}
            </h4>
            
            <div className={`
              text-[10px] tracking-wider uppercase font-medium px-2 py-0.5 rounded-full inline-block mt-2
              ${cardState === 'claimed' ? 'bg-[#9b9b6f]/20 text-[#9b9b6f] border border-[#9b9b6f]/30' :
                cardState === 'unlocked' ? 'bg-gray-800 text-gray-300 border border-gray-700' :
                'bg-gray-900 text-gray-600 border border-gray-800'}
            `}>
              {patch.config.tier}
            </div>
          </div>
        </div>

        {/* Action Button/Status */}
        <div className="mt-3">
          {cardState === 'claimed' ? (
            <div className="flex items-center justify-center gap-1 text-[#9b9b6f] text-xs font-medium">
              <CheckCircle size={12} />
              <span>CLAIMED</span>
            </div>
          ) : cardState === 'unlocked' ? (
            <button
              onClick={onClaim}
              disabled={isLoading}
              className="bg-[#9b9b6f] hover:bg-[#a5a575] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-2 px-2 rounded text-xs transition-all duration-300 w-full flex items-center justify-center gap-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-black border-t-transparent"></div>
                  <span>...</span>
                </>
              ) : (
                <>
                  <span>CLAIM</span>
                  <ExternalLink size={10} />
                </>
              )}
            </button>
          ) : (
            <div className="space-y-1 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                <Lock size={10} />
                <span>LOCKED</span>
              </div>
              <div className="text-gray-400 text-xs">
                {patch.daysRemaining}d left
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        {cardState === 'unlocked' && (
          <div className="absolute -top-1.5 -right-1.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9b9b6f] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#9b9b6f]"></span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const PatchRoadmap: React.FC = () => {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingPatch, setClaimingPatch] = useState<string | null>(null);

  const fetchEligibility = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      
      const response = await supabase.functions.invoke('validate-patch-eligibility');
      
      if (response.error) throw response.error;
      
      setEligibility(response.data);
      
    } catch (err) {
      console.error('Error fetching patch eligibility:', err);
      toast.error('Failed to load patch information');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEligibility();
  }, [user?.id]);

  const handleClaimPatch = async (patchId: string) => {
    if (!user?.id || claimingPatch) return;

    const patch = PATCH_ROADMAP.find(p => p.id === patchId);
    if (!patch) return;

    setClaimingPatch(patchId);

    try {
      // Log the claim attempt to track interest
      const { error } = await supabase.functions.invoke('log-patch-claim-attempt', {
        body: { 
          patch_type: patchId,
          user_id: user.id
        }
      });

      if (error) {
        console.error('Error logging claim attempt:', error);
        // Don't block the user from opening the shop if logging fails
      }

      // Open Shopify store in new tab - webhook will handle marking as claimed
      window.open(patch.shopifyUrl, '_blank');
      
      toast.success(`Opening ${patch.name} claim page...`, {
        icon: '🎖️',
        duration: 3000
      });
      
    } catch (err: any) {
      console.error('Error claiming patch:', err);
      toast.error('Failed to open claim page. Please try again.');
    } finally {
      setClaimingPatch(null);
    }
  };


  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 mb-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-1/3 mb-4 mx-auto"></div>
          <div className="h-4 bg-gray-800 rounded w-2/3 mb-8 mx-auto"></div>
          <div className="flex justify-center gap-8">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-40 h-48 bg-gray-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!eligibility?.isEligible) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 mb-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Patch Collection Journey</h2>
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 mb-6 max-w-2xl mx-auto">
            <h3 className="text-red-400 font-bold mb-2">Subscription Required</h3>
            <p className="text-red-300">
              {eligibility?.reason || 'Active subscription required to access exclusive patch rewards'}
            </p>
          </div>
          
          {/* Show roadmap preview but locked */}
          <div className="w-full">
            <div className="flex justify-center items-center gap-4 lg:gap-6 py-8 px-4 max-w-6xl mx-auto">
              {PATCH_ROADMAP.map((patch, index) => {
                const IconComponent = getIconComponent(patch.icon);
                const staggerOffsets = [0, -8, 6, -12]; // Matching pattern but smaller for locked state
                const wavyOffset = staggerOffsets[index] || 0;
                
                return (
                  <div 
                    key={patch.id} 
                    className="flex flex-col items-center relative opacity-50"
                    style={{ transform: `translateY(${wavyOffset}px)` }}
                  >
                    <div className="bg-gray-800 rounded-lg p-4 w-36 md:w-40 border-2 border-gray-700">
                      <div className="text-center space-y-2">
                        <div className="flex justify-center">
                          <div className="p-2 rounded-full border-2 border-gray-600 bg-gray-800">
                            <IconComponent size={16} className="text-gray-500" />
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-gray-500">{patch.name}</h4>
                          <p className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full inline-block mt-1">
                            {patch.tier}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-gray-600 text-xs">
                          <Lock size={10} />
                          <span>LOCKED</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Connection line */}
                    {index < PATCH_ROADMAP.length - 1 && (
                      <div className="absolute top-1/2 left-full w-8">
                        <div className="w-full h-0.5 bg-gray-700"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const claimedCount = eligibility.patches.filter(p => p.isClaimed).length;
  const nextPatch = eligibility.patches.find(p => !p.isUnlocked && !p.isClaimed);

  return (
    <div className="bg-gray-900 rounded-xl p-4 md:p-6 mb-8 overflow-hidden">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <img 
            src="/PUClogo-optimized.webp" 
            alt="Pull-Up Club Logo" 
            className="h-10 w-auto"
          />
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Your Patch Collection Journey
          </h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-sm mb-3">
          <div className="flex items-center gap-2 bg-[#9b9b6f]/10 px-3 py-1.5 rounded-full">
            <CheckCircle size={14} className="text-[#9b9b6f]" />
            <span className="text-[#9b9b6f] font-medium">Active Subscription</span>
          </div>
          <div className="bg-gray-800 px-3 py-1.5 rounded-full">
            <span className="text-gray-300">Day {eligibility.billingDays} of 365</span>
          </div>
          <div className="bg-gray-800 px-3 py-1.5 rounded-full">
            <span className="text-gray-300">{claimedCount} of 4 patches claimed</span>
          </div>
        </div>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm">
          Earn exclusive patches by maintaining your Pull-Up Club subscription. Each milestone unlocks a new piece of your legacy.
        </p>
      </div>

      {/* Desktop: Compact Roadmap */}
      <div className="hidden md:block">
        <div className="w-full">
          <div className="flex justify-center items-center gap-4 lg:gap-6 xl:gap-8 py-12 px-4 max-w-6xl mx-auto">
            {eligibility.patches.map((patch, index) => (
              <PatchCard
                key={patch.config.id}
                patch={patch}
                onClaim={() => handleClaimPatch(patch.config.id)}
                isLoading={claimingPatch === patch.config.id}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: Horizontal Scroll */}
      <div className="md:hidden">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 px-4 min-w-max">
            {eligibility.patches.map((patch) => (
              <PatchCard
                key={patch.config.id}
                patch={patch}
                onClaim={() => handleClaimPatch(patch.config.id)}
                isLoading={claimingPatch === patch.config.id}
                index={0} // No wavy effect on mobile
              />
            ))}
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="mt-8 text-center space-y-3">
        <div className="flex justify-center items-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#9b9b6f] rounded-full"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle size={12} />
            <span>Claimed</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock size={12} />
            <span>Locked</span>
          </div>
        </div>
        
        {nextPatch && (
          <div className="bg-gray-800 rounded-lg p-3 max-w-md mx-auto">
            <p className="text-[#9b9b6f] font-medium text-sm">Next Unlock</p>
            <p className="text-white text-sm">{nextPatch.config.name} in {nextPatch.daysRemaining} days</p>
          </div>
        )}
        
        {!nextPatch && claimedCount < 4 && (
          <div className="bg-gray-800 rounded-lg p-3 max-w-md mx-auto">
            <p className="text-[#9b9b6f] font-medium text-sm">All Available Patches Unlocked</p>
            <p className="text-white text-sm">Continue your subscription to unlock more</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatchRoadmap;
