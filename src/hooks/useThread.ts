import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface ThreadPost {
  id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  full_name: string;
  organization: string | null;
  user_badges: Array<{ name: string; image_url: string; min_pull_ups: number }>;
}

export const useThread = () => {
  const [threadPosts, setThreadPosts] = useState<ThreadPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = useCallback(async (parentId: string, limit = 20, offset = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.rpc('get_thread', {
        p_parent_id: parentId,
        p_limit: limit,
        p_offset: offset
      });

      if (fetchError) throw fetchError;
      
      if (offset === 0) {
        setThreadPosts(data || []);
      } else {
        setThreadPosts(prev => [...prev, ...(data || [])]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearThread = useCallback(() => {
    setThreadPosts([]);
    setError(null);
  }, []);

  return {
    threadPosts,
    loading,
    error,
    fetchThread,
    clearThread
  };
};
