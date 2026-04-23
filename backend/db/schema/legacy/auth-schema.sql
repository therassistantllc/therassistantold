-- ============================================================
-- THERASSISTANT — Auth & Role Permissions Schema
-- Run in Supabase SQL Editor (or as a migration)
-- ============================================================

-- ── Organizations ─────────────────────────────────────────────────────────────
-- Each paying clinic/practice is an "organization".  All data is scoped to an org.
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,           -- e.g. "sunrise-behavioral"
  plan        text not null default 'free',   -- 'free' | 'pro' | 'enterprise'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Organization Members ──────────────────────────────────────────────────────
-- Maps Supabase auth users to organizations with a role.
-- A user may belong to multiple orgs (multi-org clinicians).
create table if not exists organization_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'clinician',
  invited_by  uuid references auth.users(id) on delete set null,
  joined_at   timestamptz not null default now(),
  unique (org_id, user_id)
);

-- ── User Role Overrides ───────────────────────────────────────────────────────
-- Allows admins to grant additional permission strings to specific users
-- beyond what their role provides (e.g. a clinician who also does billing).
create table if not exists user_role_overrides (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade unique,
  permissions  jsonb not null default '[]',   -- array of "namespace.action" strings
  granted_by   uuid references auth.users(id) on delete set null,
  granted_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Audit Log ─────────────────────────────────────────────────────────────────
-- Immutable append-only record of authentication and permission events.
-- Service-role only; no public read or write via RLS.
create table if not exists audit_log (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  org_id      uuid references organizations(id) on delete set null,
  event       text not null,       -- see ALLOWED_AUDIT_EVENTS in server.js
  metadata    jsonb not null default '{}',
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ── Clinician Stripe Connect Accounts ─────────────────────────────────────────
-- Tracks clinicians who have connected a Stripe Express account.
create table if not exists clinician_stripe_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade unique,
  org_id              uuid references organizations(id) on delete set null,
  stripe_account_id   text unique not null,
  charges_enabled     boolean not null default false,
  payouts_enabled     boolean not null default false,
  details_submitted   boolean not null default false,
  livemode            boolean not null default false,
  connected_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Org MFA Policy ────────────────────────────────────────────────────────────
-- Per-organization MFA enforcement.  When require_mfa = true, auth-guard.js
-- will refuse sessions below AAL2 for all members of this org.
create table if not exists org_mfa_policy (
  org_id       uuid primary key references organizations(id) on delete cascade,
  require_mfa  boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

-- ── Session Metadata ──────────────────────────────────────────────────────────
-- Optional: track active sessions for admin visibility and force-revoke.
-- Supabase manages the underlying JWT; this table stores display metadata only.
create table if not exists user_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid references organizations(id) on delete set null,
  supabase_session_id text,                  -- reference to Supabase auth.sessions
  ip_address   text,
  user_agent   text,
  logged_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  logged_out_at timestamptz
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_org_members_user_id  on organization_members(user_id);
create index if not exists idx_org_members_org_id   on organization_members(org_id);
create index if not exists idx_org_members_role     on organization_members(role);
create index if not exists idx_audit_log_user_id    on audit_log(user_id);
create index if not exists idx_audit_log_org_id     on audit_log(org_id);
create index if not exists idx_audit_log_event      on audit_log(event);
create index if not exists idx_audit_log_created    on audit_log(created_at desc);
create index if not exists idx_user_sessions_user   on user_sessions(user_id);
create index if not exists idx_clinician_stripe_user on clinician_stripe_accounts(user_id);

-- ── Row-Level Security ────────────────────────────────────────────────────────

-- Organizations: a member can read their own org's record
alter table organizations enable row level security;
create policy "organizations_member_read"
  on organizations for select
  using (
    id in (
      select org_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Organization members: users see all members of orgs they belong to
alter table organization_members enable row level security;
create policy "org_members_within_org_read"
  on organization_members for select
  using (
    org_id in (
      select org_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Audit log: locked to service role only — no client access
alter table audit_log enable row level security;
create policy "audit_log_deny_all"
  on audit_log for all
  using (false);

-- Clinician Stripe accounts: users can read/delete their own row only
alter table clinician_stripe_accounts enable row level security;
create policy "stripe_accounts_own_read"
  on clinician_stripe_accounts for select
  using (user_id = auth.uid());
create policy "stripe_accounts_own_delete"
  on clinician_stripe_accounts for delete
  using (user_id = auth.uid());

-- Role overrides: admins can read/write; users can read their own
alter table user_role_overrides enable row level security;
create policy "role_overrides_own_read"
  on user_role_overrides for select
  using (user_id = auth.uid());

-- Org MFA policy: members can read their org's policy
alter table org_mfa_policy enable row level security;
create policy "org_mfa_policy_member_read"
  on org_mfa_policy for select
  using (
    org_id in (
      select org_id from organization_members
      where user_id = auth.uid()
    )
  );

-- User sessions: users can read only their own sessions
alter table user_sessions enable row level security;
create policy "user_sessions_own_read"
  on user_sessions for select
  using (user_id = auth.uid());

-- ── Helper: updated_at trigger ────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger trg_clinician_stripe_updated_at
  before update on clinician_stripe_accounts
  for each row execute function set_updated_at();

create trigger trg_user_role_overrides_updated_at
  before update on user_role_overrides
  for each row execute function set_updated_at();

-- ── Seed: valid role values ────────────────────────────────────────────────────
-- Enforced on the application layer (server.js) and documented here for reference.
-- Valid roles: super_admin | admin | clinician | billing_specialist |
--              credentialing_specialist | supervisor | front_desk | patient
comment on column organization_members.role is
  'One of: super_admin, admin, clinician, billing_specialist, credentialing_specialist, supervisor, front_desk, patient';

-- ============================================================
-- ADDITIONS v1.1 — Locations, User Profiles, Roles, Permissions
-- ============================================================

-- ── Locations ─────────────────────────────────────────────────────────────────
-- Physical or virtual service sites belonging to an organization.
create table if not exists locations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,                        -- "Main Office", "Telehealth"
  location_type   text not null default 'office'        -- 'office' | 'telehealth' | 'home' | 'community' | 'school' | 'hospital'
                  check (location_type in ('office','telehealth','home','community','school','hospital')),
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  zip             text,
  phone           text,
  fax             text,
  npi             text,                                  -- location/group NPI (Type 2)
  taxonomy_code   text,                                  -- CMS taxonomy code
  medicaid_id     text,                                  -- CO Medicaid provider number
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_locations_org_id  on locations(org_id);
create index if not exists idx_locations_active  on locations(org_id, is_active);

alter table locations enable row level security;

-- Members of the org can read their org's locations
create policy "locations_org_member_read"
  on locations for select
  using (
    org_id in (
      select org_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Admins can insert/update/delete locations
create policy "locations_admin_write"
  on locations for all
  using (
    org_id in (
      select org_id from organization_members
      where user_id = auth.uid()
        and role in ('super_admin','admin')
    )
  );

create trigger trg_locations_updated_at
  before update on locations
  for each row execute function set_updated_at();

-- ── User Profiles ─────────────────────────────────────────────────────────────
-- Extends auth.users with display/contact info.  One row per Supabase user.
create table if not exists user_profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  org_id          uuid references organizations(id) on delete set null,
  full_name       text,
  display_name    text,
  title           text,                                  -- "LCSW", "LPC", "Intern"
  email           text,
  phone           text,
  npi             text,                                  -- individual NPI (Type 1)
  medicaid_id     text,
  default_location_id uuid references locations(id) on delete set null,
  avatar_url      text,
  timezone        text not null default 'America/Denver',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_user_profiles_org_id on user_profiles(org_id);

alter table user_profiles enable row level security;

-- Users can read/update their own profile
create policy "user_profiles_own_read"
  on user_profiles for select
  using (user_id = auth.uid());

create policy "user_profiles_own_update"
  on user_profiles for update
  using (user_id = auth.uid());

-- Org members can read profiles of colleagues
create policy "user_profiles_org_read"
  on user_profiles for select
  using (
    org_id in (
      select org_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Admins can insert/delete profiles within their org
create policy "user_profiles_admin_write"
  on user_profiles for all
  using (
    org_id in (
      select org_id from organization_members
      where user_id = auth.uid()
        and role in ('super_admin','admin')
    )
  );

create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

-- ── Roles ─────────────────────────────────────────────────────────────────────
-- Canonical role definitions.  The role TEXT column in organization_members
-- references role.name.  This table documents each role's purpose and whether
-- it is system-defined or org-custom.
create table if not exists roles (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,           -- matches organization_members.role
  display_name  text not null,
  description   text,
  is_system     boolean not null default true,  -- false = org-custom role
  org_id        uuid references organizations(id) on delete cascade,  -- null = system role
  created_at    timestamptz not null default now()
);

-- Seed system roles
insert into roles (name, display_name, description, is_system) values
  ('super_admin',               'Super Admin',               'Full platform access; manages all orgs',                               true),
  ('admin',                     'Admin',                     'Org-level admin; manages staff, settings, billing',                    true),
  ('clinician',                 'Clinician',                 'Licensed provider; documents sessions and codes services',             true),
  ('billing_specialist',        'Billing Specialist',        'Manages claims, ERA imports, payment posting',                        true),
  ('credentialing_specialist',  'Credentialing Specialist',  'Manages provider credentials and payer enrollments',                  true),
  ('supervisor',                'Supervisor',                'Reviews and co-signs clinical documentation',                          true),
  ('front_desk',                'Front Desk',                'Schedules appointments, manages patient intake',                      true),
  ('patient',                   'Patient',                   'Limited access to own records and scheduling portal',                 true)
on conflict (name) do nothing;

alter table roles enable row level security;

-- Everyone can read system roles; org members can read their org's custom roles
create policy "roles_read"
  on roles for select
  using (
    is_system = true
    or org_id in (
      select org_id from organization_members
      where user_id = auth.uid()
    )
  );

-- Only super_admin (service role) can write system roles
create policy "roles_admin_write"
  on roles for all
  using (
    is_system = false
    and org_id in (
      select org_id from organization_members
      where user_id = auth.uid()
        and role in ('super_admin','admin')
    )
  );

-- ── Permissions ───────────────────────────────────────────────────────────────
-- Named permission keys.  Each row is one discrete action a role can take.
create table if not exists permissions (
  id            uuid primary key default gen_random_uuid(),
  permission_key text unique not null,   -- e.g. 'claims:submit', 'notes:sign', 'admin:users:edit'
  resource      text not null,           -- 'claims' | 'notes' | 'admin' | 'patients' | 'reports' | …
  action        text not null,           -- 'view' | 'create' | 'edit' | 'delete' | 'submit' | 'sign' | 'export'
  description   text,
  created_at    timestamptz not null default now()
);

-- Seed permission keys
insert into permissions (permission_key, resource, action, description) values
  -- Patient records
  ('patients:view',           'patients', 'view',   'View patient list and demographics'),
  ('patients:create',         'patients', 'create', 'Add new patients'),
  ('patients:edit',           'patients', 'edit',   'Edit patient demographics and insurance'),
  ('patients:delete',         'patients', 'delete', 'Archive or delete patients'),
  -- Clinical notes
  ('notes:view',              'notes',    'view',   'View clinical session notes'),
  ('notes:create',            'notes',    'create', 'Create new session notes'),
  ('notes:edit',              'notes',    'edit',   'Edit draft notes'),
  ('notes:sign',              'notes',    'sign',   'Sign and finalize notes'),
  ('notes:cosign',            'notes',    'cosign', 'Co-sign notes as supervisor'),
  ('notes:delete',            'notes',    'delete', 'Delete notes'),
  -- Coding / billing
  ('coding:view',             'coding',   'view',   'View coding sessions and reports'),
  ('coding:create',           'coding',   'create', 'Start new coding sessions'),
  ('coding:edit',             'coding',   'edit',   'Edit coding session answers'),
  -- Claims
  ('claims:view',             'claims',   'view',   'View claims'),
  ('claims:create',           'claims',   'create', 'Create claims'),
  ('claims:submit',           'claims',   'submit', 'Submit claims to payer'),
  ('claims:void',             'claims',   'delete', 'Void or reverse claims'),
  -- ERA / payments
  ('era:view',                'era',      'view',   'View ERA imports and payment postings'),
  ('era:import',              'era',      'create', 'Import 835 ERA files'),
  ('era:post',                'era',      'edit',   'Post payments to accounts'),
  -- Reports
  ('reports:view',            'reports',  'view',   'View financial and clinical reports'),
  ('reports:export',          'reports',  'export', 'Export reports to CSV/PDF'),
  -- Admin
  ('admin:users:view',        'admin',    'view',   'View staff user list'),
  ('admin:users:edit',        'admin',    'edit',   'Invite, edit, and deactivate staff'),
  ('admin:roles:edit',        'admin',    'edit',   'Assign roles to staff'),
  ('admin:settings:view',     'admin',    'view',   'View org settings'),
  ('admin:settings:edit',     'admin',    'edit',   'Edit org settings, locations, integrations'),
  ('admin:billing:view',      'admin',    'view',   'View subscription and billing info'),
  -- Scheduling
  ('scheduling:view',         'scheduling','view',  'View appointment calendar'),
  ('scheduling:create',       'scheduling','create','Schedule new appointments'),
  ('scheduling:edit',         'scheduling','edit',  'Reschedule or cancel appointments')
on conflict (permission_key) do nothing;

-- ── Role Permissions ──────────────────────────────────────────────────────────
-- Maps which permissions each role has by default.
create table if not exists role_permissions (
  role_name      text not null references roles(name) on delete cascade,
  permission_key text not null references permissions(permission_key) on delete cascade,
  primary key (role_name, permission_key)
);

-- Seed default role → permission mappings
insert into role_permissions (role_name, permission_key) values
  -- super_admin: everything
  ('super_admin', 'patients:view'), ('super_admin', 'patients:create'), ('super_admin', 'patients:edit'), ('super_admin', 'patients:delete'),
  ('super_admin', 'notes:view'), ('super_admin', 'notes:create'), ('super_admin', 'notes:edit'), ('super_admin', 'notes:sign'), ('super_admin', 'notes:cosign'), ('super_admin', 'notes:delete'),
  ('super_admin', 'coding:view'), ('super_admin', 'coding:create'), ('super_admin', 'coding:edit'),
  ('super_admin', 'claims:view'), ('super_admin', 'claims:create'), ('super_admin', 'claims:submit'), ('super_admin', 'claims:void'),
  ('super_admin', 'era:view'), ('super_admin', 'era:import'), ('super_admin', 'era:post'),
  ('super_admin', 'reports:view'), ('super_admin', 'reports:export'),
  ('super_admin', 'admin:users:view'), ('super_admin', 'admin:users:edit'), ('super_admin', 'admin:roles:edit'),
  ('super_admin', 'admin:settings:view'), ('super_admin', 'admin:settings:edit'), ('super_admin', 'admin:billing:view'),
  ('super_admin', 'scheduling:view'), ('super_admin', 'scheduling:create'), ('super_admin', 'scheduling:edit'),
  -- admin: all except super-level
  ('admin', 'patients:view'), ('admin', 'patients:create'), ('admin', 'patients:edit'),
  ('admin', 'notes:view'), ('admin', 'notes:sign'), ('admin', 'notes:cosign'), ('admin', 'notes:delete'),
  ('admin', 'coding:view'), ('admin', 'coding:create'), ('admin', 'coding:edit'),
  ('admin', 'claims:view'), ('admin', 'claims:create'), ('admin', 'claims:submit'), ('admin', 'claims:void'),
  ('admin', 'era:view'), ('admin', 'era:import'), ('admin', 'era:post'),
  ('admin', 'reports:view'), ('admin', 'reports:export'),
  ('admin', 'admin:users:view'), ('admin', 'admin:users:edit'), ('admin', 'admin:roles:edit'),
  ('admin', 'admin:settings:view'), ('admin', 'admin:settings:edit'), ('admin', 'admin:billing:view'),
  ('admin', 'scheduling:view'), ('admin', 'scheduling:create'), ('admin', 'scheduling:edit'),
  -- clinician: own notes + coding + scheduling
  ('clinician', 'patients:view'), ('clinician', 'patients:create'), ('clinician', 'patients:edit'),
  ('clinician', 'notes:view'), ('clinician', 'notes:create'), ('clinician', 'notes:edit'), ('clinician', 'notes:sign'),
  ('clinician', 'coding:view'), ('clinician', 'coding:create'), ('clinician', 'coding:edit'),
  ('clinician', 'claims:view'),
  ('clinician', 'reports:view'),
  ('clinician', 'scheduling:view'), ('clinician', 'scheduling:create'), ('clinician', 'scheduling:edit'),
  -- billing_specialist: claims, ERA, reports
  ('billing_specialist', 'patients:view'),
  ('billing_specialist', 'coding:view'),
  ('billing_specialist', 'claims:view'), ('billing_specialist', 'claims:create'), ('billing_specialist', 'claims:submit'), ('billing_specialist', 'claims:void'),
  ('billing_specialist', 'era:view'), ('billing_specialist', 'era:import'), ('billing_specialist', 'era:post'),
  ('billing_specialist', 'reports:view'), ('billing_specialist', 'reports:export'),
  ('billing_specialist', 'scheduling:view'),
  -- credentialing_specialist: limited admin + patient view
  ('credentialing_specialist', 'patients:view'),
  ('credentialing_specialist', 'admin:users:view'),
  ('credentialing_specialist', 'admin:settings:view'),
  ('credentialing_specialist', 'reports:view'),
  -- supervisor: co-sign notes, view everything clinical
  ('supervisor', 'patients:view'),
  ('supervisor', 'notes:view'), ('supervisor', 'notes:create'), ('supervisor', 'notes:edit'), ('supervisor', 'notes:sign'), ('supervisor', 'notes:cosign'),
  ('supervisor', 'coding:view'), ('supervisor', 'coding:create'), ('supervisor', 'coding:edit'),
  ('supervisor', 'claims:view'),
  ('supervisor', 'reports:view'), ('supervisor', 'reports:export'),
  ('supervisor', 'scheduling:view'),
  -- front_desk: scheduling + intake
  ('front_desk', 'patients:view'), ('front_desk', 'patients:create'),
  ('front_desk', 'scheduling:view'), ('front_desk', 'scheduling:create'), ('front_desk', 'scheduling:edit'),
  -- patient: own scheduling only
  ('patient', 'scheduling:view'), ('patient', 'scheduling:create')
on conflict do nothing;

alter table permissions enable row level security;
create policy "permissions_read_all" on permissions for select using (true);

alter table role_permissions enable row level security;
create policy "role_permissions_read_all" on role_permissions for select using (true);
