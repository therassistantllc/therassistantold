# Security Configuration

## Environment Variables

This application uses environment variables for sensitive configuration. **Never commit the `.env` file to source control.**

### Setup Instructions

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your actual credentials:
   - `STRIPE_SECRET_KEY`: Your Stripe secret API key
   - `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_KEY`: Your Supabase service role key
   - `PORT`: Server port (default: 3000)

### Security Notes

- ✅ `.env` is listed in `.gitignore` and will not be committed
- ✅ Use `.env.example` (with placeholder values) for documentation
- ✅ Rotate credentials immediately if accidentally exposed
- ✅ Use different credentials for development and production

### If Credentials Are Exposed

1. **Immediate Actions:**
   - Rotate all exposed API keys in Stripe dashboard
   - Reset Supabase service key in project settings
   - Update webhook secrets
   - Update `.env` with new credentials

2. **Git History:**
   - If secrets were committed, consider rewriting git history or rotating all credentials

## Current Status

All hardcoded secrets have been moved to environment variables as of April 20, 2026.
