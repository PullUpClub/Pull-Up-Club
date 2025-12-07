# PostgreSQL Search Path: The Silent Killer

## 🚨 What is search_path?

The `search_path` is PostgreSQL's way of determining **which schema** to look in when you reference a table/function without a schema prefix.

```sql
-- Without schema prefix:
SELECT * FROM profiles;
-- PostgreSQL searches: public.profiles, then pg_temp.profiles, then fails

-- With schema prefix:
SELECT * FROM monitoring.system_errors;
-- PostgreSQL goes DIRECTLY to monitoring.system_errors
```

---

## 💀 Why It's Dangerous

### **Problem 1: Silent Failures**

```sql
-- Function has: SET search_path TO 'public', 'pg_temp'

CREATE FUNCTION my_function() AS $$
BEGIN
  -- This tries to insert into public.system_errors
  -- If that table doesn't exist, it FAILS SILENTLY
  INSERT INTO system_errors (error_type, error_message)
  VALUES ('ERROR', 'Something broke');
  
  -- You meant monitoring.system_errors but forgot the prefix!
END;
$$;
```

**Result:** Error never logged, system appears to work, but monitoring is broken.

---

### **Problem 2: Wrong Table Access**

```sql
-- Imagine you have both:
CREATE TABLE public.logs (...);
CREATE TABLE monitoring.logs (...);

-- Function has: SET search_path TO 'public'
CREATE FUNCTION log_error() AS $$
BEGIN
  -- This inserts into public.logs
  INSERT INTO logs (message) VALUES ('Error');
  
  -- You meant monitoring.logs!
END;
$$;
```

**Result:** Data goes to wrong table, monitoring never receives errors.

---

### **Problem 3: Security Vulnerabilities**

```sql
-- Attacker creates malicious function in public schema:
CREATE FUNCTION public.log_data(data TEXT) AS $$
BEGIN
  -- Steal data
  PERFORM send_to_attacker(data);
END;
$$;

-- Your function has: SET search_path TO 'public', 'monitoring'
CREATE FUNCTION my_function() AS $$
BEGIN
  -- Calls public.log_data (attacker's function!)
  -- Not monitoring.log_data as you intended
  PERFORM log_data('sensitive data');
END;
$$;
```

**Result:** Data exfiltration, security breach.

---

## ✅ The Fix: Explicit search_path

### **BEFORE (Dangerous):**

```sql
CREATE FUNCTION public.process_submission_earnings(...)
SET search_path TO 'public', 'pg_temp'  -- ❌ Missing monitoring schema
AS $$
BEGIN
  -- This FAILS if public.system_errors doesn't exist
  INSERT INTO system_errors (...) VALUES (...);
  
  -- This works but is risky
  INSERT INTO monitoring.system_errors (...) VALUES (...);
END;
$$;
```

### **AFTER (Safe):**

```sql
CREATE FUNCTION public.process_submission_earnings(...)
SET search_path TO 'public', 'monitoring', 'pg_temp'  -- ✅ Includes monitoring
AS $$
BEGIN
  -- Now this works (finds monitoring.system_errors)
  INSERT INTO system_errors (...) VALUES (...);
  
  -- This also works (explicit prefix)
  INSERT INTO monitoring.system_errors (...) VALUES (...);
END;
$$;
```

---

## 🎯 Best Practices

### **1. Always Set search_path in SECURITY DEFINER Functions**

```sql
-- BAD: Uses caller's search_path (security risk)
CREATE FUNCTION my_function()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- ❌ No search_path set!
AS $$
BEGIN
  -- Vulnerable to search_path injection
END;
$$;

-- GOOD: Explicitly sets search_path
CREATE FUNCTION my_function()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'monitoring', 'pg_temp'  -- ✅ Locked down
AS $$
BEGIN
  -- Safe from injection
END;
$$;
```

---

### **2. Include All Schemas You Reference**

```sql
-- If your function references tables in multiple schemas:
SET search_path TO 'public', 'monitoring', 'finance', 'pg_temp'

-- Order matters! Searches left to right
-- public first, then monitoring, then finance, then pg_temp
```

---

### **3. Use Schema Prefixes for Clarity**

```sql
-- GOOD: Explicit (always works, no ambiguity)
INSERT INTO monitoring.system_errors (...) VALUES (...);
INSERT INTO public.profiles (...) VALUES (...);
SELECT * FROM finance.weekly_pools;

-- ACCEPTABLE: If search_path includes the schema
INSERT INTO system_errors (...) VALUES (...);  -- Works if monitoring in search_path

-- BAD: Relies on default search_path (user might have different setting)
SELECT * FROM profiles;  -- Which schema? public? auth? Unclear!
```

---

## 🔍 How to Audit Your Functions

### **Find Functions with Missing search_path:**

```sql
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as is_security_definer,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'monitoring', 'finance')
  AND p.prosecdef = true  -- SECURITY DEFINER functions
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'  -- Missing search_path
ORDER BY n.nspname, p.proname;
```

---

### **Find Functions That Reference monitoring Schema:**

```sql
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%monitoring.%'  -- References monitoring
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%monitoring%'  -- But doesn't include in search_path
ORDER BY p.proname;
```

---

## 🛡️ Your Database Status

### **Fixed Functions (Phase 4):**

✅ **handle_submission_status_change()**
- Now includes `monitoring` in search_path
- Can reference `system_errors` without prefix
- Logs all errors properly

✅ **process_submission_earnings()**
- Now includes `monitoring` in search_path
- Added pool date validation
- Enhanced error logging

### **Functions That Still Need Fixing:**

⚠️ Check these functions and add `monitoring` to search_path:
- `award_badges_on_approval()`
- `populate_monthly_graphics()`
- `cleanup_earnings_on_rejection()`
- `send_rejection_email()`
- Any other function that logs to `monitoring.system_errors`

---

## 🔧 Quick Fix Template

```sql
-- For each function that logs to monitoring:

CREATE OR REPLACE FUNCTION function_name(...)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'monitoring', 'pg_temp'  -- ✅ Add monitoring here
AS $$
BEGIN
  -- Your function code
  
  -- Now you can do either:
  INSERT INTO system_errors (...) VALUES (...);  -- Works (finds monitoring.system_errors)
  -- OR:
  INSERT INTO monitoring.system_errors (...) VALUES (...);  -- Also works (explicit)
  
EXCEPTION WHEN OTHERS THEN
  -- Error logging
  INSERT INTO monitoring.system_errors (error_type, error_message, context)
  VALUES ('FUNCTION_ERROR', SQLERRM, jsonb_build_object('function', 'function_name'));
  
  RAISE;  -- Re-raise the error
END;
$$;
```

---

## 📊 Testing search_path

### **Test 1: Verify search_path is Set**

```sql
-- Check a function's search_path
SELECT 
  proname,
  prosrc,
  proconfig  -- Contains SET commands
FROM pg_proc
WHERE proname = 'process_submission_earnings';

-- Should see: {search_path=public,monitoring,pg_temp}
```

---

### **Test 2: Verify Logging Works**

```sql
-- Clear errors
DELETE FROM monitoring.system_errors WHERE error_type = 'TEST';

-- Call function with intentional error
SELECT process_submission_earnings(
  'invalid-uuid'::uuid,  -- Will cause error
  'invalid-uuid'::uuid,
  10
);

-- Check if error was logged
SELECT * FROM monitoring.system_errors 
WHERE error_type IN ('EARNINGS_PROCESSING_ERROR', 'TEST')
ORDER BY created_at DESC;

-- Should see the error logged ✅
```

---

## 🎓 Key Takeaways

1. **Always set search_path in SECURITY DEFINER functions** (security requirement)
2. **Include all schemas you reference** (public, monitoring, finance, etc.)
3. **Use schema prefixes for clarity** (monitoring.system_errors vs system_errors)
4. **Test your functions** (verify errors are actually logged)
5. **Audit regularly** (check for functions missing search_path)

---

## 📞 Emergency: How to Fix Broken Logging

If you notice errors aren't being logged:

```sql
-- 1. Check if monitoring.system_errors table exists
SELECT COUNT(*) FROM monitoring.system_errors;

-- 2. Check function's search_path
SELECT proconfig FROM pg_proc WHERE proname = 'your_function_name';

-- 3. If search_path doesn't include 'monitoring', fix it:
CREATE OR REPLACE FUNCTION your_function_name(...)
SET search_path TO 'public', 'monitoring', 'pg_temp'  -- Add monitoring
AS $$ ... $$;

-- 4. Test immediately
SELECT your_function_name(...);
SELECT * FROM monitoring.system_errors ORDER BY created_at DESC LIMIT 5;
```

---

**Last Updated:** October 23, 2025 (Phase 4)  
**Status:** Critical functions fixed ✅  
**Next:** Audit remaining functions for search_path issues

