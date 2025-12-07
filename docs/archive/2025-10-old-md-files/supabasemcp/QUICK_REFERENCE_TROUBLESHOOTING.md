# Quick Reference: Troubleshooting Guide

## 🚨 Common Issues & Instant Fixes

### Issue: "Pool not draining after approval"

**Symptoms:**
- Submission approved ✓
- User shows on payouts ✓
- User shows on graphics ✓
- Pool shows same amount ✗

**Quick Diagnosis:**
```sql
-- Check which pool is marked current
SELECT id, week_start_date, week_end_date, is_current, remaining_amount_dollars
FROM weekly_pools 
WHERE is_current = true;

-- Check recent approved submissions
SELECT id, user_id, actual_pull_up_count, approved_at, status
FROM submissions
WHERE approved_at >= NOW() - INTERVAL '7 days'
ORDER BY approved_at DESC
LIMIT 10;

-- Check if earnings were created
SELECT we.*, wp.week_start_date, wp.week_end_date
FROM weekly_earnings we
JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
WHERE we.created_at >= NOW() - INTERVAL '7 days'
ORDER BY we.created_at DESC;
```

**Root Cause #1: is_current flag pointing to wrong week**
```sql
-- Fix immediately:
UPDATE weekly_pools SET is_current = false;
UPDATE weekly_pools SET is_current = true 
WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE;
```

**Root Cause #2: Earnings assigned to wrong pool**
```sql
-- Find orphaned earnings (earnings in wrong pool)
SELECT we.id, we.user_id, we.earning_amount_dollars, we.created_at,
       wp.week_start_date, wp.week_end_date,
       we.created_at::date as earning_date,
       CASE 
         WHEN we.created_at::date NOT BETWEEN wp.week_start_date AND wp.week_end_date 
         THEN 'WRONG POOL'
         ELSE 'OK'
       END as status
FROM weekly_earnings we
JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
WHERE we.created_at >= NOW() - INTERVAL '30 days'
ORDER BY we.created_at DESC;

-- Fix: Delete wrong earning and re-process
DELETE FROM weekly_earnings WHERE id = 'orphaned-earning-id';
SELECT process_submission_earnings('submission-id', 'user-id', pull_up_count);
```

---

### Issue: "User can't save profile settings"

**Symptoms:**
- User types in form
- Hits save
- Form clears out
- No error shown

**Quick Diagnosis:**
```sql
-- Check if UPDATE policy exists
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'UPDATE';

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';
```

**Root Cause: Missing UPDATE RLS policy**
```sql
-- Fix: Restore UPDATE policy
CREATE POLICY profiles_update_policy ON profiles
FOR UPDATE
TO public
USING ((auth.uid() = id) OR (is_admin()))
WITH CHECK ((auth.uid() = id) OR (is_admin()));

-- Test immediately
SET ROLE authenticated;
SET request.jwt.claims.sub TO 'test-user-uuid';
UPDATE profiles SET full_name = 'Test' WHERE id = 'test-user-uuid';
-- Should succeed
RESET ROLE;
```

---

### Issue: "User not showing on payouts page"

**Symptoms:**
- Submission approved ✓
- Weekly earnings created ✓
- Pool drained ✓
- User NOT on payouts page ✗

**Quick Diagnosis:**
```sql
-- Check if user_earnings exists
SELECT * FROM user_earnings 
WHERE user_id = 'user-uuid' 
AND month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Check if payout_requests exists
SELECT * FROM payout_requests 
WHERE user_id = 'user-uuid' 
AND payout_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Check if user is excluded
SELECT * FROM payout_exclusions 
WHERE user_id = 'user-uuid' AND is_active = true;

-- Check user role
SELECT id, full_name, role FROM profiles WHERE id = 'user-uuid';
```

**Root Cause #1: User is admin/influencer (excluded from payouts)**
```sql
-- Verify role
SELECT role FROM profiles WHERE id = 'user-uuid';
-- If role = 'admin' or 'influencer', they don't get payouts (by design)
```

**Root Cause #2: payout_requests not created**
```sql
-- Manually create payout request
INSERT INTO payout_requests (user_id, amount_dollars, status, payout_month, request_date, notes)
SELECT 
  user_id,
  total_earned_dollars,
  'pending',
  month_year,
  NOW(),
  'Manually created'
FROM user_earnings
WHERE user_id = 'user-uuid' AND month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

**Root Cause #3: User excluded from payouts**
```sql
-- Check exclusions
SELECT * FROM payout_exclusions WHERE user_id = 'user-uuid';

-- Remove exclusion if needed
UPDATE payout_exclusions SET is_active = false WHERE user_id = 'user-uuid';
```

---

### Issue: "User not showing on monthly graphics page"

**Symptoms:**
- Submission approved ✓
- User on payouts ✓
- User NOT on graphics ✗

**Quick Diagnosis:**
```sql
-- Check if monthly_graphics exists
SELECT * FROM monthly_graphics 
WHERE user_id = 'user-uuid' 
AND month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Check submission details
SELECT id, user_id, actual_pull_up_count, approved_at, status
FROM submissions
WHERE user_id = 'user-uuid'
AND approved_at >= DATE_TRUNC('month', CURRENT_DATE)
AND status = 'approved';
```

**Root Cause: monthly_graphics not created**
```sql
-- Manually trigger monthly graphics creation
SELECT populate_monthly_graphics();

-- Or manually create for specific submission
INSERT INTO monthly_graphics (
  submission_id,
  user_id,
  month_year,
  email,
  full_name,
  current_pullups,
  current_badge_name,
  current_badge_image_url,
  email_sent
)
SELECT 
  s.id,
  s.user_id,
  TO_CHAR(s.approved_at, 'YYYY-MM'),
  p.email,
  p.full_name,
  s.actual_pull_up_count,
  b.name,
  b.image_url,
  false
FROM submissions s
JOIN profiles p ON s.user_id = p.id
LEFT JOIN user_badges ub ON ub.user_id = s.user_id AND ub.awarded_at <= s.approved_at
LEFT JOIN badges b ON ub.badge_id = b.id
WHERE s.id = 'submission-id';
```

---

### Issue: "Leaderboard showing wrong position"

**Symptoms:**
- User approved with 25 pull-ups
- Leaderboard shows them at rank 50 (should be rank 10)

**Quick Diagnosis:**
```sql
-- Check actual leaderboard position
SELECT 
  ROW_NUMBER() OVER (ORDER BY actual_pull_up_count DESC, approved_at ASC) as rank,
  user_id,
  actual_pull_up_count,
  approved_at
FROM submissions
WHERE status = 'approved'
ORDER BY actual_pull_up_count DESC, approved_at ASC
LIMIT 100;

-- Check if user's submission is approved
SELECT id, user_id, actual_pull_up_count, status, approved_at
FROM submissions
WHERE user_id = 'user-uuid';
```

**Root Cause #1: Submission not actually approved**
```sql
-- Check status
SELECT status FROM submissions WHERE user_id = 'user-uuid';
-- Should be 'approved', not 'pending' or 'rejected'
```

**Root Cause #2: actual_pull_up_count is NULL**
```sql
-- Check if admin verified count
SELECT actual_pull_up_count FROM submissions WHERE user_id = 'user-uuid';
-- If NULL, admin didn't fill in verified count

-- Fix: Update verified count
UPDATE submissions 
SET actual_pull_up_count = pull_up_count  -- Or correct count
WHERE user_id = 'user-uuid' AND actual_pull_up_count IS NULL;
```

---

### Issue: "System errors table filling up"

**Symptoms:**
- monitoring.system_errors has 1000+ rows
- Many duplicate errors
- Performance slowdown

**Quick Diagnosis:**
```sql
-- Count errors by type
SELECT error_type, COUNT(*), MAX(created_at) as latest
FROM monitoring.system_errors
GROUP BY error_type
ORDER BY COUNT(*) DESC;

-- Recent errors (last 24 hours)
SELECT error_type, error_message, created_at
FROM monitoring.system_errors
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Cleanup:**
```sql
-- Delete errors older than 30 days
DELETE FROM monitoring.system_errors 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Keep only last 1000 errors
DELETE FROM monitoring.system_errors
WHERE id NOT IN (
  SELECT id FROM monitoring.system_errors
  ORDER BY created_at DESC
  LIMIT 1000
);
```

**Prevention:**
```sql
-- Set up auto-cleanup CRON
SELECT cron.schedule(
  'cleanup-old-errors',
  '0 3 * * 0',  -- Every Sunday at 3 AM
  $$
  DELETE FROM monitoring.system_errors 
  WHERE created_at < NOW() - INTERVAL '30 days';
  $$
);
```

---

## 🔍 Diagnostic Queries

### Check Overall System Health

```sql
SELECT 
  'Errors (24h)' as metric,
  COUNT(*)::text as value,
  CASE WHEN COUNT(*) > 10 THEN '🔴 HIGH' 
       WHEN COUNT(*) > 5 THEN '🟡 MEDIUM' 
       ELSE '🟢 LOW' END as alert_level
FROM monitoring.system_errors 
WHERE created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Current Pools',
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 1 THEN '🟢 OK' ELSE '🔴 ERROR' END
FROM weekly_pools WHERE is_current = true

UNION ALL

SELECT 
  'Negative Pools',
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '🟢 OK' ELSE '🔴 ERROR' END
FROM weekly_pools WHERE remaining_amount_dollars < 0

UNION ALL

SELECT 
  'Pending Submissions',
  COUNT(*)::text,
  CASE WHEN COUNT(*) > 50 THEN '🟡 HIGH' ELSE '🟢 OK' END
FROM submissions WHERE status = 'pending'

UNION ALL

SELECT 
  'Pending Payouts',
  COUNT(*)::text,
  '🟢 INFO'
FROM payout_requests WHERE status = 'pending';
```

### Find Users with Issues

```sql
-- Users with NULL user_id (shouldn't exist)
SELECT id, full_name, email, user_id
FROM profiles
WHERE user_id IS NULL;

-- Users with incomplete profiles
SELECT id, full_name, email, is_profile_completed
FROM profiles
WHERE is_profile_completed = false
AND created_at < NOW() - INTERVAL '7 days';

-- Users with approved submissions but no earnings
SELECT p.id, p.full_name, s.id as submission_id, s.approved_at
FROM profiles p
JOIN submissions s ON s.user_id = p.id
LEFT JOIN weekly_earnings we ON we.submission_id = s.id
WHERE s.status = 'approved'
  AND we.id IS NULL
  AND s.approved_at >= NOW() - INTERVAL '30 days';
```

### Check Financial Consistency

```sql
-- Verify weekly pool consistency
SELECT 
  wp.id,
  wp.week_start_date,
  wp.total_amount_dollars,
  wp.remaining_amount_dollars as actual_remaining,
  wp.total_amount_dollars - COALESCE(SUM(we.earning_amount_dollars), 0) as calculated_remaining,
  wp.remaining_amount_dollars - (wp.total_amount_dollars - COALESCE(SUM(we.earning_amount_dollars), 0)) as difference
FROM weekly_pools wp
LEFT JOIN weekly_earnings we ON we.weekly_pool_id = wp.id
GROUP BY wp.id, wp.week_start_date, wp.total_amount_dollars, wp.remaining_amount_dollars
HAVING wp.remaining_amount_dollars != (wp.total_amount_dollars - COALESCE(SUM(we.earning_amount_dollars), 0))
ORDER BY wp.week_start_date DESC;

-- Verify monthly earnings consistency
SELECT 
  ue.user_id,
  ue.month_year,
  ue.total_earned_dollars as monthly_total,
  COALESCE(SUM(we.earning_amount_dollars), 0) as weekly_sum,
  ue.total_earned_dollars - COALESCE(SUM(we.earning_amount_dollars), 0) as difference
FROM user_earnings ue
LEFT JOIN weekly_earnings we ON we.user_id = ue.user_id
LEFT JOIN weekly_pools wp ON we.weekly_pool_id = wp.id
WHERE TO_CHAR(wp.week_start_date, 'YYYY-MM') = ue.month_year
GROUP BY ue.user_id, ue.month_year, ue.total_earned_dollars
HAVING ue.total_earned_dollars != COALESCE(SUM(we.earning_amount_dollars), 0)
ORDER BY ue.month_year DESC, difference DESC;
```

---

## ⚡ Emergency Commands

### Disable All Triggers (Use with EXTREME caution)

```sql
-- Disable triggers on a specific table
ALTER TABLE submissions DISABLE TRIGGER ALL;

-- Work on the table...

-- Re-enable triggers
ALTER TABLE submissions ENABLE TRIGGER ALL;
```

### Disable RLS Temporarily (Use with EXTREME caution)

```sql
-- Disable RLS on a specific table
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Work on the table...

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### Force Reprocess All Recent Submissions

```sql
-- Find all approved submissions from last 7 days with no earnings
SELECT s.id, s.user_id, s.actual_pull_up_count
FROM submissions s
LEFT JOIN weekly_earnings we ON we.submission_id = s.id
WHERE s.status = 'approved'
  AND s.approved_at >= NOW() - INTERVAL '7 days'
  AND we.id IS NULL;

-- Reprocess each one
DO $$
DECLARE
  sub RECORD;
BEGIN
  FOR sub IN 
    SELECT s.id, s.user_id, s.actual_pull_up_count
    FROM submissions s
    LEFT JOIN weekly_earnings we ON we.submission_id = s.id
    WHERE s.status = 'approved'
      AND s.approved_at >= NOW() - INTERVAL '7 days'
      AND we.id IS NULL
  LOOP
    PERFORM process_submission_earnings(sub.id, sub.user_id, sub.actual_pull_up_count);
  END LOOP;
END $$;
```

---

## 📞 When to Call for Help

**Call immediately if:**
- ✅ Multiple users reporting same issue
- ✅ Error count spikes above 50/hour
- ✅ Database CPU > 80% for 10+ minutes
- ✅ RLS policies completely broken (no one can access anything)
- ✅ Data corruption detected (earnings don't sum up)

**Can wait until next business day:**
- ⏸️ Single user issue (one person can't save profile)
- ⏸️ Cosmetic issues (leaderboard position off by 1-2)
- ⏸️ Performance slightly slower than usual
- ⏸️ Non-critical email not sent

**Document and monitor:**
- 📝 Intermittent issues (works sometimes, fails sometimes)
- 📝 Edge cases (only happens for users with specific conditions)
- 📝 Performance degradation over time
- 📝 Growing error counts

---

## 🎯 Prevention Checklist

**Before Every Migration:**
- [ ] Backup database
- [ ] Run RLS tests
- [ ] Check for orphaned records
- [ ] Document what you're changing

**After Every Migration:**
- [ ] Run RLS tests again
- [ ] Test critical path (sign up → submit → approve)
- [ ] Check monitoring.system_errors
- [ ] Monitor for 24 hours

**Daily:**
- [ ] Check monitoring.system_errors count
- [ ] Check for negative pools
- [ ] Check is_current flag
- [ ] Review pending submissions

**Weekly:**
- [ ] Read health check email
- [ ] Review system_errors by type
- [ ] Check financial consistency
- [ ] Review performance metrics

---

**Last Updated:** October 23, 2025  
**For detailed analysis, see:** `DATABASE_ARCHITECTURE_ANALYSIS.md`

