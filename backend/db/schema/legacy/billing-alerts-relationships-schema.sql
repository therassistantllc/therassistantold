-- ============================================================
-- THERASSISTANT Billing Alerts — Relationship Tables & Rules Engine
-- Run AFTER billing-alerts-supabase.sql AND coding-billing-engine-schema.sql
-- AND patient-scheduling-schema.sql AND support-module-schema.sql
-- ============================================================

-- ============================================================
--  1.  EXTEND CORE TABLE
--      Add patient_id FK so billing_alerts has a proper link
--      to patient_records (currently only patient_name TEXT exists)
-- ============================================================

alter table public.billing_alerts
  add column if not exists patient_id text references public.patient_records(id) on delete set null;

create index if not exists idx_billing_alerts_patient_id
  on public.billing_alerts(patient_id);


-- ============================================================
--  2.  CLAIM LINKS
--      Many-to-many: one alert may span multiple claims
--      (original, corrected, appeal, related DOS)
-- ============================================================

create table if not exists public.billing_alert_claim_links (
  id            uuid        primary key default gen_random_uuid(),
  alert_id      uuid        not null references public.billing_alerts(id) on delete cascade,
  claim_id      uuid        not null references public.claims(id) on delete cascade,
  link_type     text        not null default 'Primary Claim'
    check (link_type in (
      'Primary Claim',
      'Related Claim',
      'Appeal',
      'Corrected Claim',
      'Original Claim',
      'Resubmission'
    )),
  is_primary    boolean     not null default false,    -- true = the triggering claim
  notes         text,
  linked_by     uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.billing_alert_claim_links enable row level security;

create index if not exists idx_bacl_alert   on public.billing_alert_claim_links(alert_id);
create index if not exists idx_bacl_claim   on public.billing_alert_claim_links(claim_id);
create index if not exists idx_bacl_primary on public.billing_alert_claim_links(alert_id, is_primary);

-- RLS: billing staff and admins can manage; clinicians read own
create policy "billing_alert_claim_links_read"
  on public.billing_alert_claim_links for select
  using (
    exists (
      select 1 from public.billing_alerts ba
      where ba.id = billing_alert_claim_links.alert_id
        and (
          ba.user_id = auth.uid()
          or exists (
            select 1 from auth.users u
            where u.id = auth.uid()
              and (u.raw_user_meta_data->>'role') in
                  ('admin','super_admin','billing_staff','billing_manager')
          )
        )
    )
  );

create policy "billing_alert_claim_links_write"
  on public.billing_alert_claim_links for all
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_user_meta_data->>'role') in
            ('admin','super_admin','billing_staff','billing_manager')
    )
  );


-- ============================================================
--  3.  APPOINTMENT LINKS
--      Many-to-many: one alert may cover multiple dates of service
-- ============================================================

create table if not exists public.billing_alert_appointment_links (
  id               uuid        primary key default gen_random_uuid(),
  alert_id         uuid        not null references public.billing_alerts(id) on delete cascade,
  appointment_id   uuid        not null references public.appointments(id) on delete cascade,
  dos              date,        -- snapshot of date-of-service at time of link creation
  is_primary       boolean     not null default false,
  notes            text,
  linked_by        uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.billing_alert_appointment_links enable row level security;

create index if not exists idx_baal_alert       on public.billing_alert_appointment_links(alert_id);
create index if not exists idx_baal_appointment on public.billing_alert_appointment_links(appointment_id);
create index if not exists idx_baal_dos         on public.billing_alert_appointment_links(dos);

create policy "billing_alert_appt_links_read"
  on public.billing_alert_appointment_links for select
  using (
    exists (
      select 1 from public.billing_alerts ba
      where ba.id = billing_alert_appointment_links.alert_id
        and (
          ba.user_id = auth.uid()
          or exists (
            select 1 from auth.users u
            where u.id = auth.uid()
              and (u.raw_user_meta_data->>'role') in
                  ('admin','super_admin','billing_staff','billing_manager')
          )
        )
    )
  );

create policy "billing_alert_appt_links_write"
  on public.billing_alert_appointment_links for all
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_user_meta_data->>'role') in
            ('admin','super_admin','billing_staff','billing_manager')
    )
  );


-- ============================================================
--  4.  TICKET LINKS
--      Many-to-many: billing alerts ↔ support tickets
--      A ticket may spawn an alert, or an alert may spawn a ticket
-- ============================================================

create table if not exists public.billing_alert_ticket_links (
  id               uuid        primary key default gen_random_uuid(),
  alert_id         uuid        not null references public.billing_alerts(id) on delete cascade,
  ticket_id        text        not null references public.support_tickets(id) on delete cascade,
  link_direction   text        not null default 'Manual link'
    check (link_direction in (
      'Alert spawned ticket',    -- billing alert was the source; ticket created to resolve it
      'Ticket spawned alert',    -- support ticket triggered this billing alert
      'Manual link'              -- staff manually associated the two records
    )),
  notes            text,
  linked_by        uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.billing_alert_ticket_links enable row level security;

create index if not exists idx_batl_alert  on public.billing_alert_ticket_links(alert_id);
create index if not exists idx_batl_ticket on public.billing_alert_ticket_links(ticket_id);

create policy "billing_alert_ticket_links_read"
  on public.billing_alert_ticket_links for select
  using (
    exists (
      select 1 from public.billing_alerts ba
      where ba.id = billing_alert_ticket_links.alert_id
        and (
          ba.user_id = auth.uid()
          or exists (
            select 1 from auth.users u
            where u.id = auth.uid()
              and (u.raw_user_meta_data->>'role') in
                  ('admin','super_admin','billing_staff','billing_manager')
          )
        )
    )
  );

create policy "billing_alert_ticket_links_write"
  on public.billing_alert_ticket_links for all
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_user_meta_data->>'role') in
            ('admin','super_admin','billing_staff','billing_manager')
    )
  );


-- ============================================================
--  5.  RULES ENGINE
--      Defines automated conditions that generate billing alerts
--      When a trigger_event fires and all conditions match,
--      a new billing_alert is auto-created with the configured
--      alert_type and priority.
-- ============================================================

create sequence if not exists billing_alert_rule_seq start 1;

create table if not exists public.billing_alert_rules (
  id                   uuid        primary key default gen_random_uuid(),
  rule_number          text        unique not null
    default 'BAR-' || to_char(extract(year from now()), 'FM9999') || '-'
              || lpad(nextval('billing_alert_rule_seq')::text, 3, '0'),

  rule_name            text        not null,
  description          text,

  -- ── Trigger ─────────────────────────────────────────────
  trigger_event        text        not null
    check (trigger_event in (
      'claim_denied',             -- payer returns denial on a claim
      'claim_underpaid',          -- payment amount < expected/contracted rate
      'claim_no_response',        -- claim submitted > N days with no ERA/EFT
      'auth_expiring',            -- prior auth expires within threshold window
      'auth_missing',             -- service requires auth but none on file
      'auth_exceeded',            -- authorized units/visits exhausted
      'eligibility_inactive',     -- patient eligibility check returns inactive
      'balance_threshold',        -- patient balance exceeds configured amount
      'late_filing_risk',         -- claim approaching payer filing deadline
      'coding_error_detected',    -- coding validation returns error flag
      'recoupment_notice',        -- ERA contains recoupment/adjustment
      'cob_discrepancy',          -- coordination of benefits conflict
      'credentialing_issue',      -- provider credentialing flag raised
      'duplicate_claim_detected', -- exact duplicate DOS + service code + patient
      'manual'                    -- staff-triggered rule (always fires when invoked)
    )),

  -- ── Condition (optional — narrows when the rule fires) ──
  condition_field      text,       -- e.g. 'payer_name', 'balance', 'service_code', 'dos_age_days'
  condition_operator   text
    check (condition_operator in ('=','!=','>','>=','<','<=','contains','starts_with','is_null','is_not_null')),
  condition_value      text,       -- compared value (cast at runtime per field type)

  -- ── Auto-generated alert config ─────────────────────────
  auto_alert_type      text        not null
    check (auto_alert_type in (
      'Claim Denial','Payment Recoupment','Authorization Required',
      'Balance Due','Credentialing Issue','EOB Discrepancy','Coding Error',
      'Insurance Verification','Coordination of Benefits','Late Filing',
      'Appeals Required','Other'
    )),
  auto_priority        text        not null default 'Routine'
    check (auto_priority in ('Routine','High Priority','Urgent')),
  auto_description_template text,  -- may include {patient_name}, {claim_id}, {payer} tokens

  -- ── Behaviour ───────────────────────────────────────────
  is_active            boolean     not null default true,
  cooldown_hours       integer     not null default 24,   -- min hours before re-firing for same patient
  max_per_patient_open integer     default null,          -- null = unlimited; 1 = no dupe open alerts

  -- ── Scope ───────────────────────────────────────────────
  applies_to_payer     text,       -- null = all payers; value = restrict to named payer
  applies_to_service_code text,    -- null = all codes; value = specific service code only

  -- ── Audit ───────────────────────────────────────────────
  created_by           uuid        references auth.users(id) on delete set null,
  updated_by           uuid        references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.billing_alert_rules enable row level security;

create index if not exists idx_bar_active_event on public.billing_alert_rules(is_active, trigger_event);
create index if not exists idx_bar_payer        on public.billing_alert_rules(applies_to_payer) where applies_to_payer is not null;
create index if not exists idx_bar_service_code on public.billing_alert_rules(applies_to_service_code) where applies_to_service_code is not null;

-- Only admins and billing managers can configure rules
create policy "billing_alert_rules_read"
  on public.billing_alert_rules for select
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_user_meta_data->>'role') in
            ('admin','super_admin','billing_staff','billing_manager')
    )
  );

create policy "billing_alert_rules_write"
  on public.billing_alert_rules for all
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_user_meta_data->>'role') in
            ('admin','super_admin','billing_manager')
    )
  );

-- updated_at trigger
create or replace function public.set_bar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_bar_updated_at
  before update on public.billing_alert_rules
  for each row execute procedure public.set_bar_updated_at();


-- ============================================================
--  6.  ESCALATIONS
--      Records each time an alert is escalated beyond its
--      originally assigned staff member.  Tracks the SLA
--      hours elapsed at the point of escalation and whether
--      the escalation has been resolved.
-- ============================================================

create table if not exists public.billing_alert_escalations (
  id                   uuid        primary key default gen_random_uuid(),
  alert_id             uuid        not null references public.billing_alerts(id) on delete cascade,

  -- ── Who ─────────────────────────────────────────────────
  escalated_by         uuid        not null references auth.users(id) on delete restrict,
  escalated_to         uuid        not null references auth.users(id) on delete restrict,
  escalated_from       uuid        references auth.users(id) on delete set null,  -- prior owner

  -- ── Why / Context ───────────────────────────────────────
  reason               text        not null,
  escalation_type      text        not null default 'SLA Breach'
    check (escalation_type in (
      'SLA Breach',          -- due date passed without resolution
      'At Risk',             -- approaching SLA threshold; pre-emptive escalation
      'Payer Dispute',       -- requires senior payer contact
      'Clinical Review',     -- needs clinician input
      'Legal / Compliance',  -- compliance or fraud risk flagged
      'Manual'               -- staff-initiated without SLA trigger
    )),
  sla_hours_elapsed    integer,    -- hours between alert creation and escalation
  due_date_snapshot    date,       -- due_date at time of escalation (may change after)

  -- ── Resolution ──────────────────────────────────────────
  status               text        not null default 'Open'
    check (status in ('Open','Resolved','Withdrawn')),
  resolution_notes     text,
  resolved_by          uuid        references auth.users(id) on delete set null,
  resolved_at          timestamptz,

  created_at           timestamptz not null default now()
);

alter table public.billing_alert_escalations enable row level security;

create index if not exists idx_bae_alert       on public.billing_alert_escalations(alert_id);
create index if not exists idx_bae_escalated_to on public.billing_alert_escalations(escalated_to);
create index if not exists idx_bae_status      on public.billing_alert_escalations(status) where status = 'Open';
create index if not exists idx_bae_type_status on public.billing_alert_escalations(escalation_type, status);

create policy "billing_alert_escalations_read"
  on public.billing_alert_escalations for select
  using (
    auth.uid() = escalated_by
    or auth.uid() = escalated_to
    or auth.uid() = escalated_from
    or exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_user_meta_data->>'role') in
            ('admin','super_admin','billing_staff','billing_manager')
    )
  );

create policy "billing_alert_escalations_write"
  on public.billing_alert_escalations for all
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_user_meta_data->>'role') in
            ('admin','super_admin','billing_staff','billing_manager')
    )
  );


-- ============================================================
--  7.  RULE FIRE LOG
--      Audit trail of every time a rule generates an alert.
--      Enables cooldown enforcement and reporting on rule health.
-- ============================================================

create table if not exists public.billing_alert_rule_fire_log (
  id                uuid        primary key default gen_random_uuid(),
  rule_id           uuid        not null references public.billing_alert_rules(id) on delete cascade,
  generated_alert_id uuid       references public.billing_alerts(id) on delete set null,
  patient_id        text        references public.patient_records(id) on delete set null,
  claim_id          uuid        references public.claims(id) on delete set null,
  trigger_payload   jsonb,      -- snapshot of the data that triggered the rule
  suppressed        boolean     not null default false,   -- true = rule matched but cooldown blocked alert
  suppression_reason text,
  fired_at          timestamptz not null default now()
);

create index if not exists idx_barfl_rule         on public.billing_alert_rule_fire_log(rule_id);
create index if not exists idx_barfl_patient       on public.billing_alert_rule_fire_log(patient_id);
create index if not exists idx_barfl_fired_at      on public.billing_alert_rule_fire_log(fired_at);
create index if not exists idx_barfl_rule_patient  on public.billing_alert_rule_fire_log(rule_id, patient_id, fired_at);


-- ============================================================
--  8.  COMPOSITE INDEXES ON CORE TABLE
--      Add join-path indexes that were missing from the original
--      billing-alerts-supabase.sql migration.
-- ============================================================

-- patient_id + status (most common filtering pattern)
create index if not exists idx_ba_patient_status
  on public.billing_alerts(patient_id, status)
  where patient_id is not null;

-- patient_id + priority
create index if not exists idx_ba_patient_priority
  on public.billing_alerts(patient_id, priority)
  where patient_id is not null;

-- alert_type + status  (dashboard counters by type)
create index if not exists idx_ba_type_status
  on public.billing_alerts(alert_type, status);

-- clinician_id + status  (clinician-facing alert list)
create index if not exists idx_ba_clinician_status
  on public.billing_alerts(clinician_id, status);

-- is_urgent fast filter
create index if not exists idx_ba_urgent
  on public.billing_alerts(is_urgent)
  where is_urgent = true;

-- Full-text search across alert fields
create index if not exists idx_ba_fts on public.billing_alerts
  using gin (
    to_tsvector('english',
      coalesce(alert_id,        '') || ' ' ||
      coalesce(patient_name,    '') || ' ' ||
      coalesce(payer_name,      '') || ' ' ||
      coalesce(description,     '') || ' ' ||
      coalesce(action_needed,   '') || ' ' ||
      coalesce(staff_notes,     '')
    )
  );


-- ============================================================
--  9.  UPDATED_AT TRIGGER FOR CORE TABLE
--      The original billing_alerts table has updated_at column
--      but no trigger — add it here.
-- ============================================================

create or replace function public.set_billing_alert_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_billing_alert_updated_at
  before update on public.billing_alerts
  for each row execute procedure public.set_billing_alert_updated_at();


-- ============================================================
--  10. HELPER VIEWS
-- ============================================================

-- billing_alerts enriched with direct patient and claim counts
create or replace view public.billing_alerts_enriched as
select
  ba.*,
  pr.name                                          as patient_full_name,
  pr.payer                                         as patient_payer,
  pr.insurance_status                              as patient_insurance_status,
  pr.outstanding_balance                           as patient_balance_on_file,
  count(distinct bacl.claim_id)                    as linked_claim_count,
  count(distinct baal.appointment_id)              as linked_appointment_count,
  count(distinct batl.ticket_id)                   as linked_ticket_count,
  count(distinct bae.id) filter (where bae.status = 'Open') as open_escalation_count
from public.billing_alerts ba
left join public.patient_records          pr   on pr.id  = ba.patient_id
left join public.billing_alert_claim_links       bacl on bacl.alert_id = ba.id
left join public.billing_alert_appointment_links baal on baal.alert_id = ba.id
left join public.billing_alert_ticket_links      batl on batl.alert_id = ba.id
left join public.billing_alert_escalations       bae  on bae.alert_id  = ba.id
group by ba.id, pr.name, pr.payer, pr.insurance_status, pr.outstanding_balance;


-- active rules summary (for admin rules-engine dashboard)
create or replace view public.billing_alert_rules_summary as
select
  bar.*,
  count(distinct fl.id)                                      as total_fires,
  count(distinct fl.id) filter (where not fl.suppressed)     as successful_fires,
  count(distinct fl.id) filter (where fl.suppressed)         as suppressed_fires,
  max(fl.fired_at)                                           as last_fired_at
from public.billing_alert_rules bar
left join public.billing_alert_rule_fire_log fl on fl.rule_id = bar.id
group by bar.id;


-- ============================================================
--  END OF MIGRATION
--  Run order:
--    1. admin-clients-schema.sql           (patient_records)
--    2. coding-billing-engine-schema.sql   (claims)
--    3. patient-scheduling-schema.sql      (appointments)
--    4. support-module-schema.sql          (support_tickets)
--    5. billing-alerts-supabase.sql        (billing_alerts core)
--    6. billing-alerts-relationships-schema.sql  ← THIS FILE
-- ============================================================
