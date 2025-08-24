# Pull-Up Club MVP

This project is a web application for the Pull-Up Club, allowing users to sign up, subscribe to a monthly plan, submit videos of their pull-up workouts, and compete on a leaderboard.

## Project Status

This project is in active development and has been significantly optimized for performance and scalability. Core functionality is robust and tested. Key features include:

- ✅ **User Authentication**: Secure email/password signup and login with Supabase Auth.
- ✅ **Profile Management**: User profiles with automatic metadata synchronization.
- ✅ **Stripe Integration**: $9.99/month subscription with Stripe Customer Portal for management.
- ✅ **Video Submission**: Support for YouTube, TikTok, and Instagram video URLs with clear validation rules.
- ✅ **Admin Dashboard**: Secure, token-based tools for managing submissions and users.
- ✅ **Highly Optimized Leaderboard**: A scalable, real-time leaderboard with advanced filtering.
- ✅ **Badge System**: Achievement tracking with progress indicators.
- ✅ **Email Notifications**: Comprehensive email system using Resend API for user communication.
- ✅ **Internationalization (i18n)**: UI translated into multiple languages.

## Tech Stack

*   **Frontend:** Vite, React, TypeScript, Tailwind CSS
*   **Backend:** Supabase (PostgreSQL Database, Auth, Edge Functions, Storage)
*   **Payments:** Stripe
*   **Email:** Resend API
*   **Key Dependencies:**
    *   `@supabase/supabase-js`
    *   `@supabase/auth-ui-react`
    *   `@stripe/stripe-js`
    *   `react-router-dom`
    *   `i18next` & `react-i18next`
    *   `lucide-react` (for icons)
    *   `date-fns` (for date utilities)

## Project Structure

```
.
├── public/                   # Static assets (images, etc.)
├── src/                      # Frontend source code
│   ├── components/           # Reusable React components
│   ├── context/              # React context providers (e.g., AuthContext)
│   ├── hooks/                # Custom React hooks
│   ├── i18n/                 # Internationalization and translation files
│   ├── lib/                  # Libraries and helper functions (e.g., supabase.ts, stripe.ts)
│   ├── pages/                # Page-level components (routed)
│   └── ...                   # Other directories
├── supabase/
│   ├── functions/            # Supabase Edge Functions source code
│   │   ├── admin-api/          # Generic admin API endpoint
│   │   ├── admin-delete-user/  # Securely deletes a user
│   │   ├── admin-submissions/  # Handles submission review by admins
│   │   ├── auth-trigger/       # Creates a user profile on new sign-up
│   │   ├── cancel-subscription/ # Cancels a Stripe subscription
│   │   ├── check-submission-eligibility/ # Validates if a user can submit
│   │   ├── create-checkout/    # Creates Stripe checkout sessions
│   │   ├── customer-portal/    # Creates Stripe customer portal sessions
│   │   ├── get-payment-history/ # Fetches user payment history
│   │   ├── request-payout/     # Handles user payout requests
│   │   ├── resend-webhook/     # Handles Resend API webhooks for email events
│   │   ├── stripe-webhooks/    # Handles incoming Stripe webhooks for payment events
│   │   ├── summon-flow/        # Sends workout summons to subscribers
│   │   ├── video-submission/   # Processes new video submissions
│   │   └── welcome-flow/       # Sends welcome messages to new subscribers
│   ├── migrations/           # Database schema migrations (SQL)
│   └── storage-policies/     # RLS policies for Supabase Storage
├── ...                     # Other configuration files
```

## Backend Overview (Supabase)

*   **Project ID:** `yqnikgupiaghgjtsaypr`
*   **Authentication:** Supabase Auth handles email/password sign-up, login, and JWT management. User metadata from the JWT is automatically synchronized with the `profiles` table.
*   **Database Schema:**
    *   `profiles`: User profiles with personal details and subscription status.
    *   `submissions`: Video submissions with a full approval workflow.
    *   `subscriptions`: Stripe subscription data.
    *   `leaderboard_cache`: A **materialized view** that pre-calculates the leaderboard for high-performance reads, refreshing automatically.
    *   `badges` & `user_badges`: Tables for managing the achievement system.
    *   `messages_log`, `notification_queue`, `email_events`: Tables supporting the notification and email system.
*   **Edge Functions:** Over 25 deployed Edge Functions handle critical backend logic like authentication, payments, notifications, and admin operations.
*   **Row-Level Security (RLS):** Security is enforced at the database level with highly optimized RLS policies. Policies have been refactored to evaluate user permissions once per query, drastically reducing latency.
*   **Database Security:** All functions that could be vulnerable to search path hijacking have been hardened by setting an explicit `search_path`.

## Scalability & Performance

The backend has been architected to support over 100,000 users and handle viral traffic spikes. Key optimizations include:

*   **Materialized View for Leaderboard**: The main leaderboard query is served from a pre-computed materialized view (`leaderboard_cache`) that refreshes every 30 seconds. This reduces query latency from several seconds to under 100ms.
*   **Strategic Indexing**: All frequently queried columns, especially those used for leaderboard filtering and sorting (`pull_up_count`, `approved_at`, `gender`, etc.), are indexed. This ensures that queries are highly efficient and use index-only scans.
*   **Optimized RLS Policies**: Row-Level Security policies were rewritten to wrap `auth.uid()` in a sub-select `(SELECT auth.uid())`. This prevents the function from being called for every row, making security checks constant-time operations.
*   **Connection Pooling**: All API traffic is routed through Supavisor in transaction mode. This allows the backend to handle thousands of concurrent client connections with a small pool of database connections, preventing exhaustion under load.
*   **Paginated API**: The frontend fetches leaderboard data in small, paginated chunks (e.g., 20 rows at a time), ensuring that the initial load is fast and the payload remains small, regardless of the total number of submissions.

## Key Features

### User Authentication & Profile Management
- Secure email/password authentication via Supabase Auth.
- Simplified signup flow.
- User profile data is automatically synced from JWT claims to the `profiles` table, ensuring data consistency for `is_paid` and `stripe_customer_id`.

### Subscription System
- Seamless $9.99/month subscription checkout powered by Stripe.
- **Stripe Customer Portal integration** allows users to manage their subscription (update payment methods, view invoices, cancel) directly through Stripe's hosted portal.

### Video Submission Workflow
- Support for YouTube, TikTok, and Instagram video URLs.
- Submission form includes clear, translated rules, including requirements for hand width.
- 30-day cooldown between approved submissions is enforced by the backend.

### Leaderboard System
- **High-Performance**: The leaderboard is powered by a materialized view, providing sub-second load times even with large datasets.
- **Advanced Filtering**: Users can filter the leaderboard by gender, organization, region, pull-up count ranges (10-20, 20-30, etc.), and earned badges.
- **Real-time Feel**: Data is paginated, and `keepPreviousData` provides a smooth browsing experience without flickering.

### Badge System
- Achievement badges are awarded based on pull-up performance.
- Users can track their progress toward the next badge level on their profile page.
- The badge system is integrated with the leaderboard filters.

### Admin Dashboard
- **Secure Submission Management**: Admins can review, approve, or reject submissions. Rejection notifications are sent to users via a secure, token-protected Edge Function.
- **Secure User Management**: Admins can manage user roles and delete users via a secure, token-protected Edge Function.

### Internationalization (i18n)
- The entire user interface supports multiple languages, with translations managed in JSON files.
- A language selector allows users to switch locales easily.

## Environment Variables

### Frontend (`.env` - in project root):
*   `VITE_SUPABASE_URL`: Your Supabase project URL.
*   `VITE_SUPABASE_ANON_KEY`: Your Supabase project anonymous key.
*   `VITE_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key.
*   `VITE_GA_MEASUREMENT_ID` (Optional): Google Analytics Measurement ID.

### Backend (Supabase Edge Functions):
These must be set in the Supabase project dashboard under Settings > Environment Variables, or via a `supabase/.env` file if using the Supabase CLI for local development (ensure this file is in `.gitignore`).
*   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin-level operations).
*   `STRIPE_SECRET_KEY`: Your Stripe secret key.
*   `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret for the `stripe-webhooks` function.
*   `APP_URL`: The base URL of your deployed application (e.g., `https://pullupclub.com`). Used in functions for constructing links.
*   `RESEND_API_KEY`: API key for Resend email service.
*   `RESEND_WEBHOOK_SECRET`: Webhook signing secret for Resend events.

## Getting Started

1.  **Clone the repository.**
2.  **Install dependencies:** `npm install`
3.  **Set up environment variables:**
    *   Create a `.env` file in the project root and populate it with your frontend keys (see above).
    *   Configure backend environment variables in your Supabase project settings or a local `supabase/.env` file.
4.  **Supabase Setup:**
    *   Ensure your Supabase project (`yqnikgupiaghgjtsaypr`) is running.
    *   Apply database migrations if setting up locally or if new migrations are pulled: `npx supabase db push` (if using Supabase CLI and migrations are synced locally).
    *   Deploy Edge Functions: `npx supabase functions deploy --project-ref yqnikgupiaghgjtsaypr` (or deploy individual functions).
    *   **Configure Redirect URLs for Auth:**
        * In your Supabase Dashboard, go to Authentication > URL Configuration
        * Set your Site URL to `https://pullupclub.com` (your production domain)
        * Add the following additional redirect URLs for development and deployment previews:
          ```
          http://localhost:3000/**
          https://**--pullupclub.netlify.app/**
          ```
        * These wildcard patterns will handle both local development and Netlify preview deployments.
5.  **Run the development server:** `npm run dev`

## Deployment on Netlify

1. **Connect your repository to Netlify**
2. **Configure the build settings:**
   * Build command: `npm run build`
   * Publish directory: `dist`
3. **Set environment variables:**
   * `VITE_SUPABASE_URL`: Your Supabase project URL
   * `VITE_SUPABASE_ANON_KEY`: Your Supabase project anonymous key
   * `VITE_SITE_URL`: Set to your domain (e.g., `https://pullupclub.com`)
   * `VITE_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
4. **Deploy the site**
5. **Verify authentication flows:**
   * Test sign-up, login, and password reset flows to ensure redirect URLs are working correctly.

## Next Steps

*   **Testing:** Implement comprehensive unit and integration tests.
*   **Real-time Features:** Add Supabase Realtime for live updates to notifications and other UI elements.
*   **Accessibility & SEO:** Continue to improve compliance and optimization.
*   **Documentation:** Maintain detailed code and user documentation as the project evolves.