import React, { useState, useEffect, useRef, memo } from 'react';
import { Button } from '../../components/ui/Button';
import { Link } from '../../components/ui/Link';
import { Zap } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useMetaTracking } from "../../hooks/useMetaTracking";

// Lazy load non-critical features
const LazyActivityTicker = memo(() => {
  const { t } = useTranslation('home');
  const [recentActivity, setRecentActivity] = useState([
    { name: "Marcus", location: "Chicago", pullUps: 25, time: "2 min ago" }
  ]);

  const cityNameMap: { [key: string]: string[] } = {
    "Chicago": ["Marcus", "Emily", "James"],
    "London": ["Sarah", "Oliver", "Amelia"],
    "São Paulo": ["Carlos", "Ana", "Lucas"],
    "Tokyo": ["Yuki", "Haruto", "Sakura"],
    "Berlin": ["Lukas", "Mia", "Leon"],
    "Sydney": ["Oliver", "Charlotte", "Jack"]
  };
  const cities = Object.keys(cityNameMap);

  useEffect(() => {
    const interval = setInterval(() => {
      const city = cities[Math.floor(Math.random() * cities.length)];
      const names = cityNameMap[city];
      const name = names[Math.floor(Math.random() * names.length)];
      setRecentActivity([{
        name,
        location: city,
        pullUps: Math.floor(Math.random() * 40) + 10,
        time: t('hero.justNow')
      }]);
    }, 8000);
    return () => clearInterval(interval);
  }, [t]);

  return (
    <div className="absolute top-4 left-0 right-0 z-10">
      <div className="max-w-7xl mx-auto px-2 py-2">
        <div className="flex items-center text-sm">
          <div className="flex items-center space-x-2 mr-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400">{t('hero.live')}</span>
          </div>
          <span className="text-gray-300">
            <Trans
              i18nKey="hero.liveActivity"
              t={t}
              values={{
                name: recentActivity[0].name,
                location: recentActivity[0].location,
                pullUps: recentActivity[0].pullUps,
              }}
              components={[
                <span className="text-[#9b9b6f] font-semibold" />,
                <span className="text-[#9b9b6f]" />,
              ]}
            />
          </span>
        </div>
      </div>
    </div>
  );
});

const Hero1: React.FC = () => {
  const { t } = useTranslation('home');
  const { trackEvent } = useMetaTracking();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [displayedActiveUsers, setDisplayedActiveUsers] = useState(0);
  const [currentPullUps] = useState(368);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  
  const heroRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [headlineVisible, setHeadlineVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);

  // Fetch total approved submissions count
  useEffect(() => {
    const fetchSubmissionCount = async () => {
      try {
        const { count } = await supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');
        
        if (count !== null) {
          setTotalSubmissions(count);
        }
      } catch (error) {
        console.error('Error fetching submission count:', error);
      }
    };
    
    fetchSubmissionCount();
  }, []);

  // Intersection Observer for animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setTimeout(() => setHeadlineVisible(true), 400);
          setTimeout(() => setSubtitleVisible(true), 900);
        }
      },
      { threshold: 0.1 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Preload appropriate hero image based on screen size
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.type = 'image/webp';
    
    if (window.innerWidth <= 768) {
      link.href = '/pullup_header-mobile.webp';
    } else if (window.innerWidth <= 1024) {
      link.href = '/pullup_header-tablet.webp';
    } else {
      link.href = '/pullup_header_desktop.webp';
    }
    
    document.head.appendChild(link);
    
    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  // Updated counter animation to animate from 0 to real total
  useEffect(() => {
    if (isVisible && totalSubmissions > 0) {
      let start = 0; // Start from 0
      const end = totalSubmissions; // Go to real count
      const duration = 1800;
      const stepTime = 30;
      const steps = Math.ceil(duration / stepTime);
      const increment = Math.max(1, Math.round((end - start) / steps));
      let current = start;
      setDisplayedActiveUsers(start);
      
      const interval = setInterval(() => {
        current += increment;
        if (current >= end) {
          setDisplayedActiveUsers(end);
          clearInterval(interval);
        } else {
          setDisplayedActiveUsers(current);
        }
      }, stepTime);
      
      return () => clearInterval(interval);
    }
  }, [isVisible, totalSubmissions]);

  const handleSignUpClick = async () => {
    // Track Lead event when user clicks Sign Up
    await trackEvent('Lead', {}, {
      content_name: 'PUC Membership Hero CTA',
      content_category: 'Subscription',
      content_type: 'product',
      value: 9.99,
      currency: 'USD',
      page_url: window.location.href,
      page_path: window.location.pathname,
    });
  };

  return (
    <div ref={heroRef} className="relative bg-gray-900 text-white overflow-hidden" style={{ minHeight: '70vh' }}>
      {/* Background image with overlay */}
      <div className="absolute inset-0 bg-black">
        <picture>
          <source 
            media="(max-width: 768px)"
            srcSet="/PUClogo-optimized.webp"
            type="image/webp"
          />
          <source 
            media="(max-width: 1024px)"
            srcSet="/pullup_header-tablet.webp"
            type="image/webp"
          />
          <source 
            srcSet="/pullup_header_desktop.webp"
            type="image/webp"
          />
          <img
            src="/pullup_header_desktop.webp"
            alt={t('hero.alt_athlete')}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? 'max-md:opacity-20 md:opacity-50' : 'opacity-0'}`}
            style={{ objectPosition: 'center center' }}
            loading="eager"
            onLoad={() => setImageLoaded(true)}
          />
        </picture>
        <div className="absolute inset-0 max-md:bg-black/80 md:bg-gradient-to-r from-black via-black/70 to-transparent opacity-85"></div>
      </div>

      {/* Activity ticker */}
      <LazyActivityTicker />

      {/* Warriors Joined Counter - Mobile Only */}
      <div className="md:hidden absolute top-28 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <span className="block text-lg font-medium tracking-wide uppercase">
              <span className="text-white">{displayedActiveUsers.toLocaleString()}+</span> <span className="text-[#9b9b6f]">warriors joined</span>
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden relative max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center pt-40" style={{ minHeight: '70vh' }}>
        <div className="w-full max-w-md mx-auto">
          {/* Main headline - bigger and bolder */}
          <div className={`mb-6 transition-all duration-700 ${headlineVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="text-6xl font-black tracking-tight leading-none">
              <span className="block text-white mb-2">
                Welcome to
              </span>
              <span className="block text-[#9b9b6f]">
                Pull-Up Club
              </span>
            </h1>
          </div>

          {/* Subtitle - bigger and brighter */}
          <div className={`mb-10 transition-all duration-700 ${subtitleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-2xl text-white font-medium leading-relaxed">
              {t('hero.subtitle')}
            </p>
          </div>

          {/* CTA Buttons - matching original style */}
          <div className="flex flex-col space-y-3 w-full max-w-xs mx-auto">
            <Link href="/subscription" className="block w-full">
              <Button 
                size="lg" 
                className="w-full bg-[#9b9b6f] hover:bg-[#8f8f66] text-white font-bold rounded-full px-8 py-4 text-lg transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                onClick={handleSignUpClick}
              >
                Sign Up Now
              </Button>
            </Link>
            <Link href="/leaderboard" className="block w-full">
              <Button variant="outline" size="lg" className="w-full bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-full px-8 py-4 text-lg font-semibold transform transition-all duration-200 hover:scale-[1.02]">
                View Leaderboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* DESKTOP/TABLET LAYOUT */}
      <div className="hidden md:block relative max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8" style={{ minHeight: '70vh' }}>
        {/* Animated Warriors Joined Counter */}
        <div className={`mb-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <span className="block text-2xl md:text-3xl font-bold tracking-tight text-white">
            {displayedActiveUsers.toLocaleString()}+ <span className="text-[#9b9b6f]">{t('hero.warriorsJoined')}</span>
          </span>
        </div>
        
        {/* Dramatic Headline Animation */}
        <div className={`mb-6 transition-all duration-700 ${headlineVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            <span className="block text-[#9b9b6f]">
              {t('hero.title')}
            </span>
          </h1>
        </div>
        
        {/* Dramatic Subtitle Animation */}
        <div className={`mb-10 transition-all duration-700 ${subtitleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xl text-gray-300 max-w-3xl">
            {t('hero.subtitle')}
          </p>
        </div>

        <div className="mb-14 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <Link href="/subscription" className="block">
            <Button 
              size="lg" 
              className="bg-[#a5a676] hover:bg-[#8f8f66] text-white rounded-full px-8 py-3"
              onClick={handleSignUpClick}
            >
              {t('hero.cta')}
            </Button>
          </Link>
          <Link href="/leaderboard" className="block">
            <Button variant="secondary" size="lg" className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-full px-8 py-3">
              {t('hero.secondaryCta')}
            </Button>
          </Link>
        </div>

        <div className="mb-10 flex space-x-12">
          <div className="flex flex-col space-y-2">
            <span className="text-3xl sm:text-4xl font-bold text-[#9b9b6f]">{t('hero.price')}</span>
            <span className="text-sm sm:text-base text-gray-400">{t('hero.cancelAnytime')}</span>
          </div>
          <div className="flex flex-col space-y-2">
            <span className="text-3xl sm:text-4xl font-bold text-[#9b9b6f]">{t('hero.global')}</span>
            <span className="text-sm sm:text-base text-gray-400">{t('hero.leaderboard')}</span>
          </div>
          <div className="flex flex-col space-y-2">
            <span className="text-3xl sm:text-4xl font-bold text-[#9b9b6f]">5</span>
            <span className="text-sm sm:text-base text-gray-400">{t('hero.badgeTypes')}</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-[#9b9b6f]" />
            <span>
              <Trans
                i18nKey="hero.pullUpsToday"
                t={t}
                values={{ count: currentPullUps }}
                components={[<span className="text-[#9b9b6f] font-bold" />]}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Hero1); 