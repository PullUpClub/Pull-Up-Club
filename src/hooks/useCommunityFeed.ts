import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

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
  channel_id?: string;
}

interface UseCommunityFeedOptions {
  pageSize?: number;
  sortBy?: 'recent' | 'popular' | 'trending';
  enableRealtime?: boolean;
  channelSlug?: string;
}

export const useCommunityFeed = (options: UseCommunityFeedOptions = {}) => {
  const { pageSize = 20, sortBy = 'recent', enableRealtime = true, channelSlug = 'the-arena' } = options;
  const { profile } = useAuth();
  
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  
  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageLoadTime: 0,
    totalRequests: 0,
    errorCount: 0
  });
  
  const realtimeSubscription = useRef<any>(null);
  const lastLoadTime = useRef(Date.now());

  // Fetch channel ID when slug changes - CRITICAL FOR SENDING MESSAGES
  useEffect(() => {
    const fetchChannelId = async () => {
      if (!channelSlug) {
        console.warn('No channel slug provided');
        return;
      }
      
      console.log('Fetching channel ID for slug:', channelSlug);
      const { data, error } = await supabase
        .from('channels')
        .select('id')
        .eq('slug', channelSlug)
        .single();
      
      if (error) {
        console.error('Error fetching channel:', error);
        setError('Failed to load channel');
        return;
      }
      
      if (data) {
        console.log('Channel ID fetched successfully:', data.id);
        setChannelId(data.id);
      } else {
        console.error('Channel not found:', channelSlug);
        setError(`Channel "${channelSlug}" not found`);
      }
    };
    
    // Reset channel ID when slug changes
    setChannelId(null);
    fetchChannelId();
  }, [channelSlug]);

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
        'get_channel_feed',
        {
          channel_slug: channelSlug,
          limit_count: pageSize,
          offset_count: offset,
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
  }, [pageSize, sortBy, profile?.id, channelSlug]);

  const optimisticLikeToggle = useCallback(async (postId: string, currentlyLiked: boolean) => {
    if (!profile) {
      toast.error('Please log in to like posts');
      return;
    }

    console.log(`[LIKE] User ${profile.id} toggling like on post ${postId}. Currently liked: ${currentlyLiked}`);

    // INSTANT OPTIMISTIC UPDATE - Update UI immediately
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          like_count: currentlyLiked ? Math.max(0, post.like_count - 1) : post.like_count + 1,
          user_has_liked: !currentlyLiked
        };
      }
      // Also update in replies
      if (post.replies) {
        return {
          ...post,
          replies: post.replies.map(reply => 
            reply.id === postId 
              ? {
                  ...reply,
                  like_count: currentlyLiked ? Math.max(0, reply.like_count - 1) : reply.like_count + 1,
                  user_has_liked: !currentlyLiked
                }
              : reply
          )
        };
      }
      return post;
    }));

    try {
      if (currentlyLiked) {
        // UNLIKE - Delete the like record
        console.log(`[LIKE] Removing like: user_id=${profile.id}, post_id=${postId}`);
        const { error, count } = await supabase
          .from('community_post_likes')
          .delete({ count: 'exact' })
          .eq('user_id', profile.id)
          .eq('post_id', postId);
        
        if (error) {
          console.error('[LIKE] Error deleting like:', error);
          throw error;
        }
        
        console.log(`[LIKE] Deleted ${count} like(s)`);
      } else {
        // LIKE - Insert new like record
        console.log(`[LIKE] Adding like: user_id=${profile.id}, post_id=${postId}`);
        const { error } = await supabase
          .from('community_post_likes')
          .insert({ user_id: profile.id, post_id: postId });
        
        if (error) {
          console.error('[LIKE] Error inserting like:', error);
          // If error is duplicate key, user already liked it - ignore error
          if (error.code === '23505' || error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
            console.log('[LIKE] Like already exists (duplicate), treating as success');
            // Not an error - user already liked it
          } else {
            throw error;
          }
        } else {
          console.log('[LIKE] Like added successfully');
        }
      }
    } catch (error) {
      console.error('[LIKE] Unexpected error:', error);
      // REVERT optimistic update on error
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            like_count: currentlyLiked ? post.like_count + 1 : Math.max(0, post.like_count - 1),
            user_has_liked: currentlyLiked
          };
        }
        if (post.replies) {
          return {
            ...post,
            replies: post.replies.map(reply => 
              reply.id === postId 
                ? {
                    ...reply,
                    like_count: currentlyLiked ? reply.like_count + 1 : Math.max(0, reply.like_count - 1),
                    user_has_liked: currentlyLiked
                  }
                : reply
            )
          };
        }
        return post;
      }));
      toast.error('Failed to update like');
    }
  }, [profile]);

  const createPost = useCallback(async (content: string, parentId?: string) => {
    if (!profile) {
      console.error('No profile found');
      toast.error('Please log in to post messages');
      return;
    }
    
    if (!channelId) {
      console.error('No channel ID found - channel may not be loaded yet');
      console.error('Current channelSlug:', channelSlug);
      toast.error('Channel not ready. Refreshing...');
      // Try to reload the page to force channel fetch
      window.location.reload();
      return;
    }

    // INSTANT OPTIMISTIC UI UPDATE - Add message immediately before API call
    const optimisticId = `temp-${Date.now()}`;
    const optimisticPost: CommunityPost = {
      id: optimisticId,
      user_id: profile.id,
      parent_id: parentId || null,
      content: content.trim(),
      post_type: 'user_post',
      submission_id: null,
      created_at: new Date().toISOString(),
      full_name: profile.full_name || 'You',
      organization: profile.organization || '',
      region: profile.region || '',
      user_badges: (profile.badges || []).map(badge => ({
        name: badge.name,
        image_url: badge.imageUrl,
        min_pull_ups: badge.criteria?.value || 0
      })),
      like_count: 0,
      reply_count: 0,
      engagement_score: 0,
      user_has_liked: false,
      submission_data: null,
      load_time_ms: 0,
      channel_id: channelId
    };

    // Add optimistic post IMMEDIATELY
    if (!parentId) {
      setPosts(current => [optimisticPost, ...current]);
    } else {
      setPosts(current => current.map(post => {
        if (post.id === parentId) {
          return {
            ...post,
            replies: [...(post.replies || []), optimisticPost],
            reply_count: post.reply_count + 1,
            isExpanded: true
          };
        }
        return post;
      }));
    }

    try {
      const { data, error } = await supabase
        .from('community_posts')
        .insert([{
          content: content.trim(),
          user_id: profile.id,
          parent_id: parentId || null,
          post_type: 'user_post',
          channel_id: channelId
        }])
        .select('*')
        .single();

      if (error) {
        console.error('Error creating post:', error);
        // REVERT optimistic update on error
        if (!parentId) {
          setPosts(current => current.filter(p => p.id !== optimisticId));
        } else {
          setPosts(current => current.map(post => {
            if (post.id === parentId) {
              return {
                ...post,
                replies: (post.replies || []).filter(r => r.id !== optimisticId),
                reply_count: Math.max(0, post.reply_count - 1)
              };
            }
            return post;
          }));
        }
        toast.error('Failed to send message');
        throw error;
      }

      // INSTANT FEEDBACK: Add your post immediately to UI
      if (data) {
        // Replace optimistic post with real data
        const realPost: CommunityPost = {
          id: data.id,
          user_id: data.user_id,
          parent_id: data.parent_id,
          content: data.content,
          post_type: data.post_type,
          submission_id: data.submission_id || null,
          created_at: data.created_at,
          full_name: profile.full_name || 'You',
          organization: profile.organization || '',
          region: profile.region || '',
          user_badges: (profile.badges || []).map(badge => ({
            name: badge.name,
            image_url: badge.imageUrl,
            min_pull_ups: badge.criteria?.value || 0
          })),
          like_count: 0,
          reply_count: 0,
          engagement_score: 0,
          user_has_liked: false,
          submission_data: null,
          load_time_ms: 0,
          channel_id: channelId
        };

        if (parentId) {
          // Replace optimistic reply with real reply
          setPosts(current => current.map(post => {
            if (post.id === parentId) {
              return {
                ...post,
                replies: (post.replies || []).map(r => r.id === optimisticId ? realPost : r)
              };
            }
            return post;
          }));
        } else {
          // Replace optimistic post with real post
          setPosts(current => current.map(p => p.id === optimisticId ? realPost : p));
        }
      }

    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }, [profile, channelId]);

  // Discord-level real-time: Light notifications + optimistic updates
  useEffect(() => {
    if (!enableRealtime || !profile) return;

    realtimeSubscription.current = supabase
      .channel('community_discord_realtime')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'community_posts' },
        async (payload) => {
          const newPost = payload.new as any;
          
          if (newPost.user_id !== profile.id) {
            // Someone else posted - light refresh from cache in 5 seconds
            setTimeout(() => {
              loadPosts(0, true);
            }, 5000);
          }
          // Note: Your own posts are handled immediately in createPost function
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_post_likes' },
        (payload) => {
          const like = payload.new as any;
          
          // IMPORTANT: Skip if this is our own like (already handled optimistically)
          if (like.user_id === profile?.id) {
            console.log('[REALTIME] Skipping own like event (already optimistic)');
            return;
          }
          
          // Update for OTHER users' likes
          console.log('[REALTIME] Another user liked:', like.user_id);
          setPosts(current => current.map(post => {
            if (post.id === like.post_id) {
              return {
                ...post,
                like_count: post.like_count + 1
              };
            }
            // Also update in replies
            if (post.replies) {
              return {
                ...post,
                replies: post.replies.map(reply =>
                  reply.id === like.post_id
                    ? {
                        ...reply,
                        like_count: reply.like_count + 1
                      }
                    : reply
                )
              };
            }
            return post;
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'community_post_likes' },
        (payload) => {
          const like = payload.old as any;
          
          // IMPORTANT: Skip if this is our own unlike (already handled optimistically)
          if (like.user_id === profile?.id) {
            console.log('[REALTIME] Skipping own unlike event (already optimistic)');
            return;
          }
          
          // Update for OTHER users' unlikes
          console.log('[REALTIME] Another user unliked:', like.user_id);
          setPosts(current => current.map(post => {
            if (post.id === like.post_id) {
              return {
                ...post,
                like_count: Math.max(0, post.like_count - 1)
              };
            }
            // Also update in replies
            if (post.replies) {
              return {
                ...post,
                replies: post.replies.map(reply =>
                  reply.id === like.post_id
                    ? {
                        ...reply,
                        like_count: Math.max(0, reply.like_count - 1)
                      }
                    : reply
                )
              };
            }
            return post;
          }));
        }
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
        const { data: replies, error } = await supabase.rpc('get_thread_cached', {
          parent_post_id: postId,
          user_context_id: profile?.id || null
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
