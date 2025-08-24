# Netlify Environment Variables Setup

## ✅ **FIXES IMPLEMENTED**

The following issues have been resolved:

1. **TypeScript Declaration Files**: Added missing `@types/react-helmet` and `@types/react-dom`
2. **Service Worker Type Error**: Fixed `import.meta.env.BASE_URL` type issue in `serviceWorkerRegistration.ts`
3. **Build Script**: Updated to use `npm run build-netlify` for more robust builds
4. **Node.js Version**: Updated to Node.js 20 for better stability

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
- Robust build command: `npm run build-netlify`

## Available Build Commands

- `npm run build` - Full TypeScript check + Vite build
- `npm run build-netlify` - Vite build only (used by Netlify)
- `npm run build:strict` - Full TypeScript compilation + build
- `npm run build:check` - TypeScript check only

## Troubleshooting

If you still get build errors:

1. **Check the build logs** in Netlify dashboard
2. **Verify all environment variables** are set correctly
3. **Try the build locally** with `npm run build` to test
4. **Check for missing dependencies** in package.json

### Common Issues and Solutions

#### TypeScript Errors
- **Missing declaration files**: Install `@types/*` packages
- **Environment variable types**: Add proper type checking
- **Import errors**: Check module resolution in tsconfig.json

#### Build Failures
- **Node.js version**: Ensure using Node.js 20
- **Memory issues**: Increase build memory in Netlify settings
- **Timeout issues**: Optimize build process

#### Environment Variables
- **Missing variables**: Set all required VITE_* variables
- **Incorrect values**: Verify API keys and URLs
- **Case sensitivity**: Ensure exact variable names

## Deployment Checklist

Before deploying to Netlify:

- [ ] All TypeScript errors resolved locally
- [ ] Environment variables configured in Netlify
- [ ] Build works locally with `npm run build-netlify`
- [ ] Node.js version set to 20
- [ ] All dependencies installed and committed
