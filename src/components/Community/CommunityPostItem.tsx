import React, { useState } from 'react';
 import { Heart, MessageCircle, Trophy, MoreHorizontal } from 'lucide-react';
import CommunityPostForm from './CommunityPostForm';
import type { CommunityPost } from '../../hooks/useCommunityFeed';
import BadgeAvatar from './BadgeAvatar';
import { linkify } from '../../utils/linkify';
import { cn } from '../../lib/utils';

interface CommunityPostItemProps {
  post: CommunityPost;
  onLikeToggle: (postId: string, currentlyLiked: boolean) => void;
  onReply: (content: string, parentId: string) => Promise<void>;
  onToggleThread?: (postId: string) => void;
  depth?: number;
}

const CommunityPostItem: React.FC<CommunityPostItemProps> = ({
  post,
  onLikeToggle,
  onReply,
  onToggleThread,
  depth = 0
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const handleLikeClick = async () => {
    // Prevent rapid clicking
    if (isLiking) {
      console.log('[LIKE] Click ignored - already processing');
      return;
    }
    
    setIsLiking(true);
    try {
      await onLikeToggle(post.id, post.user_has_liked);
    } finally {
      // Small delay to prevent accidental double-clicks
      setTimeout(() => setIsLiking(false), 300);
    }
  };

  const handleReplySubmit = async (content: string) => {
    await onReply(content, post.id);
    setShowReplyForm(false);
  };

  // Calculate best badge (highest min_pull_ups) for display label
  const bestBadge = React.useMemo(() => {
    if (!post.user_badges || post.user_badges.length === 0) return null;
    return [...post.user_badges].sort((a, b) => (b.min_pull_ups ?? 0) - (a.min_pull_ups ?? 0))[0];
  }, [post.user_badges]);

  return (
    <div 
      id={`post-${post.id}`}
      className={cn(
        "group relative transition-colors duration-300 rounded-lg",
        depth === 0 ? "hover:bg-white/[0.02] p-2 -mx-2" : "mt-3"
      )}
    >
      {/* Connecting line for threads */}
      {depth > 0 && (
        <div className="absolute -left-5 top-0 bottom-0 w-px bg-gray-800" />
      )}
      
      {depth > 0 && (
        <div className="absolute -left-5 top-4 w-4 h-px bg-gray-800" />
      )}

      <div className="flex gap-4">
        {/* Avatar Column */}
        <div className="flex-shrink-0 pt-1">
          <BadgeAvatar 
            badges={post.user_badges} 
            size={depth > 0 ? 32 : 40}
          />
        </div>
        
        {/* Content Column */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "font-bold text-gray-200 hover:underline cursor-pointer",
                depth > 0 ? "text-sm" : "text-base"
              )}>
                {post.full_name || 'Member'}
              </span>
              
              {/* Badges/Tags - Show highest rank */}
              {bestBadge && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#9b9b6f]/10 text-[#9b9b6f] border border-[#9b9b6f]/20">
                  {bestBadge.name}
                </span>
              )}
              
              <span className="text-gray-600 text-xs">
                {new Date(post.created_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>
            
            {/* More Options - Visible on Hover */}
            <button className="text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Celebration / Context Block */}
          {post.submission_data && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-[#9b9b6f]/5 border border-[#9b9b6f]/10 rounded-lg max-w-md">
              <div className="p-2 bg-[#9b9b6f]/10 rounded-full">
                <Trophy className="h-4 w-4 text-[#9b9b6f]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300">
                  Completed <span className="text-white font-bold">{post.submission_data.pull_up_count} pull-ups</span>
                </p>
                <p className="text-xs text-gray-500">
                  on {post.submission_data.platform}
                </p>
              </div>
            </div>
          )}

          {/* Message Body */}
          <div className={cn(
            "text-gray-300 whitespace-pre-wrap break-words leading-relaxed",
            depth > 0 ? "text-sm" : "text-[15px]"
          )}>
            {linkify(post.content)}
          </div>

          {/* Actions Bar */}
          <div className="flex items-center gap-6 mt-3">
            {/* Like Button */}
            <button
              onClick={handleLikeClick}
              disabled={isLiking}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium transition-all duration-200 group/like",
                post.user_has_liked ? "text-red-500" : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Heart className={cn(
                "h-3.5 w-3.5 transition-transform group-active/like:scale-75", 
                post.user_has_liked && "fill-current"
              )} />
              <span>{post.like_count > 0 ? post.like_count : ''}</span>
            </button>

            {/* Reply Button */}
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reply</span>
            </button>
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <CommunityPostForm
                onSubmit={handleReplySubmit}
                parentId={post.id}
                placeholder={`Reply to ${post.full_name}...`}
                autoFocus={true}
              />
            </div>
          )}

          {/* Thread Expansion / Replies */}
          {(post.reply_count > 0 || (post.replies && post.replies.length > 0)) && (
            <div className="mt-3">
              {/* Expand/Collapse Button */}
              {onToggleThread && !post.isExpanded && post.reply_count > 0 && (
                 <button
                  onClick={() => onToggleThread(post.id)}
                  className="flex items-center gap-2 text-xs font-bold text-[#9b9b6f] hover:text-[#8f8f66] hover:underline transition-all py-1 group/thread"
                >
                  <div className="w-4 h-px bg-[#9b9b6f]/30 group-hover/thread:bg-[#9b9b6f] transition-colors"></div>
                  <span>View {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}</span>
                </button>
              )}

              {/* Expanded Replies */}
              {post.isExpanded && post.replies && post.replies.length > 0 && (
                <div className="pl-0 sm:pl-2 border-l-2 border-gray-800 ml-0 sm:ml-0 space-y-4 pt-2">
                  {post.replies.map((reply) => (
                    <CommunityPostItem
                      key={reply.id}
                      post={reply}
                      onLikeToggle={onLikeToggle}
                      onReply={onReply}
                      onToggleThread={onToggleThread}
                      depth={depth + 1}
                    />
                  ))}
                  
                  {/* Collapse Button at bottom of thread if long */}
                  {post.replies.length > 3 && onToggleThread && (
                    <button
                      onClick={() => onToggleThread(post.id)}
                      className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-400 ml-4 mt-2 transition-colors"
                    >
                      <div className="w-3 h-px bg-gray-800"></div>
                      Collapse thread
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityPostItem;
