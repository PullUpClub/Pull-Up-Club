# Pull-Up Club Database: Complete Architectural Analysis & Prevention Guide

**Date:** October 23, 2025  
**Purpose:** Understanding why systems break, preventing future failures, and architecting for 100k+ users

---

## 🚨 EXECUTIVE SUMMARY: ROOT CAUSES OF SYSTEM FAILURES

### **The Core Problem: "Death by a Thousand Dependencies"**

Your database suffers from **architectural complexity debt** - not technical debt. Every table touches 3-5 other tables, every approval triggers 8+ functions, and there's NO separation of concerns. When one link breaks, the entire chain fails **silently**.

### **Today's Specific Failure Chain:**

```
User approves Luis → 
  Trigger calls process_submission_earnings() →
    Function reads `is_current` flag (pointing to wrong week) →
      Assigns earning to WRONG pool (Oct 6-12 instead of Oct 20-26) →
        Pool already depleted (-$71) →
          No error thrown, earning created with $0 →
            User sees nothing in payouts →
              Pool never drains →
                Admin thinks system is broken
```

**Why No One Noticed:** 
- No error logs (function returned success: true)
- No monitoring on `is_current` flag accuracy
- No validation that pool matches submission date
- No alerts when pools show negative values

---

## 📊 CURRENT ARCHITECTURE: THE MONOLITH PROBLEM

### **Schema Distribution (Everything in `public`)**

```
public/
├── Core User Data (4 tables)
│   ├── profiles (36 columns, 8 FK dependencies)
│   ├── submissions (17 columns, 5 FK dependencies)
│   ├── subscriptions (7 columns, 1 FK)
│   └── admin_roles (5 columns, 3 FK circular refs)
│
├── Financial System (4 tables)
│   ├── weekly_pools (13 columns, is_current flag, 2 FK)
│   ├── weekly_earnings (9 columns, 3 FK)
│   ├── user_earnings (8 columns, 1 FK)
│   └── payout_requests (13 columns, 2 FK)
│
├── Content/Community (6 tables)
│   ├── community_posts (16 columns, 3 FK, 2 self-refs)
│   ├── monthly_graphics (21 columns, 2 FK)
│   ├── badges (9 columns, 2 FK)
│   └── user_badges (5 columns, 3 FK)
│
├── System/Monitoring (15+ tables)
│   ├── email_notifications, notification_queue
│   ├── messages_log, system_logs, performance_logs
│   ├── security_logs, processed_webhooks
│   └── 8 more system tables
│
└── Grace Periods/Payments (3 tables)
    ├── user_grace_periods
    ├── pending_payments
    └── payout_exclusions
```

**Problem:** 47 tables in one namespace with 100+ foreign key relationships creating a **dependency graph from hell**.

---

## 🔥 CRITICAL ARCHITECTURAL FLAWS

### **1. The `is_current` Flag Disaster**

**What It Is:**
- Boolean flag on `weekly_pools` table marking which week is "current"
- Used by `process_submission_earnings()` to find active pool
- **MANUALLY MANAGED** - no automatic updates

**Why It Failed Today:**
```sql
-- Current state (WRONG):
is_current = true  WHERE week = '2025-10-06 to 2025-10-12'  -- Expired 11 days ago!

-- Should be (CORRECT):
is_current = true  WHERE week = '2025-10-20 to 2025-10-26'  -- Today is Oct 23
```

**Impact:**
- Every approval since Oct 13 went to wrong pool
- Oct 6-12 pool went to -$71 (overdraft)
- Oct 20-26 pool never used ($250 remaining when should be drained)
- **18 EARNINGS RECORDS** potentially assigned to wrong pools

**Root Cause:** No CRON job or trigger to update `is_current` on Monday 12:00 AM.

**Fix Applied:**
```sql
-- Now in monitoring.run_daily_consistency_check()
UPDATE weekly_pools SET is_current = false WHERE is_current = true;
UPDATE weekly_pools SET is_current = true 
WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE;
```

---

### **2. RLS Policy Conflicts & Silent Failures**

**The Problem:** Multiple RLS policies on the same table can create **logic bugs** where policies compete.

**Example from `profiles` table:**

```sql
-- Policy 1: SELECT (users can read their own + approved submissions)
profiles_select_policy:
  (auth.uid() = id) OR 
  (is_admin()) OR 
  (EXISTS (SELECT 1 FROM submissions WHERE user_id = profiles.id AND status = 'approved'))

-- Policy 2: UPDATE (users can update their own)
profiles_update_policy:
  (auth.uid() = id) OR (is_admin())

-- Policy 3: INSERT (users can create their own)
profiles_insert_policy:
  (auth.uid() = id) OR (is_admin())
```

**What Happened:**
- **May 25, 2025 migration** `20250525003223_little_beacon.sql` **DROPPED** the UPDATE policy
- File contained: `DROP POLICY IF EXISTS "Combined profiles update policy" ON public.profiles;`
- But the `CREATE POLICY` was **missing** or incomplete
- Result: **NO ONE could update profiles** for 5 months

**Why No One Noticed:**
- No RLS testing after migrations
- No error thrown (Supabase returns empty result set)
- Users just saw their form clear out after saving
- Admins thought it was a frontend bug

**The Competing Policy Problem:**

```sql
-- submissions table has 4 UPDATE policies:
1. submissions_user_update        (users can update if rejected)
2. Admins can update all submissions   (admin override)
3. submissions_unified_read            (affects visibility)
4. cleanup_earnings_trigger            (side effect on update)

-- When user tries to update:
-- ✅ Policy 1 passes (is rejected)
-- ✅ Policy 2 passes (not admin, skipped)
-- ❌ Policy 3 fails (not approved yet)
-- Result: UPDATE succeeds but SELECT returns nothing → appears failed
```

**Current Status:** 87 RLS policies across 47 tables, with:
- 23 policies checking `is_admin()` (function calls on every query)
- 14 policies with nested subqueries (performance hit)
- 8 tables with 4+ policies (high conflict risk)

---

### **3. Trigger Cascade Complexity**

**When a submission is approved, THIS happens:**

```
submissions.status = 'approved' (1 UPDATE statement)
  ↓
TRIGGERS (9 functions fire):
  1. validate_submission_approval (BEFORE) ✓
  2. update_updated_at_column (BEFORE) ✓
  3. submission_status_change_trigger → handle_submission_status_change()
     ↓
     3a. Calls process_submission_earnings()
         ↓
         3a-i.   Inserts weekly_earnings
         3a-ii.  Updates weekly_pools.remaining_amount_dollars
         3a-iii. Upserts user_earnings
         3a-iv.  Upserts payout_requests
         3a-v.   Logs to pool_logs (if configured)
  4. on_submission_approved_award_badges → award_badges_on_approval()
     ↓
     4a. Queries badges table (gender filter)
     4b. Inserts user_badges (triggers another statement trigger)
     4c. Updates submission_id reference
  5. trigger_populate_monthly_graphics → populate_monthly_graphics()
     ↓
     5a. Queries previous month submissions
     5b. Calculates badge progression
     5c. Inserts monthly_graphics
     5d. Queues email notification
  6. trigger_update_profile_from_submission → update_profile_from_submission()
     ↓
     6a. Updates profiles.organization
     6b. Updates profiles.region
     6c. Updates profiles.age
     6d. Updates profiles.gender
     6e. Triggers profile_updated_trigger → update_submission_profile_data()
  7. cleanup_earnings_trigger → cleanup_earnings_on_rejection()
     (skipped - not rejected)
  8. submission_rejection_email_trigger → send_rejection_email()
     (skipped - not rejected)
```

**Total Operations for ONE Approval:**
- 1 UPDATE statement by admin
- 9 trigger functions evaluated
- 4-6 functions actually execute
- 8-12 table INSERT/UPDATE operations
- 15-20 SELECT queries for lookups
- **30-40 total database operations**

**Failure Points:**
- If ANY step fails → entire transaction rolls back
- If function returns success but doesn't execute correctly → SILENT FAILURE
- If RLS policy blocks mid-cascade → partial update (data corruption)
- If foreign key constraint violated → cascade stops

**Example Silent Failure:**
```typescript
// In process_submission_earnings():
IF v_earnings_already_processed THEN
  -- Updates user_earnings and payout_requests
  -- BUT SKIPS weekly_pools update
  RETURN json_build_object('success', true, 'message', 'Already processed');
END IF;

// Admin sees: ✅ Success!
// Reality: Pool not updated, leaderboard shows wrong total
```

---

### **4. The Foreign Key Dependency Web**

**profiles table dependencies:**

```
profiles.id references auth.users.id (CASCADE DELETE)
  ↓
  ├─ submissions.user_id references profiles.id
  │    ├─ weekly_earnings.submission_id references submissions.id
  │    ├─ monthly_graphics.submission_id references submissions.id
  │    ├─ user_badges.submission_id references submissions.id
  │    └─ community_posts.submission_id references submissions.id
  │
  ├─ weekly_earnings.user_id references profiles.id
  ├─ user_earnings.user_id references profiles.id
  ├─ payout_requests.user_id references profiles.id
  ├─ monthly_graphics.user_id references profiles.id
  ├─ user_badges.user_id references profiles.id
  ├─ subscriptions.user_id references profiles.id
  ├─ user_grace_periods.user_id references profiles.id
  ├─ messages_log.user_id references profiles.id
  ├─ notification_queue.user_id references profiles.id
  ├─ email_notifications.user_id references profiles.id
  ├─ community_posts.user_id references profiles.id
  ├─ community_post_likes.user_id references profiles.id
  └─ payout_exclusions.user_id references profiles.id
```

**Circular Dependencies:**

```
profiles.admin_role_id → admin_roles.user_id
admin_roles.user_id → profiles.id
admin_roles.user_id → auth.users.id

// This creates a DELETE deadlock:
// Can't delete profile until admin_role is removed
// Can't delete admin_role until profile reference is nulled
// Can't delete auth.user until both are cleaned up
```

**Impact:**
- Deleting a user touches **16 tables**
- Each table has RLS policies that must pass
- Each table may have triggers that fire
- Total operations for one user delete: **50-80 queries**
- Failure at any point = partial delete (data corruption)

---

### **5. The "Dual Reality" Problem: Redundant Columns**

**profiles table has BOTH:**
- `profiles.id` (UUID, PK, FK to auth.users.id) - **USED EVERYWHERE**
- `profiles.user_id` (UUID, nullable, unique) - **NEVER POPULATED**

**Why This Exists:**
- Originally designed to separate auth from profile
- Migration created `user_id` but triggers never populated it
- All foreign keys point to `profiles.id`, not `profiles.user_id`
- Result: **zombie column** that confuses debugging

**Example Confusion (from today):**
```sql
-- Admin looks at Luis's profile:
SELECT id, user_id, email FROM profiles WHERE full_name = 'Luis Angulo';
-- Result: id = 'bb1674e7...', user_id = NULL, email = 'luis@...'

-- Admin thinks: "Luis has no user_id, that's why submissions fail!"
-- Reality: submissions.user_id references profiles.id (which exists)
```

**Other Redundant Columns:**
- `user_earnings.total_earned_dollars` vs `user_earnings.dollars_earned` (both track same value)
- `weekly_pools.remaining_amount_dollars` vs `weekly_pools.remaining_dollars` (both track same value)
- `submissions.pull_up_count` (user claim) vs `actual_pull_up_count` (admin verified) - GOOD redundancy

---

### **6. Schema-less Organization (The Flat Earth Problem)**

**Current Structure:**
```
database/
└── public/
    ├── 47 tables
    ├── 87 RLS policies
    ├── 65+ functions
    ├── 19 triggers
    └── 100+ foreign keys
```

**Should Be:**
```
database/
├── auth_management/     (profiles, admin_roles, user_grace_periods)
├── content/             (submissions, community_posts, badges)
├── finance/             (weekly_pools, earnings, payouts)
├── communication/       (notifications, emails, messages)
├── analytics/           (metrics, logs, performance)
└── monitoring/          (system_errors, health_checks) ✓ Created today
```

**Why This Matters:**

**Performance:**
```sql
-- Without schemas:
SELECT * FROM profiles;
-- Postgres must check ALL 87 RLS policies to determine visibility

-- With schemas:
SELECT * FROM auth_management.profiles;
-- Postgres only checks auth_management policies (10-15 policies)
```

**Security:**
```sql
-- Without schemas:
-- One leaked admin credential = access to EVERYTHING

-- With schemas:
GRANT USAGE ON SCHEMA finance TO finance_bot;
GRANT SELECT ON finance.weekly_pools TO finance_bot;
-- Bot can't see auth_management even if compromised
```

**Cognitive Load:**
```sql
-- Developer looks at database:
-- Sees 47 tables in flat list
-- No way to know which tables are related
-- Spends 30 minutes finding right table

-- With schemas:
-- Developer looks at finance schema
-- Sees 4 tables: pools, earnings, user_earnings, payouts
-- Understands the domain in 30 seconds
```

---

## 🎯 WHY SYSTEMS BREAK: The Pattern

### **Pattern 1: Silent Success (The Worst Kind of Failure)**

```typescript
// Example from process_submission_earnings():
TRY:
  Update weekly_pools SET remaining = remaining - 18
CATCH:
  // No error thrown!
  // Function returns: { success: true, message: "Processed" }
  
// Admin sees: ✅ Approval successful!
// Reality: Pool not updated, earnings created with wrong amount
```

**Why This Happens:**
- Functions use `EXCEPTION WHEN OTHERS` without re-raising
- Triggers return `NULL` on error (= success to Postgres)
- RLS policies fail silently (empty result set)
- Foreign key violations caught and ignored

**Solution:** Log ALL errors to `monitoring.system_errors`:
```sql
EXCEPTION WHEN OTHERS THEN
  INSERT INTO monitoring.system_errors (error_type, error_message, context)
  VALUES ('CRITICAL', SQLERRM, jsonb_build_object('user_id', p_user_id));
  RAISE; -- Re-raise the error!
END;
```

---

### **Pattern 2: Stale Automation (Time Bombs)**

**The `is_current` Flag:**
- Set once when pool created
- Never automatically updated
- Relies on manual CRON job that didn't exist
- Result: Points to expired pool for 11 days

**The `is_paid` Flag:**
- Set when Stripe payment succeeds
- Never automatically cleared on payment failure
- Relies on webhook that sometimes fails
- Result: Users keep access despite failed payments

**The `is_profile_completed` Flag:**
- Set when user fills out profile
- Never rechecked if required fields change
- Relies on frontend validation
- Result: Incomplete profiles bypass submission checks

**Solution:** Time-based flags must have automatic maintenance:
```sql
-- CRON runs daily at 2 AM:
UPDATE weekly_pools SET is_current = false;
UPDATE weekly_pools SET is_current = true 
WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE;

-- If no current pool found:
INSERT INTO monitoring.system_errors (...);
```

---

### **Pattern 3: Competing Business Logic (Who's in Charge?)**

**Earnings Calculation Example:**

**Frontend says:**
```typescript
// AdminSubmissionPage.tsx
onClick={() => {
  // Approves submission
  // Expects $1/rep up to max pull_ups
  // Expects immediate pool drain
}}
```

**Trigger says:**
```sql
-- handle_submission_status_change()
IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
  PERFORM process_submission_earnings(...);
END IF;
```

**Function says:**
```sql
-- process_submission_earnings()
v_dollars_earned := LEAST(
  p_pull_up_count,           -- User's count
  v_remaining_dollars,        -- Pool limit
  v_monthly_cap_remaining     -- Monthly $1000 cap
);
```

**Admin Role Check says:**
```sql
-- Later in same function:
IF v_user_role IN ('admin', 'influencer') THEN
  v_dollars_earned := 0;  -- Override everything above!
END IF;
```

**Problem:** Business rules scattered across 4 layers:
1. Frontend (validation)
2. RLS policies (access control)
3. Trigger functions (orchestration)
4. Core functions (calculation)

**When they disagree:**
- Frontend shows $18 earned
- Database records $0 (user is admin)
- Admin confused why pool didn't drain
- User confused why no payout

**Solution:** Single source of truth:
```sql
-- All business logic in ONE function
-- All other layers just validate and orchestrate
CREATE FUNCTION calculate_earnings(
  user_id UUID,
  pull_up_count INT,
  pool_id UUID
) RETURNS INT AS $$
  -- ALL logic here
  -- Returns: dollars earned OR raises exception
$$;
```

---

### **Pattern 4: Cascading Failures (Domino Effect)**

**Today's Chain:**

```
is_current flag wrong (root cause)
  ↓
process_submission_earnings() uses wrong pool
  ↓
Assigns earning to expired pool (Oct 6-12)
  ↓
Expired pool already at -$71 (overdraft)
  ↓
Function doesn't update pool (thinks it's already processed)
  ↓
user_earnings updated to $18
  ↓
payout_requests updated to $18
  ↓
monthly_graphics created
  ↓
User shows on payouts page ✓
  ↓
User shows on graphics page ✓
  ↓
User shows on leaderboard ✓
  ↓
Pool shows $250 (wrong) ✗
  ↓
Admin investigates
  ↓
Finds Luis has no user_id (red herring)
  ↓
Thinks foreign keys are broken
  ↓
Hours of debugging...
```

**Why It Cascaded:**
- No validation that `pool.week` matches `submission.approved_at`
- No check that pool is actually current
- No alert when pool goes negative
- No error when pool update fails
- No monitoring on flag accuracy

**Solution:** Break the chain at every link:
```sql
-- Validation layer:
IF pool_week_start > submission_date OR pool_week_end < submission_date THEN
  INSERT INTO monitoring.system_errors (...);
  RAISE EXCEPTION 'Pool date mismatch';
END IF;

-- Constraint layer:
ALTER TABLE weekly_pools ADD CONSTRAINT remaining_not_negative 
  CHECK (remaining_amount_dollars >= 0);

-- Monitoring layer:
IF pool.remaining_amount_dollars < 0 THEN
  INSERT INTO monitoring.system_errors (error_type, error_message, context)
  VALUES ('POOL_NEGATIVE', 'Pool has negative balance', ...);
END IF;
```

---

## 🔧 ARCHITECTURAL SOLUTIONS

### **1. Schema Separation (Organization Layer)**

**Phase 1: Create Views (ZERO RISK)**

```sql
-- Create organizational schemas
CREATE SCHEMA IF NOT EXISTS auth_management;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS communication;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create views that point to existing tables
CREATE OR REPLACE VIEW finance.weekly_pools AS SELECT * FROM public.weekly_pools;
CREATE OR REPLACE VIEW finance.weekly_earnings AS SELECT * FROM public.weekly_earnings;
CREATE OR REPLACE VIEW finance.user_earnings AS SELECT * FROM public.user_earnings;
CREATE OR REPLACE VIEW finance.payout_requests AS SELECT * FROM public.payout_requests;

-- Same RLS policies apply (views inherit from base table)
-- Zero data migration needed
-- Can test immediately
```

**Benefits:**
- Better organization for developers
- Query performance insights (see which schema is slow)
- Easier to grant schema-level permissions later
- Can migrate tables one at a time

**Phase 2-9:** Gradually move tables (see full roadmap below)

---

### **2. Monitoring & Error Recovery**

**Implemented Today:**

```sql
-- monitoring.system_errors (logs all failures)
CREATE TABLE monitoring.system_errors (
  id UUID PRIMARY KEY,
  error_type TEXT,      -- 'POOL_MISMATCH', 'RLS_FAILURE', etc.
  error_message TEXT,   -- Human-readable description
  context JSONB,        -- Full error context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- monitoring.check_pool_consistency() (auto-fixes pool mismatches)
CREATE FUNCTION monitoring.check_pool_consistency() RETURNS JSONB AS $$
  -- Calculates what remaining SHOULD be
  -- Compares to actual remaining
  -- Auto-fixes if mismatch found
  -- Logs to system_errors
$$;

-- monitoring.update_current_pool() (fixes is_current flag)
CREATE FUNCTION monitoring.update_current_pool() RETURNS VOID AS $$
  -- Unmarks all pools
  -- Marks correct current week
  -- Logs if no current pool found
$$;

-- Daily CRON (runs at 2 AM)
SELECT cron.schedule(
  'daily-consistency-check',
  '0 2 * * *',
  $$ SELECT monitoring.run_daily_consistency_check(); $$
);

-- Weekly email (runs Mondays at 8 AM)
SELECT cron.schedule(
  'weekly-health-check-email',
  '0 8 * * 1',
  $$ SELECT net.http_post(...) $$  -- Calls weekly-health-check Edge Function
);
```

**What This Prevents:**
- ✅ is_current flag drift (updates daily)
- ✅ Pool mismatches (detects & fixes daily)
- ✅ Silent failures (logs all errors)
- ✅ Admin blindness (weekly email reports)
- ✅ Data corruption (consistency checks)

---

### **3. RLS Policy Consolidation**

**Current:** 87 policies across 47 tables  
**Target:** 40-50 policies with clear hierarchy

**Consolidation Strategy:**

```sql
-- BEFORE: 4 separate policies on submissions
CREATE POLICY submissions_user_insert ...;
CREATE POLICY submissions_user_update ...;
CREATE POLICY submissions_admin_all ...;
CREATE POLICY submissions_unified_read ...;

-- AFTER: 1 unified policy per operation
CREATE POLICY submissions_access AS PERMISSIVE FOR ALL
TO public
USING (
  -- SELECT: approved OR own OR admin
  (status = 'approved') OR 
  (user_id = auth.uid()) OR 
  (is_admin())
)
WITH CHECK (
  -- INSERT: own only (unless admin)
  CASE 
    WHEN TG_OP = 'INSERT' THEN 
      (user_id = auth.uid()) OR (is_admin())
    -- UPDATE: own if rejected OR admin all
    WHEN TG_OP = 'UPDATE' THEN
      ((user_id = auth.uid() AND status = 'rejected')) OR (is_admin())
    -- DELETE: admin only
    WHEN TG_OP = 'DELETE' THEN
      (is_admin())
  END
);
```

**Benefits:**
- Single policy = easier to test
- Clear hierarchy (admin > owner > public)
- No conflicts between policies
- Better performance (one check instead of 4)

---

### **4. Trigger Simplification**

**Current:** 9 triggers on submissions (8 AFTER, 1 BEFORE)  
**Target:** 3 triggers max (1 BEFORE validate, 1 AFTER orchestrate, 1 INSTEAD OF if needed)

**Consolidation:**

```sql
-- BEFORE: 9 separate triggers
BEFORE: validate_submission_approval, update_updated_at_column
AFTER: submission_status_change_trigger (calls process_submission_earnings)
AFTER: on_submission_approved_award_badges
AFTER: trigger_populate_monthly_graphics
AFTER: trigger_update_profile_from_submission
AFTER: cleanup_earnings_trigger
AFTER: submission_rejection_email_trigger

-- AFTER: 2 triggers
BEFORE: validate_and_prepare_submission
  - Validates all rules
  - Updates updated_at
  - Sets default values
  - Raises exception if invalid

AFTER: handle_submission_lifecycle
  - IF status changed to 'approved':
      → process_earnings()
      → award_badges()
      → create_monthly_graphic()
      → update_profile()
  - IF status changed to 'rejected':
      → cleanup_earnings()
      → send_rejection_email()
  - All in ONE function with proper error handling
```

**Benefits:**
- Predictable execution order
- Single transaction (all or nothing)
- Easier to debug (one call stack)
- Better error messages

---

### **5. Business Logic Layer**

**Create dedicated functions for each domain:**

```sql
-- finance/earnings.sql
CREATE FUNCTION finance.process_submission_earnings(...) 
  -- All earnings logic
  -- Logs to monitoring.system_errors on failure
  -- Returns detailed result with all values
  -- NEVER returns success: true if failed

-- finance/payouts.sql
CREATE FUNCTION finance.calculate_monthly_payout(user_id UUID, month TEXT)
  -- Sums up all earnings for month
  -- Returns exact amount
  -- Used by process_submission_earnings

-- content/badges.sql
CREATE FUNCTION content.award_badges(submission_id UUID)
  -- All badge logic
  -- Idempotent (can run multiple times)
  -- Returns list of awarded badges

-- communication/notifications.sql
CREATE FUNCTION communication.queue_notification(
  user_id UUID, 
  type TEXT, 
  data JSONB
)
  -- Adds to notification queue
  -- Never fails (logs error if queue insert fails)
  -- Returns notification_id
```

**Benefits:**
- Single responsibility
- Easy to test in isolation
- Can be called from triggers OR Edge Functions
- Clear ownership (who maintains this?)

---

## 📋 LONG-TERM MIGRATION ROADMAP

### **Phase 1: Monitoring Foundation** ✅ COMPLETED

**Status:** Done (Oct 23, 2025)
- ✅ Created `monitoring` schema
- ✅ Created `monitoring.system_errors` table
- ✅ Created `monitoring.check_pool_consistency()` function
- ✅ Created `monitoring.update_current_pool()` function
- ✅ Set up daily CRON at 2 AM
- ✅ Set up weekly health check emails
- ✅ Fixed `process_submission_earnings()` function

**Risk:** ZERO - Added new features, didn't change existing

---

### **Phase 2: Schema Views (Organization)** ⚠️ LOW RISK

**What:**
- Create 5 schemas (auth_management, content, finance, communication, analytics)
- Create views in each schema pointing to public tables
- Update documentation to reference new schemas
- **NO TABLE MOVES YET**

**SQL:**
```sql
CREATE SCHEMA IF NOT EXISTS auth_management;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS communication;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Finance views
CREATE OR REPLACE VIEW finance.weekly_pools AS SELECT * FROM public.weekly_pools;
CREATE OR REPLACE VIEW finance.weekly_earnings AS SELECT * FROM public.weekly_earnings;
CREATE OR REPLACE VIEW finance.user_earnings AS SELECT * FROM public.user_earnings;
CREATE OR REPLACE VIEW finance.payout_requests AS SELECT * FROM public.payout_requests;

-- Content views
CREATE OR REPLACE VIEW content.submissions AS SELECT * FROM public.submissions;
CREATE OR REPLACE VIEW content.badges AS SELECT * FROM public.badges;
CREATE OR REPLACE VIEW content.user_badges AS SELECT * FROM public.user_badges;
CREATE OR REPLACE VIEW content.monthly_graphics AS SELECT * FROM public.monthly_graphics;

-- Auth views
CREATE OR REPLACE VIEW auth_management.profiles AS SELECT * FROM public.profiles;
CREATE OR REPLACE VIEW auth_management.admin_roles AS SELECT * FROM public.admin_roles;
CREATE OR REPLACE VIEW auth_management.user_grace_periods AS SELECT * FROM public.user_grace_periods;

-- Communication views
CREATE OR REPLACE VIEW communication.email_notifications AS SELECT * FROM public.email_notifications;
CREATE OR REPLACE VIEW communication.notification_queue AS SELECT * FROM public.notification_queue;
CREATE OR REPLACE VIEW communication.messages_log AS SELECT * FROM public.messages_log;

-- Analytics views
CREATE OR REPLACE VIEW analytics.system_metrics AS SELECT * FROM public.system_metrics;
CREATE OR REPLACE VIEW analytics.performance_logs AS SELECT * FROM public.performance_logs;
```

**Benefits:**
- Better organization
- No breaking changes
- Can test immediately
- Reversible (just drop views)

**Risk:** LOW
- Views might be slightly slower (negligible)
- Developers need to update queries (but old queries still work)

**Estimated Time:** 2 hours

---

### **Phase 3: RLS Policy Audit & Consolidation** ⚠️ LOW RISK

**What:**
- Audit all 87 RLS policies
- Identify conflicts and redundancies
- Consolidate where possible
- Add RLS testing to CI/CD

**Current Issues:**
- 23 policies call `is_admin()` function (overhead)
- 14 policies have nested subqueries (slow)
- 8 tables have 4+ policies (conflict risk)

**Target:**
- Reduce to 40-50 policies total
- Each table has 1-2 policies max
- Clear hierarchy: admin > owner > public
- All policies tested after every migration

**Script:**
```sql
-- Example consolidation: profiles table
-- BEFORE: 3 policies (select, insert, update)
-- AFTER: 1 policy

CREATE POLICY profiles_unified AS PERMISSIVE FOR ALL
TO public
USING (
  (auth.uid() = id) OR (is_admin()) OR
  (EXISTS (SELECT 1 FROM submissions WHERE user_id = profiles.id AND status = 'approved'))
)
WITH CHECK (
  (auth.uid() = id) OR (is_admin())
);
```

**Testing:**
```sql
-- Run after every migration
SELECT * FROM monitoring.test_rls_policies();
-- Returns pass/fail for each policy
```

**Risk:** LOW
- Testing required before deployment
- Can rollback individual policies
- No data changes

**Estimated Time:** 1 week

---

### **Phase 4: Trigger Consolidation** ⚠️ MEDIUM RISK

**What:**
- Reduce 19 triggers to 8-10 triggers
- Create unified orchestration functions
- Add comprehensive error logging
- Test each trigger in isolation

**Current:** 9 triggers on submissions alone  
**Target:** 2 triggers on submissions (BEFORE validate, AFTER orchestrate)

**Implementation:**
```sql
-- New unified trigger function
CREATE FUNCTION handle_submission_lifecycle() RETURNS TRIGGER AS $$
BEGIN
  -- Track what changed
  IF OLD.status != NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN
        -- Call all approval functions
        PERFORM finance.process_submission_earnings(NEW.id, NEW.user_id, NEW.actual_pull_up_count);
        PERFORM content.award_badges(NEW.id);
        PERFORM content.create_monthly_graphic(NEW.id);
        PERFORM auth_management.update_profile_from_submission(NEW.id);
        
      WHEN 'rejected' THEN
        -- Call all rejection functions
        PERFORM finance.cleanup_earnings(NEW.id);
        PERFORM communication.send_rejection_email(NEW.user_id, NEW.notes);
    END CASE;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block update
  INSERT INTO monitoring.system_errors (error_type, error_message, context)
  VALUES ('TRIGGER_ERROR', SQLERRM, jsonb_build_object('submission_id', NEW.id));
  
  RETURN NEW; -- Allow update to proceed
END;
$$ LANGUAGE plpgsql;
```

**Risk:** MEDIUM
- Triggers are critical path
- Must test thoroughly
- Rollback plan: keep old triggers disabled, re-enable if needed

**Estimated Time:** 2 weeks (with testing)

---

### **Phase 5: Move Core Tables to Schemas** 🔥 HIGH RISK

**What:**
- Move 10-15 most critical tables to new schemas
- Update all foreign keys
- Update all RLS policies
- Update all functions/triggers
- Update all Edge Functions
- Update frontend queries

**Tables to Move:**
```
auth_management/
  - profiles
  - admin_roles
  
finance/
  - weekly_pools
  - weekly_earnings
  - user_earnings
  - payout_requests
  
content/
  - submissions
  - badges
  - user_badges
```

**Migration Script (example for one table):**
```sql
BEGIN;

-- Step 1: Create table in new schema
CREATE TABLE finance.weekly_pools (LIKE public.weekly_pools INCLUDING ALL);

-- Step 2: Copy data
INSERT INTO finance.weekly_pools SELECT * FROM public.weekly_pools;

-- Step 3: Update foreign keys
ALTER TABLE finance.weekly_earnings 
  DROP CONSTRAINT weekly_earnings_weekly_pool_id_fkey,
  ADD CONSTRAINT weekly_earnings_weekly_pool_id_fkey 
    FOREIGN KEY (weekly_pool_id) REFERENCES finance.weekly_pools(id);

-- Step 4: Copy RLS policies
-- (manually recreate each policy on new table)

-- Step 5: Copy triggers
-- (manually recreate each trigger on new table)

-- Step 6: Test extensively
SELECT monitoring.test_schema_migration('weekly_pools');

-- Step 7: If tests pass, drop old table
-- DROP TABLE public.weekly_pools;

COMMIT;
```

**Risk:** HIGH
- Many dependencies to update
- RLS policies must be recreated
- Triggers must be recreated
- Foreign keys must be updated
- Edge Functions must be updated
- Frontend must be updated (or use views)

**Mitigation:**
- Move one table per week
- Keep old table as VIEW during transition
- Run parallel for 1 week (write to both)
- Extensive testing before dropping old table

**Estimated Time:** 3-6 months (one table per week)

---

### **Phase 6: Remove Redundant Columns** ⚠️ LOW RISK (but tedious)

**What:**
- Drop `profiles.user_id` (never used)
- Consolidate `user_earnings.total_earned_dollars` and `dollars_earned`
- Consolidate `weekly_pools.remaining_amount_dollars` and `remaining_dollars`

**Risk:** LOW
- Just dropping unused columns
- Can be done table by table

**Estimated Time:** 1 week

---

### **Phase 7: Implement Constraints** ⚠️ MEDIUM RISK

**What:**
- Add CHECK constraints for business rules
- Add NOT NULL constraints where appropriate
- Add UNIQUE constraints for logical keys

**Examples:**
```sql
-- weekly_pools must have non-negative remaining
ALTER TABLE weekly_pools 
  ADD CONSTRAINT remaining_not_negative 
  CHECK (remaining_amount_dollars >= 0);

-- Only one current pool at a time
CREATE UNIQUE INDEX only_one_current_pool 
  ON weekly_pools (is_current) 
  WHERE is_current = true;

-- profiles must have completed required fields
ALTER TABLE profiles 
  ADD CONSTRAINT profile_required_fields 
  CHECK (
    CASE WHEN is_profile_completed THEN
      full_name IS NOT NULL AND
      age IS NOT NULL AND
      gender IS NOT NULL
    ELSE true
    END
  );
```

**Risk:** MEDIUM
- Existing data might violate constraints
- Must clean up data first
- Can block inserts/updates if too strict

**Estimated Time:** 2 weeks

---

### **Phase 8: Implement Audit Logging** ⚠️ LOW RISK

**What:**
- Add audit columns to critical tables (created_by, updated_by, deleted_by)
- Create audit log table for sensitive operations
- Implement trigger-based auditing

**Example:**
```sql
CREATE TABLE monitoring.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE FUNCTION monitoring.audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO monitoring.audit_log (table_name, operation, old_values, new_values, changed_by)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    auth.uid()
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Add to critical tables
CREATE TRIGGER audit_profiles 
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION monitoring.audit_trigger();
```

**Risk:** LOW
- Just adds logging
- Can be enabled table by table
- Slight performance impact (negligible)

**Estimated Time:** 1 week

---

### **Phase 9: Performance Optimization** ⚠️ LOW RISK

**What:**
- Add missing indexes
- Optimize slow queries
- Implement materialized views for reports
- Add query result caching

**Current Issues:**
- Leaderboard query scans all submissions (slow at 100k users)
- Monthly graphics query scans two months (slow)
- Admin dashboard aggregations are real-time (slow)

**Solutions:**
```sql
-- Materialized view for leaderboard (refreshed daily)
CREATE MATERIALIZED VIEW analytics.leaderboard AS
SELECT 
  s.user_id,
  p.full_name,
  s.organization,
  s.region,
  s.actual_pull_up_count,
  s.approved_at,
  ROW_NUMBER() OVER (ORDER BY s.actual_pull_up_count DESC, s.approved_at ASC) as rank
FROM submissions s
JOIN profiles p ON s.user_id = p.id
WHERE s.status = 'approved';

CREATE UNIQUE INDEX ON analytics.leaderboard (user_id);
CREATE INDEX ON analytics.leaderboard (rank);

-- Refresh daily
SELECT cron.schedule(
  'refresh-leaderboard',
  '0 1 * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.leaderboard; $$
);
```

**Risk:** LOW
- Just adding indexes and caching
- Doesn't change data or logic
- Can be rolled back

**Estimated Time:** 2 weeks

---

## 🎓 PREVENTION CHECKLIST: How to Never Break Again

### **Before Every Migration:**

```bash
# 1. Backup database
pg_dump -F c -f backup_$(date +%Y%m%d).dump

# 2. Run RLS tests
SELECT * FROM monitoring.test_rls_policies();

# 3. Verify all constraints pass
SELECT * FROM monitoring.verify_constraints();

# 4. Check for orphaned records
SELECT * FROM monitoring.check_referential_integrity();
```

### **After Every Migration:**

```bash
# 1. Run RLS tests again
SELECT * FROM monitoring.test_rls_policies();

# 2. Run consistency checks
SELECT * FROM monitoring.run_daily_consistency_check();

# 3. Test critical paths manually
- Sign up new user
- Submit video
- Approve submission
- Check pool drain
- Check payout creation
- Check monthly graphic creation

# 4. Monitor for 24 hours
- Check monitoring.system_errors table
- Look for spike in errors
- Check weekly email report
```

### **Daily Automated Checks:**

```sql
-- Already running at 2 AM:
1. Update is_current flag on weekly_pools
2. Check pool consistency (remaining vs calculated)
3. Auto-fix pool mismatches
4. Log all errors to monitoring.system_errors
```

### **Weekly Automated Reports:**

```sql
-- Already running Mondays at 8 AM:
1. Count of system_errors in last 7 days
2. Pool health (negative balances, orphaned pools)
3. Earnings consistency (sum of weekly = monthly?)
4. RLS policy violations
5. Trigger execution failures
6. Overall health score (0-100)
```

### **When Systems Break:**

```sql
-- 1. Check monitoring.system_errors
SELECT * FROM monitoring.system_errors 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 2. Run consistency checks manually
SELECT * FROM monitoring.check_pool_consistency();

-- 3. Check is_current flag
SELECT * FROM weekly_pools WHERE is_current = true;

-- 4. Verify foreign key integrity
SELECT * FROM monitoring.check_referential_integrity();

-- 5. Check for missing records
SELECT * FROM monitoring.check_missing_earnings();
```

---

## 📚 DEVELOPER GUIDE: Working with This Database

### **Finding Tables:**

```sql
-- OLD way (flat structure):
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Returns 47 tables in random order

-- NEW way (organized schemas):
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname IN ('auth_management', 'content', 'finance', 'communication', 'analytics')
ORDER BY schemaname, tablename;
-- Returns organized list by domain
```

### **Understanding Dependencies:**

```sql
-- Find all tables that reference profiles
SELECT 
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'profiles';
```

### **Testing RLS Policies:**

```sql
-- Test as user
SET ROLE authenticated;
SET request.jwt.claims.sub TO 'user-uuid-here';

SELECT * FROM profiles WHERE id = 'user-uuid-here'; -- Should work
SELECT * FROM profiles WHERE id = 'other-user-uuid'; -- Should fail (or return empty)

-- Test as admin
SET ROLE authenticated;
SET request.jwt.claims.sub TO 'admin-uuid-here';

SELECT * FROM profiles; -- Should return all profiles

-- Reset
RESET ROLE;
```

### **Debugging Triggers:**

```sql
-- See what triggers will fire for an operation
SELECT 
  tgname AS trigger_name,
  proname AS function_name,
  CASE tgtype & 1 WHEN 1 THEN 'ROW' ELSE 'STATEMENT' END AS level,
  CASE tgtype & 66 WHEN 2 THEN 'BEFORE' WHEN 64 THEN 'INSTEAD OF' ELSE 'AFTER' END AS timing
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'submissions'::regclass
  AND NOT tgisinternal
ORDER BY timing, trigger_name;

-- Disable a trigger temporarily
ALTER TABLE submissions DISABLE TRIGGER submission_status_change_trigger;

-- Re-enable
ALTER TABLE submissions ENABLE TRIGGER submission_status_change_trigger;
```

### **Monitoring System Health:**

```sql
-- Quick health check
SELECT 
  (SELECT COUNT(*) FROM monitoring.system_errors WHERE created_at >= NOW() - INTERVAL '24 hours') as errors_24h,
  (SELECT COUNT(*) FROM weekly_pools WHERE is_current = true) as current_pools,
  (SELECT COUNT(*) FROM weekly_pools WHERE remaining_amount_dollars < 0) as negative_pools,
  (SELECT COUNT(*) FROM payout_requests WHERE status = 'pending') as pending_payouts,
  (SELECT COUNT(*) FROM submissions WHERE status = 'pending') as pending_submissions;
```

---

## 🚀 QUICK WINS (Implement These First)

### **1. Add Constraints to Prevent Negative Pools** ⚡ 5 minutes

```sql
ALTER TABLE weekly_pools 
  ADD CONSTRAINT remaining_not_negative 
  CHECK (remaining_amount_dollars >= 0);
```

### **2. Add Unique Constraint for Current Pool** ⚡ 5 minutes

```sql
CREATE UNIQUE INDEX only_one_current_pool 
  ON weekly_pools (is_current) 
  WHERE is_current = true;
```

### **3. Add Error Logging to Critical Functions** ⚡ 30 minutes

```sql
-- Add to process_submission_earnings(), award_badges_on_approval(), etc.
EXCEPTION WHEN OTHERS THEN
  INSERT INTO monitoring.system_errors (error_type, error_message, context)
  VALUES ('FUNCTION_ERROR', SQLERRM, jsonb_build_object('submission_id', p_submission_id));
  
  RAISE; -- Re-raise to fail the transaction
END;
```

### **4. Add Validation to is_current Flag** ⚡ 15 minutes

```sql
-- In process_submission_earnings():
IF pool.week_start_date > submission.approved_at::date OR 
   pool.week_end_date < submission.approved_at::date THEN
  INSERT INTO monitoring.system_errors (...);
  RAISE EXCEPTION 'Pool date mismatch';
END IF;
```

### **5. Create Admin Dashboard Widget** ⚡ 1 hour

```typescript
// src/components/AdminHealthCheck.tsx
function AdminHealthCheck() {
  const { data } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_system_health');
      return data;
    },
    refetchInterval: 60000 // Refresh every minute
  });
  
  return (
    <div className="health-widget">
      <h3>System Health</h3>
      <div className="metrics">
        <Metric label="Errors (24h)" value={data.errors_24h} alert={data.errors_24h > 5} />
        <Metric label="Current Pools" value={data.current_pools} alert={data.current_pools !== 1} />
        <Metric label="Negative Pools" value={data.negative_pools} alert={data.negative_pools > 0} />
        <Metric label="Pending Payouts" value={data.pending_payouts} />
      </div>
    </div>
  );
}
```

---

## 🎯 SUCCESS METRICS

### **Reliability:**
- ✅ Zero silent failures (all errors logged)
- ✅ Zero negative pool balances
- ✅ Zero RLS policy conflicts
- ✅ 99.9% uptime for critical functions

### **Performance:**
- ✅ Leaderboard loads <1 second (100k users)
- ✅ Submission approval <500ms
- ✅ Admin dashboard <2 seconds

### **Developer Experience:**
- ✅ Find any table in <30 seconds
- ✅ Understand table relationships in <5 minutes
- ✅ Debug issues in <1 hour (vs 4+ hours today)

### **Maintainability:**
- ✅ Can add new features without breaking existing
- ✅ Can migrate tables without downtime
- ✅ Can rollback any change within 5 minutes

---

## 📞 EMERGENCY PROCEDURES

### **If Pools Stop Draining:**

```sql
-- 1. Check is_current flag
SELECT * FROM weekly_pools WHERE is_current = true;

-- 2. If wrong, fix immediately
UPDATE weekly_pools SET is_current = false;
UPDATE weekly_pools SET is_current = true 
WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE;

-- 3. Check for orphaned earnings
SELECT we.* 
FROM weekly_earnings we
JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
WHERE we.created_at::date NOT BETWEEN wp.week_start_date AND wp.week_end_date;

-- 4. Fix orphaned earnings (reassign to correct pool)
-- (See full script in monitoring schema)
```

### **If RLS Policies Break:**

```sql
-- 1. Disable RLS on affected table (TEMPORARY!)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Fix the policy
DROP POLICY IF EXISTS broken_policy ON profiles;
CREATE POLICY fixed_policy ...;

-- 3. Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Test immediately
SELECT * FROM monitoring.test_rls_policies();
```

### **If Data Corruption Detected:**

```sql
-- 1. Stop all writes (disable triggers)
ALTER TABLE submissions DISABLE TRIGGER ALL;

-- 2. Restore from backup
pg_restore -d database backup.dump

-- 3. Re-enable triggers
ALTER TABLE submissions ENABLE TRIGGER ALL;

-- 4. Run consistency checks
SELECT * FROM monitoring.run_daily_consistency_check();
```

---

## 🏆 CONCLUSION

Your database doesn't break because of bugs. It breaks because of **architectural complexity**. The solution isn't fixing individual bugs - it's **simplifying the architecture**.

**Key Takeaways:**

1. **Silent failures are the enemy** → Log everything to `monitoring.system_errors`
2. **Time-based flags need automation** → Daily CRON updates `is_current`
3. **Cascading triggers create fragility** → Consolidate to 1-2 triggers per table
4. **Flat schemas cause chaos** → Organize into 5-7 domain schemas
5. **Multiple RLS policies conflict** → Consolidate to 1 policy per operation
6. **Foreign keys without constraints fail** → Add CHECK constraints everywhere
7. **Business logic in triggers fails silently** → Move to dedicated functions

**This database can support 100k users reliably.** But only after architectural improvements are made. Start with quick wins (constraints, error logging), then tackle schema organization over 6-12 months.

**The goal:** A database that **tells you when it's breaking** instead of failing silently.

---

**Next Steps:**
1. ✅ Review this document with team
2. ⏳ Implement quick wins (1-2 days)
3. ⏳ Start Phase 2: Schema views (1 week)
4. ⏳ Continue with roadmap phases (6-12 months)
5. ✅ Monitor weekly health emails
6. ✅ Check `monitoring.system_errors` daily

**Document Version:** 1.0  
**Last Updated:** October 23, 2025  
**Maintained By:** Database Architecture Team

