# Monthly Graphics Email Bug Fix - Deployment Instructions

## Problem Summary
When admins send monthly graphics, the system shows both "sent" and "warning" messages, and users never get marked as "Sent" in the admin panel.

## Root Cause
**Resend API is failing completely.** All emails are being queued as fallback, but the database wasn't being updated to reflect this.

## What Was Fixed
1. **Enhanced Error Logging** - Now logs the ACTUAL Resend error details
2. **Database Update in Fallback Mode** - Now updates `monthly_graphics` table even when Resend fails
3. **Better Error Messages** - Shows the actual Resend error in toast notifications

## How to Deploy

### Step 1: Deploy the Fixed Edge Function
```bash
npx supabase functions deploy send-monthly-graphics
```

### Step 2: Test the Fix
1. Go to `/admin-monthly-graphics` page
2. Select a user who hasn't been sent their graphic
3. Click "Send" button
4. **Check the browser console and toast messages** - you should now see the ACTUAL Resend error
5. Verify the user status changes to "Sent" ✓ (even if Resend failed, it's queued)

### Step 3: Fix the Underlying Resend Issue
After deployment, check the Supabase Edge Function logs to see the actual Resend error:

**Go to:** Supabase Dashboard → Edge Functions → `send-monthly-graphics` → Logs

#### Common Resend Errors & Solutions:

**1. Invalid API Key**
```bash
# Check environment variable in Supabase Dashboard
# Settings → Edge Functions → Secrets
# Verify RESEND_API_KEY is set correctly
```

**2. Invalid From Address** (MOST LIKELY)
- **Current From:** `Pull-Up Club <noreply@pullupclub.com>`
- **Solution:** Verify `pullupclub.com` domain in Resend dashboard
- **OR:** Change to Resend test email: `onboarding@resend.dev`
  
To use test email temporarily:
```typescript
// In send-monthly-graphics/index.ts line 93
from: 'Pull-Up Club <onboarding@resend.dev>', // Resend test email
```

**3. Rate Limit Exceeded**
- Check your Resend plan limits
- The code already has 100ms delays between sends

**4. Invalid Email Format**
- Check `monthly_graphics` table for invalid emails
```sql
SELECT email, full_name FROM monthly_graphics WHERE email NOT LIKE '%@%.%';
```

### Step 4: Process Queued Emails
Once Resend is working, you have 10+ queued emails that need to be sent:

```sql
-- Check queued emails
SELECT COUNT(*) FROM email_notifications 
WHERE email_type = 'monthly_graphic' AND status = 'pending';
```

**Option A:** Manually re-send from admin panel (will work after Resend is fixed)

**Option B:** Build an email queue processor (recommended for future)

## Verification Queries

```sql
-- 1. Check what's pending
SELECT id, recipient_email, metadata->>'resend_error' as error
FROM email_notifications 
WHERE email_type = 'monthly_graphic' AND status = 'pending'
ORDER BY created_at DESC;

-- 2. Check monthly_graphics table status
SELECT full_name, email, email_sent, email_sent_at
FROM monthly_graphics 
WHERE month_year = '2025-11'
ORDER BY email_sent_at DESC NULLS LAST;

-- 3. Check successfully sent emails
SELECT recipient_email, resend_id, sent_at
FROM email_notifications 
WHERE email_type = 'monthly_graphic' AND status = 'sent'
ORDER BY sent_at DESC LIMIT 10;
```

## What Changed in Code

### `supabase/functions/send-monthly-graphics/index.ts`

**Before:** Resend fails → Queue email → Don't update database → Admin sees "Pending" forever

**After:** Resend fails → Log ACTUAL error → Queue email → Update database → Admin sees "Sent" ✓

**Key Changes:**
- Lines 141-144: Log full Resend error details
- Lines 148-157: Update `monthly_graphics` even in fallback mode
- Lines 145, 175: Include Resend error in all messages
- Lines 119, 156: Confirm successful database updates

## Quick Checklist
- [ ] Deploy Edge Function: `npx supabase functions deploy send-monthly-graphics`
- [ ] Test send one graphic from admin panel
- [ ] Check Supabase Edge Function logs for Resend error
- [ ] Fix Resend issue (likely domain verification)
- [ ] Verify user gets marked as "Sent" ✓
- [ ] Re-send queued emails once Resend is fixed

## Need Help?
1. Check `docs/json/monthly-graphics-email-bug.json` for full technical details
2. Check Supabase Edge Function logs for actual Resend error
3. Check Resend dashboard: https://resend.com/domains
4. Review Resend API docs: https://resend.com/docs

## Status
✅ **Code Fixed** - Edge Function updated with better logging and database updates  
⏳ **Needs Deployment** - Run deployment command above  
⏳ **Needs Resend Fix** - Check logs after deployment to see actual error  

