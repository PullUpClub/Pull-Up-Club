export const products = {
  pullUpClub: {
    price: 9.99,
    name: 'Monthly Membership',
    description: 'Access to all Pull-Up Club features',
    interval: 'month',
    productId: 'prod_SH8uXKHPtjHbke',
    paymentLink: 'https://buy.stripe.com/dRmdR9dos2kmaQcdHGejK00'
  },
  pullUpClubAnnual: {
    price: 99.99,
    name: 'Annual Membership',
    description: 'Access to all Pull-Up Club features, billed annually',
    interval: 'year',
    productId: 'prod_SH8vqXMcQi0qFQ',
    paymentLink: 'https://buy.stripe.com/28EcN5dosf784rO0UUejK01'
  },
};

export const stripeConfig = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  apiVersion: '2023-10-16' as const,
  successUrl: `${window.location.origin}/success`,
  cancelUrl: `${window.location.origin}/subscription`,
  allowedCountries: ['US', 'CA', 'GB', 'AU', 'NZ'], // Add or remove countries as needed
  billingAddressCollection: 'required' as const,
  customerEmail: undefined as string | undefined, // Will be set dynamically
};

// Only need price IDs in env vars (because they differ between test/live)
export const productIds = {
  monthly: import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID,
  annual: import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID,
};