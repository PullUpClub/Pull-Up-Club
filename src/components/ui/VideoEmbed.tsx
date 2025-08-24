import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VideoEmbedProps {
  embedId: string;
  platform?: 'youtube' | 'vimeo';
  autoplayOnScroll?: boolean;
  title?: string;
}

const VideoEmbed: React.FC<VideoEmbedProps> = ({ 
  embedId, 
  platform = 'youtube', 
  autoplayOnScroll = true,
  title = 'Video Demo'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle user click to play video
  const handlePlayClick = useCallback(() => {
    setUserInteracted(true);
    setIsLoading(true);
    setIsPlaying(true);
    setError(null);
  }, []);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    
    // For Vimeo, try to unmute after load
    if (platform === 'vimeo' && iframeRef.current && userInteracted) {
      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ method: 'setMuted', value: false }),
            '*'
          );
        } catch (e) {
          console.log('Could not unmute Vimeo video:', e);
        }
      }, 100);
    }
  }, [platform, userInteracted]);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    setError('Failed to load video. Please try again.');
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Intersection Observer for autoplay
  useEffect(() => {
    if (!autoplayOnScroll || !containerRef.current || hasAutoPlayed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setHasAutoPlayed(true);
            // Auto-play only on desktop, show click prompt on mobile
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) {
              setUserInteracted(true);
              setIsLoading(true);
              setIsPlaying(true);
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [autoplayOnScroll, hasAutoPlayed]);

  // Generate embed URL
  const getEmbedUrl = useCallback(() => {
    if (platform === 'vimeo') {
      const params = new URLSearchParams({
        autoplay: '1',
        loop: '1',
        title: '0',
        byline: '0',
        portrait: '0',
        controls: '1',
        playsinline: '1',
        muted: userInteracted ? '0' : '1'
      });
      return `https://player.vimeo.com/video/${embedId}?${params}`;
    }
    
    // YouTube
    const params = new URLSearchParams({
      autoplay: '1',
      mute: userInteracted ? '0' : '1',
      loop: '1',
      playlist: embedId,
      controls: '1',
      modestbranding: '1',
      rel: '0',
      playsinline: '1'
    });
    return `https://www.youtube-nocookie.com/embed/${embedId}?${params}`;
  }, [embedId, platform, userInteracted]);

  // Error state
  if (error) {
    return (
      <div className="relative bg-gray-900 rounded-lg flex items-center justify-center w-full aspect-video">
        <div className="text-center p-6">
          <div className="text-red-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
          <button 
            onClick={handlePlayClick}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Playing state
  if (isPlaying) {
    return (
      <div ref={containerRef} className="relative w-full aspect-video rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
          </div>
        )}
        <iframe 
          ref={iframeRef}
          src={getEmbedUrl()}
          className="w-full h-full"
          title={title}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
    );
  }

  // Thumbnail state
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const showAutoplayHint = autoplayOnScroll && !hasAutoPlayed && !isMobile;
  
  return (
    <div 
      ref={containerRef}
      className="relative cursor-pointer bg-black rounded-lg overflow-hidden w-full aspect-video group"
      onClick={handlePlayClick}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black" />
      
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-red-600 rounded-full p-4 group-hover:bg-red-700 group-hover:scale-110 transition-all duration-200 shadow-lg">
          <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
      
      {/* Interaction hint */}
      <div className="absolute bottom-4 left-4 right-4 text-center">
        <span className="text-white text-sm bg-black/70 px-3 py-2 rounded-lg inline-block">
          {showAutoplayHint 
            ? 'Scroll down to autoplay or click to play now' 
            : 'Click to play video'
          }
        </span>
      </div>
    </div>
  );
};

export default VideoEmbed; 