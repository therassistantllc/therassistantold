create extension if not exists pgcrypto;

-- Keep professional_claims usable as the canonical claim table for billing UIs/APIs
-- that filter active claims or report submitted activity.
alter table public.professional_claims
  add column if not exists archived_at timestamptz,
  add column if not exists submitted_at timestamptz;

create index if not exists idx_professional_claims_org_submitted_at
  on public.professional_claims (organization_id, submitted_at desc)
  where submitted_at is not null and archived_at is null;

create index if not exists idx_professional_claims_org_active_status
  on public.professional_claims (organization_id, claim_status, updated_at desc)
  where archived_at is null;

-- Preserve parsed ERA patient demographics after import so Add Patient/manual match
-- screens can prefill from the actual 835 instead of losing the NM1 data.
alter table public.era_claim_payments
  add column if not exists parsed_patient_first_name text,
  add column if not exists parsed_patient_last_name text,
  add column if not exists parsed_patient_middle_name text,
  add column if not exists parsed_patient_member_id text,
  add column if not exists parsed_patient_date_of_birth date,
  add column if not exists parsed_patient_name text,
  add column if not exists match_blockers jsonb not null default '[]'::jsonb,
  add column if not exists posted_at timestamptz;

create index if not exists idx_era_claim_payments_parsed_patient_name
  on public.era_claim_payments (organization_id, parsed_patient_last_name, parsed_patient_first_name)
  where archived_at is null;

-- Compatibility view for posted payment history across insurance ERA ledger entries
-- and patient-responsibility payments.
create or replace view public.rcm_posted_payments as
select
  eple.id,
  eple.organization_id,
  eple.client_id,
  eple.professional_claim_id,
  eple.era_claim_payment_id,
  null::uuid as patient_invoice_id,
  eple.entry_type as payment_type,
  eple.amount,
  eple.description,
  eple.created_at as posted_at,
  'era_posting_ledger_entries'::text as source_table
from public.era_posting_ledger_entries eple
where eple.archived_at is null
union all
select
  pip.id,
  pip.organization_id,
  pip.client_id,
  pi.professional_claim_id,
  pi.era_claim_payment_id,
  pip.patient_invoice_id,
  'patient_payment'::text as payment_type,
  pip.amount,
  pip.memo as description,
  pip.paid_at as posted_at,
  'patient_invoice_payments'::text as source_table
from public.patient_invoice_payments pip
join public.patient_invoices pi on pi.id = pip.patient_invoice_id
where pip.archived_at is null
  and pip.payment_status = 'posted';

select pg_notify('pgrst', 'reload schema');
