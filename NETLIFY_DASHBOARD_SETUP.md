# Netlify Dashboard Configuration Guide

## **Current Issue Fixed**

The build was failing because of:
1. **Version conflicts** between local Vite (6.3.5) and Netlify's auto-installed Vite (7.1.3)
2. **Module resolution errors** in the build environment
3. **Inconsistent build commands** between dashboard and netlify.toml

## **Solution Implemented**

✅ **Updated `netlify.toml`:**
- Build command: `npm install && npm run build`
- Uses local Vite installation instead of npx
- Proper dependency management

✅ **Fixed TypeScript errors:**
- Added missing type declarations
- Fixed service worker type issues

## **Netlify Dashboard Settings**

### **Required Configuration:**

1. **Runtime:** Select **"Node.js"** from dropdown
2. **Base directory:** Leave empty (default)
3. **Package directory:** Leave empty (default)
4. **Build command:** `npm install && npm run build`
5. **Publish directory:** `dist`
6. **Functions directory:** `netlify/functions`

### **Step-by-Step Setup:**

1. **Go to your Netlify dashboard**
2. **Navigate to:** Site settings → Build & deploy → Build settings
3. **Update these fields:**

```
Runtime: Node.js
Base directory: (leave empty)
Package directory: (leave empty)  
Build command: npm install && npm run build
Publish directory: dist
Functions directory: netlify/functions
```

4. **Click "Save"**

### **Why This Works:**

- **`npm install && npm run build`** ensures dependencies are installed before building
- **Local Vite installation** prevents version conflicts
- **TypeScript check** runs before Vite build to catch errors early
- **Standard build process** that Netlify expects

## **Environment Variables**

Make sure these are set in **Site settings → Environment variables:**

### **Required Variables:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_STRIPE_MONTHLY_PRICE_ID`
- `VITE_STRIPE_ANNUAL_PRICE_ID`
- `VITE_META_PIXEL_ID`
- `VITE_META_ACCESS_TOKEN`
- `VITE_APP_GA4_MEASUREMENT_ID`

### **Optional Variables:**
- `VITE_APP_VERSION` (defaults to 1.0.0)
- `VITE_META_API_VERSION` (defaults to v21.0)

## **Deployment Process**

1. **Commit and push** your changes to GitHub
2. **Netlify will automatically:**
   - Install dependencies with `npm install`
   - Run TypeScript check with `tsc --noEmit`
   - Build with Vite using `vite build`
   - Deploy to `dist` directory

## **Troubleshooting**

If build still fails:

1. **Check build logs** for specific error messages
2. **Verify environment variables** are set correctly
3. **Test locally** with `npm run build`
4. **Check Node.js version** (should be 20)

## **Expected Build Output**

```
✓ 2427 modules transformed.
✓ built in 5.42s
```

The build should complete successfully with no TypeScript errors and proper Vite compilation.
