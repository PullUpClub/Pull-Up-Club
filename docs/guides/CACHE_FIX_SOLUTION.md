# How We Fixed The Massive Cache/Cookie Problem in Pull-Up Club

## 🚨 The Problem

Our React SPA (Vite + React + Vercel) had a **catastrophic caching issue**:

- Users were stuck on old versions of the app
- Different users saw different bugs based on their cached version
- Manual cache clearing didn't always work
- Users had to do Ctrl+Shift+R or clear cookies manually
- Service Workers were aggressively caching HTML
- Vercel's CDN was caching everything
- No way to force users to the latest version on deployment

**Result:** Version fragmentation chaos. Users reporting bugs that were already fixed.

---

## ✅ The Solution: 4-Layer Cache Invalidation System

We built a comprehensive, automatic cache-busting system that works at every level of the stack.

---

## Layer 1: Automatic Version Detection & Cache Clearing

### File: `src/App.tsx`

Add this `useEffect` hook in your main `App` component:

```tsx
import { useEffect } from 'react';

function App() {
  // Enhanced deployment detection with comprehensive cache clearing
  useEffect(() => {
    // Skip in development
    if (import.meta.env.DEV) {
      console.log('🛠️ Development mode - skipping deployment detection');
      return;
    }

    try {
      // Get version from Vercel Git SHA, fallback to manual version, then timestamp
      const APP_VERSION = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ||
                          import.meta.env.VITE_APP_VERSION ||
                          Date.now().toString();

      const storedVersion = localStorage.getItem('app_version');

      console.log('🔍 Deployment check:', {
        current: APP_VERSION,
        stored: storedVersion,
        timestamp: new Date().toISOString(),
      });

      // Version mismatch = new deployment detected!
      if (storedVersion && storedVersion !== APP_VERSION) {
        console.log('🚀 NEW DEPLOYMENT DETECTED - Clearing caches and reloading...');

        // 1. Clear ALL Service Worker caches
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

        // 2. Auth keys to preserve (DON'T log users out!)
        const authKeysToPreserve = [
          'supabase.auth.token',
          'sb-auth-token',
          'sb-',
          'auth-',
          'supabase-auth-token',
        ];

        // 3. Clear localStorage except auth keys & version
        Object.keys(localStorage).forEach((key) => {
          const preserve = authKeysToPreserve.some((p) => key.includes(p));
          if (!preserve && key !== 'app_version') {
            localStorage.removeItem(key);
            console.log('🗑️ Removed localStorage key:', key);
          }
        });

        // 4. Clear sessionStorage except auth keys
        Object.keys(sessionStorage).forEach((key) => {
          const preserve = authKeysToPreserve.some((p) => key.includes(p));
          if (!preserve) {
            sessionStorage.removeItem(key);
            console.log('🗑️ Removed sessionStorage key:', key);
          }
        });

        // 5. Update version and reload
        localStorage.setItem('app_version', APP_VERSION);

        console.log('✅ Cache clearing complete, reloading in 100ms...');
        setTimeout(() => {
          window.location.reload();
        }, 100);
        return;
      }

      // First visit - store version
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

  return (
    // Your app components
  );
}
```

### File: `src/env.d.ts`

Add TypeScript definitions:

```typescript
interface ImportMetaEnv {
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
  readonly VITE_APP_VERSION?: string;
  // ... your other env vars
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Layer 2: Smart Service Worker Configuration

### File: `public/sw.js`

Create a service worker that **never caches HTML**:

```javascript
// Enhanced service worker with browser extension protection
const CACHE_NAME = 'your-app-v1'; // Increment version to force cache refresh
const STATIC_ASSETS = [
  // IMPORTANT: HTML shell deliberately excluded to always fetch latest version
  '/logo.png',
  '/header-image.webp',
  // Add your critical static assets here
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('SW: Installing version', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((error) => console.log('SW: Install failed:', error))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating version', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip browser extension requests
  if (
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'moz-extension:' ||
    url.protocol === 'safari-extension:'
  ) {
    return;
  }

  // CRITICAL: Never cache index.html or root route
  if (
    event.request.url.includes('/index.html') ||
    event.request.url === new URL('/', self.location).href ||
    event.request.url.endsWith('/')
  ) {
    console.log('SW: Bypassing cache for HTML shell:', event.request.url);
    return; // Always fetch from network
  }

  // Skip API calls and external requests
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('stripe.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        console.log('SW: Cache hit for:', event.request.url);
        return response;
      }

      console.log('SW: Cache miss, fetching:', event.request.url);
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();

          // Only cache images and static assets
          if (event.request.url.match(/\.(jpg|jpeg|png|gif|webp|svg|css|js)$/)) {
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache))
              .catch((error) => console.log('SW: Cache put failed:', error));
          }

          return networkResponse;
        })
        .catch((error) => {
          console.log('SW: Fetch failed:', error);
          return new Response('Network error occurred', { status: 408 });
        });
    })
  );
});
```

---

## Layer 3: Vercel HTTP Headers (Critical!)

### File: `vercel.json`

This is **THE KEY** to making it work on Vercel:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/",
      "headers": [
        { 
          "key": "Cache-Control", 
          "value": "no-store, no-cache, must-revalidate" 
        }
      ]
    },
    {
      "source": "/index.html",
      "headers": [
        { 
          "key": "Cache-Control", 
          "value": "no-store, no-cache, must-revalidate" 
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { 
          "key": "Cache-Control", 
          "value": "public, max-age=31536000, immutable" 
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/((?!assets/|favicon.ico|robots.txt).*)",
      "destination": "/index.html"
    }
  ]
}
```

**What this does:**
- **`no-store`** = Don't store in ANY cache (CDN, browser, proxy)
- **`no-cache`** = Must revalidate with server before using
- **`must-revalidate`** = Can't serve stale content
- Assets get long-term caching (they're fingerprinted by Vite)
- All routes rewrite to `index.html` for SPA routing

---

## Layer 4: Vercel Environment Variables

### In Vercel Dashboard:

1. Go to **Project Settings** → **Environment Variables**
2. Add these variables:

**For All Environments (Production, Preview, Development):**

```
VITE_APP_VERSION = 1.0.0
```

**Automatic Variables (Vercel provides these):**
- `VERCEL_GIT_COMMIT_SHA` - Automatically available as `VITE_VERCEL_GIT_COMMIT_SHA`

### How Vercel Auto-Injects Git SHA:

Vercel automatically exposes environment variables with `VITE_` prefix to your frontend build. The Git commit SHA is automatically available, so your version detection uses:

1. **`VITE_VERCEL_GIT_COMMIT_SHA`** (automatic) - The Git commit hash
2. **`VITE_APP_VERSION`** (manual) - Fallback version number
3. **`Date.now()`** - Last resort timestamp

This means **every Git push = new version** automatically!

---

## Vercel Build Settings

### In Vercel Dashboard → Project Settings → General:

```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### In `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  }
}
```

---

## 🎯 How It All Works Together

### User Flow on New Deployment:

```
1. You deploy new code to Vercel
   ↓
2. Vercel builds with new Git SHA
   ↓
3. User visits site
   ↓
4. Vercel CDN serves HTML with headers:
   "Cache-Control: no-store, no-cache, must-revalidate"
   ↓
5. Browser fetches fresh HTML (not cached)
   ↓
6. Service Worker sees HTML request → bypasses cache
   ↓
7. App.tsx runs version detection:
   - storedVersion: "abc123" (old)
   - currentVersion: "def456" (new from Git SHA)
   ↓
8. Version mismatch detected!
   ↓
9. Clears ALL caches:
   - Service Worker caches
   - localStorage (except auth)
   - sessionStorage (except auth)
   ↓
10. Stores new version: "def456"
    ↓
11. Reloads page in 100ms
    ↓
12. User gets latest version
    ↓
✅ User stays logged in, sees latest version
```

---

## 🔒 Why Each Layer Matters

| Layer | Prevents | Without It |
|-------|----------|------------|
| **Vercel Headers** | CDN caching HTML | Vercel edge cache serves stale HTML |
| **Service Worker** | Browser caching HTML | SW caches HTML, version check never runs |
| **Version Detection** | Stale app state | Old localStorage/cache persists |
| **Selective Clearing** | User logout | Auth tokens cleared, users logged out |

---

## 🚀 Benefits

✅ **Automatic** - Zero user action required  
✅ **Instant** - Updates within seconds of visiting  
✅ **Seamless** - Users stay logged in  
✅ **Universal** - Works on all browsers  
✅ **Git-based** - Every push = new version  
✅ **Debug-friendly** - Console logs show what's happening  
✅ **Production-ready** - Skips in development mode  

---

## 📋 Implementation Checklist

- [ ] Add version detection code to `App.tsx`
- [ ] Add TypeScript definitions to `env.d.ts`
- [ ] Create `public/sw.js` with smart caching
- [ ] Create/update `vercel.json` with headers
- [ ] Add `VITE_APP_VERSION` to Vercel environment variables
- [ ] Verify Vercel build settings (Framework: Vite, Output: dist)
- [ ] Test: Deploy, visit site, check console logs
- [ ] Test: Deploy again, verify automatic cache clear
- [ ] Test: Ensure users stay logged in after update

---

## 🧪 Testing

### Test New Deployment:

1. Open DevTools Console
2. Deploy new code to Vercel
3. Refresh your browser
4. Look for console logs:
   ```
   🔍 Deployment check: { current: "def456", stored: "abc123" }
   🚀 NEW DEPLOYMENT DETECTED - Clearing caches and reloading...
   🗑️ Deleting cache: your-app-v1
   🗑️ Removed localStorage key: some-stale-key
   ✅ Cache clearing complete, reloading in 100ms...
   ```

### Verify No Caching:

1. Network tab → Reload page
2. Check `index.html` response headers:
   ```
   Cache-Control: no-store, no-cache, must-revalidate
   ```
3. Should show `200` (not `304 Not Modified`)

### Test Authentication Preservation:

1. Log in to your app
2. Deploy a new version
3. Visit the site
4. Should see cache clear logs
5. After reload, **you should still be logged in**

---

## 🐛 Troubleshooting

### Users still seeing old version?

**Check:**
1. `vercel.json` is in project root
2. Vercel dashboard shows correct build settings
3. `VITE_APP_VERSION` is set in Vercel env vars
4. Service worker is registered (check DevTools → Application → Service Workers)
5. Console shows version detection logs

### Users getting logged out?

**Fix:**
- Verify `authKeysToPreserve` array includes your auth token keys
- Check your auth library's storage keys
- Common keys: `supabase.auth.token`, `auth0.token`, `firebase.auth`

### Version not updating?

**Check:**
1. `import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA` is available (log it)
2. If not, ensure `VITE_APP_VERSION` is set in Vercel
3. Increment `VITE_APP_VERSION` manually for testing

---

## 🎉 Result

**Before:** Users stuck on broken versions, manual cache clearing required  
**After:** Every deployment automatically pushes to all users within seconds, zero manual intervention

This is **enterprise-grade cache invalidation** that solved our version fragmentation nightmare!

---

## 📝 Notes

- This solution works with **any React SPA on Vercel** (not just Vite)
- Adapt the Service Worker for your static assets
- Adjust `authKeysToPreserve` for your auth provider
- The console logs are helpful for debugging but can be removed in production
- Consider adding error tracking (Sentry, LogRocket) to monitor cache clearing failures

---

## 🤝 Credits

Developed and battle-tested on **Pull-Up Club** with thousands of users. Zero cache-related support tickets since implementation.

---

**Questions?** This system is bulletproof. Implement it once, never think about cache issues again. 🛡️

