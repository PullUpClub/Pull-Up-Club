/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_DATABASE_URL?: string;
  readonly VITE_LOGO_URL?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_META_PIXEL_ID?: string;
  readonly VITE_STRIPE_MONTHLY_PRICE_ID?: string;
  readonly VITE_STRIPE_ANNUAL_PRICE_ID?: string;
  readonly VITE_META_ACCESS_TOKEN?: string;
  readonly VITE_META_API_VERSION?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
  readonly VITE_APP_VERSION?: string;
  readonly BASE_URL?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 