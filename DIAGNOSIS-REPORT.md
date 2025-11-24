# PULL-UP CLUB EARNINGS SYSTEM - FULL DIAGNOSIS REPORT
**Date:** September 30, 2025  
**Project ID:** yqnikgupiaghgjtsaypr

---

## 🔴 CRITICAL ISSUES FOUND

### **Issue #1: Missing `weekly_earnings` Table**
**Status:** BLOCKING - System cannot function  
**Location:** Database schema

**Problem:**
- Migration `20250610000002_fix_function_search_paths.sql` creates trigger `process_earnings_on_approval()` 
- This trigger tries to INSERT into `weekly_earnings` table (line 50)
- **The `weekly_earnings` table was NEVER created in any migration**
- Original migration `20250609000000_create_puc_bank_system.sql` only creates `user_earnings` table

**Impact:**
- When submissions are approved, the trigger fires
- The trigger FAILS SILENTLY because table doesn't exist
- No earnings are recorded
- Users never appear in earnings/payouts

---

### **Issue #2: Column Name Mismatch in `weekly_pools`**
**Status:** BLOCKING  
**Location:** `supabase/migrations/20250610000002_fix_function_search_paths.sql:73`

**Problem:**
```sql
-- Line 73 references columns that don't exist:
FROM weekly_pools wp
WHERE CURRENT_DATE BETWEEN wp.week_start_date AND wp.week_end_date
```

But the actual `weekly_pools` table schema has:
```sql
week_start TIMESTAMPTZ   -- NOT week_start_date
week_end TIMESTAMPTZ     -- NOT week_end_date
```

**Impact:**
- Even if `weekly_earnings` table existed, the INSERT would fail
- Error: column "week_start_date" does not exist

---

### **Issue #3: Weekly Pool Does NOT Drain**
**Status:** CRITICAL - Money tracking broken  
**Location:** Missing code in trigger `process_earnings_on_approval()`

**Problem:**
The OLD system (`process_submission_earnings` RPC) correctly drains the pool:
```sql
-- Lines 114-120 of 20250609000000_create_puc_bank_system.sql
UPDATE weekly_pools 
SET 
  remaining_dollars = remaining_dollars - v_dollars_earned,
  spent_dollars = spent_dollars + v_dollars_earned,
  is_depleted = (remaining_dollars - v_dollars_earned) <= 0,
  updated_at = NOW()
WHERE id = v_pool_id;
```

The NEW trigger (`process_earnings_on_approval()`) **NEVER updates the weekly_pools table**:
- It only INSERTs into `weekly_earnings`
- The pool's `remaining_dollars` stays at 250
- The pool's `spent_dollars` stays at 0
- Pool never depletes

**Impact:**
- Weekly pool appears to never drain
- No limit enforcement on earnings
- Financial tracking is completely broken
- Unlimited earnings from the same pool

---

### **Issue #4: Conflicting Table Schemas**
**Status:** CRITICAL - Data model inconsistency  
**Location:** Multiple migrations

**Problem:**
The `user_earnings` table was redefined with a completely different schema:

**ORIGINAL Schema** (20250609000000):
```sql
CREATE TABLE user_earnings (
  id UUID PRIMARY KEY,
  user_id UUID,
  submission_id UUID,        -- Links to specific submission
  pool_id UUID,              -- Links to weekly pool
  pull_up_count INTEGER,
  dollars_earned DECIMAL,
  is_first_submission BOOLEAN
);
```

**NEW Schema** (20250610000002+):
```sql
CREATE TABLE user_earnings (
  id UUID PRIMARY KEY,
  user_id UUID,
  month_year TEXT,           -- Aggregated by month
  total_earned_dollars INTEGER,  -- Total for month
  total_submissions INTEGER,     -- Count for month
  updated_at TIMESTAMP
);
```

**Impact:**
- Two completely different data models
- No migration to transform old data to new schema
- Functions reference old schema, policies reference new schema
- INSERT policies expect one schema, SELECT policies expect another

---

### **Issue #5: Frontend Calls Non-Existent Flow**
**Status:** BLOCKING  
**Location:** `src/pages/Admin/AdminDashboardPage.tsx:520`

**Problem:**
When admin approves a submission, the frontend calls:
```typescript
const { data: earningsResult, error: earningsError } = await supabase.rpc('process_submission_earnings', {
  p_submission_id: submissionId,
  p_user_id: submission.userId,
  p_pull_up_count: verifiedCount
});
```

This RPC function **may work** (if it still exists), BUT:
- It tries to INSERT into `user_earnings` with OLD schema (submission_id, pool_id, etc.)
- But later migrations expect NEW schema (month_year, total_earned_dollars, etc.)
- Constraint violations or schema mismatches will occur

---

### **Issue #6: Payouts Page Reads Wrong Tables**
**Status:** BLOCKING  
**Location:** `src/pages/Admin/AdminPayoutsPage.tsx:70`

**Problem:**
The payouts page calls:
```typescript
const { data, error } = await supabase.rpc('get_payouts_by_month', {
  target_month: month
});
```

This function queries `payout_requests` table, which is populated by `generate_monthly_payouts_smart()`.

But `generate_monthly_payouts_smart()` tries to read from **non-existent `weekly_earnings` table**:
```sql
FROM weekly_earnings we
JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
```

**Impact:**
- Function fails to generate payout requests
- Payouts page shows empty results
- Users never see their earnings ready for payout

---

### **Issue #7: RLS Policy Blocks System Inserts**
**Status:** POTENTIAL ISSUE  
**Location:** `supabase/migrations/20250609000000_create_puc_bank_system.sql:226`

**Problem:**
```sql
CREATE POLICY "Only system can insert earnings" ON user_earnings
  FOR INSERT WITH CHECK (false);
```

This policy blocks ALL inserts, even from SECURITY DEFINER functions (though this depends on Supabase configuration).

Later migration (`20250610000000_fix_earnings_rls_policies.sql`) adds:
```sql
CREATE POLICY "Admins can insert user earnings" ON public.user_earnings
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IN (SELECT user_id FROM admin_roles)
  );
```

**Impact:**
- Conflicting policies may block inserts
- Functions may fail even with SECURITY DEFINER

---

## 🔍 ROOT CAUSE ANALYSIS

### What Happened:

1. **Original System (20250609000000):**
   - Created `weekly_pools` + `user_earnings` (old schema)
   - Created RPC `process_submission_earnings()` to handle approval flow
   - **This system WORKS correctly** (drains pool, creates earnings)

2. **Refactor Attempt (20250610000002+):**
   - Tried to implement a better 2-tier system: `weekly_earnings` → `user_earnings` (monthly)
   - Created trigger `process_earnings_on_approval()` to automate earnings
   - Created `generate_monthly_payouts_smart()` to aggregate earnings
   - **BUT: Never created the `weekly_earnings` table!**
   - **AND: Used wrong column names (week_start_date vs week_start)**
   - **AND: Never updated the pool draining logic**

3. **Result:**
   - Frontend still calls old RPC `process_submission_earnings()`
   - Old RPC might partially work, but schema conflicts block it
   - New trigger fires but fails silently (missing table)
   - No earnings recorded either way
   - Pool never drains
   - Payouts page is empty

---

## 📋 DIAGNOSTIC CHECKLIST

Before deciding on a fix, run these checks:

### 1. Check Database State
Run the diagnostic SQL script I created: `diagnostic-check.sql`

This will show:
- ✅ Which tables actually exist
- ✅ Actual table schemas
- ✅ Active triggers
- ✅ Weekly pools data
- ✅ Recent approved submissions
- ✅ Any existing earnings records

### 2. Check Function Execution
In Supabase SQL Editor, test:
```sql
-- Test if process_submission_earnings RPC exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'process_submission_earnings';

-- Test if trigger is firing
SELECT trigger_name, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'submissions';
```

### 3. Check Current Week Pool
```sql
-- Does a current week pool exist?
SELECT * FROM weekly_pools WHERE is_current = true;

-- If not, create one:
-- SELECT reset_weekly_pools();
```

### 4. Test Approval Flow
```sql
-- Create test submission and approve it
-- Then check if earnings were created
SELECT * FROM user_earnings ORDER BY created_at DESC LIMIT 5;
```

---

## 💡 RECOMMENDED FIX STRATEGY

After running diagnostics, we have **3 options:**

### **Option A: Complete the New System** ⭐ RECOMMENDED
**Pros:** Modern, scalable, automated  
**Cons:** More work, requires data migration

Steps:
1. Create missing `weekly_earnings` table
2. Fix column name references (week_start_date → week_start)
3. Add pool draining logic to trigger
4. Create initial weekly pool if missing
5. Update RLS policies
6. Test full flow
7. Remove deprecated RPC functions

### **Option B: Revert to Old System**
**Pros:** Simpler, proven to work  
**Cons:** Less elegant, manual RPC calls

Steps:
1. Drop new triggers and functions
2. Restore old `user_earnings` schema
3. Keep using `process_submission_earnings` RPC
4. Update payouts page to read from `user_earnings` directly
5. Add manual payout generation logic

### **Option C: Hybrid Approach**
**Pros:** Quick fix, keeps both systems  
**Cons:** Technical debt, confusing architecture

Steps:
1. Fix the old RPC to work with current schema
2. Disable the broken trigger
3. Keep using RPC until new system is ready
4. Plan proper migration later

---

## 🚨 IMMEDIATE ACTION REQUIRED

1. **Run `diagnostic-check.sql`** in Supabase SQL Editor
2. **Share the results** so we can see exact database state
3. **Check if any users have pending approved submissions** that didn't get processed
4. **Decide on fix strategy** based on diagnosis results

---

## 📊 EXPECTED DIAGNOSIS RESULTS

Based on the code, I expect the diagnostic to show:

❌ `weekly_earnings` table: **DOES NOT EXIST**  
✅ `weekly_pools` table: **EXISTS** (but columns are `week_start`, `week_end`)  
⚠️ `user_earnings` table: **EXISTS** (but unclear which schema)  
⚠️ `payout_requests` table: **EXISTS** (but likely empty)  
✅ Trigger `process_earnings_on_approval`: **EXISTS** (but broken)  
✅ RPC `process_submission_earnings`: **MAY EXIST** (but may have schema conflicts)  
❌ Weekly pool `remaining_dollars`: **NEVER CHANGES** (stuck at 250)  
❌ Approved submissions → earnings: **NOT CONNECTED**

---

## 📝 NEXT STEPS

1. Run diagnostic SQL
2. Share results
3. I'll create a precise fix plan
4. We'll implement and test
5. Backfill any missed earnings for approved submissions

Would you like me to proceed with running the diagnostic, or would you prefer to run it manually in your Supabase dashboard?
