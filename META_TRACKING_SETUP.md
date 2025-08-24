# Meta Tracking Setup Guide

## Environment Variables Required

To fix the Meta tracking 500 errors, you need to set up the following environment variables:

### For Vercel/Production:
```bash
META_PIXEL_ID=your_pixel_id_here
META_ACCESS_TOKEN=your_access_token_here
META_API_VERSION=v21.0
```

### For Local Development:
Create a `.env.local` file in your project root:
```bash
VITE_META_PIXEL_ID=your_pixel_id_here
VITE_META_ACCESS_TOKEN=your_access_token_here
VITE_META_API_VERSION=v21.0
```

## How to Get Meta Credentials

### 1. Meta Pixel ID
1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to Events Manager
3. Select your Pixel or create a new one
4. Copy the Pixel ID (it's a long number like `1512318086417813`)

### 2. Meta Access Token
1. In Events Manager, go to Settings
2. Scroll down to "Conversions API"
3. Click "Set up" or "Manage"
4. Generate a new access token
5. Copy the token (starts with `EAAG...`)

## Stripe Purchase Tracking

The system now supports automatic purchase tracking through:

1. **Stripe Webhooks**: Automatically tracks purchases when webhooks are received
2. **Frontend Tracking**: Tracks purchase initiation and completion
3. **Dual Tracking**: Uses both Meta Conversions API and our custom endpoint

### Purchase Events Tracked:
- `InitiateCheckout`: When user starts checkout process
- `Purchase`: When payment is completed (via Stripe webhook)
- `Lead`: When user shows interest in subscription

## Testing Meta Tracking

### 1. Check Environment Variables
```javascript
// Add this to your browser console to test
console.log('Meta Config:', {
  pixelId: import.meta.env.VITE_META_PIXEL_ID,
  hasToken: !!import.meta.env.VITE_META_ACCESS_TOKEN
});
```

### 2. Test API Endpoint
```bash
curl -X POST https://your-domain.com/api/meta/track-event \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "ViewContent",
    "userData": {"email": "test@example.com"},
    "customData": {"content_name": "Test Page"}
  }'
```

### 3. Check Meta Events Manager
1. Go to Events Manager
2. Look for test events in the "Test Events" tab
3. Verify events are being received

## Troubleshooting

### 500 Errors
- Check environment variables are set correctly
- Verify Meta credentials are valid
- Check browser console for detailed error messages

### Authentication Issues
- Clear browser storage and try again
- Check Supabase auth configuration
- Verify redirect URLs are correct

### Purchase Tracking Issues
- Check Stripe webhook configuration
- Verify webhook endpoint is accessible
- Check Meta API rate limits

## Security Notes

1. **Never expose access tokens** in client-side code
2. **Use environment variables** for all sensitive data
3. **Hash PII data** before sending to Meta
4. **Validate all inputs** before processing

## Rate Limits

- Meta Conversions API: 1000 events per second per pixel
- Stripe Webhooks: 1000 events per second
- Our API: No specific limits, but monitor usage

## Monitoring

Check these logs for issues:
- Browser console for frontend errors
- Vercel function logs for API errors
- Supabase function logs for webhook errors
- Meta Events Manager for delivery status 