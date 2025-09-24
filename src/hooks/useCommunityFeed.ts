import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface CommunityPost {
  id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  post_type: 'user_post' | 'submission_celebration' | 'admin_announcement';
  submission_id: string | null;
  created_at: string;
  full_name: string;
  organization: string | null;
  region: string;
  user_badges: Array<{ name: string; image_url: string; min_pull_ups: number }>;
  like_count: number;
  reply_count: number;
  engagement_score: number;
  user_has_liked: boolean;
  submission_data: {
    pull_up_count: number;
    video_url: string;
    platform: string;
    approved_at: string;
  } | null;
  load_time_ms: number;
  grouped?: boolean;
  replies?: CommunityPost[];
  isExpanded?: boolean;
}

interface UseCommunityFeedOptions {
  pageSize?: number;
  sortBy?: 'recent' | 'popular' | 'trending';
  enableRealtime?: boolean;
}

export const useCommunityFeed = (options: UseCommunityFeedOptions = {}) => {
  const { pageSize = 20, sortBy = 'recent', enableRealtime = true } = options;
  const { profile } = useAuth();
  
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageLoadTime: 0,
    totalRequests: 0,
    errorCount: 0
  });
  
  const realtimeSubscription = useRef<any>(null);
  const lastLoadTime = useRef(Date.now());

  const loadPosts = useCallback(async (offset = 0, replace = false) => {
    try {
      if (offset === 0) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const startTime = Date.now();
      
      const { data, error: fetchError } = await supabase.rpc(
        'get_community_feed_optimized',
        {
          limit_count: pageSize,
          offset_count: offset,
          sort_by: sortBy,
          user_context_id: profile?.id || null
        }
      );

      const loadTime = Date.now() - startTime;
      
      if (fetchError) {
        throw fetchError;
      }

      // Update performance metrics
      setPerformanceMetrics(prev => ({
        averageLoadTime: prev.totalRequests === 0 ? loadTime : (prev.averageLoadTime * prev.totalRequests + loadTime) / (prev.totalRequests + 1),
        totalRequests: prev.totalRequests + 1,
        errorCount: prev.errorCount
      }));

      if (replace || offset === 0) {
        setPosts(data || []);
      } else {
        setPosts(prev => [...prev, ...(data || [])]);
      }

      setHasMore((data || []).length === pageSize);
      lastLoadTime.current = Date.now();

      // Log performance to Supabase
      if (profile) {
        supabase.rpc('log_performance', {
          p_operation: 'community_feed_client',
          p_duration_ms: loadTime,
          p_success: true,
          p_metadata: { 
            user_id: profile.id, 
            post_count: (data || []).length,
            sort_by: sortBy 
          }
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load posts';
      setError(errorMessage);
      
      setPerformanceMetrics(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1
      }));

      console.error('Error loading community posts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [pageSize, sortBy, profile?.id]);

  const optimisticLikeToggle = useCallback(async (postId: string, currentlyLiked: boolean) => {
    if (!profile) return;

    // Optimistic update
    setPosts(prev => prev.map(post => 
      post.id === postId
        ? {
            ...post,
            like_count: currentlyLiked ? post.like_count - 1 : post.like_count + 1,
            user_has_liked: !currentlyLiked
          }
        : post
    ));

    try {
      if (currentlyLiked) {
        await supabase
          .from('community_post_likes')
          .delete()
          .match({ user_id: profile.id, post_id: postId });
      } else {
        await supabase
          .from('community_post_likes')
          .insert([{ user_id: profile.id, post_id: postId }]);
      }
    } catch (error) {
      // Revert optimistic update on error
      setPosts(prev => prev.map(post => 
        post.id === postId
          ? {
              ...post,
              like_count: currentlyLiked ? post.like_count + 1 : post.like_count - 1,
              user_has_liked: currentlyLiked
            }
          : post
      ));
      console.error('Error toggling like:', error);
    }
  }, [profile]);

  const createPost = useCallback(async (content: string, parentId?: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('community_posts')
        .insert([{
          content: content.trim(),
          user_id: profile.id,
          parent_id: parentId || null,
          post_type: 'user_post'
        }]);

      if (error) throw error;

      // Refresh feed after successful post
      setTimeout(() => loadPosts(0, true), 500);

    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }, [profile, loadPosts]);

  // Real-time subscription with throttling
  useEffect(() => {
    if (!enableRealtime || !profile) return;

    const throttledRefresh = () => {
      const now = Date.now();
      if (now - lastLoadTime.current > 2000) { // Throttle to max every 2 seconds
        loadPosts(0, true);
      }
    };

    realtimeSubscription.current = supabase
      .channel('community_realtime')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'community_posts' },
        throttledRefresh
      )
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'community_posts' },
        throttledRefresh
      )
      .subscribe();

    return () => {
      realtimeSubscription.current?.unsubscribe();
    };
  }, [enableRealtime, profile, loadPosts]);

  // Initial load
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Thread expansion functions
  const toggleThreadExpansion = useCallback(async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Toggle expansion state
    const newExpanded = !post.isExpanded;
    
    // Update the post's expansion state
    setPosts(currentPosts => 
      currentPosts.map(p => 
        p.id === postId 
          ? { ...p, isExpanded: newExpanded, replies: newExpanded ? p.replies : undefined }
          : p
      )
    );

    // If expanding and no replies loaded yet, fetch them
    if (newExpanded && (!post.replies || post.replies.length === 0) && post.reply_count > 0) {
      try {
        const { data: replies, error } = await supabase.rpc('get_thread', {
          p_parent_id: postId,
          p_limit: 20,
          p_offset: 0
        });

        if (error) throw error;

        // Update the post with fetched replies
        setPosts(currentPosts => 
          currentPosts.map(p => 
            p.id === postId 
              ? { ...p, replies: replies || [] }
              : p
          )
        );
      } catch (err) {
        console.error('Failed to load thread:', err);
      }
    }
  }, [posts]);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    error,
    performanceMetrics,
    actions: {
      loadMore: () => loadPosts(posts.length),
      refresh: () => loadPosts(0, true),
      toggleLike: optimisticLikeToggle,
      createPost,
      toggleThreadExpansion
    }
  };
};

export type { CommunityPost };
