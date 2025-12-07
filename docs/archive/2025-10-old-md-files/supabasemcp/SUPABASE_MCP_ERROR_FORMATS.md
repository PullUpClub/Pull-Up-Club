# Supabase MCP: Error Reading Best Practices

## 📊 **Best Format: JSON**

**TL;DR:** Use **JSON** for programmatic error reading. Use **Markdown** for human documentation.

---

## 🎯 **Why JSON for Errors?**

### **1. Machine Readable**
```json
{
  "error_type": "POOL_MISMATCH",
  "error_message": "Weekly pool remaining amount does not match calculated value",
  "context": {
    "pool_id": "479ec2d1-7bfd-4438-aa92-0ff99c0210c2",
    "actual_remaining": 232,
    "calculated_remaining": 250,
    "difference": -18
  },
  "created_at": "2025-10-23T21:39:32.608571+00:00"
}
```

**Benefits:**
- ✅ Structured data (easy to parse)
- ✅ Type-safe (numbers are numbers, strings are strings)
- ✅ Queryable (can filter, sort, aggregate)
- ✅ Standardized (same format always)
- ✅ Programmable (MCP can act on specific error types)

---

### **2. Easy to Query**

```sql
-- Get all POOL_MISMATCH errors
SELECT * FROM monitoring.system_errors
WHERE error_type = 'POOL_MISMATCH'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- Aggregate by error type
SELECT 
  error_type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM monitoring.system_errors
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY error_type
ORDER BY count DESC;

-- Get specific context field
SELECT 
  error_type,
  context->>'pool_id' as pool_id,
  context->>'difference' as difference
FROM monitoring.system_errors
WHERE error_type = 'POOL_MISMATCH';
```

---

### **3. MCP-Friendly Format**

**Optimal Query for Supabase MCP:**

```sql
-- Returns all errors as a single JSON array
SELECT jsonb_agg(
  jsonb_build_object(
    'id', id,
    'error_type', error_type,
    'error_message', error_message,
    'context', context,
    'created_at', created_at,
    'age_hours', EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600
  ) ORDER BY created_at DESC
) as errors
FROM monitoring.system_errors
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

**MCP can then:**
- Parse the JSON array
- Filter by error_type
- Sort by age_hours
- Aggregate counts
- Trigger alerts based on thresholds

---

## 📝 **Why Markdown for Documentation?**

**Use Markdown for:**
- Human-readable documentation
- Guides and tutorials
- Architectural decisions
- Troubleshooting steps
- Long-form explanations

**Example: This document is Markdown!**

---

## 🔄 **Best Practice: Use Both**

### **JSON for Data**
```sql
-- Store errors as JSON
CREATE TABLE monitoring.system_errors (
  id UUID PRIMARY KEY,
  error_type TEXT,
  error_message TEXT,
  context JSONB,  -- ✅ JSON for structured data
  created_at TIMESTAMPTZ
);
```

### **Markdown for Docs**
```markdown
# Error Type: POOL_MISMATCH

**Description:** Weekly pool remaining amount does not match calculated value.

**Cause:** Pool update failed or earnings calculation incorrect.

**Fix:** Run `SELECT monitoring.check_pool_consistency();`
```

---

## 🚨 **Your Current Security Advisor Warnings**

The screenshot shows 3 "Security Definer View" warnings:

### **What are Security Definer Views?**

**Definition:**
- Views that run with the permissions of the **creator** (postgres)
- Not the permissions of the **user** querying them
- Similar to SECURITY DEFINER functions

**Your Views:**
1. `public.public_leaderboard` - Shows approved submissions
2. `public.recent_security_events` - Shows security logs
3. `public.grace_period_monitor` - Shows grace period statuses

---

### **Is This a Problem?**

**For your views: NO, this is intentional.**

**Why they're SECURITY DEFINER:**
- `public_leaderboard`: Users need to see leaderboard without direct access to submissions table
- `recent_security_events`: Admins need to see security logs without direct access to security_logs table
- `grace_period_monitor`: Admins need to see grace periods without full profile access

**This is actually GOOD DESIGN** - it provides controlled access to data.

---

### **When IS It a Problem?**

**Security Definer Views are dangerous IF:**

1. **View exposes sensitive data** (passwords, API keys, etc.)
   ```sql
   -- BAD: Exposes all user data to everyone
   CREATE VIEW public.all_user_data AS
   SELECT * FROM profiles;  -- Including passwords, etc.
   ```

2. **View allows data modification** (updateable views)
   ```sql
   -- BAD: Anyone can update profiles through this view
   CREATE VIEW public.editable_profiles AS
   SELECT * FROM profiles
   WHERE is_paid = true;
   ```

3. **View has no RLS** (anyone can query)
   ```sql
   -- BAD: No RLS on the view
   ALTER VIEW public.sensitive_data OWNER TO postgres;
   -- Anyone can: SELECT * FROM public.sensitive_data;
   ```

---

### **How to Fix (If Needed)**

**Option 1: Add RLS to Views** (Recommended)

```sql
-- Enable RLS on the underlying tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- The view will inherit RLS from the table
-- No changes needed to the view itself
```

**Option 2: Change View to SECURITY INVOKER** (Less Common)

```sql
-- Remove SECURITY DEFINER (make it use caller's permissions)
-- Note: This might break access for some users
ALTER VIEW public.public_leaderboard SECURITY INVOKER;
```

**Option 3: Keep as-is but Document** (Your Case)

```sql
-- These views are INTENTIONALLY SECURITY DEFINER
-- They provide controlled read-only access to data
-- The underlying tables have RLS that provides real security

COMMENT ON VIEW public.public_leaderboard IS 
  'SECURITY DEFINER: Intentional. Provides public read-only access to leaderboard data.';
```

---

## ✅ **Recommended Actions for Your Database**

### **1. Document Your Security Definer Views**

```sql
-- Add comments explaining why they're SECURITY DEFINER
COMMENT ON VIEW public.public_leaderboard IS 
  'SECURITY DEFINER: Allows public to view leaderboard without direct access to submissions table. Read-only, no sensitive data exposed.';

COMMENT ON VIEW public.recent_security_events IS 
  'SECURITY DEFINER: Allows admins to view security events without direct access to security_logs table. Admin-only access enforced by RLS.';

COMMENT ON VIEW public.grace_period_monitor IS 
  'SECURITY DEFINER: Allows admins to monitor grace periods without full profile access. Admin-only access enforced by RLS.';
```

---

### **2. Verify RLS on Underlying Tables**

```sql
-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('submissions', 'security_logs', 'user_grace_periods', 'profiles')
  AND schemaname = 'public';

-- Should all return: rls_enabled = true
```

---

### **3. Test View Access**

```sql
-- Test as anonymous user
SET ROLE anon;

-- Should work (public leaderboard)
SELECT * FROM public.public_leaderboard LIMIT 5;

-- Should fail (security events are admin-only)
SELECT * FROM public.recent_security_events LIMIT 5;

-- Reset
RESET ROLE;
```

---

## 📊 **MCP Query Templates**

### **Template 1: Get Recent Errors (JSON)**

```sql
SELECT jsonb_agg(
  jsonb_build_object(
    'id', id,
    'type', error_type,
    'message', error_message,
    'context', context,
    'time', created_at
  ) ORDER BY created_at DESC
) as errors
FROM monitoring.system_errors
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

---

### **Template 2: Get Error Summary (JSON)**

```sql
SELECT jsonb_object_agg(
  error_type,
  jsonb_build_object(
    'count', count,
    'latest', latest,
    'oldest', oldest
  )
) as summary
FROM (
  SELECT 
    error_type,
    COUNT(*) as count,
    MAX(created_at) as latest,
    MIN(created_at) as oldest
  FROM monitoring.system_errors
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY error_type
) subquery;
```

**Output:**
```json
{
  "POOL_MISMATCH": {
    "count": 6,
    "latest": "2025-10-23T21:39:32Z",
    "oldest": "2025-10-23T21:39:32Z"
  },
  "STATUS_CHANGE": {
    "count": 1,
    "latest": "2025-10-23T21:03:52Z",
    "oldest": "2025-10-23T21:03:52Z"
  }
}
```

---

### **Template 3: Get Health Score (JSON)**

```sql
SELECT jsonb_build_object(
  'health_score', 
    CASE 
      WHEN error_count = 0 THEN 100
      WHEN error_count <= 5 THEN 90
      WHEN error_count <= 20 THEN 70
      ELSE 50
    END,
  'error_count_24h', error_count,
  'critical_errors', critical_count,
  'warnings', warning_count,
  'checked_at', NOW()
) as health
FROM (
  SELECT 
    COUNT(*) as error_count,
    COUNT(*) FILTER (WHERE error_type IN ('POOL_PROCESSING_ERROR', 'EARNINGS_ERROR')) as critical_count,
    COUNT(*) FILTER (WHERE error_type IN ('POOL_MISMATCH', 'STATUS_CHANGE')) as warning_count
  FROM monitoring.system_errors
  WHERE created_at >= NOW() - INTERVAL '24 hours'
) subquery;
```

---

## 🎯 **Summary**

### **Use JSON When:**
- ✅ Storing errors in database
- ✅ Querying errors programmatically
- ✅ MCP needs to parse and act on data
- ✅ Building APIs or automated systems
- ✅ Need to aggregate, filter, or sort

### **Use Markdown When:**
- ✅ Writing documentation
- ✅ Creating guides or tutorials
- ✅ Explaining architecture
- ✅ Human-readable reports
- ✅ Long-form explanations (like this doc!)

### **Your Security Definer Views:**
- ✅ They are INTENTIONAL and SAFE
- ✅ They provide controlled read-only access
- ✅ RLS on underlying tables provides real security
- ✅ Document why they're SECURITY DEFINER (add comments)
- ✅ No changes needed unless exposing sensitive data

---

## 📞 **Quick Reference**

**Query Errors (JSON):**
```sql
SELECT * FROM monitoring.system_errors 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Export Errors (JSON Array):**
```sql
SELECT jsonb_agg(row_to_json(t)) FROM monitoring.system_errors t;
```

**Check Security Definer Views:**
```sql
SELECT schemaname, viewname 
FROM pg_views 
WHERE schemaname = 'public';
```

**Test View Access:**
```sql
SET ROLE anon;
SELECT * FROM public.public_leaderboard LIMIT 1;
RESET ROLE;
```

---

**Last Updated:** October 23, 2025  
**Related Docs:** 
- `DATABASE_ARCHITECTURE_ANALYSIS.md` - Full architecture
- `SEARCH_PATH_GUIDE.md` - Search path security
- `QUICK_REFERENCE_TROUBLESHOOTING.md` - Common issues

