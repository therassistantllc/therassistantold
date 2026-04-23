# Revised schema package

This package replaces overlapping masters with a smaller canonical set.

## Canonical masters
- organizations
- clients
- encounters
- claims
- workqueue_items

## Supporting tables
- appointments
- encounter_notes
- claim_service_lines
- claim_submissions
- claim_status_inquiries
- billing_alerts
- support_tickets
- providers / provider_locations
- insurance_payers / insurance_subscribers / insurance_policies
- eligibility_checks / authorization_or_referrals
- payment_import_batches / payment_import_items / payment_postings / payment_posting_allocations
- external_transactions / external_transaction_attempts / external_message_envelopes

## Safe delete after migration
- admin-clients-schema.sql
- admin-claims-schema.sql
- coding-billing-schema.sql

## Likely delete after migration
- operations-schema.sql

## Keep only for optional/reference use
- claims-billing-schema.sql
- clinical-documentation-schema.sql
- documentation-engine-schema.sql
- eligibility-reports-schema.sql
- credentialing-schema.sql
- provider-billing-identity-schema.sql
- providers-schema.sql
- patient-insurance-schema.sql
- payment-reconciliation-schema.sql
- support-module-schema.sql
- auth-schema.sql
- patient-scheduling-schema.sql
- coding-billing-engine-schema.sql

## Key fixes
- Replaced mixed org_id/client_id/tenant references with organization_id
- Replaced competing patient/patient_records tables with clients
- Replaced visit-as-note / visit-as-coding-session with encounters
- Replaced duplicate claim masters with claims
- Replaced multiple operational work systems with workqueue_items
- Kept billing_alerts as signals and support_tickets as communication records
- Kept claim submissions/status inquiries as transport/history only
