# RLS Policy Testing Guide

## Overview

This guide explains how to test Row Level Security (RLS) policies after making database migrations. Testing RLS policies is crucial to prevent silent failures where users can read data but cannot update it.

## The Problem We Solved

**Luis Angelo's Issue**: Users could log in and view their profiles, but when they tried to save profile settings, the changes would disappear. This happened because:

1. ✅ SELECT policies existed (users could read their profiles)
2. ❌ UPDATE policies were missing (users couldn't save changes)
3. ❌ Profile completion always failed
4. ❌ Video submissions were blocked (required completed profile)

## Testing System Components

### 1. Database Functions

We've created several SQL functions to test RLS policies:

#### `run_basic_rls_tests()`
Quick test to check if critical policies exist.

```sql
SELECT * FROM run_basic_rls_tests();
```

**Expected Output:**
```
test_summary                | critical_policies_missing | total_policies | status
RLS Policy Check Summary    | 0                        | 8              | PASS - All critical policies exist
```

#### `check_rls_policies()`
Detailed breakdown of which policies exist for each table/operation.

```sql
SELECT * FROM check_rls_policies();
```

#### `get_rls_policy_details()`
Shows the actual policy definitions.

```sql
SELECT * FROM get_rls_policy_details();
```

### 2. Shell Script

Run the shell script for automated testing:

```bash
chmod +x scripts/test-rls.sh
./scripts/test-rls.sh
```

### 3. Manual Testing Commands

Quick SQL commands to verify specific policies:

```sql
-- Check if profiles UPDATE policy exists
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'UPDATE';

-- Check if submissions UPDATE policy exists  
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'submissions' AND cmd = 'UPDATE';

-- List all policies for critical tables
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename IN ('profiles', 'submissions', 'weekly_pools')
ORDER BY tablename, cmd;
```

## Testing Workflow

### After Every Migration

1. **Apply Migration:**
   ```bash
   supabase db push
   ```

2. **Test RLS Policies:**
   ```bash
   ./scripts/test-rls.sh
   ```
   OR
   ```sql
   SELECT * FROM run_basic_rls_tests();
   ```

3. **Review Results:**
   - ✅ `PASS` = All critical policies exist
   - ❌ `FAIL` = Missing critical policies (DO NOT DEPLOY)

4. **Fix Issues:**
   If tests fail, check which policies are missing:
   ```sql
   SELECT * FROM check_rls_policies() WHERE policy_exists = false;
   ```

### Critical Policies Required

These policies MUST exist for the system to work:

| Table | Operation | Required For |
|-------|-----------|-------------|
| `profiles` | SELECT | Users can view profiles, leaderboard works |
| `profiles` | UPDATE | Users can save profile settings |
| `profiles` | INSERT | New user registration works |
| `submissions` | SELECT | Leaderboard and admin panel work |
| `submissions` | UPDATE | Users can resubmit rejected videos, admins can approve |
| `submissions` | INSERT | Users can submit videos |

## Manual Testing Scenarios

### Test 1: Profile Updates (Regular User)
1. Log into your app as a regular user
2. Go to profile settings
3. Update your name, age, or other fields
4. Click save
5. **Expected**: Changes should save successfully ✅
6. **If fails**: Missing UPDATE policy on profiles table ❌

### Test 2: Profile Updates (Different User)
1. Try to update another user's profile via API/SQL
2. **Expected**: Should be blocked with permission error ✅
3. **If succeeds**: UPDATE policy is too permissive ❌

### Test 3: Admin Access
1. Log in as an admin user
2. Try to update any user's profile
3. **Expected**: Should work ✅
4. **If fails**: Admin role not properly configured ❌

### Test 4: Submission Updates
1. Submit a video as a regular user
2. Have admin reject it
3. Try to update the rejected submission
4. **Expected**: Should work (users can resubmit) ✅
5. **If fails**: Missing UPDATE policy for rejected submissions ❌

### Test 5: Public Access (Leaderboard)
1. Access leaderboard without authentication
2. **Expected**: Should show users with approved submissions ✅
3. **If fails**: Missing SELECT policy for public access ❌

## Common RLS Policy Patterns

### User Can Access Own Data
```sql
CREATE POLICY "users_own_data" ON table_name
    FOR operation TO public
    USING (auth.uid() = user_id);
```

### Admin Can Access All Data
```sql
CREATE POLICY "admin_access_all" ON table_name
    FOR operation TO public
    USING (
        EXISTS (
            SELECT 1 FROM admin_roles
            WHERE user_id = auth.uid()
        )
    );
```

### Public Can Read Approved Content
```sql
CREATE POLICY "public_read_approved" ON table_name
    FOR SELECT TO public
    USING (status = 'approved');
```

## Troubleshooting

### Issue: "Policy allowed unauthorized update"
**Cause**: UPDATE policy is too permissive
**Fix**: Add proper WHERE conditions to restrict access

### Issue: "No policy found"
**Cause**: Policy was dropped but not recreated
**Fix**: Create the missing policy with proper conditions

### Issue: "Permission denied"
**Cause**: Policy is too restrictive or user role not set correctly
**Fix**: Check user's role and policy conditions

## Prevention Checklist

Before deploying any migration that touches RLS policies:

- [ ] Run `SELECT * FROM run_basic_rls_tests();`
- [ ] Verify all critical policies exist
- [ ] Test profile updates manually
- [ ] Test submission flow manually
- [ ] Check admin access works
- [ ] Verify public leaderboard access

## Emergency Fix

If you discover broken RLS policies in production:

```sql
-- Quick fix: Restore critical policies
CREATE POLICY "emergency_profiles_update" ON profiles
    FOR UPDATE TO public
    USING (auth.uid() = id);

CREATE POLICY "emergency_submissions_update" ON submissions
    FOR UPDATE TO public
    USING (
        (auth.uid() = user_id AND status = 'rejected') OR
        EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
    );
```

## Monitoring

Set up alerts for:
- Failed profile updates
- Users unable to complete registration
- Submission flow failures
- RLS policy violations in logs

## Summary

**The key lesson**: RLS policies can fail silently. Users might be able to log in and view data, but unable to update it. Always test both READ and WRITE operations after any RLS policy changes.

**Remember**: A passing `run_basic_rls_tests()` result means your core system functionality should work correctly.
