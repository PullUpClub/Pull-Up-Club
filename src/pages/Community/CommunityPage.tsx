import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout/Layout';
import { useCommunityFeed } from '../../hooks/useCommunityFeed';
import CommunityPostForm from '../../components/Community/CommunityPostForm';
import CommunityPostItem from '../../components/Community/CommunityPostItem';
import { useAuth } from '../../context/AuthContext';

const CommunityPage: React.FC = () => {
  useTranslation('common');
  const { profile } = useAuth();
  const observerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    error,
    performanceMetrics,
    actions
  } = useCommunityFeed({ pageSize: 50, enableRealtime: true });

  // Track whether user is at the bottom; only auto-scroll when true
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      atBottomRef.current = nearBottom;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (atBottomRef.current) {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [posts]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          actions.loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, actions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await actions.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };


  if (loading) {
    return (
      <Layout>
        <div className="bg-black min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9b9b6f] mx-auto mb-4"></div>
            <p className="text-white">Loading community...</p>
            <p className="text-gray-500 text-sm mt-2">Connecting pull-up athletes worldwide</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-black min-h-screen flex items-center justify-center">
          <div className="text-center text-red-400 max-w-md">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold mb-2">Connection Issue</h2>
            <p className="mb-4 text-gray-300">Unable to load community posts</p>
            <button 
              onClick={handleRefresh}
              className="bg-[#9b9b6f] hover:bg-[#8f8f66] text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-black min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center">
              <img 
                src="/PUClogo (1).webp" 
                alt="Pull-Up Club" 
                className="h-10 w-10 mr-3"
              />
              The Arena
            </h1>
            <div className="w-20 h-1 bg-[#9b9b6f] mx-auto mt-4 mb-4"></div>
            <p className="text-gray-400">
              Where champions connect and legends are made
            </p>
          </div>

          {/* Chat Container - Better scrolling */}
          <div className="bg-gray-900 rounded-lg min-h-[600px] flex flex-col">
            {/* Chat Header */}
            <div className="flex-shrink-0 border-b border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm">
                  {posts.length > 0 ? `${posts.length} messages` : 'Share your pull-up journey'}
                </p>
                
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-gray-400 hover:text-[#9b9b6f] transition-colors p-2 rounded-lg hover:bg-gray-800"
                  title="Refresh feed"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Messages Container - Fixed scrolling with chat-scroll-container class */}
            <div className="flex-1 chat-scroll-container" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div ref={listRef} className="p-4">
                {posts
                  .slice()
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((post, i, arr) => {
                  const prev = i > 0 ? arr[i - 1] : null;
                  const grouped = !!prev && prev.user_id === post.user_id && (new Date(post.created_at).getTime() - new Date(prev.created_at).getTime()) <= 2 * 60 * 1000;
                  const prevDate = prev ? new Date(prev.created_at).toDateString() : '';
                  const currDate = new Date(post.created_at).toDateString();
                  const showDateDivider = !prev || prevDate !== currDate;
                  const enriched = { ...post, grouped } as any;
                  
                  // Format date divider text
                  const today = new Date().toDateString();
                  const yesterday = new Date(Date.now() - 86400000).toDateString();
                  let dateText = currDate;
                  if (currDate === today) dateText = 'Today';
                  else if (currDate === yesterday) dateText = 'Yesterday';
                  
                  return (
                    <React.Fragment key={post.id}>
                      {showDateDivider && (
                        <div className="relative text-center py-6">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-700"></div>
                          </div>
                          <span className="relative inline-block text-xs text-gray-400 px-4 py-1 bg-gray-900 rounded-full border border-gray-700">
                            {dateText}
                          </span>
                        </div>
                      )}
                      <CommunityPostItem
                        post={enriched}
                        onLikeToggle={actions.toggleLike}
                        onReply={actions.createPost}
                        onToggleThread={actions.toggleThreadExpansion}
                      />
                    </React.Fragment>
                  );
                  })}
                
                {/* Infinite scroll loader */}
                {hasMore && (
                  <div ref={observerRef} className="py-4 flex justify-center">
                    {loadingMore && (
                      <div className="flex items-center space-x-2 text-gray-400 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#9b9b6f]"></div>
                        <span>Loading more...</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Empty state */}
                {posts.length === 0 && !loading && (
                  <div className="text-center py-16 text-gray-400">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                    <h2 className="text-xl font-bold text-white mb-2">
                      Welcome to Pull-Up Club Community!
                    </h2>
                    <p className="text-sm mb-4">Be the first to start the conversation</p>
                  </div>
                )}
              </div>
            </div>

            {/* Message Input - only show for authenticated users */}
            {profile && (
              <div className="flex-shrink-0 bg-gray-900 rounded-b-lg">
                <CommunityPostForm onSubmit={actions.createPost} />
              </div>
            )}
          </div>

          {/* Performance metrics (development only) */}
          {process.env.NODE_ENV === 'development' && performanceMetrics.totalRequests > 0 && (
            <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
              <div>Avg Load: {Math.round(performanceMetrics.averageLoadTime)}ms</div>
              <div>Requests: {performanceMetrics.totalRequests}</div>
              <div>Errors: {performanceMetrics.errorCount}</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CommunityPage;
