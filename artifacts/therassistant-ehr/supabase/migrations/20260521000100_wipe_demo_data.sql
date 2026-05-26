-- ============================================================================
-- WIPE DEMO / SEED DATA
-- ============================================================================
-- This migration removes the demo rows previously inserted by the seed SQL
-- files in `supabase/seed/` and by `supabase/migrations/20260511210000_
-- provider_credentialing_seed.sql`. After this runs, the app should display
-- empty lists for any operator-facing surface until real data is created
-- through the UI / OAuth / clearinghouse integrations.
--
-- Safety:
--   * Scoped to the demo organization slug `therassistant-demo`. If your
--     organization slug differs, EDIT the WHERE clause below before running.
--   * Wrapped in a transaction. If anything fails, nothing changes.
--   * `audit_logs` is intentionally NOT wiped — keep history.
--   * `profiles` (users) is NOT wiped — keep logins.
--   * `organizations`, `payers`, `provider_credentialing_profiles`,
--     `payer_profiles` are NOT wiped — these are configuration the operator
--     entered or will edit, not demo data.
--
-- If you want a full nuke including configuration, change `KEEP_CONFIG` to
-- false in your psql session (`\set KEEP_CONFIG false`) and re-author below.
-- ============================================================================

BEGIN;

WITH demo_org AS (
  SELECT id FROM public.organizations WHERE slug = 'therassistant-demo'
)
DELETE FROM public.mailroom_items
 WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.inbound_email_messages WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.charge_capture_items WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.copay_transactions WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.billing_alerts WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.workqueue_items WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.claim_837p_batch_claims WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.claim_837p_batches WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.professional_claims WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.authorization_or_referrals WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.appointments WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.intake_submissions WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.intake_links WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.availity_transactions WHERE organization_id IN (SELECT id FROM demo_org);

-- Clients and insurance_policies are the most "real-looking" demo rows.
-- Wipe them too — operators will create real patients through intake.
WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.insurance_policies WHERE organization_id IN (SELECT id FROM demo_org);

WITH demo_org AS (SELECT id FROM public.organizations WHERE slug = 'therassistant-demo')
DELETE FROM public.clients WHERE organization_id IN (SELECT id FROM demo_org);

COMMIT;

-- Storage objects under `mailroom-documents/mailroom/demo/*` must be wiped
-- separately — they live in Supabase Storage, not Postgres. Run from the
-- Supabase dashboard or via the storage API:
--   supabase storage rm --recursive mailroom-documents/mailroom/demo/
