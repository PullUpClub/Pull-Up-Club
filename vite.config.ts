import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import type { Connect } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-routes',
      configureServer(server) {
        server.middlewares.use(async (req: Connect.IncomingMessage, res, next) => {
          if (req.url?.startsWith('/api/')) {
            try {
              // Get request body
              let body: any;
              if (req.method !== 'GET' && req.method !== 'HEAD') {
                const chunks: Buffer[] = [];
                for await (const chunk of req) {
                  chunks.push(Buffer.from(chunk));
                }
                const rawBody = Buffer.concat(chunks).toString('utf8');
                try {
                  body = JSON.parse(rawBody);
                } catch {
                  body = rawBody;
                }
              }

              const modulePath = resolve(process.cwd(), 'src', req.url.replace('/api/', 'pages/api/'));
              const module = await import(modulePath);
              const handler = module.default;
              
              // Convert Express request to Web API Request
              const url = new URL(req.url, `http://${req.headers.host}`);
              const request = new Request(url, {
                method: req.method,
                headers: new Headers(req.headers as any),
                body: body ? JSON.stringify(body) : undefined
              });

              // Handle the request
              const response = await handler(request);
              
              // Send the response
              res.statusCode = response.status;
              response.headers.forEach((value, key) => {
                res.setHeader(key, value);
              });
              
              const responseBody = await response.text();
              res.end(responseBody);
            } catch (error) {
              console.error('API Route Error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    port: 5173,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React libraries
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
          
          // UI libraries
          if (id.includes('@headlessui/react') || 
              id.includes('node_modules/framer-motion')) {
            return 'ui-vendor';
          }
          
          // Analytics and tracking
          if (id.includes('@vercel/analytics') || 
              id.includes('@vercel/speed-insights') ||
              id.includes('node_modules/react-ga4')) {
            return 'analytics';
          }
          
          // Query and state management
          if (id.includes('@tanstack/react-query') || 
              id.includes('node_modules/zustand')) {
            return 'query-vendor';
          }
          
          // Supabase libraries
          if (id.includes('@supabase')) {
            return 'supabase-vendor';
          }
          
          // i18n libraries
          if (id.includes('i18next') || 
              id.includes('react-i18next')) {
            return 'i18n-vendor';
          }
          
          // Stripe
          if (id.includes('@stripe')) {
            return 'stripe-vendor';
          }
          
          // Icons and utilities
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          
          // Date/time utilities
          if (id.includes('date-fns') || 
              id.includes('dayjs')) {
            return 'date-vendor';
          }
          
          // Toast notifications
          if (id.includes('react-hot-toast')) {
            return 'toast-vendor';
          }
          
          // Lenis smooth scroll
          if (id.includes('lenis')) {
            return 'lenis-vendor';
          }
          
          // Community page (large page, separate chunk)
          if (id.includes('/pages/Community/')) {
            return 'page-community';
          }
          
          // FAQ page (large page, separate chunk)
          if (id.includes('/pages/FAQ/')) {
            return 'page-faq';
          }
          
          // Admin pages (not needed by regular users)
          if (id.includes('/pages/Admin/')) {
            return 'page-admin';
          }
          
          // Other large pages
          if (id.includes('/pages/Profile/')) {
            return 'page-profile';
          }
          
          if (id.includes('/pages/Subscription/')) {
            return 'page-subscription';
          }
          
          if (id.includes('/pages/VideoSubmission/')) {
            return 'page-video-submission';
          }
          
          // All other node_modules
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        }
      }
    },
    // Increase chunk size warning limit since we're intentionally chunking
    chunkSizeWarningLimit: 1000,
    // Optimize for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
  }
});