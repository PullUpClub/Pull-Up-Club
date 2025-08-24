import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

interface PoolData {
  remaining_dollars: string;
  total_dollars: string;
  spent_dollars: string;
  progress_percentage: number;
  is_depleted: boolean;
}

const PUCBankBanner: React.FC = () => {
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation('leaderboard');

  const fetchPoolStatus = async () => {
    try {
      console.log('🏦 Fetching pool status...');
      const { data, error } = await supabase.functions.invoke('get-pool-status');
      
      console.log('📊 Pool status response:', { data, error });
      
      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }
      
      if (data?.success) {
        console.log('✅ Pool data received:', data.pool);
        
        // Handle dollar-based API with fallbacks
        const poolData = {
          remaining_dollars: data.pool.remaining_dollars || '250',
          total_dollars: data.pool.total_dollars || '250', 
          spent_dollars: data.pool.spent_dollars || '0',
          progress_percentage: isNaN(data.pool.progress_percentage) ? 0 : data.pool.progress_percentage,
          is_depleted: data.pool.is_depleted || false
        };
        
        console.log('🔢 Processed pool data:', poolData);
        setPoolData(poolData);
        setError(null);
      } else {
        console.error('❌ Edge function returned failure:', data);
        throw new Error(data?.error || 'Failed to fetch pool status');
      }
    } catch (err) {
      console.error('💥 Error fetching pool status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pool status');
      
      // Show fallback data instead of hiding completely
      console.log('🔄 Using fallback data');
      setPoolData({
        remaining_dollars: '250',
        total_dollars: '250',
        spent_dollars: '0', 
        progress_percentage: 0,
        is_depleted: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPoolStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center mb-6">
        <div className="bg-gray-900/50 border border-[#9b9b6f]/20 rounded-full px-4 py-1 animate-pulse">
          <div className="h-4 bg-[#9b9b6f]/20 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (error && !poolData) {
    return null; // Fail silently for better UX
  }

  return (
    <div className="flex justify-center mb-6">
      {poolData?.is_depleted ? (
        // DEPLETED State - Larger pill
        <div className="bg-gray-900/50 border border-red-500/30 rounded-full px-6 py-2 shadow-lg shadow-red-500/10">
          <div className="flex items-center space-x-3 text-base">
            <span className="text-red-400 text-xl">💸</span>
            <span className="text-red-400 font-bold text-xl">{t('pucBank.poolDepleted')}</span>
          </div>
        </div>
      ) : (
        // ACTIVE State - Larger pill
        <div className="bg-gray-900/50 border-2 border-[#9b9b6f]/30 rounded-full px-6 py-2 shadow-lg shadow-[#9b9b6f]/10">
          <div className="flex items-center space-x-4 text-base">
            <div className="flex items-center space-x-2">
              <span className="text-xl">🏦</span>
              <span className="text-[#9b9b6f] font-bold text-2xl">{t('pucBank.title')}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold text-xl">
                ${poolData?.remaining_dollars}
              </span>
              <span className="text-gray-400">/</span>
              <span className="text-[#9b9b6f] text-xl">
                ${poolData?.total_dollars}
              </span>
            </div>


          </div>
        </div>
      )}
    </div>
  );
};

export default PUCBankBanner; 