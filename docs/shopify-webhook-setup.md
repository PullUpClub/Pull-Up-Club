# Shopify Patch Webhook Setup

## Webhook URL
```
https://yqnikgupiaghgjtsaypr.supabase.co/functions/v1/shopify-patch-webhook
```

## Setup Instructions

### 1. Disable JWT Verification
The `shopify-patch-webhook` function needs to have JWT verification disabled since Shopify webhooks don't include JWT tokens.

**Important:** Run this command to redeploy the function without JWT verification:
```bash
npx supabase functions deploy shopify-patch-webhook --no-verify-jwt
```

### 2. Set Environment Variables
Add the following secret to your Supabase project:

**In Supabase Dashboard:**
1. Go to Project Settings → Edge Functions → Secrets
2. Add new secret:
   - Name: `SHOPIFY_WEBHOOK_SECRET`
   - Value: [Get this from Shopify after creating the webhook]

**Or via CLI:**
```bash
npx supabase secrets set SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Configure Shopify Webhook

1. **Go to Shopify Admin:**
   - Settings → Notifications → Webhooks

2. **Create New Webhook:**
   - Event: `Order creation` (orders/create)
   - Format: `JSON`
   - URL: `https://yqnikgupiaghgjtsaypr.supabase.co/functions/v1/shopify-patch-webhook`
   - API version: Latest

3. **Save the Webhook Secret:**
   - After creating the webhook, Shopify will provide a signing secret
   - Copy this secret and add it to Supabase as `SHOPIFY_WEBHOOK_SECRET`

4. **Optional: Add Second Webhook for Paid Orders**
   - Event: `Order payment` (orders/paid)
   - Same URL and configuration as above
   - This ensures patches are marked as claimed when payment is confirmed

### 4. Product Mapping
The webhook automatically maps these product handles to patch types:

| Product Handle/Title Contains | Patch Type |
|------------------------------|-----------|
| `3-months-in-pullupclub` or `3 months` | warrior |
| `6-months-in-patch-pullupclub` or `6 months` | champion |
| `9-months-in-patch-pullupclub` or `9 months` | guardian |
| `12-months-in-patch-pullupclub` or `12 months` | immortal |

Make sure your Shopify product handles match these patterns.

### 5. Testing
To test the webhook:
1. Place a test order in Shopify
2. Check the Edge Function logs in Supabase Dashboard
3. Verify the patch was marked as claimed in the `patch_claims` table

## Monitoring
- View webhook logs: Supabase Dashboard → Edge Functions → shopify-patch-webhook → Logs
- View claimed patches: Database → Table Editor → patch_claims
- View claim attempts: Database → Table Editor → patch_claim_attempts

## Troubleshooting

### Webhook Signature Verification Fails
- Ensure `SHOPIFY_WEBHOOK_SECRET` is set correctly in Supabase
- The secret should match what Shopify provides

### User Not Found
- The webhook looks up users by email
- Ensure the customer email in Shopify matches the user's email in your auth system

### Patch Not Claimed
- Check product handles match the patterns above
- View Edge Function logs for details
- Verify the order contains patch products

## Security
- Webhook signatures are verified using HMAC-SHA256
- Only authenticated users can view their own claim attempts
- Admins can view all claim attempts and claims

