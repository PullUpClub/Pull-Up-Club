import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Channel {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  position: number;
  is_private: boolean;
}

export const useChannels = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('channels')
          .select('*')
          .order('position', { ascending: true });

        if (error) throw error;

        setChannels(data || []);
      } catch (err) {
        console.error('Error fetching channels:', err);
        setError('Failed to load channels');
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  return { channels, loading, error };
};

