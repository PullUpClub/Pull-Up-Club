import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Initialize performance monitoring
import './utils/performanceMonitor';
// Service worker registration will be handled inline below

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Enhanced service worker registration
if (import.meta.env.PROD) {
  const registerSW = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      registration.addEventListener('updatefound', () => {
        console.log('SW: Update found, new service worker installing...');
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('SW: New service worker activated');
              // Force reload to use new service worker
              window.location.reload();
            }
          });
        }
      });

      console.log('SW: Service worker registered successfully');
    } catch (error) {
      console.log('SW: Service worker registration failed:', error);
    }
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', registerSW);
  }
}
