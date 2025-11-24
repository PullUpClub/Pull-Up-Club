import React, { useState, useRef } from 'react';
import { Smile } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface CommunityPostFormProps {
  onSubmit: (content: string, parentId?: string) => Promise<void>;
  parentId?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

const CommunityPostForm: React.FC<CommunityPostFormProps> = ({
  onSubmit,
  parentId,
  placeholder,
  autoFocus = false
}) => {
  const { t } = useTranslation('common');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Common emojis for quick access
  const quickEmojis = ['💪', '🔥', '💯', '👏', '🎯', '⚡', '🏆', '💎', '🚀', '✨', '👊', '🙌', '💥', '🎉', '👑', '🦾'];

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + emoji + content.substring(end);
    
    setContent(newContent);
    
    // Reset cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const defaultPlaceholder = parentId 
    ? (t?.('community.forms.replyPlaceholder') as string) || "Share your thoughts on this..."
    : (t?.('community.forms.postPlaceholder') as string) || "Share your pull-up journey...";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      console.log('Submitting message:', content.trim());
      await onSubmit(content.trim(), parentId);
      console.log('Message submitted successfully');
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error submitting message:', error);
      // Keep the content so user doesn't lose their message
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit: Enter (no shift) OR Ctrl/Cmd + Enter
    const isPlainEnter = e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey;
    const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter';
    if (isPlainEnter || isCtrlEnter) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full group">
      <div className={cn(
        "relative flex items-end gap-2 p-3 rounded-lg transition-all duration-300",
        "bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-800",
        "focus-within:border-[#9b9b6f]/50 focus-within:ring-1 focus-within:ring-[#9b9b6f]/20 focus-within:shadow-lg focus-within:shadow-[#9b9b6f]/10",
        "hover:border-gray-700 backdrop-blur-sm"
      )}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          className={cn(
            "flex-1 bg-transparent text-gray-200 text-sm placeholder-gray-600 resize-none focus:outline-none max-h-[200px]",
            "scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
          )}
          rows={1}
          disabled={isSubmitting}
          autoFocus={autoFocus}
          style={{ minHeight: '24px' }}
        />
        
        <div className="flex-shrink-0 flex items-center gap-2">
          {/* Emoji Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-[#9b9b6f] hover:bg-white/5 transition-all duration-200"
              title="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </button>

            {/* Emoji Picker Popup */}
            {showEmojiPicker && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowEmojiPicker(false)}
                />
                
                {/* Emoji Grid */}
                <div className="absolute bottom-full right-0 mb-2 z-50 bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-800 rounded-lg shadow-2xl p-3 w-64 backdrop-blur-sm">
                  <div className="grid grid-cols-8 gap-1">
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          insertEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="text-xl hover:bg-gray-900 rounded p-1.5 transition-all duration-200 hover:scale-110"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Custom Send Button */}
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className={cn(
              "group/btn relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 font-medium text-sm",
              content.trim() && !isSubmitting 
                ? "bg-gradient-to-b from-[#9b9b6f] to-[#8a8a62] text-white hover:shadow-lg hover:shadow-[#9b9b6f]/30 hover:-translate-y-0.5 active:scale-95" 
                : "bg-gray-800 text-gray-600 cursor-not-allowed",
              isSubmitting && "opacity-50 cursor-wait"
            )}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                {/* Icon wrapper with background circle */}
                <div className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full transition-all duration-300",
                  content.trim() ? "bg-white/20" : "bg-transparent"
                )}>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    className={cn(
                      "w-3 h-3 transition-all duration-300",
                      content.trim() && "group-hover/btn:rotate-45"
                    )}
                  >
                    <path fill="none" d="M0 0h24v24H0z" />
                    <path 
                      fill="currentColor" 
                      d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" 
                    />
                  </svg>
                </div>
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Helper text for desktop */}
      <div className="hidden md:block absolute -bottom-6 right-0 text-[10px] text-gray-600 opacity-0 group-focus-within:opacity-100 transition-opacity">
        Press <span className="font-bold text-gray-500">Enter</span> to send • Click <Smile className="inline h-3 w-3" /> for emojis
      </div>
    </form>
  );
};

export default CommunityPostForm;
