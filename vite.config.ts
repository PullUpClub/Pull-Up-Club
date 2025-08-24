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
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@headlessui/react'],
        }
      }
    }
  }
});