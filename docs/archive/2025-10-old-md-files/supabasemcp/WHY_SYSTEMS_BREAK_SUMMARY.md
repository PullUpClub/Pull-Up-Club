# Why Your Systems Break: Executive Summary

## Your Specific Questions Answered

### ❓ "Why was there two different pools?"

**Answer:** There's only ONE pool system, but the `is_current` flag was pointing to the **WRONG** pool.

**What Happened:**
```
Database has 17 weekly pools (one per week since June)
  ↓
Each pool has `is_current` boolean flag
  ↓
Only ONE should be true at any time (the current week)
  ↓
On October 13, the flag was NOT updated when week changed
  ↓
Flag still pointed to October 6-12 (expired)
  ↓
For 11 days, all approvals went to the WRONG pool
  ↓
October 6-12 pool went to -$71 (overdraft)
October 20-26 pool stayed at $250 (never used)
```

**Why It Wasn't Updated:**
- No CRON job to update `is_current` on Mondays
- No trigger to detect week change
- No validation that pool matches submission date
- **Manual process that was forgotten**

**Fix Applied:**
```sql
-- Now runs DAILY at 2 AM:
UPDATE weekly_pools SET is_current = false;
UPDATE weekly_pools SET is_current = true 
WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE;
```

---

### ❓ "Why are there inconsistencies around that?"

**Answer:** Cascading failures from the wrong pool assignment.

**The Chain of Inconsistencies:**

1. **Luis approved on Oct 23**
   - Trigger calls `process_submission_earnings()`
   
2. **Function reads is_current flag**
   - Returns pool for Oct 6-12 (WRONG - expired 11 days ago)
   
3. **Earnings created in wrong pool**
   - `weekly_earnings.weekly_pool_id` = Oct 6-12 pool
   - But `submissions.approved_at` = Oct 23
   
4. **Wrong pool already depleted**
   - Oct 6-12 pool at -$71 remaining
   - Function thinks "already processed, skip pool update"
   
5. **Downstream tables updated correctly**
   - `user_earnings` → $18 ✓
   - `payout_requests` → $18 ✓
   - `monthly_graphics` → Created ✓
   
6. **But pool NOT updated**
   - Oct 20-26 pool still shows $250 ✗
   - Oct 6-12 pool still at -$71 ✗

**Result:**
- Payouts page shows Luis ✓ ($18)
- Graphics page shows Luis ✓
- Leaderboard shows Luis ✓ (58 reps)
- Pool shows $250 ✗ (should be $232)

---

### ❓ "Why aren't things going to the payout page?"

**Answer:** They ARE going to the payout page NOW (we fixed it). But here's why they WEREN'T:

**The Luis Example:**
1. Luis signed up through Stripe ✓
2. Stripe webhook created his `profiles` record ✓
3. Luis tried to save his profile settings
4. **UPDATE RLS policy was MISSING** (dropped in migration)
5. Profile update silently failed
6. Profile remained `is_profile_completed = false`
7. System blocked him from submitting (requires completed profile)
8. Admin manually completed his profile
9. Luis submitted video ✓
10. Admin approved video ✓
11. **Wrong pool assigned** (due to `is_current` bug)
12. Earnings created but pool not drained
13. `payout_requests` created correctly ✓
14. Luis shows on payouts page ✓

**But for OTHER users who might not show:**

**Reason 1: User is admin/influencer**
```sql
-- Admins/influencers are excluded from payouts
IF user_role IN ('admin', 'influencer') THEN
  v_dollars_earned := 0;
END IF;
```

**Reason 2: User is in payout_exclusions table**
```sql
-- Check if user manually excluded
SELECT * FROM payout_exclusions 
WHERE user_id = 'user-id' AND is_active = true;
```

**Reason 3: payout_requests not created (function failed silently)**
```sql
-- Function might return success but not create payout
-- Check monitoring.system_errors for the failure
SELECT * FROM monitoring.system_errors 
WHERE context->>'user_id' = 'user-id'
ORDER BY created_at DESC;
```

---

### ❓ "Why when someone gets approved, they go on the leaderboard but not payouts, but they go on graphics?"

**Answer:** Because these three systems are **independent** and one can succeed while others fail.

**The Three Systems:**

**1. Leaderboard** (Simple - always works)
```sql
-- Just queries approved submissions
SELECT * FROM submissions 
WHERE status = 'approved'
ORDER BY actual_pull_up_count DESC;

-- Doesn't depend on:
- weekly_pools
- weekly_earnings
- user_earnings
- payout_requests
```

**2. Monthly Graphics** (Medium - usually works)
```sql
-- Trigger: trigger_populate_monthly_graphics
-- Fires on ANY submission status change
-- Only needs:
- submissions table ✓
- profiles table ✓
- badges table ✓

-- Doesn't depend on:
- weekly_pools ✓
- weekly_earnings ✓
- user_earnings ✓
- payout_requests ✓
```

**3. Payouts** (Complex - can fail)
```sql
-- Trigger: submission_status_change_trigger → process_submission_earnings()
-- Must succeed at ALL steps:
1. Find current weekly_pool (can fail if is_current wrong)
2. Check pool has remaining dollars (can fail if negative)
3. Create weekly_earnings (can fail if RLS blocks)
4. Update weekly_pools (can fail if constraint blocks)
5. Create/update user_earnings (can fail if RLS blocks)
6. Create/update payout_requests (can fail if RLS blocks)

-- If ANY step fails:
- Leaderboard works ✓ (doesn't depend on this)
- Graphics work ✓ (separate trigger)
- Payouts broken ✗ (function failed)
```

**Example Scenario:**

```
Admin approves submission
  ↓
TRIGGER 1: submission_status_change_trigger
  ↓
  Calls process_submission_earnings()
    ↓
    Step 1: Find pool → is_current flag wrong → uses expired pool
    Step 2: Check remaining → pool negative → creates earning with $0
    Step 3: Update pool → skipped (thinks already processed)
    Step 4: Create payout_requests → ❌ FAILS (RLS policy missing)
  ↓
  Returns: { success: true } (LIE!)
  ↓
TRIGGER 2: trigger_populate_monthly_graphics
  ↓
  Creates monthly_graphics → ✓ Success
  ↓
Frontend queries:
  - Leaderboard → ✓ Shows user (queries submissions.approved)
  - Graphics → ✓ Shows user (monthly_graphics exists)
  - Payouts → ✗ Doesn't show (payout_requests doesn't exist)
```

---

## 🔥 Root Causes Summary

### 1. **No Separation of Concerns**
All 47 tables in one schema. Financial system coupled to content system coupled to auth system. One failure cascades everywhere.

### 2. **Silent Failures Everywhere**
Functions return `success: true` even when they fail. RLS policies fail silently (empty result set). Triggers catch exceptions and continue.

### 3. **Manual Maintenance Required**
`is_current` flag requires manual update. No automation. When forgotten, system uses wrong pool for days/weeks.

### 4. **Competing Business Logic**
- Frontend validates one way
- RLS policies enforce different rules
- Triggers implement different logic
- Functions have their own rules
Result: They disagree, system breaks.

### 5. **Complex Trigger Chains**
9 triggers fire on submission approval. 30-40 database operations. Any one fails → partial update → data corruption.

### 6. **Missing Constraints**
- No check that pool remaining ≥ 0 (allows -$71)
- No check that only one pool is_current
- No check that pool date matches submission date
- No check that earnings sum up correctly

### 7. **No Monitoring**
- No alerts when pools go negative
- No alerts when is_current flag is wrong
- No alerts when functions fail silently
- No health check dashboard

---

## ✅ What We Fixed Today

### Immediate Fixes (Oct 23, 2025):

1. ✅ **Fixed is_current flag** (pointed to Oct 20-26 instead of Oct 6-12)
2. ✅ **Fixed Luis's earning** (deleted from wrong pool, re-created in correct pool)
3. ✅ **Fixed pool drainage** (Oct 20-26 pool now shows $232 instead of $250)
4. ✅ **Added daily CRON** (updates is_current flag every day at 2 AM)
5. ✅ **Added consistency checks** (detects and fixes pool mismatches daily)
6. ✅ **Added error logging** (all failures go to monitoring.system_errors)
7. ✅ **Added weekly email** (reports system health every Monday 8 AM)
8. ✅ **Fixed process_submission_earnings()** (now ALWAYS updates pool)

### Prevention Systems Added:

1. ✅ **monitoring schema** (separate from production data)
2. ✅ **monitoring.system_errors** (logs all failures)
3. ✅ **monitoring.check_pool_consistency()** (auto-fixes mismatches)
4. ✅ **monitoring.update_current_pool()** (keeps is_current accurate)
5. ✅ **monitoring.run_daily_consistency_check()** (runs all checks)
6. ✅ **weekly-health-check Edge Function** (sends email reports)
7. ✅ **Daily CRON at 2 AM** (automatic maintenance)
8. ✅ **Weekly CRON at 8 AM Mondays** (health reports)

---

## 🚀 Next Steps to Prevent Future Breaks

### Immediate (This Week):
- [ ] Add constraints (remaining ≥ 0, only one is_current)
- [ ] Add error logging to all functions
- [ ] Add validation (pool date matches submission date)
- [ ] Test RLS policies after every migration

### Short-term (This Month):
- [ ] Create schema views (better organization)
- [ ] Consolidate RLS policies (reduce conflicts)
- [ ] Simplify triggers (reduce cascade complexity)
- [ ] Add admin health dashboard

### Long-term (Next 6 months):
- [ ] Separate tables into schemas (auth, finance, content, etc.)
- [ ] Implement audit logging
- [ ] Add materialized views (performance)
- [ ] Set up load testing

---

## 📊 How to Know Systems Are Healthy

### Daily Checks (Automated):
```sql
SELECT * FROM monitoring.run_daily_consistency_check();
-- Returns: issues found and fixed
```

### Weekly Email (Automated):
Every Monday at 8 AM you receive:
- Error count (last 7 days)
- Pool health (negative balances, wrong is_current)
- Earnings consistency (weekly sum = monthly sum?)
- RLS policy violations
- Overall health score (0-100)

### Manual Checks (When Investigating):
```sql
-- Quick health check
SELECT 
  (SELECT COUNT(*) FROM monitoring.system_errors 
   WHERE created_at >= NOW() - INTERVAL '24 hours') as errors_24h,
  (SELECT COUNT(*) FROM weekly_pools WHERE is_current = true) as current_pools,
  (SELECT COUNT(*) FROM weekly_pools WHERE remaining_amount_dollars < 0) as negative_pools,
  (SELECT COUNT(*) FROM payout_requests WHERE status = 'pending') as pending_payouts;

-- Expected results:
-- errors_24h: 0-5 (OK), 5-20 (WARNING), 20+ (CRITICAL)
-- current_pools: 1 (OK), 0 or 2+ (ERROR)
-- negative_pools: 0 (OK), 1+ (ERROR)
-- pending_payouts: varies (INFO only)
```

---

## 🎯 Success Criteria

**You'll know the system is healthy when:**

1. ✅ **Zero silent failures** (all errors logged to monitoring.system_errors)
2. ✅ **Zero negative pools** (constraint prevents it)
3. ✅ **Always exactly one current pool** (constraint enforces it)
4. ✅ **Earnings always sum correctly** (daily consistency check fixes it)
5. ✅ **Approvals always drain pools** (fixed function ensures it)
6. ✅ **RLS policies never conflict** (tested after every migration)
7. ✅ **Weekly emails show green** (health score > 90)

---

## 📞 When to Worry

**🔴 Immediate Action Required:**
- Error count > 50 in one hour
- Negative pool balance
- Zero current pools or 2+ current pools
- Leaderboard showing wrong data
- Multiple users reporting same issue

**🟡 Monitor Closely:**
- Error count 10-50 in 24 hours
- One user reporting issue
- Performance slower than usual
- Health score < 80

**🟢 Normal Operation:**
- Error count 0-10 in 24 hours
- No user complaints
- All checks passing
- Health score > 90

---

## 🔧 Emergency Commands (Keep Handy)

```sql
-- Fix is_current flag
UPDATE weekly_pools SET is_current = false;
UPDATE weekly_pools SET is_current = true 
WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE;

-- Check for pool mismatches
SELECT * FROM monitoring.check_pool_consistency();

-- See recent errors
SELECT * FROM monitoring.system_errors 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Find orphaned earnings
SELECT we.*, wp.week_start_date, wp.week_end_date
FROM weekly_earnings we
JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
WHERE we.created_at::date NOT BETWEEN wp.week_start_date AND wp.week_end_date;

-- Reprocess a submission
SELECT process_submission_earnings('submission-id', 'user-id', pull_up_count);
```

---

## 📚 Full Documentation

For complete details, see:
- **DATABASE_ARCHITECTURE_ANALYSIS.md** - Full technical deep dive (50 pages)
- **QUICK_REFERENCE_TROUBLESHOOTING.md** - Common issues and instant fixes
- **RLS_TESTING_GUIDE.md** - How to test RLS policies after migrations
- **SYSTEM_BREAKDOWN_ANALYSIS.md** - What causes systems to break

---

**Last Updated:** October 23, 2025  
**Next Review:** November 1, 2025 (after one week of monitoring)

