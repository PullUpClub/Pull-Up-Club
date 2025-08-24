# Netlify Environment Variables Setup

## Required Environment Variables

To prevent build failures, you need to set these environment variables in your Netlify dashboard:

### Supabase Configuration
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Stripe Configuration
- `VITE_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key
- `VITE_STRIPE_MONTHLY_PRICE_ID` - Monthly subscription price ID
- `VITE_STRIPE_ANNUAL_PRICE_ID` - Annual subscription price ID

### Meta/Facebook Pixel
- `VITE_META_PIXEL_ID` - Meta Pixel ID
- `VITE_META_ACCESS_TOKEN` - Meta API access token
- `VITE_META_API_VERSION` - Meta API version (default: v21.0)

### Analytics
- `VITE_APP_GA4_MEASUREMENT_ID` - Google Analytics 4 measurement ID

### App Configuration
- `VITE_APP_VERSION` - App version (default: 1.0.0)
- `VITE_VERCEL_GIT_COMMIT_SHA` - Git commit SHA (optional)

## How to Set Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** > **Environment variables**
4. Add each variable with its corresponding value
5. Save the changes

## Build Configuration

The updated `netlify.toml` includes:
- Node.js version 20 (more stable)
- TypeScript compilation with `--noEmit` flag
- Proper build environment settings

## Troubleshooting

If you still get build errors:

1. **Check the build logs** in Netlify dashboard
2. **Verify all environment variables** are set correctly
3. **Try the build locally** with `npm run build` to test
4. **Check for missing dependencies** in package.json

## Alternative Build Commands

If the main build fails, you can try these alternatives:

- `npm run build-netlify` - Vite build only (no TypeScript check)
- `npm run build:strict` - Full TypeScript compilation + build
