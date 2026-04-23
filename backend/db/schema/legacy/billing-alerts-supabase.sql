-- ============================================================
-- THERASSISTANT Billing Alerts System — Supabase Migration
-- Run this in the Supabase SQL Editor to enable Billing Alerts
-- ============================================================

-- ── Billing Alerts ───────────────────────────────────────────
create table if not exists public.billing_alerts (
  id                   uuid primary key default gen_random_uuid(),
  alert_id             text unique not null,            -- display ID e.g. BA-2026-001
  user_id              uuid references auth.users not null,   -- clinician
  patient_name         text not null,
  patient_dob          date,
  clinician_id         uuid references auth.users,
  assigned_staff_id    uuid references auth.users,
  payer_name           text,
  insurance_id         text,
  alert_type           text check (alert_type in (
                         'Claim Denial','Payment Recoupment','Authorization Required',
                         'Balance Due','Credentialing Issue','EOB Discrepancy','Coding Error',
                         'Insurance Verification','Coordination of Benefits','Late Filing',
                         'Appeals Required','Other'
                       )) default 'Other',
  priority             text check (priority in ('Routine','High Priority','Urgent')) default 'Routine',
  status               text check (status in (
                         'New','Viewed','In Progress','Waiting on Patient',
                         'Waiting on Insurance','Waiting on Clinician','Waiting on Staff',
                         'Resolved','Archived'
                       )) default 'New',
  due_date             date,
  description          text,
  action_needed        text,
  patient_balance      numeric(10,2),
  insurance_status     text,
  related_claim_id     text,
  related_ticket_id    text,
  related_chat_id      text,
  appointment_dates    text[],
  payment_info         text,
  resolution_summary   text,
  staff_notes          text,     -- visible to clinician
  is_urgent            boolean default false,
  tags                 text[],
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  resolved_at          timestamptz
);

alter table public.billing_alerts enable row level security;

create policy "Clinicians see own billing alerts"
  on public.billing_alerts for select
  using (auth.uid() = user_id);

create policy "Clinicians can update own alert status"
  on public.billing_alerts for update
  using (auth.uid() = user_id)
  with check (status in (
    'Viewed','In Progress','Waiting on Patient','Waiting on Insurance','Resolved'
  ));

create policy "Admins full access to billing alerts"
  on public.billing_alerts for all
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
    )
  );

-- ── Billing Alert Comments ───────────────────────────────────
create table if not exists public.billing_alert_comments (
  id                uuid primary key default gen_random_uuid(),
  alert_id          uuid references public.billing_alerts on delete cascade not null,
  author_id         uuid references auth.users not null,
  author_role       text check (author_role in ('clinician','staff','system')) not null,
  author_name       text,
  content           text not null,
  is_internal       boolean default false,   -- staff-only internal note
  parent_comment_id uuid references public.billing_alert_comments,
  attachments       text[],                  -- file URLs
  created_at        timestamptz default now(),
  edited_at         timestamptz
);

alter table public.billing_alert_comments enable row level security;

create policy "Clinicians see non-internal comments on own alerts"
  on public.billing_alert_comments for select
  using (
    is_internal = false
    and exists (
      select 1 from public.billing_alerts
      where id = alert_id and user_id = auth.uid()
    )
  );

create policy "Clinicians can add comments to own alerts"
  on public.billing_alert_comments for insert
  with check (
    author_id = auth.uid()
    and author_role = 'clinician'
    and is_internal = false
    and exists (
      select 1 from public.billing_alerts
      where id = alert_id and user_id = auth.uid()
    )
  );

create policy "Staff full access to comments"
  on public.billing_alert_comments for all
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
    )
  );

-- ── Billing Alert Attachments ────────────────────────────────
create table if not exists public.billing_alert_attachments (
  id          uuid primary key default gen_random_uuid(),
  alert_id    uuid references public.billing_alerts on delete cascade not null,
  uploaded_by uuid references auth.users not null,
  file_name   text not null,
  file_url    text not null,
  file_type   text,
  file_size   integer,
  description text,
  uploaded_at timestamptz default now()
);

alter table public.billing_alert_attachments enable row level security;

create policy "Participants can see attachments"
  on public.billing_alert_attachments for select
  using (
    exists (
      select 1 from public.billing_alerts
      where id = alert_id and user_id = auth.uid()
    )
    or exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
    )
  );

create policy "Participants can upload attachments"
  on public.billing_alert_attachments for insert
  with check (
    auth.uid() = uploaded_by
    and (
      exists (
        select 1 from public.billing_alerts
        where id = alert_id and user_id = auth.uid()
      )
      or exists (
        select 1 from auth.users
        where id = auth.uid()
          and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
      )
    )
  );

-- ── Billing Alert Activity Log ───────────────────────────────
create table if not exists public.billing_alert_activity_log (
  id            uuid primary key default gen_random_uuid(),
  alert_id      uuid references public.billing_alerts on delete cascade not null,
  actor_id      uuid references auth.users,
  actor_role    text check (actor_role in ('clinician','staff','system')),
  actor_name    text,
  action        text not null,
  field_changed text,
  old_value     text,
  new_value     text,
  notes         text,
  created_at    timestamptz default now()
);

alter table public.billing_alert_activity_log enable row level security;

create policy "Alert participants can see activity"
  on public.billing_alert_activity_log for select
  using (
    exists (
      select 1 from public.billing_alerts
      where id = alert_id and user_id = auth.uid()
    )
    or exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
    )
  );

create policy "System and staff can insert activity"
  on public.billing_alert_activity_log for insert
  with check (auth.uid() = actor_id or actor_role = 'system');

-- ── Billing Alert Assignments ────────────────────────────────
create table if not exists public.billing_alert_assignments (
  id          uuid primary key default gen_random_uuid(),
  alert_id    uuid references public.billing_alerts on delete cascade not null,
  staff_id    uuid references auth.users not null,
  assigned_by uuid references auth.users,
  assigned_at timestamptz default now(),
  status      text check (status in ('active','completed')) default 'active'
);

alter table public.billing_alert_assignments enable row level security;

create policy "Staff can see assignments"
  on public.billing_alert_assignments for all
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
    )
  );

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_billing_alerts_user    on public.billing_alerts(user_id);
create index if not exists idx_billing_alerts_status  on public.billing_alerts(status);
create index if not exists idx_billing_alerts_priority on public.billing_alerts(priority);
create index if not exists idx_billing_alerts_due     on public.billing_alerts(due_date);
create index if not exists idx_ba_comments_alert      on public.billing_alert_comments(alert_id, created_at);
create index if not exists idx_ba_attachments_alert   on public.billing_alert_attachments(alert_id);
create index if not exists idx_ba_activity_alert      on public.billing_alert_activity_log(alert_id, created_at);

-- ── Realtime ─────────────────────────────────────────────────
-- Enable in Supabase Dashboard → Database → Replication:
-- billing_alerts, billing_alert_comments, billing_alert_activity_log

-- ── Storage bucket ───────────────────────────────────────────
-- Create in Supabase Dashboard → Storage → New bucket:
--   Name: billing-alert-attachments
--   Public: false
--   File size limit: 20MB
--   Allowed MIME types: image/*, application/pdf, .doc, .docx, .xls, .xlsx
