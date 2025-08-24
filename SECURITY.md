# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within Pull-Up Club, please send an email to **security@pullupclub.com**. All security vulnerabilities will be promptly addressed.

We are committed to working with security researchers to resolve issues. Please do not publicly disclose the issue until it has been addressed by our team.

## Core Security Measures

### 1. Environment & Secret Management
- All sensitive credentials (API keys, JWT secrets, database credentials) are stored as environment variables using Supabase's secrets management.
- No secrets are ever hardcoded or committed to the repository.
- Separate credentials are used for development and production environments.

### 2. Database Security
- **Row-Level Security (RLS):** RLS is enabled on all tables, ensuring users can only access their own data. Policies are optimized for performance by evaluating user authentication status once per query.
- **Function Security:** All PostgreSQL functions have their `search_path` explicitly set to `public` to prevent search path hijacking attacks.
- **SQL Injection Prevention:** Supabase's client libraries use prepared statements, mitigating the risk of SQL injection.
- **Connection Security:** All connections to the database are encrypted via SSL.

### 3. API & Edge Function Security
- **JWT Authentication:** All sensitive API endpoints and Edge Functions are protected and require a valid JWT passed in the Authorization header. The JWT is verified on the server to authenticate and authorize requests.
- **Webhook Security:** Stripe and Resend webhooks are verified using a signing secret to ensure they originate from a trusted source.
- **CORS Policies:** Strict Cross-Origin Resource Sharing (CORS) policies are configured for all Edge Functions.
- **Admin Endpoint Protection:** Admin-level operations (like deleting a user or managing submissions) are handled by dedicated, secure Edge Functions that validate the user's admin role from the JWT claims.
- **Rate Limiting:** Supabase's built-in rate limiting is active to prevent abuse of authentication and API endpoints.

### 4. Frontend Security
- **Content Security Policy (CSP):** A strict CSP is in place to prevent cross-site scripting (XSS) and other injection attacks.
- **XSS Protection:** React's built-in XSS protection is leveraged by not using `dangerouslySetInnerHTML`.
- **Environment Variable Exposure:** Only non-sensitive, public keys (like the Supabase anonymous key and Stripe publishable key) are exposed to the frontend.

## Version Control Security
- Pre-commit hooks are configured to scan for sensitive data before commits.
- Dependencies are regularly audited for known vulnerabilities using `npm audit`.

## Responsible Disclosure
We kindly ask that:
1. You act in good faith and do not exploit the vulnerability or access/modify user data.
2. You provide sufficient detail for us to reproduce the vulnerability.
3. You allow us a reasonable amount of time to fix the issue before any public disclosure. 