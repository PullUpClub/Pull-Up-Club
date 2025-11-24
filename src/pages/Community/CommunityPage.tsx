import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  RefreshCw, 
  Menu, 
  X, 
  Search, 
  Hash,
  Mail
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import { useCommunityFeed } from '../../hooks/useCommunityFeed';
import { useChannels } from '../../hooks/useChannels';
import CommunityPostForm from '../../components/Community/CommunityPostForm';
import CommunityPostItem from '../../components/Community/CommunityPostItem';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

// Helper to dynamically render Lucide icons
const ChannelIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = (LucideIcons as any)[name] || Hash;
  return <Icon className={className} />;
};

const CommunityPage: React.FC = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const observerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  
  // Channel Management
  const { channels, loading: channelsLoading } = useChannels();
  const [activeChannelSlug, setActiveChannelSlug] = useState('the-arena');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize active channel from URL hash or default
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const channelParam = params.get('channel');
    
    if (channelParam) {
      const exists = channels.some(c => c.slug === channelParam);
      if (exists) {
        setActiveChannelSlug(channelParam);
      }
    }
  }, [channels, location.search]);

  // Update URL when channel changes
  const handleChannelChange = (slug: string) => {
    setActiveChannelSlug(slug);
    setMobileMenuOpen(false);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('channel', slug);
    window.history.pushState({}, '', newUrl.toString());
  };

  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    error,
    actions
  } = useCommunityFeed({ 
    pageSize: 50, 
    enableRealtime: true,
    channelSlug: activeChannelSlug
  });

  const activeChannel = channels.find(c => c.slug === activeChannelSlug) || channels[0];

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
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

  // Handle direct navigation to specific posts via URL hash
  useEffect(() => {
    const hash = location.hash;
    if (hash.startsWith('#post-')) {
      const postId = hash.replace('#post-', '');
      
      const scrollToPost = () => {
        const targetElement = document.getElementById(`post-${postId}`);
        if (targetElement) {
          const parentPost = posts.find(p => p.id === postId || (p.replies && p.replies.some(r => r.id === postId)));
          if (parentPost && !parentPost.isExpanded && parentPost.reply_count > 0) {
            actions.toggleThreadExpansion(parentPost.id);
            setTimeout(() => {
              const updatedElement = document.getElementById(`post-${postId}`);
              if (updatedElement) {
                updatedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                updatedElement.classList.add('bg-white/5');
                setTimeout(() => updatedElement.classList.remove('bg-white/5'), 3000);
              }
            }, 300);
          } else {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetElement.classList.add('bg-white/5');
            setTimeout(() => targetElement.classList.remove('bg-white/5'), 3000);
          }
        }
      };
      
      if (posts.length > 0 && !loading) {
        setTimeout(scrollToPost, 100);
      }
    }
  }, [location.hash, posts.length, loading, posts, actions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await actions.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredPosts = searchQuery 
    ? posts.filter(p => 
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  return (
    <Layout showFooter={false}>
      <div className="bg-gradient-to-b from-gray-950 via-gray-950 to-black h-[calc(100vh-64px)] flex overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Channels */}
        <aside className={cn(
          "fixed md:relative inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-gray-900 to-gray-950 border-r border-gray-800 backdrop-blur-sm transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "top-[64px] md:top-0 h-[calc(100vh-64px)]"
        )}>
           {/* Sidebar Header - Matches Main Header Height */}
           <div className="h-16 px-5 border-b border-gray-800 flex items-center justify-between bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm flex-shrink-0">
             <h2 className="font-bold text-white text-lg tracking-wide flex items-center gap-2">
               <Mail className="h-5 w-5 text-[#9b9b6f]" />
               <span>COMMUNITY</span>
             </h2>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search Channels/Posts */}
          <div className="p-4 bg-gradient-to-b from-gray-900 to-gray-950">
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 group-focus-within:text-[#9b9b6f] transition-colors" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 text-gray-200 pl-10 pr-4 py-2.5 rounded-lg text-sm border border-gray-800 focus:border-[#9b9b6f]/50 focus:outline-none focus:ring-1 focus:ring-[#9b9b6f]/20 transition-all placeholder-gray-500 backdrop-blur-sm"
              />
            </div>
          </div>

          {/* Channel List */}
          <div className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5 bg-gradient-to-b from-gray-950 to-gray-950">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 mb-3 mt-2">
              Channels
            </div>
            
            {channelsLoading ? (
              <div className="space-y-2 px-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-9 bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              channels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelChange(channel.slug)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-300 group relative overflow-hidden",
                    activeChannelSlug === channel.slug
                      ? "bg-gradient-to-b from-gray-800 to-gray-900 text-white border border-gray-800 shadow-lg"
                      : "text-gray-400 hover:bg-gray-900/50 hover:text-gray-200 border border-transparent"
                  )}
                >
                  {activeChannelSlug === channel.slug && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#9b9b6f]/5 to-transparent" />
                  )}
                  <ChannelIcon 
                    name={channel.icon} 
                    className={cn(
                      "h-5 w-5 transition-colors relative z-10",
                      activeChannelSlug === channel.slug ? "text-[#9b9b6f]" : "text-gray-500 group-hover:text-gray-300"
                    )} 
                  />
                  <span className="relative z-10">{channel.name}</span>
                </button>
              ))
            )}

            <div className="border-t border-gray-800 my-6 mx-4"></div>

            {/* Links / Other Nav */}
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-4 mb-3">
              Shortcuts
            </div>
            <a 
              href="/leaderboard" 
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold text-gray-400 hover:bg-gray-900/50 hover:text-gray-200 transition-all duration-300 group border border-transparent hover:border-gray-800"
            >
              <LucideIcons.Trophy className="h-5 w-5 text-gray-500 group-hover:text-[#9b9b6f] transition-colors" />
              <span>Leaderboard</span>
            </a>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-gray-950 to-black relative w-full md:pb-0 pb-[calc(env(safe-area-inset-bottom)+88px)]">
          {/* Header - Channel Title Bar */}
          <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0 bg-gradient-to-b from-gray-900/95 to-gray-950/95 backdrop-blur-md z-10 shadow-lg">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-gray-400 hover:text-white transition-colors"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-3 tracking-tight">
                  <span className="text-[#9b9b6f] opacity-80 text-xl font-light">#</span>
                  <span>{activeChannel?.name || 'Loading...'}</span>
                </h1>
                <p className="text-xs text-gray-500 hidden md:block mt-0.5 font-medium">
                  {activeChannel?.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  "p-2 rounded-md text-gray-400 hover:text-[#9b9b6f] hover:bg-white/5 transition-all",
                  isRefreshing && "animate-spin text-[#9b9b6f]"
                )}
                title="Refresh feed"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto chat-scroll-container bg-gradient-to-b from-gray-950 to-black custom-scrollbar pb-4 md:pb-0" ref={listRef}>
            {loading && posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9b9b6f] mb-4 opacity-80"></div>
                <p className="text-sm font-medium animate-pulse">Syncing channel history...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-red-400/80">
                <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
                <p className="mb-4 text-sm">Failed to load messages</p>
                <button 
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg text-white text-xs font-medium transition-all duration-300"
                >
                  Retry Connection
                </button>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
                <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-800 p-6 rounded-xl mb-6 shadow-lg backdrop-blur-sm">
                  <ChannelIcon name={activeChannel?.icon || 'MessageCircle'} className="h-10 w-10 text-[#9b9b6f]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Welcome to #{activeChannel?.name}</h3>
                <p className="max-w-sm mx-auto mb-8 text-gray-400 leading-relaxed">{activeChannel?.description}</p>
                <p className="text-sm text-[#9b9b6f] font-medium">Be the first to start the conversation!</p>
              </div>
            ) : (
              <div className="px-4 md:px-8 py-6 space-y-2 max-w-5xl mx-auto">
                 {filteredPosts
                  .slice()
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((post, i, arr) => {
                  const prev = i > 0 ? arr[i - 1] : null;
                  const prevDate = prev ? new Date(prev.created_at).toDateString() : '';
                  const currDate = new Date(post.created_at).toDateString();
                  const showDateDivider = !prev || prevDate !== currDate;
                  
                  // Format date divider text
                  const today = new Date().toDateString();
                  const yesterday = new Date(Date.now() - 86400000).toDateString();
                  let dateText = currDate;
                  if (currDate === today) dateText = 'Today';
                  else if (currDate === yesterday) dateText = 'Yesterday';
                  
                  return (
                    <React.Fragment key={post.id}>
                      {showDateDivider && (
                        <div className="relative text-center py-6 my-2">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-800"></div>
                          </div>
                          <span className="relative inline-block text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 py-1.5 bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 rounded-full shadow-lg">
                            {dateText}
                          </span>
                        </div>
                      )}
                      <CommunityPostItem
                        post={post}
                        onLikeToggle={actions.toggleLike}
                        onReply={actions.createPost}
                        onToggleThread={actions.toggleThreadExpansion}
                      />
                    </React.Fragment>
                  );
                  })}
                
                {/* Infinite scroll loader */}
                {hasMore && (
                  <div ref={observerRef} className="py-6 flex justify-center">
                    {loadingMore && (
                      <div className="flex items-center space-x-2 text-gray-600 text-xs uppercase tracking-wide font-bold">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#9b9b6f]"></div>
                        <span>Loading history...</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Bottom spacer for input - Larger on mobile to account for fixed input */}
                <div className="h-4 md:h-4"></div>
              </div>
            )}
          </div>

          {/* Input Area - Fixed on Mobile, Aligned with Messages */}
          <div 
            className="flex-shrink-0 border-t border-gray-800 bg-gradient-to-b from-gray-950 to-black backdrop-blur-sm md:relative fixed bottom-0 left-0 right-0 md:left-auto md:right-auto z-20 md:z-auto shadow-2xl md:shadow-none"
            style={{ 
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))'
            }}
          >
            <div className="px-4 md:px-8 py-4 max-w-5xl mx-auto">
              {profile ? (
                <CommunityPostForm 
                  onSubmit={actions.createPost} 
                  placeholder={`Message #${activeChannel?.name || 'channel'}...`}
                />
              ) : (
                <div className="text-center py-4 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border border-gray-800 backdrop-blur-sm shadow-lg">
                  <p className="text-sm text-gray-400">
                    Please <a href="/login" className="text-[#9b9b6f] hover:text-white font-medium transition-colors">log in</a> to join the conversation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default CommunityPage;
