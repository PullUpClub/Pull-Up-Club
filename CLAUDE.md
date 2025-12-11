# Pull-Up Club - Project Context for Claude

## Project Overview
Pull-Up Club is a monthly pull-up competition platform where users submit video demonstrations of their pull-ups to compete for monetary prizes. Users pay $9.99/month to participate and earn $1 per verified pull-up from weekly $250 prize pools.

**Live Site:** https://pullupclub.com
**Supabase Project ID:** `yqnikgupiaghgjtsaypr`

## Tech Stack
- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **Payments:** Stripe (subscriptions, checkout, customer portal)
- **Email:** Resend API
- **Image Generation:** HTMLCSSTOIMAGE API (monthly graphics)
- **Deployment:** Netlify
- **i18n:** i18next for multi-language support

## Project Structure
```
Pull-Up-Club/
├── src/
│   ├── components/       # React components organized by feature
│   │   ├── Admin/        # Admin dashboard components
│   │   ├── Auth/         # Authentication components
│   │   ├── Community/    # Community features
│   │   ├── Layout/       # Header, Footer, Navigation
│   │   ├── Leaderboard/  # Leaderboard display
│   │   ├── Profile/      # User profile components
│   │   ├── PUCBank/      # Earnings/payout components
│   │   ├── Stripe/       # Payment components
│   │   └── ui/           # Shared UI components
│   ├── pages/            # Route-level page components
│   │   ├── Admin/        # Admin pages
│   │   ├── Home/         # Landing page
│   │   ├── Profile/      # User profile page
│   │   ├── Submission/   # Video submission page
│   │   └── ...
│   ├── context/          # React context (AuthContext)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries (supabase.ts, stripe.ts)
│   ├── i18n/             # Translations
│   └── types/            # TypeScript type definitions
├── supabase/
│   ├── functions/        # 35+ Edge Functions
│   └── migrations/       # Database migrations
├── public/               # Static assets
└── api/                  # Vercel API routes (if any)
```

## Key Edge Functions
| Function | Purpose |
|----------|---------|
| `auth-trigger` | Auto-creates user profile on signup |
| `stripe-webhooks` | Handles Stripe payment events |
| `create-checkout` | Creates Stripe checkout sessions |
| `video-submission` | Processes new video submissions |
| `admin-submissions` | Admin approval/rejection workflow |
| `request-payout` | Handles user payout requests |
| `send-email` / `resend-email` | Email delivery via Resend |
| `generate-monthly-graphic` | Creates shareable monthly stats images |
| `summon-flow` | Daily workout challenges |
| `welcome-flow` | New subscriber onboarding emails |

## Database Schema (Key Tables)
- **`profiles`** - User data, subscription status, PayPal email
- **`submissions`** - Video submissions with approval workflow
- **`subscriptions`** - Stripe subscription tracking
- **`weekly_pools`** - $250 weekly prize pools
- **`weekly_earnings`** - User earnings per submission
- **`user_earnings`** - Monthly aggregated earnings
- **`payout_requests`** - PayPal payout requests
- **`badges`** / **`user_badges`** - Achievement system
- **`leaderboard_cache`** - Materialized view for fast leaderboard queries

## Business Rules
1. **Payment-first onboarding** - Users must pay before creating account
2. **$1 per verified pull-up** from weekly $250 pools
3. **30-day cooldown** between approved submissions
4. **Admin verification** required for all submissions
5. **PayPal payouts** - Manual admin process after user request

## Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test:e2e     # Playwright tests

# Supabase
supabase functions deploy          # Deploy all Edge Functions
supabase functions deploy <name>   # Deploy specific function
supabase db push                   # Apply migrations
```

## Environment Variables
Frontend (`.env`):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `VITE_SITE_URL` - Production URL (https://pullupclub.com)

Backend (Supabase Dashboard):
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `HTMLCSSTOIMAGE_API_KEY` / `HTMLCSSTOIMAGE_API_ID`

## Recent Work (as of Dec 2024)
Based on git history, recent commits include:
- Monthly graphics email generation with HTMLCSSTOIMAGE API
- Code splitting fixes for circular dependencies
- Pool banner improvements (always show dollar amounts)
- Cache-busting and logging for pool status display
- Hero user count fixes
- Realtime broadcast authorization for community features
- Badge system data seeding

## Key Files to Reference
- `src/App.tsx` - Main app router and layout
- `src/context/AuthContext.tsx` - Authentication state management
- `src/lib/supabase.ts` - Supabase client configuration
- `src/pages/Home/HomePage.tsx` - Landing page
- `src/pages/Profile/ProfilePage.tsx` - User dashboard
- `supabase/functions/stripe-webhooks/index.ts` - Payment processing

## Performance Optimizations
- **Materialized view** (`leaderboard_cache`) for fast leaderboard queries
- **Strategic indexing** on frequently queried columns
- **Optimized RLS policies** with subselect pattern for `auth.uid()`
- **Connection pooling** via Supavisor
- **Paginated API** responses (20 rows per page)

## Notes
- The project uses Tanstack Query for data fetching
- Framer Motion for animations
- Lucide React for icons
- React Hot Toast for notifications
