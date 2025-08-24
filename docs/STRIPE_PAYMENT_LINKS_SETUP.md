# Stripe Payment Links Setup

## Overview
This document explains how to configure Stripe Payment Links for the Pull-Up Club secure signup flow.

## Production Payment Links

### Monthly Plan
- **Payment Link:** `https://buy.stripe.com/dRmdR9dos2kmaQcdHGejK00`
- **Product ID:** `prod_SH8uXKHPtjHbke`
- **Price ID:** `price_1RMacXGaHiDfsUfBF4dgFfjO`
- **Success URL:** `https://pullupclub.com/signup-access?session_id={CHECKOUT_SESSION_ID}`
- **Cancel URL:** `https://pullupclub.com/subscription`

### Annual Plan
- **Payment Link:** `https://buy.stripe.com/28EcN5dosf784rO0UUejK01`
- **Product ID:** `prod_SH8vqXMcQi0qFQ`
- **Price ID:** `price_1RMadhGaHiDfsUfBrKZXrwQS`
- **Success URL:** `https://pullupclub.com/signup-access?session_id={CHECKOUT_SESSION_ID}`
- **Cancel URL:** `https://pullupclub.com/subscription`

## Subscription Management

Subscription management is handled through the Stripe Customer Portal. Users can:
- Update their payment method
- View billing history
- Cancel their subscription
- Manage their subscription settings

The Customer Portal is automatically accessible through the user's profile page. There is no need for manual subscription cancellation handling as all subscription management is delegated to the Stripe Customer Portal.

## Security Benefits

This setup provides several security benefits:

1. **Session Verification**: Each signup attempt is verified against Stripe's payment session
2. **Tamper Prevention**: Session IDs cannot be guessed or manipulated
3. **Payment Confirmation**: Account creation only occurs after confirmed payment
4. **Time Limits**: Stripe sessions have built-in expiration
5. **Secure Subscription Management**: All subscription changes are handled through Stripe's secure Customer Portal

## Environment Variables

Ensure these environment variables are properly set in your production environment:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

## Webhook Configuration

The Stripe webhook endpoint is configured to:
```
https://yqnikgupiaghgjtsaypr.supabase.co/functions/v1/stripe-webhooks
```

Ensure the following events are enabled:
- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed

## Troubleshooting

### Common Issues

1. **"Session not found" errors**
   - Check that STRIPE_SECRET_KEY is correctly set
   - Verify the session ID is being passed correctly

2. **CORS errors**
   - Ensure the verify-stripe-session Edge Function is deployed
   - Check CORS headers in the function

3. **Subscription Management Issues**
   - Direct users to the Customer Portal for all subscription-related actions
   - Verify webhook endpoint is receiving events
   - Check webhook logs in Stripe Dashboard

### Debugging

1. **Check session ID in URL**
   ```javascript
   const searchParams = new URLSearchParams(window.location.search);
   const sessionId = searchParams.get('session_id');
   console.log('Session ID:', sessionId);
   ```

2. **Test webhook delivery**
   ```bash
   stripe trigger customer.subscription.updated
   ```

## Production Checklist

✅ Payment Links configured with correct success/cancel URLs
✅ Webhook endpoint configured and receiving events
✅ Customer Portal enabled and configured
✅ Environment variables set with production keys
✅ Subscription management delegated to Stripe Customer Portal
✅ Test end-to-end flow with real payment methods 