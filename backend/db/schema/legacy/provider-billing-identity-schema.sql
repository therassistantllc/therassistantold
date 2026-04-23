-- ============================================================
-- THERASSISTANT — Organizations, Locations & Provider
--                 Billing Identity Schema              v1.0
-- Colorado Medicaid Behavioral Health Billing Platform
--
-- Covers:
--   Section  1  organizations             (extended from auth-schema.sql)
--   Section  2  locations                 (extended from auth-schema.sql)
--   Section  3  organization_taxonomy     Org-level taxonomy code assignments
--   Section  4  providers                 (extended from providers-schema.sql)
--   Section  5  provider_npis             All NPI records per provider (Type 1 + Type 2)
--   Section  6  provider_taxonomy_codes   Per-provider taxonomy assignments
--   Section  7  provider_credentials      Full credential records per provider
--   Section  8  supervision_relationships (extended from providers-schema.sql)
--   Section  9  rendering_providers       CMS-1500 Box 24J rendering provider identities
--   Section 10  billing_providers         CMS-1500 Box 33 billing provider identities
--   Section 11  referring_providers       CMS-1500 Box 17 referring provider identities
--   Section 12  service_facilities        CMS-1500 Box 32 service facility identities
--   Section 13  claim_provider_links      Resolved provider identity snapshot per claim
--   Section 14  provider_org_memberships  Provider ↔ Org with role, dates, and billing flags
--   Section 15  Indexes, triggers, RLS
--
-- Dependencies (must run first):
--   auth-schema.sql          → auth.users, organizations, locations,
--                              organization_members
--   providers-schema.sql     → providers
--   coding-billing-schema.sql → claims
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- SHARED HELPER: set_updated_at()
-- Re-declared here as a guard; all schemas share this function.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- SHARED HELPER: set_deleted_at()
-- Populates deleted_at / deleted_by on soft-delete.
-- Called by triggers on tables that support soft delete.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_deleted_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.deleted_at  = now();
  NEW.deleted_by  = auth.uid();
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- SHARED ENUM TYPES
-- ════════════════════════════════════════════════════════════

CREATE TYPE record_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'pending',
  'archived'
);

CREATE TYPE npi_type AS ENUM ('type1', 'type2');

-- ────────────────────────────────────────────────────────────
-- CMS taxonomy code enumeration for behavioral health
-- (partial list — billing engine may extend this)
-- ────────────────────────────────────────────────────────────
CREATE TYPE taxonomy_specialty AS ENUM (
  'behavioral_health',
  'mental_health',
  'substance_use',
  'psychiatric',
  'counseling',
  'social_work',
  'psychology',
  'nursing',
  'medical',
  'peer_support',
  'case_management',
  'other'
);


-- ════════════════════════════════════════════════════════════
-- SECTION 1 — ORGANIZATIONS (Extended)
-- Extends auth-schema.sql organizations with billing identity,
-- tax information, and operational metadata.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: organizations (ALTER — additive extension)
--
-- Purpose:
--   Extended billing identity for each practice/org.
--   Core id/name/slug/plan remain in auth-schema.
--   This adds Medicaid, NPI, tax, address, and operational fields.
--
-- New Fields:
--   tax_id              EIN / Federal Taxpayer ID
--   group_npi           Type 2 NPI (organization-level)
--   medicaid_provider_id CO Medicaid billing provider number
--   clia_number         Lab certification (if applicable)
--   org_type            Practice structure
--   status              Active / inactive / suspended
--
-- Soft Delete:
--   deleted_at / deleted_by — organizations are never hard-deleted;
--   billing history must remain intact.
-- ──────────────────────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS legal_name              TEXT,
  ADD COLUMN IF NOT EXISTS dba_name                TEXT,
  ADD COLUMN IF NOT EXISTS org_type                TEXT
    DEFAULT 'private_practice'
    CHECK (org_type IN (
      'private_practice','group_practice','community_mental_health_center',
      'federally_qualified_health_center','hospital','iop','residential',
      'telehealth_only','other'
    )),
  ADD COLUMN IF NOT EXISTS tax_id                  TEXT,
  ADD COLUMN IF NOT EXISTS tax_id_type             TEXT DEFAULT 'EIN'
    CHECK (tax_id_type IN ('EIN','SSN')),
  ADD COLUMN IF NOT EXISTS group_npi               TEXT,
  ADD COLUMN IF NOT EXISTS secondary_npi           TEXT,
  ADD COLUMN IF NOT EXISTS medicaid_provider_id    TEXT,
  ADD COLUMN IF NOT EXISTS medicaid_enrollment_date DATE,
  ADD COLUMN IF NOT EXISTS medicare_provider_id    TEXT,
  ADD COLUMN IF NOT EXISTS clia_number             TEXT,

  -- Primary address
  ADD COLUMN IF NOT EXISTS address_line1           TEXT,
  ADD COLUMN IF NOT EXISTS address_line2           TEXT,
  ADD COLUMN IF NOT EXISTS city                    TEXT,
  ADD COLUMN IF NOT EXISTS state                   TEXT DEFAULT 'CO',
  ADD COLUMN IF NOT EXISTS zip                     TEXT,
  ADD COLUMN IF NOT EXISTS county                  TEXT,
  ADD COLUMN IF NOT EXISTS phone                   TEXT,
  ADD COLUMN IF NOT EXISTS fax                     TEXT,
  ADD COLUMN IF NOT EXISTS website                 TEXT,

  -- Pay-to address (if different from service address)
  ADD COLUMN IF NOT EXISTS pay_to_address_line1    TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_address_line2    TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_city             TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_state            TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_zip              TEXT,

  -- Status
  ADD COLUMN IF NOT EXISTS status                  record_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_change_reason    TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_group_npi
  ON organizations(group_npi) WHERE group_npi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_medicaid_id
  ON organizations(medicaid_provider_id) WHERE medicaid_provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON organizations(status);


-- ════════════════════════════════════════════════════════════
-- SECTION 2 — LOCATIONS (Extended)
-- Extends auth-schema.sql locations with full billing address,
-- pay-to override, taxonomy, and soft-delete support.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: locations (ALTER — additive extension)
--
-- Purpose:
--   Physical or virtual service sites linked to an org.
--   Each location can have its own NPI, taxonomy code, Medicaid
--   provider number, and pay-to address.  Appears in CMS-1500
--   Box 32 as service facility.
--
-- Soft Delete:
--   Locations are never hard-deleted; historical claims reference them.
-- ──────────────────────────────────────────────────────────
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS legal_name              TEXT,
  ADD COLUMN IF NOT EXISTS address_line1           TEXT,
  ADD COLUMN IF NOT EXISTS address_line2           TEXT,
  ADD COLUMN IF NOT EXISTS city                    TEXT,
  ADD COLUMN IF NOT EXISTS state                   TEXT DEFAULT 'CO',
  ADD COLUMN IF NOT EXISTS zip                     TEXT,
  ADD COLUMN IF NOT EXISTS county                  TEXT,
  ADD COLUMN IF NOT EXISTS country                 TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS phone                   TEXT,
  ADD COLUMN IF NOT EXISTS fax                     TEXT,

  -- CMS billing identity for this location
  ADD COLUMN IF NOT EXISTS pos_code                TEXT,    -- CMS Place of Service code (11, 02, 10, etc.)
  ADD COLUMN IF NOT EXISTS pos_label               TEXT,    -- e.g. "Office", "Telehealth", "Home"

  -- Pay-to override (Box 33 when different from service address)
  ADD COLUMN IF NOT EXISTS pay_to_name             TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_address_line1    TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_address_line2    TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_city             TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_state            TEXT,
  ADD COLUMN IF NOT EXISTS pay_to_zip              TEXT,

  -- Status
  ADD COLUMN IF NOT EXISTS status                  record_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_changed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_pos_code
  ON locations(pos_code) WHERE pos_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_status
  ON locations(status);


-- ════════════════════════════════════════════════════════════
-- SECTION 3 — ORGANIZATION TAXONOMY CODES
-- Org-level taxonomy assignments. An org may have multiple
-- taxonomy codes for different service lines.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: organization_taxonomy_codes
--
-- Purpose:
--   Maps CMS taxonomy codes to an organization (Type 2 NPI).
--   The primary taxonomy appears in Box 24 and NPPES filings.
--   One org may hold multiple taxonomy codes for different
--   service lines (e.g. mental health + SUD).
--
-- Relationships:
--   org_id → organizations(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_taxonomy_codes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Taxonomy
  taxonomy_code        TEXT NOT NULL,
  taxonomy_label       TEXT,
  taxonomy_specialty   taxonomy_specialty NOT NULL DEFAULT 'behavioral_health',
  taxonomy_version     TEXT DEFAULT '2024',

  -- Classification
  is_primary           BOOLEAN NOT NULL DEFAULT FALSE,
  service_line         TEXT,          -- 'mental_health', 'sud', 'peer_support', etc.
  effective_date       DATE,
  expiration_date      DATE,

  -- Payer-specific taxonomy requirements
  payer_specific       BOOLEAN NOT NULL DEFAULT FALSE,
  payer_id             TEXT,          -- if taxonomy applies to one payer only

  -- Status
  status               record_status NOT NULL DEFAULT 'active',

  -- Soft delete
  deleted_at           TIMESTAMPTZ,
  deleted_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (org_id, taxonomy_code)
);

CREATE INDEX IF NOT EXISTS idx_org_taxonomy_org
  ON organization_taxonomy_codes(org_id);

CREATE INDEX IF NOT EXISTS idx_org_taxonomy_primary
  ON organization_taxonomy_codes(org_id, is_primary) WHERE is_primary = TRUE;


-- ════════════════════════════════════════════════════════════
-- SECTION 4 — PROVIDERS (Extended)
-- Extends providers-schema.sql with audit fields, soft delete,
-- and billing identity columns.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: providers (ALTER — additive extension)
-- ──────────────────────────────────────────────────────────
ALTER TABLE providers
  -- Full name components (supplement first/last)
  ADD COLUMN IF NOT EXISTS middle_name             TEXT,
  ADD COLUMN IF NOT EXISTS name_suffix             TEXT,     -- Jr, Sr, II, etc.
  ADD COLUMN IF NOT EXISTS preferred_name          TEXT,

  -- Additional identifiers
  ADD COLUMN IF NOT EXISTS ssn_last4               TEXT,     -- last 4 only, for identity verification
  ADD COLUMN IF NOT EXISTS date_of_birth           DATE,
  ADD COLUMN IF NOT EXISTS gender                  TEXT
    CHECK (gender IN ('M','F','X','prefer_not_to_say')),

  -- CAQH / PECOS identifiers
  ADD COLUMN IF NOT EXISTS caqh_id                 TEXT,
  ADD COLUMN IF NOT EXISTS pecos_id                TEXT,

  -- Extended billing flags
  ADD COLUMN IF NOT EXISTS billing_entity_type     TEXT DEFAULT 'individual'
    CHECK (billing_entity_type IN ('individual','group')),
  ADD COLUMN IF NOT EXISTS accepts_new_patients     BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS telehealth_eligible      BOOLEAN DEFAULT TRUE,

  -- Hire / termination dates
  ADD COLUMN IF NOT EXISTS hire_date               DATE,
  ADD COLUMN IF NOT EXISTS termination_date        DATE,
  ADD COLUMN IF NOT EXISTS termination_reason      TEXT,

  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_providers_caqh
  ON providers(caqh_id) WHERE caqh_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_providers_pecos
  ON providers(pecos_id) WHERE pecos_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_providers_deleted
  ON providers(deleted_at) WHERE deleted_at IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- SECTION 5 — PROVIDER NPIs
-- Full NPI registry per provider. Supports multiple NPIs:
--   Type 1 — Individual
--   Type 2 — Group / Organization (carried by providers who
--             also serve as a billing entity)
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: provider_npis
--
-- Purpose:
--   Authoritative NPI record per provider. One row per NPI.
--   A provider typically has one Type 1 NPI; may also have a
--   Type 2 if they operate as a solo-practice billing entity.
--   NPPES verification data and enumeration date are stored here.
--
-- Key Fields:
--   npi                  The 10-digit NPI number
--   npi_type             type1 = individual, type2 = organization
--   is_primary           Which NPI appears in Box 24J / Box 33
--   enumeration_date     Date NPPES issued the NPI
--   nppes_last_verified  When our system last verified against NPPES API
--   nppes_status         Active / deactivated per NPPES
--
-- Relationships:
--   provider_id → providers(id)
--   org_id      → organizations(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_npis (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id            UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                 UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- NPI data
  npi                    TEXT NOT NULL,
  npi_type               npi_type NOT NULL DEFAULT 'type1',
  is_primary             BOOLEAN NOT NULL DEFAULT TRUE,

  -- NPPES registry data
  enumeration_date       DATE,
  nppes_last_verified    TIMESTAMPTZ,
  nppes_status           TEXT DEFAULT 'active'
    CHECK (nppes_status IN ('active','deactivated','replaced')),
  nppes_entity_name      TEXT,        -- NPPES-returned official name for Type 2
  nppes_address          TEXT,        -- NPPES mailing address snapshot
  nppes_taxonomy_primary TEXT,        -- primary taxonomy per NPPES

  -- Usage context
  use_for_claims         BOOLEAN NOT NULL DEFAULT TRUE,
  use_for_telehealth     BOOLEAN NOT NULL DEFAULT FALSE,
  use_for_billing        BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE = this is the Box 33 NPI
  notes                  TEXT,

  -- Status
  status                 record_status NOT NULL DEFAULT 'active',
  effective_date         DATE,
  expiration_date        DATE,

  -- Soft delete
  deleted_at             TIMESTAMPTZ,
  deleted_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (npi)
);

CREATE INDEX IF NOT EXISTS idx_provider_npis_provider
  ON provider_npis(provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_npis_npi
  ON provider_npis(npi);

CREATE INDEX IF NOT EXISTS idx_provider_npis_primary
  ON provider_npis(provider_id, is_primary) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_provider_npis_type
  ON provider_npis(npi_type);


-- ════════════════════════════════════════════════════════════
-- SECTION 6 — PROVIDER TAXONOMY CODES
-- Per-provider taxonomy code assignments.
-- Separate from org-level taxonomy (Section 3).
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: provider_taxonomy_codes
--
-- Purpose:
--   Maps CMS taxonomy codes to an individual provider (Type 1 NPI).
--   The primary taxonomy appears in Box 24 of the CMS-1500.
--   Providers with dual roles (e.g., LCSW + CAC III) may have
--   multiple taxonomy codes.
--
-- Key Fields:
--   taxonomy_code        10-digit CMS taxonomy code
--   is_primary           Primary taxonomy for billing
--   credential_link_id   Links to the provider_credentials row
--                        that supports this taxonomy
--
-- Relationships:
--   provider_id         → providers(id)
--   npi_id              → provider_npis(id) (optional link to specific NPI)
--   credential_link_id  → provider_credentials(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_taxonomy_codes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id          UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id               UUID REFERENCES organizations(id) ON DELETE SET NULL,
  npi_id               UUID REFERENCES provider_npis(id) ON DELETE SET NULL,
  credential_link_id   UUID,   -- FK to provider_credentials(id), set post-insert

  -- Taxonomy
  taxonomy_code        TEXT NOT NULL,
  taxonomy_label       TEXT,
  taxonomy_specialty   taxonomy_specialty NOT NULL DEFAULT 'behavioral_health',
  taxonomy_version     TEXT DEFAULT '2024',

  -- Classification
  is_primary           BOOLEAN NOT NULL DEFAULT FALSE,
  service_line         TEXT,          -- 'mental_health', 'sud', 'peer_support'
  effective_date       DATE,
  expiration_date      DATE,

  -- Payer-specific override
  payer_specific       BOOLEAN NOT NULL DEFAULT FALSE,
  payer_id             TEXT,

  -- Status
  status               record_status NOT NULL DEFAULT 'active',

  -- Soft delete
  deleted_at           TIMESTAMPTZ,
  deleted_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (provider_id, taxonomy_code)
);

CREATE INDEX IF NOT EXISTS idx_provider_taxonomy_provider
  ON provider_taxonomy_codes(provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_taxonomy_primary
  ON provider_taxonomy_codes(provider_id, is_primary) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_provider_taxonomy_code
  ON provider_taxonomy_codes(taxonomy_code);


-- ════════════════════════════════════════════════════════════
-- SECTION 7 — PROVIDER CREDENTIALS
-- Full credential tracking per provider: licenses, certifications,
-- DEA, malpractice, CAQH, PECOS, payer enrollment status.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: provider_credentials
--
-- Purpose:
--   Master credential record per provider. One row per credential.
--   Tracks state licenses, board certifications, DEA registrations,
--   malpractice policies, hospital privileges, and CAQH/PECOS status.
--
-- Key Fields:
--   credential_type      License, certification, DEA, malpractice, etc.
--   credential_number    Unique identifier issued by the credentialing body
--   credential_state     State of issuance (or federal for DEA/Medicare)
--   issuing_body         Board, state agency, or federal body
--   issue_date           When the credential was issued
--   expiration_date      When it expires — drives alerting
--   renewal_submitted_date When renewal was filed
--   verified_date        When the platform last verified this credential
--   verification_source  Primary source, CAQH, OIG, SAM, etc.
--   is_primary           Marks the credential used for billing
--
-- Relationships:
--   provider_id         → providers(id)
--   supervised_by       → providers(id)  — for supervision credentials
--   document_id         → credentialing_documents(id) (optional)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_credentials (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id               UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                    UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Credential identity
  credential_type           TEXT NOT NULL
    CHECK (credential_type IN (
      'state_license',
      'board_certification',
      'dea_registration',
      'malpractice_insurance',
      'hospital_privilege',
      'payer_enrollment',
      'caqh_profile',
      'pecos_enrollment',
      'dora_registration',
      'clia_certification',
      'other'
    )),
  credential_subtype        TEXT,    -- e.g. 'LCSW', 'LPC', 'LAC', 'CAC III', 'PMHNP'
  credential_number         TEXT,
  credential_state          TEXT DEFAULT 'CO',
  credential_country        TEXT DEFAULT 'US',
  issuing_body              TEXT,    -- 'Colorado DORA', 'DEA', 'ABPN', 'NASW', etc.

  -- Dates
  issue_date                DATE,
  effective_date            DATE,
  expiration_date           DATE,
  renewal_submitted_date    DATE,
  renewal_approved_date     DATE,
  next_renewal_date         DATE,    -- computed from expiration calendar

  -- Verification
  verified_date             TIMESTAMPTZ,
  verified_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_source       TEXT
    CHECK (verification_source IN (
      'primary_source','caqh','oig_exclusion','sam_exclusion',
      'nppes','pecos','self_reported','document','other'
    )),
  verification_notes        TEXT,
  is_verified               BOOLEAN NOT NULL DEFAULT FALSE,

  -- OIG / SAM exclusion check results
  oig_exclusion_checked_at  TIMESTAMPTZ,
  oig_excluded              BOOLEAN DEFAULT FALSE,
  sam_exclusion_checked_at  TIMESTAMPTZ,
  sam_excluded              BOOLEAN DEFAULT FALSE,

  -- Classification
  is_primary                BOOLEAN NOT NULL DEFAULT FALSE,
  is_required_for_billing   BOOLEAN NOT NULL DEFAULT FALSE,
  taxonomy_link_id          UUID,    -- set after provider_taxonomy_codes inserted

  -- Linked document
  document_id               UUID,    -- FK to credentialing_documents(id)

  -- Status
  status                    record_status NOT NULL DEFAULT 'active',
  status_change_reason      TEXT,
  status_changed_at         TIMESTAMPTZ,
  status_changed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Alert tracking
  alert_days_before_expiry  INT DEFAULT 90,    -- days before expiry to trigger alert
  last_alert_sent_at        TIMESTAMPTZ,

  -- Notes
  notes                     TEXT,

  -- Soft delete
  deleted_at                TIMESTAMPTZ,
  deleted_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_creds_provider
  ON provider_credentials(provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_creds_type
  ON provider_credentials(credential_type);

CREATE INDEX IF NOT EXISTS idx_provider_creds_expiry
  ON provider_credentials(expiration_date)
  WHERE expiration_date IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_provider_creds_excluded
  ON provider_credentials(oig_excluded, sam_excluded)
  WHERE (oig_excluded = TRUE OR sam_excluded = TRUE);

CREATE INDEX IF NOT EXISTS idx_provider_creds_status
  ON provider_credentials(status);

-- Back-fill the taxonomy_link_id FK after both tables exist
ALTER TABLE provider_taxonomy_codes
  ADD CONSTRAINT fk_taxonomy_credential
  FOREIGN KEY (credential_link_id)
  REFERENCES provider_credentials(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;


-- ════════════════════════════════════════════════════════════
-- SECTION 8 — SUPERVISION RELATIONSHIPS (Extended)
-- Extends providers-schema.sql supervision_relationships with
-- audit fields, soft delete, and billing control flags.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: supervision_relationships (ALTER — additive extension)
--
-- Purpose:
--   Links a supervisee provider to their supervisor.
--   Tracks supervision type, required hours, completed hours,
--   supervisory credential basis, and billing authority.
--
-- Key Fields:
--   supervisor_id          Provider who holds supervisor authority
--   supervisee_id          Provider receiving supervision
--   supervision_type       Clinical vs. administrative vs. billing
--   cosign_required        Supervisor must cosign supervisee notes
--   bill_under_supervisor  Claims submitted under supervisor NPI
--   supervising_npi        The NPI that appears in CMS-1500 Box 17b
--   supervision_credential_id  FK to the supervisor's credential
-- ──────────────────────────────────────────────────────────
ALTER TABLE supervision_relationships
  ADD COLUMN IF NOT EXISTS org_id                  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervision_type        TEXT NOT NULL DEFAULT 'clinical'
    CHECK (supervision_type IN (
      'clinical','administrative','billing','group','peer'
    )),
  ADD COLUMN IF NOT EXISTS supervising_npi         TEXT,   -- NPI in CMS Box 17b
  ADD COLUMN IF NOT EXISTS supervision_credential_id UUID REFERENCES provider_credentials(id) ON DELETE SET NULL,

  -- Board / license requirements
  ADD COLUMN IF NOT EXISTS required_hours_weekly   NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS total_hours_required    NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS total_hours_completed   NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supervision_modality    TEXT DEFAULT 'individual'
    CHECK (supervision_modality IN ('individual','group','telehealth','mixed')),
  ADD COLUMN IF NOT EXISTS supervision_frequency   TEXT DEFAULT 'weekly',

  -- Billing authority
  ADD COLUMN IF NOT EXISTS cosign_required         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bill_under_supervisor   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_auth_level      TEXT DEFAULT 'none'
    CHECK (billing_auth_level IN (
      'none','co_sign_only','bill_under_supervisor','independent_with_cosign'
    )),

  -- Dates
  ADD COLUMN IF NOT EXISTS start_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS end_date                DATE,
  ADD COLUMN IF NOT EXISTS ended_reason            TEXT,

  -- Status
  ADD COLUMN IF NOT EXISTS status                  record_status NOT NULL DEFAULT 'active',

  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supervision_supervisor
  ON supervision_relationships(supervisor_id);

CREATE INDEX IF NOT EXISTS idx_supervision_supervisee
  ON supervision_relationships(supervisee_id);

CREATE INDEX IF NOT EXISTS idx_supervision_active
  ON supervision_relationships(status, end_date)
  WHERE status = 'active';


-- ════════════════════════════════════════════════════════════
-- SECTION 9 — RENDERING PROVIDERS
-- CMS-1500 Box 24J — individual who performed the service.
-- May differ from the billing provider.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: rendering_providers
--
-- Purpose:
--   Stores billing-identity snapshots for the rendering provider
--   (the individual clinician who provided the service).
--   On a claim, this resolves to a specific NPI for Box 24J.
--   One row per provider-org pairing; updated when billing
--   identity changes (new NPI, new taxonomy, new credential).
--
-- Relationship to providers:
--   provider_id → providers(id) — the source clinical record
--   billing_provider_id → billing_providers(id) — who bills on their behalf
--
-- Relationship to claims:
--   Referenced by claim_provider_links(rendering_provider_id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rendering_providers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id               UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  -- CMS-1500 Box 24J identity
  rendering_npi             TEXT NOT NULL,
  rendering_first_name      TEXT NOT NULL,
  rendering_last_name       TEXT NOT NULL,
  rendering_middle_name     TEXT,
  rendering_credential      TEXT,       -- LCSW, LPC, NP, MD, etc.

  -- Taxonomy for this rendering context
  primary_taxonomy_code     TEXT,
  primary_taxonomy_label    TEXT,
  taxonomy_source_id        UUID REFERENCES provider_taxonomy_codes(id) ON DELETE SET NULL,

  -- Medicaid enrollment
  medicaid_provider_id      TEXT,
  medicaid_enrollment_date  DATE,
  medicaid_enrollment_status TEXT DEFAULT 'active'
    CHECK (medicaid_enrollment_status IN (
      'active','pending','inactive','excluded','not_enrolled'
    )),

  -- Supervision linkage (pre-licensed / under supervision)
  is_supervised             BOOLEAN NOT NULL DEFAULT FALSE,
  supervisor_id             UUID REFERENCES providers(id) ON DELETE SET NULL,
  supervision_relationship_id UUID REFERENCES supervision_relationships(id) ON DELETE SET NULL,
  supervising_npi           TEXT,   -- NPI in Box 17b when supervised

  -- Billing linkage
  billing_provider_id       UUID,   -- FK to billing_providers(id), set post-insert
  bills_independently       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Status
  status                    record_status NOT NULL DEFAULT 'active',
  effective_date            DATE,
  expiration_date           DATE,

  -- Soft delete
  deleted_at                TIMESTAMPTZ,
  deleted_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (provider_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_rendering_provider_provider
  ON rendering_providers(provider_id);

CREATE INDEX IF NOT EXISTS idx_rendering_provider_org
  ON rendering_providers(org_id);

CREATE INDEX IF NOT EXISTS idx_rendering_provider_npi
  ON rendering_providers(rendering_npi);

CREATE INDEX IF NOT EXISTS idx_rendering_provider_status
  ON rendering_providers(status);

CREATE INDEX IF NOT EXISTS idx_rendering_provider_supervisor
  ON rendering_providers(supervisor_id) WHERE supervisor_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- SECTION 10 — BILLING PROVIDERS
-- CMS-1500 Box 33 — the entity responsible for billing.
-- Usually the group practice / organization.  May be the
-- individual for solo practitioners.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: billing_providers
--
-- Purpose:
--   Billing identity that appears in CMS-1500 Box 33.
--   One row per org (group billing) or per provider (solo).
--   Holds the NPI, Tax ID / EIN, pay-to address, and
--   taxonomy code that the payer expects on the claim.
--
-- Relationship to rendering_providers:
--   rendering_providers.billing_provider_id → billing_providers(id)
--
-- Relationship to claims:
--   Referenced by claim_provider_links(billing_provider_id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_providers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  -- Entity type: group practice bills as org; solo bills as individual
  billing_entity_type       TEXT NOT NULL DEFAULT 'organization'
    CHECK (billing_entity_type IN ('organization','individual')),

  -- When billing entity is an organization (Box 33a)
  billing_org_name          TEXT,
  billing_group_npi         TEXT,
  billing_tax_id            TEXT,
  billing_tax_id_type       TEXT DEFAULT 'EIN'
    CHECK (billing_tax_id_type IN ('EIN','SSN')),

  -- When billing entity is an individual (solo solo-practitioner)
  provider_id               UUID REFERENCES providers(id) ON DELETE SET NULL,
  billing_first_name        TEXT,
  billing_last_name         TEXT,
  billing_credential        TEXT,
  billing_individual_npi    TEXT,

  -- Effective NPI for Box 33 (always required)
  billing_npi               TEXT NOT NULL,

  -- Medicaid billing identity
  medicaid_billing_id       TEXT,
  medicaid_enrollment_status TEXT DEFAULT 'active'
    CHECK (medicaid_enrollment_status IN (
      'active','pending','inactive','excluded','not_enrolled'
    )),

  -- Primary taxonomy for billing
  primary_taxonomy_code     TEXT,
  primary_taxonomy_label    TEXT,

  -- Pay-to address (Box 33 address block)
  pay_to_name               TEXT,
  pay_to_address_line1      TEXT NOT NULL,
  pay_to_address_line2      TEXT,
  pay_to_city               TEXT NOT NULL,
  pay_to_state              TEXT NOT NULL DEFAULT 'CO',
  pay_to_zip                TEXT NOT NULL,
  pay_to_phone              TEXT,
  pay_to_fax                TEXT,

  -- Payer-specific billing identifiers
  payer_specific_id         TEXT,   -- some payers assign their own provider number
  payer_id                  TEXT,   -- if this row is scoped to a single payer

  -- Status
  status                    record_status NOT NULL DEFAULT 'active',
  effective_date            DATE,
  expiration_date           DATE,
  is_default                BOOLEAN NOT NULL DEFAULT FALSE,   -- default billing provider for org

  -- Soft delete
  deleted_at                TIMESTAMPTZ,
  deleted_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_provider_org
  ON billing_providers(org_id);

CREATE INDEX IF NOT EXISTS idx_billing_provider_npi
  ON billing_providers(billing_npi);

CREATE INDEX IF NOT EXISTS idx_billing_provider_tax
  ON billing_providers(billing_tax_id) WHERE billing_tax_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_provider_default
  ON billing_providers(org_id, is_default) WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_billing_provider_status
  ON billing_providers(status);

-- Back-fill rendering → billing FK
ALTER TABLE rendering_providers
  ADD CONSTRAINT fk_rendering_billing_provider
  FOREIGN KEY (billing_provider_id)
  REFERENCES billing_providers(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;


-- ════════════════════════════════════════════════════════════
-- SECTION 11 — REFERRING PROVIDERS
-- CMS-1500 Box 17 — provider who referred the patient.
-- May be internal (another provider in the org) or external.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: referring_providers
--
-- Purpose:
--   Maintains a directory of referring providers.
--   Internal referrers link to providers(id).
--   External referrers are stored as standalone records with
--   enough data to populate CMS-1500 Box 17 / 17a / 17b.
--
--   A patient may have a standing referral from the same PCP
--   across many claims; this table is the source of truth.
--
-- Key Fields:
--   is_internal          TRUE = provider in same org system
--   provider_id          FK when is_internal = TRUE
--   referring_npi        NPI for Box 17b (required if known)
--   upin                 Legacy UPIN if payer still requires it
--
-- Relationship to claims:
--   Referenced by claim_provider_links(referring_provider_id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referring_providers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Internal vs external referrer
  is_internal             BOOLEAN NOT NULL DEFAULT FALSE,
  provider_id             UUID REFERENCES providers(id) ON DELETE SET NULL,

  -- Identity fields (required for external referrers)
  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  middle_name             TEXT,
  credential              TEXT,     -- MD, DO, NP, PA, LCSW, etc.
  specialty               TEXT,

  -- CMS identifiers
  referring_npi           TEXT,     -- Box 17b
  upin                    TEXT,     -- legacy; some payers still require
  medicaid_provider_id    TEXT,
  taxonomy_code           TEXT,
  state_license_number    TEXT,
  license_state           TEXT DEFAULT 'CO',

  -- Contact / address
  practice_name           TEXT,
  address_line1           TEXT,
  address_line2           TEXT,
  city                    TEXT,
  state                   TEXT DEFAULT 'CO',
  zip                     TEXT,
  phone                   TEXT,
  fax                     TEXT,

  -- Relationship context
  relationship_type       TEXT DEFAULT 'referral'
    CHECK (relationship_type IN (
      'referral','ordering','supervising','attending','primary_care','specialist','other'
    )),
  accepts_back_referrals  BOOLEAN DEFAULT TRUE,

  -- Status
  status                  record_status NOT NULL DEFAULT 'active',
  is_favorite             BOOLEAN NOT NULL DEFAULT FALSE,  -- pinned for quick selection

  -- Soft delete
  deleted_at              TIMESTAMPTZ,
  deleted_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referring_provider_org
  ON referring_providers(org_id) WHERE org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referring_provider_npi
  ON referring_providers(referring_npi) WHERE referring_npi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referring_provider_internal
  ON referring_providers(provider_id) WHERE is_internal = TRUE;

CREATE INDEX IF NOT EXISTS idx_referring_provider_status
  ON referring_providers(status);


-- ════════════════════════════════════════════════════════════
-- SECTION 12 — SERVICE FACILITIES
-- CMS-1500 Box 32 — where the service was rendered.
-- Usually a location, but may differ from the billing address.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: service_facilities
--
-- Purpose:
--   Represents the physical or virtual location where a
--   service was rendered, as it appears on CMS-1500 Box 32.
--   May mirror a locations row (most common) or represent
--   a one-off site (home visit, community, school).
--
--   Service facility NPI and address are transmitted in the
--   837P Loop 2310D and in Box 32 / 32a of the CMS-1500.
--
-- Key Fields:
--   location_id          Links to locations table if applicable
--   service_facility_npi Box 32a NPI (may be org Type 2 or location-specific)
--   pos_code             Place of service code (11, 02, 10, 12, etc.)
--   is_same_as_billing   When TRUE, Box 32 prints "SAME" per payer rules
--
-- Relationships:
--   location_id → locations(id)
--   org_id      → organizations(id)
--   Referenced by claim_provider_links(service_facility_id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_facilities (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  location_id             UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Identity
  facility_name           TEXT NOT NULL,
  facility_type           TEXT NOT NULL DEFAULT 'office'
    CHECK (facility_type IN (
      'office','telehealth','home','community','school',
      'hospital','iop','residential','correctional','other'
    )),

  -- CMS-1500 Box 32 address
  address_line1           TEXT,
  address_line2           TEXT,
  city                    TEXT,
  state                   TEXT NOT NULL DEFAULT 'CO',
  zip                     TEXT,
  phone                   TEXT,

  -- Box 32a / 837P Loop 2310D
  service_facility_npi    TEXT,     -- Type 2 NPI for the facility
  pos_code                TEXT NOT NULL,   -- CMS Place of Service code
  pos_label               TEXT,
  clia_number             TEXT,     -- Lab facility only

  -- Telehealth-specific
  is_telehealth           BOOLEAN NOT NULL DEFAULT FALSE,
  telehealth_originating_site BOOLEAN DEFAULT FALSE,  -- patient's location (originating)
  telehealth_distant_site     BOOLEAN DEFAULT FALSE,  -- provider's location (distant)

  -- Billing behavior
  is_same_as_billing      BOOLEAN NOT NULL DEFAULT FALSE,  -- print "SAME" in Box 32
  is_default_for_pos      BOOLEAN NOT NULL DEFAULT FALSE,  -- default for this POS code in org
  payer_exceptions        JSONB,    -- { payer_id: { override_npi, override_name } }

  -- Status
  status                  record_status NOT NULL DEFAULT 'active',
  effective_date          DATE,
  expiration_date         DATE,

  -- Soft delete
  deleted_at              TIMESTAMPTZ,
  deleted_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_facility_org
  ON service_facilities(org_id);

CREATE INDEX IF NOT EXISTS idx_service_facility_location
  ON service_facilities(location_id) WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_facility_npi
  ON service_facilities(service_facility_npi) WHERE service_facility_npi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_facility_pos
  ON service_facilities(org_id, pos_code);

CREATE INDEX IF NOT EXISTS idx_service_facility_default
  ON service_facilities(org_id, is_default_for_pos) WHERE is_default_for_pos = TRUE;

CREATE INDEX IF NOT EXISTS idx_service_facility_status
  ON service_facilities(status);


-- ════════════════════════════════════════════════════════════
-- SECTION 13 — CLAIM PROVIDER LINKS
-- Immutable snapshot of all provider identities resolved at
-- the time each claim was created or last updated.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: claim_provider_links
--
-- Purpose:
--   Resolved provider identity for a single claim.
--   One row per claim. Captures the exact NPI, tax ID, and
--   address values that were written to the CMS-1500 / 837P.
--   Immutable after the claim is submitted — preserves the
--   billing snapshot even if provider records change later.
--
-- Key Fields:
--   claim_id                  → claims(id)
--   rendering_provider_id     → rendering_providers(id)
--   billing_provider_id       → billing_providers(id)
--   referring_provider_id     → referring_providers(id)  (nullable)
--   service_facility_id       → service_facilities(id)    (nullable)
--   snapshot_locked           TRUE after claim submission; no further edits
--
-- Snapshot columns (prefix: snap_):
--   Denormalized CMS-1500 values frozen at submission time.
--   These are the values that were actually transmitted to the payer.
--
-- Relationships to claims:
--   claims.rendering_npi   should match snap_rendering_npi
--   claims.billing_npi     should match snap_billing_npi
--   claims.supervising_npi should match snap_supervising_npi
--   claims.referring_npi   should match snap_referring_npi
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claim_provider_links (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                    UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  -- Provider identity FKs
  rendering_provider_id       UUID REFERENCES rendering_providers(id) ON DELETE SET NULL,
  billing_provider_id         UUID REFERENCES billing_providers(id) ON DELETE SET NULL,
  referring_provider_id       UUID REFERENCES referring_providers(id) ON DELETE SET NULL,
  service_facility_id         UUID REFERENCES service_facilities(id) ON DELETE SET NULL,
  supervising_provider_id     UUID REFERENCES providers(id) ON DELETE SET NULL,

  -- ── RENDERING PROVIDER SNAPSHOT (Box 24J) ──────────────
  snap_rendering_npi          TEXT,
  snap_rendering_first_name   TEXT,
  snap_rendering_last_name    TEXT,
  snap_rendering_credential   TEXT,
  snap_rendering_taxonomy     TEXT,
  snap_rendering_medicaid_id  TEXT,

  -- ── BILLING PROVIDER SNAPSHOT (Box 33) ─────────────────
  snap_billing_npi            TEXT,
  snap_billing_name           TEXT,
  snap_billing_tax_id         TEXT,    -- masked in UI; full value for 837P generation only
  snap_billing_taxonomy       TEXT,
  snap_billing_address1       TEXT,
  snap_billing_address2       TEXT,
  snap_billing_city           TEXT,
  snap_billing_state          TEXT,
  snap_billing_zip            TEXT,
  snap_billing_phone          TEXT,

  -- ── SUPERVISING PROVIDER SNAPSHOT (Box 17 / 17b) ────────
  snap_supervising_npi        TEXT,
  snap_supervising_first_name TEXT,
  snap_supervising_last_name  TEXT,
  snap_supervising_credential TEXT,

  -- ── REFERRING PROVIDER SNAPSHOT (Box 17 / 17a / 17b) ────
  snap_referring_npi          TEXT,
  snap_referring_first_name   TEXT,
  snap_referring_last_name    TEXT,
  snap_referring_credential   TEXT,
  snap_referring_upin         TEXT,

  -- ── SERVICE FACILITY SNAPSHOT (Box 32 / 32a) ────────────
  snap_facility_name          TEXT,
  snap_facility_npi           TEXT,
  snap_facility_address1      TEXT,
  snap_facility_city          TEXT,
  snap_facility_state         TEXT,
  snap_facility_zip           TEXT,
  snap_facility_pos_code      TEXT,
  snap_is_same_as_billing     BOOLEAN DEFAULT FALSE,

  -- Lock flag — set TRUE when claim transitions to Submitted
  snapshot_locked             BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_locked_at          TIMESTAMPTZ,
  snapshot_locked_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (claim_id)
);

CREATE INDEX IF NOT EXISTS idx_claim_provider_links_claim
  ON claim_provider_links(claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_provider_links_rendering
  ON claim_provider_links(rendering_provider_id) WHERE rendering_provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_claim_provider_links_billing
  ON claim_provider_links(billing_provider_id) WHERE billing_provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_claim_provider_links_facility
  ON claim_provider_links(service_facility_id) WHERE service_facility_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_claim_provider_links_org
  ON claim_provider_links(org_id);


-- ════════════════════════════════════════════════════════════
-- SECTION 14 — PROVIDER ↔ ORGANIZATION MEMBERSHIPS
-- Governs exactly which orgs a provider works for, at what
-- role, and with what billing authority.  Supplements the
-- general organization_members table in auth-schema.sql with
-- provider-specific billing configuration.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: provider_org_memberships
--
-- Purpose:
--   Controls a provider's authorization within a specific org:
--   their role, service path, billing eligibility, and
--   permitted service locations.  One row per provider–org pair.
--
-- Key Fields:
--   service_path         'mh' | 'sud' | 'integrated'
--   can_bill_independently  May submit claims under own NPI
--   can_supervise           May supervise pre-licensed staff
--   can_cosign              May cosign another provider's notes
--   billing_cred_display    Credential printed on claims
--   permitted_location_ids  Locations where provider may render services
--
-- Relationships:
--   provider_id → providers(id)
--   org_id      → organizations(id)
--   rendering_provider_id → rendering_providers(id)
--   billing_provider_id  → billing_providers(id)  (their designated billing entity)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_org_memberships (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id               UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Role within org
  org_role                  TEXT NOT NULL DEFAULT 'clinician'
    CHECK (org_role IN (
      'clinician','supervisor','prescriber','peer_support',
      'case_manager','intern','billing_staff','admin','super_admin'
    )),
  service_path              TEXT NOT NULL DEFAULT 'mh'
    CHECK (service_path IN ('mh','sud','integrated')),
  employment_type           TEXT DEFAULT 'employee'
    CHECK (employment_type IN ('employee','contractor','intern','volunteer')),

  -- Dates
  start_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date                  DATE,
  ended_reason              TEXT,

  -- Billing authority flags
  can_bill_independently    BOOLEAN NOT NULL DEFAULT TRUE,
  can_supervise             BOOLEAN NOT NULL DEFAULT FALSE,
  can_cosign                BOOLEAN NOT NULL DEFAULT FALSE,
  billing_cred_display      TEXT,    -- printed credential on claim (may differ from license)

  -- Provider identity links for this org context
  rendering_provider_id     UUID REFERENCES rendering_providers(id) ON DELETE SET NULL,
  billing_provider_id       UUID REFERENCES billing_providers(id) ON DELETE SET NULL,

  -- Permitted service locations
  permitted_location_ids    UUID[],  -- array of locations(id)
  primary_location_id       UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Status
  status                    record_status NOT NULL DEFAULT 'active',

  -- Soft delete
  deleted_at                TIMESTAMPTZ,
  deleted_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (provider_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_org_memberships_provider
  ON provider_org_memberships(provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_org_memberships_org
  ON provider_org_memberships(org_id);

CREATE INDEX IF NOT EXISTS idx_provider_org_memberships_status
  ON provider_org_memberships(status);

CREATE INDEX IF NOT EXISTS idx_provider_org_memberships_role
  ON provider_org_memberships(org_id, org_role);


-- ════════════════════════════════════════════════════════════
-- SECTION 15 — TRIGGERS, RLS, COMMENTS
-- ════════════════════════════════════════════════════════════

-- ── updated_at triggers ──────────────────────────────────────────────────────

CREATE TRIGGER trg_org_taxonomy_updated_at
  BEFORE UPDATE ON organization_taxonomy_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_provider_npis_updated_at
  BEFORE UPDATE ON provider_npis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_provider_taxonomy_updated_at
  BEFORE UPDATE ON provider_taxonomy_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_provider_credentials_updated_at
  BEFORE UPDATE ON provider_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rendering_providers_updated_at
  BEFORE UPDATE ON rendering_providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_billing_providers_updated_at
  BEFORE UPDATE ON billing_providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_referring_providers_updated_at
  BEFORE UPDATE ON referring_providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_service_facilities_updated_at
  BEFORE UPDATE ON service_facilities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_claim_provider_links_updated_at
  BEFORE UPDATE ON claim_provider_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_provider_org_memberships_updated_at
  BEFORE UPDATE ON provider_org_memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Lock claim_provider_links when snapshot is locked ───────────────────────

CREATE OR REPLACE FUNCTION prevent_locked_snapshot_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.snapshot_locked = TRUE
     AND NEW.snapshot_locked = TRUE
     AND (
       NEW.snap_rendering_npi    IS DISTINCT FROM OLD.snap_rendering_npi OR
       NEW.snap_billing_npi      IS DISTINCT FROM OLD.snap_billing_npi   OR
       NEW.snap_billing_tax_id   IS DISTINCT FROM OLD.snap_billing_tax_id
     )
  THEN
    RAISE EXCEPTION
      'claim_provider_links row % is locked after submission. '
      'Create a corrected claim instead of modifying the existing snapshot.',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_claim_provider_snapshot
  BEFORE UPDATE ON claim_provider_links
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_snapshot_update();

-- ── Auto-lock snapshot when claim is submitted ───────────────────────────────

CREATE OR REPLACE FUNCTION lock_claim_provider_snapshot_on_submit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'Submitted' AND OLD.status <> 'Submitted' THEN
    UPDATE claim_provider_links
    SET
      snapshot_locked    = TRUE,
      snapshot_locked_at = now(),
      snapshot_locked_by = auth.uid()
    WHERE claim_id = NEW.id
      AND snapshot_locked = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_lock_claim_snapshot
  AFTER UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION lock_claim_provider_snapshot_on_submit();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE organization_taxonomy_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_npis                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_taxonomy_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_credentials           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rendering_providers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_providers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE referring_providers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_facilities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_provider_links           ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_org_memberships       ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's records
CREATE POLICY "org_members_read_own_org"
  ON organization_taxonomy_codes FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_read_provider_npis"
  ON provider_npis FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "providers_read_own_npis"
  ON provider_npis FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "org_members_read_provider_taxonomy"
  ON provider_taxonomy_codes FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_read_credentials"
  ON provider_credentials FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "providers_read_own_credentials"
  ON provider_credentials FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "org_members_read_rendering"
  ON rendering_providers FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_read_billing"
  ON billing_providers FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_read_referring"
  ON referring_providers FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "org_members_read_facilities"
  ON service_facilities FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "billing_staff_read_claim_links"
  ON claim_provider_links FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('admin','billing_staff','super_admin','clinician')
    )
  );

CREATE POLICY "org_members_read_memberships"
  ON provider_org_memberships FOR SELECT
  USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

-- Admin write policies (single pattern for brevity — apply to all tables above)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organization_taxonomy_codes','provider_npis','provider_taxonomy_codes',
    'provider_credentials','rendering_providers','billing_providers',
    'referring_providers','service_facilities','provider_org_memberships'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "admin_write_%s" ON %I FOR ALL
       USING (org_id IN (
         SELECT org_id FROM organization_members
         WHERE user_id = auth.uid()
           AND role IN (''super_admin'',''admin'',''credentialing_specialist'')
       ))',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ── Table comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE organization_taxonomy_codes IS
  'CMS taxonomy codes assigned at the organization (Type 2 NPI) level. '
  'is_primary marks the taxonomy sent in Box 24 of the CMS-1500.';

COMMENT ON TABLE provider_npis IS
  'All NPI numbers per provider. Type 1 = individual (Box 24J). '
  'Type 2 = organization entity. NPPES verification metadata stored here. '
  'UNIQUE constraint on npi prevents duplicate registration.';

COMMENT ON TABLE provider_taxonomy_codes IS
  'CMS taxonomy code assignments per provider. is_primary = Box 24 value. '
  'credential_link_id ties this taxonomy to the license that supports it.';

COMMENT ON TABLE provider_credentials IS
  'Master credential record: licenses, DEA, malpractice, CAQH, PECOS. '
  'alert_days_before_expiry drives credentialing_alerts generation. '
  'OIG/SAM exclusion check timestamps tracked per credential row.';

COMMENT ON TABLE rendering_providers IS
  'Billing identity for the clinician who rendered the service (CMS Box 24J). '
  'One row per provider-org pair. snapshot values appear in claim_provider_links. '
  'supervisor_id links pre-licensed providers to their supervising clinician.';

COMMENT ON TABLE billing_providers IS
  'Billing entity for CMS-1500 Box 33. Usually the group practice. '
  'pay_to_* fields populate the Box 33 address block. '
  'snapshot values are frozen in claim_provider_links at submission.';

COMMENT ON TABLE referring_providers IS
  'Directory of referring providers for CMS Box 17. '
  'Internal referrers link via provider_id; external are standalone records. '
  'referring_npi populates Box 17b on the CMS-1500.';

COMMENT ON TABLE service_facilities IS
  'Service facility for CMS Box 32 / 32a. Links to locations where available. '
  'is_same_as_billing = TRUE causes Box 32 to print "SAME" on the claim form. '
  'pos_code drives medical necessity rules and code restrictions.';

COMMENT ON TABLE claim_provider_links IS
  'Immutable claim-time snapshot of all CMS-1500 provider identity fields. '
  'One row per claim. Locked after submission via snapshot_locked trigger. '
  'snap_* columns preserve exact values transmitted to the payer.';

COMMENT ON TABLE provider_org_memberships IS
  'Provider billing roles and permissions within a specific organization. '
  'One row per provider-org pair. Controls can_bill_independently, '
  'can_supervise, permitted locations, and linked billing identity.';
