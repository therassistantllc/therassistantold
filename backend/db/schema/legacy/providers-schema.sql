-- ============================================================
-- THERASSISTANT — Providers Schema                  v1.0
-- Colorado Medicaid Behavioral Health Billing Platform
--
-- Covers: individual provider profiles, specialties/certifications,
--         and supervision relationships.
--
-- Dependencies (must run first):
--   auth-schema.sql        → auth.users, organizations, locations
--   admin-clients-schema.sql → clinician_accounts (practice/subscriber)
--
-- NOTE: clinician_stripe_accounts is defined in auth-schema.sql.
--       This file does NOT redefine it.
-- ============================================================

-- ── Table of Contents ────────────────────────────────────────────────────────
--   TABLE 1  providers                  Individual provider/clinician profiles
--   TABLE 2  provider_specialties       Provider specialty & certification records
--   TABLE 3  supervision_relationships  Supervisor–supervisee pairings & terms
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════
-- TABLE 1: providers
--   One row per licensed or unlicensed clinical provider.
--   Links to auth.users (identity) and clinician_accounts (subscriber
--   practice they operate under). Holds all credentialing data needed
--   for Colorado Medicaid billing.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS providers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity links
  user_id                   UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id                    UUID REFERENCES organizations(id) ON DELETE SET NULL,
  -- soft reference to the practice/subscriber account
  client_id                 TEXT REFERENCES clinician_accounts(id) ON DELETE SET NULL,

  -- Personal / display
  first_name                TEXT NOT NULL,
  last_name                 TEXT NOT NULL,
  display_name              TEXT,               -- overrides "First Last" if set
  email                     TEXT,
  phone                     TEXT,

  -- Credential & license
  credential                TEXT NOT NULL,      -- LCSW, LPC, CACIII, MFT, LAC, LSW, MA, PhD, MD, DO, etc.
  license_number            TEXT,               -- state license number
  license_state             TEXT NOT NULL DEFAULT 'CO',
  license_type              TEXT,               -- e.g. 'Licensed Clinical Social Worker'
  license_expiration_date   DATE,
  dea_number                TEXT,               -- for prescribers only
  board_certification       TEXT,               -- e.g. 'ABPN Board Certified'

  -- Identifiers
  npi                       TEXT UNIQUE,        -- Individual NPI (Type 1)
  taxonomy_code             TEXT,               -- primary CMS taxonomy code
  medicaid_id               TEXT,               -- CO Medicaid individual provider ID
  medicaid_enrollment_date  DATE,
  group_npi                 TEXT,               -- Group NPI (Type 2) — usually the practice's

  -- Employment / org role
  provider_type             TEXT NOT NULL DEFAULT 'clinician'
                              CHECK (provider_type IN
                                ('clinician','supervisor','prescriber',
                                 'peer_support','case_manager','intern','admin_only')),
  employment_type           TEXT DEFAULT 'employee'
                              CHECK (employment_type IN
                                ('employee','contractor','intern','volunteer')),
  primary_location_id       UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Supervision status
  requires_supervision      BOOLEAN NOT NULL DEFAULT FALSE,  -- interns, pre-licensed staff
  supervision_hours_required NUMERIC(6,2),     -- weekly hours required by license board
  supervision_hours_completed NUMERIC(8,2) DEFAULT 0,
  supervision_notes         TEXT,

  -- Billing eligibility flags
  can_bill_independently    BOOLEAN NOT NULL DEFAULT TRUE,
  can_supervise             BOOLEAN NOT NULL DEFAULT FALSE,
  can_cosign                BOOLEAN NOT NULL DEFAULT FALSE,
  billing_render_credential TEXT,              -- credential printed on claims (may differ from license)

  -- Status
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at            TIMESTAMPTZ,
  deactivated_reason        TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_user_id      ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_org_id       ON providers(org_id);
CREATE INDEX IF NOT EXISTS idx_providers_client_id    ON providers(client_id);
CREATE INDEX IF NOT EXISTS idx_providers_npi          ON providers(npi);
CREATE INDEX IF NOT EXISTS idx_providers_medicaid_id  ON providers(medicaid_id);
CREATE INDEX IF NOT EXISTS idx_providers_type         ON providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_providers_active       ON providers(is_active);
CREATE INDEX IF NOT EXISTS idx_providers_license_exp  ON providers(license_expiration_date);

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Providers can read/update their own record
CREATE POLICY "providers_own_read"
  ON providers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "providers_own_update"
  ON providers FOR UPDATE
  USING (user_id = auth.uid());

-- Org members can read all provider profiles in their org
CREATE POLICY "providers_org_read"
  ON providers FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins can insert, update, delete providers in their org
CREATE POLICY "providers_admin_write"
  ON providers FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'credentialing_specialist')
    )
  );

CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 2: provider_specialties
--   A provider can have multiple specialties, certifications,
--   and training credentials. Drives service eligibility checks,
--   payer enrollment, and taxonomy matching.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_specialties (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Classification
  specialty_type        TEXT NOT NULL
                          CHECK (specialty_type IN (
                            'primary_specialty',    -- main billable specialty
                            'secondary_specialty',  -- additional billable area
                            'certification',        -- formal certification (CAC, CCTP, etc.)
                            'training',             -- training-level credential
                            'endorsement'           -- state-level endorsement
                          )),

  -- Specialty identity
  specialty_name        TEXT NOT NULL,   -- e.g. "Substance Use Disorders", "Trauma-Focused CBT"
  taxonomy_code         TEXT,            -- CMS taxonomy code if applicable
  certifying_body       TEXT,            -- e.g. "NAADAC", "EMDR Institute", "Colorado DORA"
  certificate_number    TEXT,
  issue_date            DATE,
  expiration_date       DATE,

  -- Colorado Medicaid population groups (drives H0001, H0031, H0032 eligibility)
  population_served     TEXT[]  DEFAULT '{}',
  -- e.g. ['adults','adolescents','children','older_adults','perinatal','co_occurring']

  -- Service codes this specialty enables (Colorado Medicaid)
  enabled_service_codes TEXT[]  DEFAULT '{}',
  -- e.g. ['H0001','H0031','90837','90847','H0004','S9480']

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  notes                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pspec_provider_id    ON provider_specialties(provider_id);
CREATE INDEX IF NOT EXISTS idx_pspec_org_id         ON provider_specialties(org_id);
CREATE INDEX IF NOT EXISTS idx_pspec_type           ON provider_specialties(specialty_type);
CREATE INDEX IF NOT EXISTS idx_pspec_taxonomy       ON provider_specialties(taxonomy_code);
CREATE INDEX IF NOT EXISTS idx_pspec_enabled_codes  ON provider_specialties USING gin(enabled_service_codes);
CREATE INDEX IF NOT EXISTS idx_pspec_population     ON provider_specialties USING gin(population_served);
CREATE INDEX IF NOT EXISTS idx_pspec_expiration     ON provider_specialties(expiration_date);

ALTER TABLE provider_specialties ENABLE ROW LEVEL SECURITY;

-- Providers can read their own specialties
CREATE POLICY "pspec_own_read"
  ON provider_specialties FOR SELECT
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  );

-- Org members can read all specialties in their org
CREATE POLICY "pspec_org_read"
  ON provider_specialties FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins / credentialing can write
CREATE POLICY "pspec_admin_write"
  ON provider_specialties FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'credentialing_specialist')
    )
  );

CREATE TRIGGER trg_pspec_updated_at
  BEFORE UPDATE ON provider_specialties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 3: supervision_relationships
--   Formal supervision agreements between a licensed supervisor
--   and a supervisee (intern, pre-licensed, or provisionally
--   licensed clinician).
--
--   This is distinct from supervisor_signatures (which records
--   individual co-sign events on documents). This table records
--   the ongoing contractual relationship that authorizes those
--   co-signatures.
--
--   Colorado requirements:
--     - LAC, LSW, pre-licensed CAC: must have a named supervisor
--       on file with DORA before billing under supervisor's NPI.
--     - Supervisors must hold full licensure (LCSW, LPC, etc.).
--     - Frequency and modality requirements vary by license board.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS supervision_relationships (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Parties
  supervisor_provider_id      UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  supervisee_provider_id      UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,

  -- Relationship terms
  relationship_type           TEXT NOT NULL DEFAULT 'clinical'
                                CHECK (relationship_type IN (
                                  'clinical',           -- direct clinical supervision
                                  'administrative',     -- admin/compliance oversight
                                  'consultation',       -- peer consultation (not required)
                                  'training'            -- formal training program
                                )),

  -- Contract / board-required details
  supervision_modality        TEXT NOT NULL DEFAULT 'individual'
                                CHECK (supervision_modality IN (
                                  'individual',
                                  'group',
                                  'combined'            -- both individual and group
                                )),
  required_hours_per_week     NUMERIC(5,2),              -- what the license board mandates
  direct_to_indirect_ratio    TEXT,                      -- e.g. '1:1' (1 direct per 1 indirect)
  supervision_contract_on_file BOOLEAN NOT NULL DEFAULT FALSE,
  dora_filed                  BOOLEAN NOT NULL DEFAULT FALSE,  -- filed with CO DORA
  dora_filed_date             DATE,
  dora_approval_number        TEXT,

  -- Duration
  start_date                  DATE NOT NULL,
  end_date                    DATE,                      -- NULL = currently active
  termination_reason          TEXT,

  -- Billing authorization
  -- When TRUE, supervisee may bill under supervisor's NPI/Medicaid ID
  supervisee_bills_under_supervisor BOOLEAN NOT NULL DEFAULT FALSE,
  billing_npi_override        TEXT,                      -- supervisor NPI used on claims
  billing_medicaid_id_override TEXT,                     -- supervisor Medicaid ID used on claims

  -- Notes
  notes                       TEXT,

  -- Status (derived: active if end_date IS NULL or > now())
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforce unique active relationship per supervisee per type
  UNIQUE (supervisee_provider_id, relationship_type, start_date)
);

CREATE INDEX IF NOT EXISTS idx_suprel_org_id          ON supervision_relationships(org_id);
CREATE INDEX IF NOT EXISTS idx_suprel_supervisor       ON supervision_relationships(supervisor_provider_id);
CREATE INDEX IF NOT EXISTS idx_suprel_supervisee       ON supervision_relationships(supervisee_provider_id);
CREATE INDEX IF NOT EXISTS idx_suprel_active           ON supervision_relationships(is_active);
CREATE INDEX IF NOT EXISTS idx_suprel_end_date         ON supervision_relationships(end_date);

ALTER TABLE supervision_relationships ENABLE ROW LEVEL SECURITY;

-- Both parties can read the relationship
CREATE POLICY "suprel_party_read"
  ON supervision_relationships FOR SELECT
  USING (
    supervisor_provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
    OR supervisee_provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  );

-- Org members can read all relationships in their org
CREATE POLICY "suprel_org_read"
  ON supervision_relationships FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins and credentialing specialists can write
CREATE POLICY "suprel_admin_write"
  ON supervision_relationships FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'credentialing_specialist')
    )
  );

CREATE TRIGGER trg_suprel_updated_at
  BEFORE UPDATE ON supervision_relationships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── Cross-reference: note existing clinician_stripe_accounts ─────────────────
-- clinician_stripe_accounts is defined in auth-schema.sql (linked to auth.users).
-- The providers table references user_id → auth.users, so the join is:
--   providers p JOIN clinician_stripe_accounts csa ON csa.user_id = p.user_id
-- No redefinition needed here.
