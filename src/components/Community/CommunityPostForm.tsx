
import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const defaultPlaceholder = parentId 
    ? (t?.('community.forms.replyPlaceholder') as string) || "Share your thoughts on this..."
    : (t?.('community.forms.postPlaceholder') as string) || "Share your pull-up journey...";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim(), parentId);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
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
    <form onSubmit={handleSubmit} className="flex w-full gap-2 p-4">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || defaultPlaceholder}
        className={cn(
          "flex-1 rounded-full bg-gray-800 text-white px-4 py-2.5 text-sm transition-all duration-300",
          "border border-gray-700 focus:border-[#9b9b6f] focus:ring-1 focus:ring-[#9b9b6f]/50",
          "resize-none min-h-[42px] max-h-[120px] placeholder-gray-400",
          "scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent",
          content.trim() && !isSubmitting ? "pr-12" : ""
        )}
        maxLength={2000}
        disabled={isSubmitting}
        autoFocus={autoFocus}
        rows={1}
        // Prevent iOS zoom on focus - critical for mobile UX
        style={{ fontSize: '16px' }}
      />
      
      {content.trim() && (
        <button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className={cn(
            "aspect-square h-[42px] rounded-full",
            "bg-[#9b9b6f] hover:bg-[#8f8f66] text-white",
            "disabled:bg-gray-700 disabled:cursor-not-allowed",
            "transition-all flex items-center justify-center",
            "animate-in fade-in slide-in-from-right-2 duration-300",
            isSubmitting ? "cursor-wait" : "hover:scale-105 active:scale-95"
          )}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      )}
    </form>
  );
};

export default CommunityPostForm;
