import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain, x-shopify-order-id',
}

// Verify Shopify HMAC signature
async function verifyShopifyWebhook(body: string, hmacHeader: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  )
  
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return base64Signature === hmacHeader
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get webhook data
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
    const topic = req.headers.get('x-shopify-topic')
    const shopifySecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')
    
    console.log('Received Shopify webhook:', topic)

    if (!hmacHeader || !shopifySecret) {
      console.error('Missing HMAC header or webhook secret')
      return new Response(JSON.stringify({ error: 'Missing webhook verification data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.text()
    
    // Verify the webhook signature
    const isValid = await verifyShopifyWebhook(body, hmacHeader, shopifySecret)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const webhookData = JSON.parse(body)
    
    // Only process order creation/payment events
    if (topic !== 'orders/create' && topic !== 'orders/paid') {
      console.log('Ignoring webhook topic:', topic)
      return new Response(JSON.stringify({ message: 'Webhook topic ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Extract customer email and line items
    const customerEmail = webhookData.customer?.email || webhookData.email
    const lineItems = webhookData.line_items || []
    
    console.log('Processing order for email:', customerEmail)
    console.log('Line items:', lineItems.length)

    if (!customerEmail) {
      console.error('No customer email in webhook')
      return new Response(JSON.stringify({ error: 'No customer email in webhook' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Find user by email from auth.users
    const { data: authUser, error: authError } = await supabaseClient.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error fetching users:', authError)
      throw authError
    }

    const user = authUser.users.find(u => u.email === customerEmail)
    
    if (!user) {
      console.error('User not found for email:', customerEmail)
      // Still return 200 to Shopify so it doesn't retry
      return new Response(JSON.stringify({ 
        message: 'User not found, webhook acknowledged but not processed' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Found user:', user.id)

    // Map product handles/titles to patch types
    const patchMapping: { [key: string]: string } = {
      '3-months-in-pullupclub-com': 'warrior',
      '3-months-in-pullupclub': 'warrior',
      '3 months': 'warrior',
      '6-months-in-patch-pullupclub-com': 'champion',
      '6-months-in-patch-pullupclub': 'champion',
      '6 months': 'champion',
      '9-months-in-patch-pullupclub-com': 'guardian',
      '9-months-in-patch-pullupclub': 'guardian',
      '9 months': 'guardian',
      '12-months-in-patch-pullupclub-com': 'immortal',
      '12-months-in-patch-pullupclub': 'immortal',
      '12 months': 'immortal'
    }

    let patchesClaimed = 0

    for (const item of lineItems) {
      const productHandle = (item.product_id || '').toString().toLowerCase()
      const productTitle = (item.title || '').toLowerCase()
      const productSku = (item.sku || '').toLowerCase()
      
      console.log('Processing item:', { productHandle, productTitle, productSku })

      // Try to match by handle, title, or SKU
      let patchType = null
      
      for (const [key, value] of Object.entries(patchMapping)) {
        if (productHandle.includes(key) || 
            productTitle.includes(key) || 
            productSku.includes(key) ||
            productTitle.includes(key.replace(/-/g, ' '))) {
          patchType = value
          break
        }
      }
      
      if (patchType) {
        console.log('Matched patch type:', patchType)
        
        // Mark patch as claimed
        const { error: claimError } = await supabaseClient
          .from('patch_claims')
          .upsert({
            user_id: user.id,
            patch_type: patchType,
            claimed_at: new Date().toISOString(),
            order_placed_at: new Date().toISOString(),
            shopify_order_id: webhookData.id?.toString()
          }, {
            onConflict: 'user_id,patch_type'
          })

        if (claimError) {
          console.error('Error marking patch as claimed:', claimError)
        } else {
          console.log('Successfully marked patch as claimed:', patchType)
          patchesClaimed++
        }
      } else {
        console.log('No patch type matched for item')
      }
    }

    console.log(`Processed ${patchesClaimed} patches for user ${user.id}`)

    return new Response(JSON.stringify({ 
      success: true, 
      patchesClaimed,
      userId: user.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

