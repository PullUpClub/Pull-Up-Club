import React, { useState } from 'react';
import { Heart, MessageCircle, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  useTranslation('community');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const handleLikeClick = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      onLikeToggle(post.id, post.user_has_liked);
    } finally {
      setIsLiking(false);
    }
  };

  const handleReplySubmit = async (content: string) => {
    await onReply(content, post.id);
    setShowReplyForm(false);
  };

  return (
    <div 
      className={cn("mb-3", {
        "ml-8": depth > 0, // Subtle indentation for replies
        "ml-16": depth > 1, // Slightly more for nested replies
      })}
    >
      {/* Card container - Skool style */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <BadgeAvatar 
              badges={post.user_badges} 
              size={36}
            />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-gray-200">
                {post.full_name || 'Member'}
              </span>
              <span className="text-gray-500 text-sm">
                {new Date(post.created_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>

            {/* Celebration badge for submission posts */}
            {post.submission_data && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-gray-700 rounded-md">
                <Trophy className="h-4 w-4 text-[#9b9b6f]" />
                <span className="text-sm text-gray-300">
                  Completed {post.submission_data.pull_up_count} pull-ups on {post.submission_data.platform}
                </span>
              </div>
            )}

            {/* Message content */}
            <div className="text-gray-100 text-sm mb-3 whitespace-pre-wrap break-words">
              {linkify(post.content)}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 text-sm">
              {/* Like button */}
              <button
                onClick={handleLikeClick}
                disabled={isLiking}
                className={cn(
                  "flex items-center gap-1.5 transition-colors",
                  post.user_has_liked ? "text-red-500" : "text-gray-400 hover:text-red-400",
                  "disabled:opacity-50"
                )}
              >
                <Heart className={cn("h-4 w-4", post.user_has_liked && "fill-current")} />
                <span>{post.like_count || 0}</span>
              </button>

              {/* Reply button */}
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center gap-1.5 text-gray-400 hover:text-[#9b9b6f] transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Reply</span>
              </button>
            </div>

            {/* Reply form */}
            {showReplyForm && (
              <div className="mt-3">
                <CommunityPostForm
                  onSubmit={handleReplySubmit}
                  parentId={post.id}
                  placeholder={`Reply to ${post.full_name}...`}
                  autoFocus={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thread toggle - Skool style */}
      {post.reply_count > 0 && onToggleThread && (
        <div className="mt-2 ml-12">
          <button
            onClick={() => onToggleThread(post.id)}
            className="text-sm text-[#6b9bd2] hover:text-[#5a8bc4] transition-colors"
          >
            {post.isExpanded 
              ? `Hide ${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}`
              : `View ${post.reply_count} more ${post.reply_count === 1 ? 'reply' : 'replies'}`
            }
          </button>
        </div>
      )}

      {/* Inline replies */}
      {post.isExpanded && post.replies && post.replies.length > 0 && (
        <div className="mt-3">
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
        </div>
      )}
    </div>
  );
};

export default CommunityPostItem;