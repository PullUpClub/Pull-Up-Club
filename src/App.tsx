import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.tsx";
import ProtectedRoute from "./components/Layout/ProtectedRoute.tsx";
import AdminRoute from "./components/Layout/AdminRoute.tsx";
import ProfileCompletionRoute from "./components/Layout/ProfileCompletionRoute.tsx";
import AnalyticsWrapper from "./components/Layout/AnalyticsWrapper.tsx";
import { supabase } from "./lib/supabase.ts";
import Lenis from "lenis";
import StripeProvider from "./lib/StripeProvider.tsx";
import DebugConnection from './lib/DebugConnection';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CacheProvider } from './context/CacheProvider';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { initializeGA, trackPageView } from './utils/analytics';
import { useMetaTracking } from './hooks/useMetaTracking';
import { useAuth } from './context/AuthContext';
import { useRef } from "react";

// Lazy-loaded components
const Home = lazy(() => import("./pages/Home/Home.tsx"));
const LeaderboardPage = lazy(() => import("./pages/Leaderboard/LeaderboardPage.tsx"));
const AdminDashboardPage = lazy(() => import("./pages/Admin/AdminDashboardPage.tsx"));
const AdminPayoutsPage = lazy(() => import("./pages/Admin/AdminPayoutsPage.tsx"));
const AdminMonthlyGraphicsPage = lazy(() => import("./pages/Admin/AdminMonthlyGraphicsPage.tsx"));
const NotFoundPage = lazy(() => import("./pages/NotFound/NotFoundPage.tsx"));
const SuccessPage = lazy(() => import("./pages/Success/SuccessPage.tsx"));
const LoginPage = lazy(() => import("./pages/Login/LoginPage.tsx"));
const ProfilePage = lazy(() => import("./pages/Profile/ProfilePage.tsx"));
const RulesPage = lazy(() => import("./pages/Rules/RulesPage.tsx"));
const FAQPage = lazy(() => import("./pages/FAQ/FAQPage.tsx"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicy/PrivacyPolicyPage.tsx"));
const CookiesPolicyPage = lazy(() => import("./pages/CookiesPolicy/CookiesPolicyPage.tsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword/ResetPasswordPage.tsx"));
const SubscriptionPage = lazy(() => import("./pages/Subscription/SubscriptionPage.tsx"));
const SubscribeRedirect = lazy(() => import("./pages/Subscription/SubscribeRedirect.tsx"));
const SignupAccessPage = lazy(() => import("./pages/Subscription/SignupAccessPage.tsx"));
const VideoSubmissionPage = lazy(() => import("./pages/VideoSubmission/VideoSubmissionPage.tsx"));
const AdminUserManagement = lazy(() => import("./pages/AdminUserManagement.tsx"));
const EthosPage = lazy(() => import("./pages/EthosPage.tsx"));
const FirstPullUpCourse = lazy(() => import("./pages/FirstPullUpCourse/FirstPullUpCourse.tsx"));

// Community feature - lazy loaded for optimal performance  
const CommunityPage = lazy(() => import("./pages/Community/CommunityPage.tsx"));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-black">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#9b9b6f]"></div>
  </div>
);

// Create QueryClient with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

function App() {
  const { user } = useAuth();
  const location = useLocation();
  const { trackViewContent } = useMetaTracking();
  const [connectionStatus, setConnectionStatus] = useState<
    "initializing" | "connecting" | "connected" | "error"
  >("initializing");
  const [retryCount, setRetryCount] = useState(0);
  const hasTracked = useRef(false);

  useEffect(() => {
    // Initialize Google Analytics
    initializeGA();
  }, []);

  useEffect(() => {
    // Track page views on route changes
    trackPageView();
  }, [location]);

  useEffect(() => {
    // Give the app time to initialize before checking connection
    const initTimeout = setTimeout(() => {
      setConnectionStatus("connecting");
      checkConnection();
    }, 2000);

    return () => clearTimeout(initTimeout);
  }, []);

  useEffect(() => {
    const lenis = new Lenis({
      // Exclude chat containers from Lenis smooth scrolling
      prevent: (node) => {
        return node.classList.contains('chat-scroll-container') || 
               node.closest('.chat-scroll-container') !== null;
      }
    });

    // Create a simple raf loop that works with Deno/TypeScript
    let rafId: number;
    const rafLoop = (time: number) => {
      lenis.raf(time);
      // Cast to any to bypass TypeScript error
      rafId = (globalThis as any).requestAnimationFrame(rafLoop);
    };
    
    // Cast to any to bypass TypeScript error
    rafId = (globalThis as any).requestAnimationFrame(rafLoop);

    // Scroll to top on route change
    lenis.scrollTo(0, { immediate: true });

    return () => {
      // Cancel animation frame on cleanup
      (globalThis as any).cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [location]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, _session) => {
        // We're not using these variables but keeping the listener for state changes
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Enhanced deployment detection with comprehensive cache clearing
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🛠️ Development mode - skipping deployment detection');
      return;
    }

    try {
      const APP_VERSION = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ||
                          import.meta.env.VITE_APP_VERSION ||
                          Date.now().toString();

      const storedVersion = localStorage.getItem('app_version');

      console.log('🔍 Deployment check:', {
        current: APP_VERSION,
        stored: storedVersion,
        timestamp: new Date().toISOString(),
      });

      if (storedVersion && storedVersion !== APP_VERSION) {
        console.log('🚀 NEW DEPLOYMENT DETECTED - Clearing caches and reloading...');

        // Clear service worker caches
        if ('serviceWorker' in navigator && 'caches' in window) {
          caches
            .keys()
            .then((cacheNames) => {
              return Promise.all(
                cacheNames.map((cacheName) => {
                  console.log('🗑️ Deleting cache:', cacheName);
                  return caches.delete(cacheName);
                })
              );
            })
            .catch((error) => {
              console.log('Cache deletion error:', error);
            });
        }

        // Auth keys to preserve
        const authKeysToPreserve = [
          'supabase.auth.token',
          'sb-auth-token',
          'sb-',
          'auth-',
          'supabase-auth-token',
        ];

        // Clear localStorage except auth keys & version
        Object.keys(localStorage).forEach((key) => {
          const preserve = authKeysToPreserve.some((p) => key.includes(p));
          if (!preserve && key !== 'app_version') {
            localStorage.removeItem(key);
            console.log('🗑️ Removed localStorage key:', key);
          }
        });

        // Clear sessionStorage except auth keys
        Object.keys(sessionStorage).forEach((key) => {
          const preserve = authKeysToPreserve.some((p) => key.includes(p));
          if (!preserve) {
            sessionStorage.removeItem(key);
            console.log('🗑️ Removed sessionStorage key:', key);
          }
        });

        localStorage.setItem('app_version', APP_VERSION);

        console.log('✅ Cache clearing complete, reloading in 100ms...');
        setTimeout(() => {
          window.location.reload();
        }, 100);
        return;
      }

      if (!storedVersion) {
        localStorage.setItem('app_version', APP_VERSION);
        console.log('✅ First visit - version stored:', APP_VERSION);
      } else {
        console.log('✅ Version match - no reload needed');
      }
    } catch (error) {
      console.error('❌ Deployment detection error:', error);
    }
  }, []);

  // Track page views
  useEffect(() => {
    // Initialize Google Analytics
    initializeGA();

    // Track page view in GA
    trackPageView();

    // Track page view in Meta
    if (!hasTracked.current) {
      hasTracked.current = true;
      const path = location.pathname;
      const pageName = path === '/' ? 'Home' : path.substring(1).split('/').map(s => 
        s.charAt(0).toUpperCase() + s.slice(1)
      ).join(' ');

      trackViewContent(
        user ? {
          email: user.email,
          externalId: user.id
        } : {},
        {
          name: pageName,
          category: path.split('/')[1] || 'home',
          type: 'page',
          path: path,
          title: document.title
        }
      ).catch(error => {
        console.error('Failed to track page view:', error);
      });
    }
  }, [location, user, trackViewContent]);

  // Check database connection
  const checkConnection = async () => {
    try {
      // Use a simpler query that just selects the id of one row
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) throw error;
      setConnectionStatus("connected");
      setRetryCount(0);
    } catch (error) {
      console.error("Database connection error:", error);
      // Only show error after multiple failed attempts
      if (retryCount >= 2) {
        setConnectionStatus("error");
      } else {
        setRetryCount((prev) => prev + 1);
        // Try again after a delay
        setTimeout(checkConnection, 3000);
      }
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <CacheProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#ffffff',
              border: '1px solid #9b9b6f',
            },
            success: {
              style: {
                background: '#1f2937',
                color: '#ffffff',
                border: '1px solid #9b9b6f',
              },
              iconTheme: {
                primary: '#9b9b6f',
                secondary: '#ffffff',
              },
            },
            error: {
              style: {
                background: '#1f2937',
                color: '#ffffff',
                border: '1px solid #ef4444',
              },
            },
          }}
        />
        <AuthProvider>
          <StripeProvider>
            {connectionStatus === "error" && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded fixed top-0 left-0 right-0 z-50 flex justify-between items-center">
                <span>
                  <strong>Connection Error:</strong> Unable to connect to the
                  database. Some features may not work correctly.
                </span>
                <button
                  onClick={() => {
                    setConnectionStatus("connecting");
                    checkConnection();
                  }}
                  className="bg-red-700 text-white px-4 py-2 rounded"
                >
                  Retry
                </button>
              </div>
            )}
            
            {/* Debug connection component for better diagnostics */}
            <DebugConnection />
            
            <AnalyticsWrapper>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Public routes that don't require authentication */}
                  <Route path="/" element={<Home />} />
                  <Route path="/rules" element={<RulesPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/cookies" element={<CookiesPolicyPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/ethos" element={<EthosPage />} />
                  
                  {/* Protected First Pull Up Course - requires authentication */}
                  <Route
                    path="/first-pull-up-course"
                    element={
                      <ProtectedRoute requireAuth={true} redirectTo="/subscription">
                        <FirstPullUpCourse />
                      </ProtectedRoute>
                    }
                  />

                  {/* Protected Community - requires authentication */}
                  <Route
                    path="/community"
                    element={
                      <ProtectedRoute requireAuth={true} redirectTo="/subscription">
                        <CommunityPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Authentication routes - redirect if already logged in */}
                  <Route
                    path="/login"
                    element={
                      <ProtectedRoute requireAuth={false} redirectTo="/profile">
                        <LoginPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Redirect from /create-account to /login */}
                  <Route
                    path="/create-account"
                    element={<Navigate to="/login" replace />}
                  />

                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  {/* Public route with conditional display based on auth state */}
                  <Route path="/subscription" element={<SubscriptionPage />} />

                  {/* Alias route for backwards compatibility */}
                  <Route path="/subscribe" element={<SubscriptionPage />} />

                  {/* New pay-first signup route */}
                  <Route path="/signup" element={<SubscribeRedirect />} />

                  {/* Secure signup access page */}
                  <Route path="/signup-access" element={<SignupAccessPage />} />

                  {/* Protected routes - require authentication */}
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="/success" element={<SuccessPage />} />

                  <Route
                    path="/submit"
                    element={
                      <ProtectedRoute>
                        <ProfileCompletionRoute>
                          <VideoSubmissionPage />
                        </ProfileCompletionRoute>
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin routes with role check */}
                  <Route
                    path="/admin-dashboard"
                    element={
                      <AdminRoute>
                        <AdminDashboardPage />
                      </AdminRoute>
                    }
                  />

                  <Route
                    path="/admin-payouts"
                    element={
                      <AdminRoute>
                        <AdminPayoutsPage />
                      </AdminRoute>
                    }
                  />

                  <Route
                    path="/admin-monthly-graphics"
                    element={
                      <AdminRoute>
                        <AdminMonthlyGraphicsPage />
                      </AdminRoute>
                    }
                  />

                  <Route
                    path="/admin-users"
                    element={
                      <AdminRoute>
                        <AdminUserManagement />
                      </AdminRoute>
                    }
                  />

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AnalyticsWrapper>
            <Analytics />
            <SpeedInsights />
          </StripeProvider>
        </AuthProvider>
      </CacheProvider>
    </QueryClientProvider>
  );
}

// Router future flags
const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
};

// Wrap App with Router for useLocation to work
const AppWrapper = () => (
  <Router future={routerFutureConfig}>
    <App />
  </Router>
);

export default AppWrapper;