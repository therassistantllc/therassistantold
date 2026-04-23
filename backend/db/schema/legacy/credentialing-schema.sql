-- ============================================================
-- THERASSISTANT — Credentialing Schema                 v1.0
-- Colorado Medicaid Behavioral Health Billing Platform
--
-- Covers end-to-end provider credentialing lifecycle:
--   payer enrollments, CAQH, PECOS, NPPES, state licenses,
--   DEA registrations, malpractice insurance, payer contracts,
--   and credential documents.
--
-- Dependencies (must run first):
--   auth-schema.sql            → auth.users, organizations,
--                                organization_members, locations
--   providers-schema.sql       → providers (provider profiles)
--
-- RLS role conventions:
--   super_admin | admin | credentialing_specialist → full access
--   clinician                                      → own records (read)
--   billing_specialist                             → enrollment + NPI (read)
--
-- ============================================================

-- ── Shared helper: role check ─────────────────────────────────────────────────
-- Reused in all RLS policies as an inline sub-select.
-- Checks that the calling user has a qualifying role in the row's org.

-- ── Table of Contents ────────────────────────────────────────────────────────
--   TABLE  1  provider_licenses          State professional licenses
--   TABLE  2  provider_dea_registrations DEA controlled-substance registrations
--   TABLE  3  provider_malpractice_policies  E&O / malpractice insurance
--   TABLE  4  provider_nppes_records     NPI registry snapshots (NPPES)
--   TABLE  5  provider_caqh_profiles     CAQH ProView tracking
--   TABLE  6  provider_pecos_records     Medicare PECOS enrollments
--   TABLE  7  provider_enrollments       Per-payer enrollment records
--   TABLE  8  payer_contracts            Negotiated payer contracts
--   TABLE  9  provider_contract_participations  Provider ↔ contract links
--   TABLE 10  credentialing_documents    Secure document references
--   TABLE 11  credentialing_alerts       Automated expiry / task alerts
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════
-- TABLE 1: provider_licenses
--   One row per license. A provider may hold multiple licenses
--   (e.g., LCSW in CO + CA, plus a CAC III).  Supersedes the
--   single flat license_* columns in providers for multi-license
--   tracking and expiration alerting.
--
--   Colorado DORA license types tracked:
--     LCSW  Licensed Clinical Social Worker
--     LSW   Licensed Social Worker (provisional)
--     LPC   Licensed Professional Counselor
--     LPCC  Licensed Professional Counselor Candidate
--     LMFT  Licensed Marriage and Family Therapist
--     MFTC  Marriage and Family Therapist Candidate
--     LAC   Licensed Addiction Counselor
--     CAC II / CAC III  Certified Addiction Counselor
--     LAT   Licensed Addiction Therapist
--     PSY   Licensed Psychologist
--     MD    Medical Doctor (psychiatry)
--     DO    Doctor of Osteopathic Medicine
--     PMHNP Psychiatric Mental Health Nurse Practitioner
--     RN    Registered Nurse
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_licenses (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider_id                 UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- License identity
  license_type                TEXT NOT NULL,
  -- e.g. 'LCSW', 'LPC', 'LPCC', 'LAC', 'CAC III', 'PSY', 'PMHNP', 'MD'
  license_number              TEXT NOT NULL,
  license_state               TEXT NOT NULL DEFAULT 'CO',
  issuing_board               TEXT,
  -- e.g. 'Colorado DORA Mental Health Section', 'Colorado DORA Drug Board'

  -- Dates
  issue_date                  DATE,
  effective_date              DATE,
  expiration_date             DATE NOT NULL,
  last_renewal_date           DATE,
  next_renewal_due_date       DATE GENERATED ALWAYS AS (expiration_date) STORED,
  -- Override: some boards set renewal deadline before hard expiry
  renewal_deadline_override   DATE,

  -- Status
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN (
                                  'active', 'expired', 'suspended',
                                  'revoked', 'pending', 'inactive'
                                )),
  status_note                 TEXT,

  -- Supervision / provisional flags
  is_provisional              BOOLEAN NOT NULL DEFAULT FALSE,
  -- True for LPCC, MFTC, LSW, LAC, CAC I/II — requires named supervisor
  supervision_required        BOOLEAN NOT NULL DEFAULT FALSE,
  supervisor_license_id       UUID REFERENCES provider_licenses(id) ON DELETE SET NULL,

  -- Continuing education
  ce_hours_required           NUMERIC(6,2),    -- per renewal cycle
  ce_hours_completed          NUMERIC(6,2) DEFAULT 0,
  ce_cycle_end_date           DATE,

  -- Colorado Medicaid billing flags
  billable_under_own_npi      BOOLEAN NOT NULL DEFAULT TRUE,
  billable_under_supervisor   BOOLEAN NOT NULL DEFAULT FALSE,
  colorado_medicaid_eligible  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Whether this license satisfies CO HCPF provider qualification

  -- Alert thresholds (days before expiry to generate alerts)
  alert_days_90               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_60               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_30               BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plicenses_provider_id   ON provider_licenses(provider_id);
CREATE INDEX IF NOT EXISTS idx_plicenses_org_id        ON provider_licenses(org_id);
CREATE INDEX IF NOT EXISTS idx_plicenses_expiration    ON provider_licenses(expiration_date);
CREATE INDEX IF NOT EXISTS idx_plicenses_status        ON provider_licenses(status);
CREATE INDEX IF NOT EXISTS idx_plicenses_state         ON provider_licenses(license_state);

ALTER TABLE provider_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plicenses_own_read"
  ON provider_licenses FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "plicenses_org_read"
  ON provider_licenses FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "plicenses_admin_write"
  ON provider_licenses FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist')
  ));

CREATE TRIGGER trg_plicenses_updated_at
  BEFORE UPDATE ON provider_licenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 2: provider_dea_registrations
--   DEA (Drug Enforcement Administration) schedule authorizations.
--   Relevant for psychiatric prescribers (MD, DO, PMHNP) who
--   prescribe controlled substances (buprenorphine, stimulants, etc.).
--   Non-prescribers will not have records here.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_dea_registrations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider_id                 UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  dea_number                  TEXT NOT NULL UNIQUE,   -- format: AB1234567
  registration_state          TEXT NOT NULL DEFAULT 'CO',

  -- DEA registration type
  registration_type           TEXT NOT NULL DEFAULT 'practitioner'
                                CHECK (registration_type IN (
                                  'practitioner', 'mid_level_practitioner',
                                  'pharmacy', 'hospital', 'clinic'
                                )),

  -- Schedules authorized (I–V)
  schedules_authorized        TEXT[] NOT NULL DEFAULT '{}',
  -- e.g. ['II','III','IV','V'] — Schedule I not for clinical use

  -- X waiver / DATA 2000 (buprenorphine)
  -- Under MATE Act 2023, DEA waiver is no longer required but
  -- DEA number must still be valid for buprenorphine prescribing
  buprenorphine_authorized    BOOLEAN NOT NULL DEFAULT FALSE,
  mat_patient_limit           INTEGER,
  -- Legacy: Was 30/100/275 depending on waiver level; MATE Act removed cap

  -- Dates
  issue_date                  DATE,
  expiration_date             DATE NOT NULL,

  -- Status
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN (
                                  'active', 'expired', 'surrendered',
                                  'revoked', 'pending'
                                )),

  -- Practice location this registration is tied to
  practice_address            TEXT,
  business_activity           TEXT,
  -- e.g. 'Dispensing','Prescribing','Administering','Collecting'

  -- Alert thresholds
  alert_days_90               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_60               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_30               BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdea_provider_id     ON provider_dea_registrations(provider_id);
CREATE INDEX IF NOT EXISTS idx_pdea_org_id          ON provider_dea_registrations(org_id);
CREATE INDEX IF NOT EXISTS idx_pdea_expiration      ON provider_dea_registrations(expiration_date);
CREATE INDEX IF NOT EXISTS idx_pdea_status          ON provider_dea_registrations(status);

ALTER TABLE provider_dea_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdea_own_read"
  ON provider_dea_registrations FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "pdea_org_read"
  ON provider_dea_registrations FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "pdea_admin_write"
  ON provider_dea_registrations FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist')
  ));

CREATE TRIGGER trg_pdea_updated_at
  BEFORE UPDATE ON provider_dea_registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 3: provider_malpractice_policies
--   E&O / malpractice insurance policy records.  Most payer contracts
--   and hospital credentialing require minimum per-occurrence and
--   aggregate limits.  Colorado Medicaid itself does not mandate a
--   specific minimum, but many MCOs and hospital-based contracts do.
--
--   Tracks both occurrence-based and claims-made policies.
--   For claims-made policies, tail coverage dates are critical — a gap
--   voids prior-acts coverage and can expose the provider to denial of
--   vicarious liability coverage by payers.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_malpractice_policies (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider_id                 UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Policy identity
  insurer_name                TEXT NOT NULL,
  -- e.g. 'HPSO', 'CPH & Associates', 'NASW Risk Retention Group', 'Chubb'
  policy_number               TEXT NOT NULL,
  insurer_naic_code           TEXT,            -- National Association of Insurance Commisioners code

  -- Coverage type and structure
  coverage_type               TEXT NOT NULL DEFAULT 'occurrence'
                                CHECK (coverage_type IN ('occurrence', 'claims_made')),
  -- Occurrence: covers incidents that occurred during policy period, regardless of when claimed.
  -- Claims-made: covers claims filed while policy is active; requires tail coverage after termination.

  -- Limits (USD)
  per_occurrence_limit        NUMERIC(14,2) NOT NULL,
  -- Minimum commonly required: $1,000,000 per occurrence
  aggregate_limit             NUMERIC(14,2) NOT NULL,
  -- Minimum commonly required: $3,000,000 aggregate

  -- Policy period
  effective_date              DATE NOT NULL,
  expiration_date             DATE NOT NULL,

  -- Claims-made specifics
  retroactive_date            DATE,
  -- For claims-made: date from which prior acts are covered
  tail_coverage_obtained      BOOLEAN NOT NULL DEFAULT FALSE,
  tail_coverage_effective     DATE,
  tail_coverage_expiration    DATE,
  tail_coverage_policy_number TEXT,

  -- Status
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN (
                                  'active', 'expired', 'cancelled',
                                  'non_renewed', 'pending'
                                )),
  cancellation_date           DATE,
  cancellation_reason         TEXT,

  -- COI (Certificate of Insurance) on file
  coi_on_file                 BOOLEAN NOT NULL DEFAULT FALSE,
  coi_document_id             UUID,
  -- FK to credentialing_documents once that table is created

  -- Additional insureds (payers / facilities that must be named)
  additional_insureds         TEXT[],
  -- e.g. ['Colorado HCPF', 'Kaiser Permanente of Colorado']

  -- Alert thresholds
  alert_days_90               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_60               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_30               BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmal_provider_id    ON provider_malpractice_policies(provider_id);
CREATE INDEX IF NOT EXISTS idx_pmal_org_id         ON provider_malpractice_policies(org_id);
CREATE INDEX IF NOT EXISTS idx_pmal_expiration     ON provider_malpractice_policies(expiration_date);
CREATE INDEX IF NOT EXISTS idx_pmal_status         ON provider_malpractice_policies(status);

ALTER TABLE provider_malpractice_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmal_own_read"
  ON provider_malpractice_policies FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "pmal_org_read"
  ON provider_malpractice_policies FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "pmal_admin_write"
  ON provider_malpractice_policies FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist')
  ));

CREATE TRIGGER trg_pmal_updated_at
  BEFORE UPDATE ON provider_malpractice_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 4: provider_nppes_records
--   Snapshot of the CMS National Plan and Provider Enumeration System
--   (NPPES) registry entries.  Stores both Type 1 (individual) and
--   Type 2 (organizational) NPI data as pulled from the NPPES NPI
--   Registry download or NPI Validation API.
--
--   Type 1 NPI: individual provider — one per clinician
--   Type 2 NPI: organizational entity — one per practice/org
--
--   An NPI is assigned once and does not expire, but can be
--   deactivated by CMS (voluntary or involuntary).
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_nppes_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Can link to a provider OR an org (for Type 2)
  provider_id                 UUID REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- NPI fields
  npi                         TEXT NOT NULL UNIQUE,   -- 10-digit NPI
  npi_type                    INTEGER NOT NULL
                                CHECK (npi_type IN (1, 2)),
  -- 1 = Individual (Type 1)   2 = Organization (Type 2)

  enumeration_date            DATE,              -- date NPI was first assigned
  last_updated_date           DATE,              -- date NPPES record was last changed

  -- Entity name (provider or organization)
  entity_name_first           TEXT,              -- Type 1 only
  entity_name_last            TEXT,              -- Type 1 only
  entity_name_organization    TEXT,              -- Type 2 only
  doing_business_as           TEXT,

  -- Taxonomy codes
  primary_taxonomy_code       TEXT,
  taxonomy_codes              TEXT[] DEFAULT '{}',
  -- Full list per NPPES; first is primary

  -- Practice address (mailing and location)
  practice_address_line1      TEXT,
  practice_address_line2      TEXT,
  practice_city               TEXT,
  practice_state              TEXT,
  practice_zip                TEXT,
  practice_phone              TEXT,
  practice_fax                TEXT,

  mailing_address_line1       TEXT,
  mailing_address_line2       TEXT,
  mailing_city                TEXT,
  mailing_state               TEXT,
  mailing_zip                 TEXT,

  -- Deactivation / reactivation
  deactivation_date           DATE,
  deactivation_reason         TEXT,
  -- 'Death', 'Disbandment', 'Fraud', 'Other'
  reactivation_date           DATE,

  -- Status
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,

  -- Last sync from NPPES
  last_synced_at              TIMESTAMPTZ,
  data_source                 TEXT DEFAULT 'NPPES_DOWNLOAD',
  -- 'NPPES_DOWNLOAD' | 'NPI_REGISTRY_API' | 'MANUAL'

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nppes_npi           ON provider_nppes_records(npi);
CREATE INDEX IF NOT EXISTS idx_nppes_provider_id   ON provider_nppes_records(provider_id);
CREATE INDEX IF NOT EXISTS idx_nppes_org_id        ON provider_nppes_records(org_id);
CREATE INDEX IF NOT EXISTS idx_nppes_type          ON provider_nppes_records(npi_type);
CREATE INDEX IF NOT EXISTS idx_nppes_taxonomy      ON provider_nppes_records USING gin(taxonomy_codes);

ALTER TABLE provider_nppes_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nppes_org_read"
  ON provider_nppes_records FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "nppes_own_read"
  ON provider_nppes_records FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "nppes_admin_write"
  ON provider_nppes_records FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist', 'billing_specialist')
  ));

CREATE TRIGGER trg_nppes_updated_at
  BEFORE UPDATE ON provider_nppes_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 5: provider_caqh_profiles
--   CAQH (Council for Affordable Quality Healthcare) ProView
--   profile tracking.  CAQH is the industry-standard credentialing
--   database used by most commercial payers and some Medicaid MCOs
--   to retrieve provider credentialing data.
--
--   Providers must re-attest their CAQH profile every 120 days or
--   payers will not access it.  This table tracks attestation
--   currency and authorization grant status per payer.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_caqh_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider_id                 UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- CAQH identifiers
  caqh_id                     TEXT NOT NULL UNIQUE,   -- 8-digit CAQH ID
  caqh_username               TEXT,                   -- ProView login (masked after entry)

  -- Profile completeness
  profile_status              TEXT NOT NULL DEFAULT 'incomplete'
                                CHECK (profile_status IN (
                                  'complete', 'incomplete', 'expired',
                                  'not_authorized', 'initial_application'
                                )),
  profile_complete_date       DATE,

  -- Attestation
  last_attestation_date       DATE,
  next_attestation_due_date   DATE,
  -- CAQH requires re-attestation every 120 days
  attestation_cycle_days      INTEGER NOT NULL DEFAULT 120,

  -- Authorization (provider must authorize each payer to access profile)
  authorization_granted       BOOLEAN NOT NULL DEFAULT FALSE,
  authorized_payers           TEXT[] DEFAULT '{}',
  -- List of payer names/IDs that have been authorized
  unauthorized_payers         TEXT[] DEFAULT '{}',
  -- Payers that have requested access but not yet been authorized

  -- Supporting documents on file in CAQH
  cv_uploaded                 BOOLEAN NOT NULL DEFAULT FALSE,
  malpractice_uploaded        BOOLEAN NOT NULL DEFAULT FALSE,
  license_uploaded            BOOLEAN NOT NULL DEFAULT FALSE,
  degree_uploaded             BOOLEAN NOT NULL DEFAULT FALSE,

  -- Exclusion / sanctions check
  last_exclusion_check_date   DATE,
  exclusion_check_result      TEXT DEFAULT 'not_checked'
                                CHECK (exclusion_check_result IN (
                                  'not_checked', 'clear', 'flagged'
                                )),
  -- OIG LEIE and SAM checks should run before initial enrollment and annually

  -- Alert thresholds (days before attestation due)
  alert_days_30               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_14               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_5                BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caqh_provider_id         ON provider_caqh_profiles(provider_id);
CREATE INDEX IF NOT EXISTS idx_caqh_org_id              ON provider_caqh_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_caqh_caqh_id             ON provider_caqh_profiles(caqh_id);
CREATE INDEX IF NOT EXISTS idx_caqh_next_attestation    ON provider_caqh_profiles(next_attestation_due_date);
CREATE INDEX IF NOT EXISTS idx_caqh_status              ON provider_caqh_profiles(profile_status);

ALTER TABLE provider_caqh_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caqh_own_read"
  ON provider_caqh_profiles FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "caqh_org_read"
  ON provider_caqh_profiles FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "caqh_admin_write"
  ON provider_caqh_profiles FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist')
  ));

CREATE TRIGGER trg_caqh_updated_at
  BEFORE UPDATE ON provider_caqh_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 6: provider_pecos_records
--   Medicare Provider Enrollment, Chain, and Ownership System (PECOS)
--   enrollment tracking.  Colorado BH providers who bill Medicare
--   (and Medicare Advantage plans that cross-walk to Part B) must
--   maintain active PECOS enrollment by revalidating every 5 years
--   (or sooner per CMS notice).
--
--   PTAN (Provider Transaction Access Number) is the Medicare-assigned
--   billing identifier distinct from the NPI.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_pecos_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Can apply to individual provider or org
  provider_id                 UUID REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- PECOS identifiers
  pecos_enrollment_id         TEXT,              -- CMS-assigned enrollment record ID
  ptan                        TEXT UNIQUE,       -- Provider Transaction Access Number
  medicare_contractor         TEXT,              -- MAC (Medicare Administrative Contractor) region
  -- Colorado is served by Noridian Healthcare Solutions (MAC J-F)

  -- Enrollment type
  enrollment_type             TEXT NOT NULL DEFAULT 'individual'
                                CHECK (enrollment_type IN (
                                  'individual', 'group', 'ordering_referring',
                                  'dme_supplier', 'affiliated'
                                )),
  -- ordering_referring: non-billing providers who just order/refer

  -- Specialty and taxonomy as recorded in PECOS
  medicare_specialty_code     TEXT,
  -- CMS specialty code (e.g. 86 = Clinical Social Worker, 62 = Psychiatry)
  primary_taxonomy_code       TEXT,

  -- Enrollment status
  status                      TEXT NOT NULL DEFAULT 'not_enrolled'
                                CHECK (status IN (
                                  'active', 'deactivated', 'revoked',
                                  'pending_initial', 'pending_revalidation',
                                  'not_enrolled', 'opted_out'
                                )),
  -- opted_out: providers who formally opted out of Medicare
  opt_out_date                DATE,
  opt_out_expiration          DATE,

  -- Effective / revalidation dates
  effective_date              DATE,
  revalidation_due_date       DATE,
  last_revalidation_date      DATE,
  application_date            DATE,
  application_id              TEXT,             -- CMS application tracking number

  -- Reassignment of benefits
  benefits_reassigned_to_org  BOOLEAN NOT NULL DEFAULT FALSE,
  reassigned_to_entity_name   TEXT,

  -- Billing MAC information
  mac_jurisdiction            TEXT DEFAULT 'J-F',
  -- J-F = Jurisdiction F (Colorado, New Mexico, South Dakota, North Dakota, Wyoming, Texas, Oklahoma, Louisiana, Arkansas)
  -- Updated 2025: Jurisdiction F reassigned to Noridian from WPS

  -- Alert thresholds (days before revalidation due)
  alert_days_180              BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_90               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_30               BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pecos_provider_id     ON provider_pecos_records(provider_id);
CREATE INDEX IF NOT EXISTS idx_pecos_org_id          ON provider_pecos_records(org_id);
CREATE INDEX IF NOT EXISTS idx_pecos_ptan            ON provider_pecos_records(ptan);
CREATE INDEX IF NOT EXISTS idx_pecos_status          ON provider_pecos_records(status);
CREATE INDEX IF NOT EXISTS idx_pecos_revalidation    ON provider_pecos_records(revalidation_due_date);

ALTER TABLE provider_pecos_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pecos_own_read"
  ON provider_pecos_records FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "pecos_org_read"
  ON provider_pecos_records FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "pecos_admin_write"
  ON provider_pecos_records FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist', 'billing_specialist')
  ));

CREATE TRIGGER trg_pecos_updated_at
  BEFORE UPDATE ON provider_pecos_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 7: provider_enrollments
--   Per-payer enrollment records.  One row per provider per payer.
--   Covers Colorado Medicaid (HCPF/ACC), commercial plans, and
--   any managed behavioral health organizations (MBHOs).
--
--   Colorado Medicaid behavioral health payers:
--     State FFS: CO HCPF (direct Medicaid)
--     ACC Phase 2–4 MCOs: Health First Colorado
--     ASO: Regional Accountable Entities (RAEs)
--       RAE 1: HealthConnect Rocky Mountain (northeast)
--       RAE 2: Colorado Access (Denver metro)
--       RAE 3: Arapahoe/Douglas Mental Health  (southeast)
--       RAE 4: Colorado Health Partnerships (San Luis Valley / Pueblo)
--       RAE 5: Behavioral Health Connections (south)
--       RAE 6: Beacon Health Options / Peak (northwest)
--       RAE 7: Behavioral Health Network (southwest)
--
--   Commercial common in CO BH: Cigna, Aetna, United, Anthem,
--     RMHP, Kaiser Permanente, Bright Health, Colorado Choice (IHC).
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_enrollments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider_id                 UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Payer
  payer_name                  TEXT NOT NULL,
  payer_id                    TEXT,             -- internal payer_id if payers table exists
  payer_type                  TEXT NOT NULL DEFAULT 'medicaid'
                                CHECK (payer_type IN (
                                  'medicaid',           -- CO HCPF state Medicaid
                                  'medicare',           -- CMS Part B
                                  'medicare_advantage', -- MA plans
                                  'commercial',         -- private insurance
                                  'rae',                -- Regional Accountable Entity (CO Medicaid ASO)
                                  'tricare',            -- Military health system
                                  'chip',               -- Children's Health Insurance Program
                                  'self_pay_network',   -- e.g. Open Path, Alma
                                  'other'
                                )),

  -- NPI used for this enrollment (may differ from provider's individual NPI
  -- if billing under group or supervisor NPI)
  billing_npi                 TEXT NOT NULL,
  billing_group_npi           TEXT,
  billing_tax_id              TEXT,             -- org/practice TIN

  -- Provider identifiers assigned by this payer
  payer_provider_id           TEXT,             -- e.g. CO Medicaid legacy provider number
  provider_number_legacy      TEXT,             -- Older CO Medicaid 6-digit provider #

  -- Enrollment details
  enrollment_type             TEXT NOT NULL DEFAULT 'individual'
                                CHECK (enrollment_type IN (
                                  'individual', 'group', 'ordering_referring',
                                  'rendering_only'
                                )),
  application_date            DATE,
  submitted_date              DATE,
  effective_date              DATE,
  termination_date            DATE,
  revalidation_due_date       DATE,
  last_revalidation_date      DATE,

  -- Status lifecycle
  status                      TEXT NOT NULL DEFAULT 'not_started'
                                CHECK (status IN (
                                  'not_started',    -- Enrollment not yet initiated
                                  'preparing',      -- Gathering documents
                                  'submitted',      -- Application sent; awaiting payer
                                  'pend',           -- Payer requested additional info
                                  'approved',       -- Enrollment active
                                  'denied',         -- Payer denied enrollment
                                  'appealing',      -- Denial under appeal
                                  'terminated',     -- Provider term'd from payer panel
                                  'revalidating',   -- Active revalidation in progress
                                  'inactive'        -- Temporarily deactivated
                                )),
  denial_reason               TEXT,
  denial_date                 DATE,
  appeal_submitted_date       DATE,
  appeal_decision_date        DATE,
  appeal_outcome              TEXT CHECK (appeal_outcome IN ('approved','denied','pending',NULL)),

  -- Credentialing (payer-side credentialing, distinct from enrollment)
  credentialing_required      BOOLEAN NOT NULL DEFAULT TRUE,
  credentialing_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  credentialing_completed_date DATE,
  credentialing_expiration     DATE,
  -- Most payers re-credential every 2–3 years

  -- Panel / network status
  accepting_new_patients      BOOLEAN NOT NULL DEFAULT TRUE,
  network_name                TEXT,
  -- e.g. 'Exclusive Provider Network', 'Preferred Provider Network'
  panel_size_limit            INTEGER,
  current_panel_size          INTEGER,

  -- Taxonomy code used for this enrollment
  taxonomy_code               TEXT,

  -- Alert thresholds
  alert_days_90               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_60               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_30               BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (provider_id, payer_name, enrollment_type)
);

CREATE INDEX IF NOT EXISTS idx_penroll_provider_id      ON provider_enrollments(provider_id);
CREATE INDEX IF NOT EXISTS idx_penroll_org_id           ON provider_enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_penroll_payer_name       ON provider_enrollments(payer_name);
CREATE INDEX IF NOT EXISTS idx_penroll_payer_type       ON provider_enrollments(payer_type);
CREATE INDEX IF NOT EXISTS idx_penroll_status           ON provider_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_penroll_effective        ON provider_enrollments(effective_date);
CREATE INDEX IF NOT EXISTS idx_penroll_revalidation     ON provider_enrollments(revalidation_due_date);

ALTER TABLE provider_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "penroll_own_read"
  ON provider_enrollments FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "penroll_org_read"
  ON provider_enrollments FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "penroll_admin_write"
  ON provider_enrollments FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist', 'billing_specialist')
  ));

CREATE TRIGGER trg_penroll_updated_at
  BEFORE UPDATE ON provider_enrollments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 8: payer_contracts
--   Negotiated participation agreements between the organization
--   (or an individual provider) and a payer / insurance company.
--   A contract governs: fee schedule, covered service codes, billing
--   requirements, credentialing requirements, termination notice,
--   and dispute resolution.
--
--   Distinct from provider_enrollments:
--     - contract = the legal arrangement and fee schedule
--     - enrollment = each provider's application under that contract
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payer_contracts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Payer details
  payer_name                  TEXT NOT NULL,
  payer_type                  TEXT NOT NULL DEFAULT 'commercial'
                                CHECK (payer_type IN (
                                  'medicaid', 'medicare', 'medicare_advantage',
                                  'commercial', 'rae', 'tricare', 'chip', 'other'
                                )),
  payer_contact_name          TEXT,
  payer_contact_email         TEXT,
  payer_contact_phone         TEXT,

  -- Contract identity
  contract_number             TEXT,             -- Payer-assigned contract ID
  contract_type               TEXT NOT NULL DEFAULT 'participation'
                                CHECK (contract_type IN (
                                  'participation',    -- Standard in-network participation
                                  'single_case',      -- One-time single case agreement
                                  'letter_of_intent', -- LOI / tentative agreement
                                  'capitated',        -- Per-member per-month risk model
                                  'value_based'       -- VBP / outcomes-based arrangement
                                )),

  -- Effective period
  effective_date              DATE NOT NULL,
  termination_date            DATE,
  evergreen                   BOOLEAN NOT NULL DEFAULT TRUE,
  -- If true, auto-renews annually unless terminated; termination_date is next T-date
  renewal_date                DATE,             -- Date terms auto-renew
  termination_notice_days     INTEGER DEFAULT 90,
  -- Number of days advance written notice required to terminate

  -- Fee schedule
  fee_schedule_type           TEXT DEFAULT 'medicaid_fee_schedule'
                                CHECK (fee_schedule_type IN (
                                  'medicaid_fee_schedule',  -- CO HCPF fee schedule
                                  'medicare_fee_schedule',  -- CMS fee schedule
                                  'percentage_of_medicare', -- e.g. 120% of Medicare
                                  'negotiated_rate',        -- Custom negotiated rates
                                  'ucr',                    -- Usual, Customary, and Reasonable
                                  'capitation'              -- PMPM
                                )),
  fee_schedule_effective_date DATE,
  fee_schedule_document_id    UUID,             -- FK to credentialing_documents

  -- Credentialing requirements under this contract
  credentialing_required      BOOLEAN NOT NULL DEFAULT TRUE,
  recredentialing_cycle_months INTEGER DEFAULT 36,
  -- Most payers re-credential every 24–36 months
  caqh_required               BOOLEAN NOT NULL DEFAULT FALSE,
  -- True for most MCOs; CO Medicaid FFS does not use CAQH

  -- Covered services (CPT/HCPCS codes authorized under this agreement)
  covered_service_codes       TEXT[] DEFAULT '{}',
  -- e.g. ['H0031','H0032','H0001','90837','90847']
  excluded_service_codes      TEXT[] DEFAULT '{}',

  -- Status
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN (
                                  'active', 'pending', 'terminated',
                                  'under_review', 'negotiating', 'expired'
                                )),
  status_change_date          DATE,
  status_change_reason        TEXT,

  -- Contract document reference
  contract_document_id        UUID,             -- FK to credentialing_documents

  -- Alert thresholds (for renewal and termination deadlines)
  alert_days_180              BOOLEAN NOT NULL DEFAULT FALSE,
  alert_days_90               BOOLEAN NOT NULL DEFAULT TRUE,
  alert_days_30               BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcontracts_org_id         ON payer_contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_pcontracts_payer_name     ON payer_contracts(payer_name);
CREATE INDEX IF NOT EXISTS idx_pcontracts_payer_type     ON payer_contracts(payer_type);
CREATE INDEX IF NOT EXISTS idx_pcontracts_status         ON payer_contracts(status);
CREATE INDEX IF NOT EXISTS idx_pcontracts_effective      ON payer_contracts(effective_date);
CREATE INDEX IF NOT EXISTS idx_pcontracts_renewal        ON payer_contracts(renewal_date);
CREATE INDEX IF NOT EXISTS idx_pcontracts_covered_codes  ON payer_contracts USING gin(covered_service_codes);

ALTER TABLE payer_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcontracts_org_read"
  ON payer_contracts FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "pcontracts_admin_write"
  ON payer_contracts FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist', 'billing_specialist')
  ));

CREATE TRIGGER trg_pcontracts_updated_at
  BEFORE UPDATE ON payer_contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 9: provider_contract_participations
--   Many-to-many join: which providers participate under which
--   payer contracts.  A contract may cover all org providers or only
--   specific credentialed individuals.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_contract_participations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider_id                 UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  contract_id                 UUID NOT NULL REFERENCES payer_contracts(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Participation lifecycle
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'active', 'pending', 'terminated',
                                  'suspended', 'credentialing_in_progress'
                                )),
  effective_date              DATE,
  termination_date            DATE,

  -- Taxonomy used under this contract
  taxonomy_code               TEXT,
  rendering_npi               TEXT,             -- NPI used when billing under this contract

  -- Credentialing completion for this specific pairing
  credentialing_complete      BOOLEAN NOT NULL DEFAULT FALSE,
  credentialing_date          DATE,
  recredentialing_due_date    DATE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (provider_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_pcp_provider_id      ON provider_contract_participations(provider_id);
CREATE INDEX IF NOT EXISTS idx_pcp_contract_id      ON provider_contract_participations(contract_id);
CREATE INDEX IF NOT EXISTS idx_pcp_org_id           ON provider_contract_participations(org_id);
CREATE INDEX IF NOT EXISTS idx_pcp_status           ON provider_contract_participations(status);
CREATE INDEX IF NOT EXISTS idx_pcp_recredential     ON provider_contract_participations(recredentialing_due_date);

ALTER TABLE provider_contract_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcp_own_read"
  ON provider_contract_participations FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "pcp_org_read"
  ON provider_contract_participations FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "pcp_admin_write"
  ON provider_contract_participations FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist', 'billing_specialist')
  ));

CREATE TRIGGER trg_pcp_updated_at
  BEFORE UPDATE ON provider_contract_participations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 10: credentialing_documents
--   Secure references to credentialing document files stored in
--   Supabase Storage.  storage_path is the bucket-relative path
--   to the object; access is controlled by Storage RLS or signed URLs.
--
--   This table stores metadata only.  The raw file bytes live in
--   Supabase Storage bucket 'credentialing-documents'.
--
--   Any table above may reference this table via its document_id
--   FK columns once this table is created.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS credentialing_documents (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  provider_id                 UUID REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Document classification
  document_type               TEXT NOT NULL
                                CHECK (document_type IN (
                                  'state_license',         -- State professional license
                                  'dea_certificate',       -- DEA registration certificate
                                  'malpractice_coi',       -- Certificate of Insurance (malpractice)
                                  'malpractice_policy',    -- Full policy document
                                  'caqh_summary',          -- CAQH profile PDF
                                  'pecos_confirmation',    -- PECOS enrollment confirmation
                                  'nppes_confirmation',    -- NPI registry confirmation letter
                                  'cv_resume',             -- Curriculum Vitae
                                  'diploma_degree',        -- Academic degree certificate
                                  'board_certification',   -- Board certification certificate
                                  'caqh_authorization',    -- CAQH payer authorization form
                                  'payer_enrollment_app',  -- Completed payer enrollment application
                                  'payer_contract',        -- Fully executed payer contract
                                  'w9',                    -- W-9 tax identification form
                                  'direct_deposit_form',   -- EFT/ACH direct deposit setup
                                  'exclusion_check',       -- OIG/SAM exclusion search result
                                  'background_check',      -- Background check report
                                  'training_certificate',  -- CEU or specialty training certificate
                                  'supervision_agreement', -- Signed supervision agreement
                                  'other'
                                )),
  document_name               TEXT NOT NULL,             -- Display name
  file_name                   TEXT,                      -- Original uploaded file name

  -- Storage reference
  storage_bucket              TEXT NOT NULL DEFAULT 'credentialing-documents',
  storage_path                TEXT NOT NULL,
  -- e.g. 'org_abc123/provider_xyz/state_license_2026.pdf'
  -- Supabase Storage bucket path; retrieve via signed URL or RLS
  file_size_bytes             BIGINT,
  mime_type                   TEXT,                      -- e.g. 'application/pdf'

  -- Document validity window
  issue_date                  DATE,
  expiration_date             DATE,
  is_expired                  BOOLEAN GENERATED ALWAYS AS (
                                expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE
                              ) STORED,

  -- Linkage to specific credentialing records
  linked_license_id           UUID REFERENCES provider_licenses(id) ON DELETE SET NULL,
  linked_dea_id               UUID REFERENCES provider_dea_registrations(id) ON DELETE SET NULL,
  linked_malpractice_id       UUID REFERENCES provider_malpractice_policies(id) ON DELETE SET NULL,
  linked_enrollment_id        UUID REFERENCES provider_enrollments(id) ON DELETE SET NULL,
  linked_contract_id          UUID REFERENCES payer_contracts(id) ON DELETE SET NULL,

  -- Verification
  verified                    BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at                 TIMESTAMPTZ,
  verification_notes          TEXT,

  uploaded_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creddocs_provider_id    ON credentialing_documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_creddocs_org_id         ON credentialing_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_creddocs_doc_type       ON credentialing_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_creddocs_expiration     ON credentialing_documents(expiration_date);
CREATE INDEX IF NOT EXISTS idx_creddocs_is_expired     ON credentialing_documents(is_expired);

ALTER TABLE credentialing_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creddocs_own_read"
  ON credentialing_documents FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "creddocs_org_read"
  ON credentialing_documents FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "creddocs_admin_write"
  ON credentialing_documents FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist')
  ));

CREATE POLICY "creddocs_own_upload"
  ON credentialing_documents FOR INSERT
  WITH CHECK (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE TRIGGER trg_creddocs_updated_at
  BEFORE UPDATE ON credentialing_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- TABLE 11: credentialing_alerts
--   Automated alerts generated by the platform for upcoming
--   credentialing deadlines, expirations, and required actions.
--   These surface in the admin credentialing dashboard and trigger
--   optional email/notification to the provider and admin.
--
--   Alert generation logic (run as a scheduled function or trigger):
--     - Check all tables above for items where:
--         expiration_date / due_date IS WITHIN alert threshold days
--     - Insert or upsert an alert row
--     - Mark resolved when the underlying record is updated to active/renewed
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS credentialing_alerts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider_id                 UUID REFERENCES providers(id) ON DELETE CASCADE,
  org_id                      UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Alert classification
  alert_type                  TEXT NOT NULL
                                CHECK (alert_type IN (
                                  'license_expiring',           -- State license within threshold
                                  'license_expired',            -- State license past expiry
                                  'dea_expiring',               -- DEA registration within threshold
                                  'dea_expired',                -- DEA past expiry
                                  'malpractice_expiring',       -- Malpractice policy within threshold
                                  'malpractice_expired',        -- Policy past expiry
                                  'caqh_attestation_due',       -- CAQH re-attestation overdue
                                  'caqh_profile_incomplete',    -- CAQH profile status not "complete"
                                  'caqh_not_authorized',        -- Provider has not authorized payers
                                  'enrollment_expiring',        -- Payer enrollment revalidation due
                                  'enrollment_not_started',     -- Enrollment should exist but does not
                                  'pecos_revalidation_due',     -- PECOS revalidation window open
                                  'contract_renewal_due',       -- Payer contract renewal approaching
                                  'contract_terminated',        -- Contract terminated (billing impacted)
                                  'recredentialing_due',        -- Payer-side recredentialing window
                                  'exclusion_check_overdue',    -- OIG/SAM check not run within 12 months
                                  'supervision_agreement_expired', -- Supervision agreement expired
                                  'document_expired',           -- A credentialing document has expired
                                  'tail_coverage_gap'           -- Claims-made gap risk detected
                                )),
  severity                    TEXT NOT NULL DEFAULT 'warning'
                                CHECK (severity IN ('info', 'warning', 'critical')),
  -- info: 90+ days out  |  warning: 31–89 days  |  critical: ≤30 days or already expired

  -- What triggered this alert
  subject_line                TEXT NOT NULL,   -- Human-readable: "LCSW License CO #12345 expires in 28 days"
  message_body                TEXT,            -- Extended detail / action guidance

  -- Deep links to the related record
  linked_table                TEXT,
  -- 'provider_licenses' | 'provider_dea_registrations' | 'provider_malpractice_policies' |
  -- 'provider_caqh_profiles' | 'provider_pecos_records' | 'provider_enrollments' |
  -- 'payer_contracts' | 'provider_contract_participations' | 'credentialing_documents'
  linked_record_id            UUID,            -- PK of the related row

  -- Key dates for context
  due_date                    DATE,            -- The deadline/expiry driving this alert
  days_until_due              INTEGER GENERATED ALWAYS AS (
                                CASE WHEN due_date IS NOT NULL
                                  THEN (due_date - CURRENT_DATE)
                                  ELSE NULL
                                END
                              ) STORED,

  -- Alert lifecycle
  status                      TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN (
                                  'open',       -- Active, requires action
                                  'snoozed',    -- User dismissed temporarily
                                  'resolved',   -- Underlying record renewed/fixed
                                  'dismissed'   -- Manually dismissed; won't re-trigger this cycle
                                )),
  snoozed_until               DATE,
  resolved_at                 TIMESTAMPTZ,
  resolved_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Notification tracking
  notified_at                 TIMESTAMPTZ,     -- When email/push was sent
  notified_provider           BOOLEAN NOT NULL DEFAULT FALSE,
  notified_admin              BOOLEAN NOT NULL DEFAULT FALSE,

  -- Idempotency key (prevents duplicate alerts for the same item + type)
  idempotency_key             TEXT UNIQUE,
  -- Suggested format: '{alert_type}__{linked_table}__{linked_record_id}__{due_date}'

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credalerts_provider_id   ON credentialing_alerts(provider_id);
CREATE INDEX IF NOT EXISTS idx_credalerts_org_id        ON credentialing_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_credalerts_type          ON credentialing_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_credalerts_severity      ON credentialing_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_credalerts_status        ON credentialing_alerts(status);
CREATE INDEX IF NOT EXISTS idx_credalerts_due_date      ON credentialing_alerts(due_date);
CREATE INDEX IF NOT EXISTS idx_credalerts_linked_rec    ON credentialing_alerts(linked_table, linked_record_id);

ALTER TABLE credentialing_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credalerts_own_read"
  ON credentialing_alerts FOR SELECT
  USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "credalerts_org_read"
  ON credentialing_alerts FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "credalerts_admin_write"
  ON credentialing_alerts FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'credentialing_specialist')
  ));

CREATE TRIGGER trg_credalerts_updated_at
  BEFORE UPDATE ON credentialing_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- BACK-FILL FOREIGN KEY CONSTRAINTS
--   Now that credentialing_documents exists, wire the FK columns
--   that were deferred in earlier tables.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE provider_malpractice_policies
  ADD CONSTRAINT fk_pmal_coi_doc
    FOREIGN KEY (coi_document_id)
    REFERENCES credentialing_documents(id)
    ON DELETE SET NULL;

ALTER TABLE payer_contracts
  ADD CONSTRAINT fk_pcontracts_fee_schedule_doc
    FOREIGN KEY (fee_schedule_document_id)
    REFERENCES credentialing_documents(id)
    ON DELETE SET NULL;

ALTER TABLE payer_contracts
  ADD CONSTRAINT fk_pcontracts_contract_doc
    FOREIGN KEY (contract_document_id)
    REFERENCES credentialing_documents(id)
    ON DELETE SET NULL;


-- ══════════════════════════════════════════════════════════════════
-- TRIGGER: auto-generate credentialing_alerts on UPDATE/INSERT
--   Lightweight triggers on key tables to upsert alerts when
--   expiration dates change.  Uses ON CONFLICT on idempotency_key
--   to avoid duplicates.
-- ══════════════════════════════════════════════════════════════════

-- License expiry alert trigger
CREATE OR REPLACE FUNCTION fn_alert_on_license_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_days_until INTEGER;
  v_severity   TEXT;
  v_ikey       TEXT;
BEGIN
  IF NEW.expiration_date IS NULL THEN RETURN NEW; END IF;
  v_days_until := (NEW.expiration_date - CURRENT_DATE);
  IF    v_days_until <= 30   THEN v_severity := 'critical';
  ELSIF v_days_until <= 89   THEN v_severity := 'warning';
  ELSIF v_days_until <= 180  THEN v_severity := 'info';
  ELSE RETURN NEW; END IF;  -- Not within alert window yet

  v_ikey := 'license_expiring__provider_licenses__' || NEW.id::text || '__' || NEW.expiration_date::text;

  INSERT INTO credentialing_alerts (
    provider_id, org_id, alert_type, severity,
    subject_line, message_body,
    linked_table, linked_record_id, due_date,
    status, idempotency_key
  ) VALUES (
    NEW.provider_id, NEW.org_id,
    CASE WHEN v_days_until < 0 THEN 'license_expired' ELSE 'license_expiring' END,
    v_severity,
    NEW.license_type || ' license (' || COALESCE(NEW.license_number,'') || ') '
      || CASE WHEN v_days_until < 0 THEN 'expired ' || ABS(v_days_until)::text || ' days ago'
              ELSE 'expires in ' || v_days_until::text || ' days'
         END,
    'License state: ' || NEW.license_state || '. Status: ' || NEW.status || '.',
    'provider_licenses', NEW.id, NEW.expiration_date,
    'open', v_ikey
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET severity    = EXCLUDED.severity,
        subject_line = EXCLUDED.subject_line,
        updated_at  = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_license_alert
  AFTER INSERT OR UPDATE OF expiration_date, status
  ON provider_licenses
  FOR EACH ROW EXECUTE FUNCTION fn_alert_on_license_change();


-- Malpractice expiry alert trigger
CREATE OR REPLACE FUNCTION fn_alert_on_malpractice_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_days_until INTEGER;
  v_severity   TEXT;
  v_ikey       TEXT;
BEGIN
  IF NEW.expiration_date IS NULL THEN RETURN NEW; END IF;
  v_days_until := (NEW.expiration_date - CURRENT_DATE);
  IF    v_days_until <= 30  THEN v_severity := 'critical';
  ELSIF v_days_until <= 89  THEN v_severity := 'warning';
  ELSIF v_days_until <= 180 THEN v_severity := 'info';
  ELSE RETURN NEW; END IF;

  v_ikey := 'malpractice_expiring__provider_malpractice_policies__' || NEW.id::text || '__' || NEW.expiration_date::text;

  INSERT INTO credentialing_alerts (
    provider_id, org_id, alert_type, severity,
    subject_line, message_body,
    linked_table, linked_record_id, due_date,
    status, idempotency_key
  ) VALUES (
    NEW.provider_id, NEW.org_id,
    CASE WHEN v_days_until < 0 THEN 'malpractice_expired' ELSE 'malpractice_expiring' END,
    v_severity,
    'Malpractice policy (' || NEW.insurer_name || ' #' || NEW.policy_number || ') '
      || CASE WHEN v_days_until < 0 THEN 'expired ' || ABS(v_days_until)::text || ' days ago'
              ELSE 'expires in ' || v_days_until::text || ' days'
         END,
    'Coverage type: ' || NEW.coverage_type || '. Per-occurrence: $' || NEW.per_occurrence_limit::text || '.',
    'provider_malpractice_policies', NEW.id, NEW.expiration_date,
    'open', v_ikey
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET severity     = EXCLUDED.severity,
        subject_line = EXCLUDED.subject_line,
        updated_at   = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_malpractice_alert
  AFTER INSERT OR UPDATE OF expiration_date, status
  ON provider_malpractice_policies
  FOR EACH ROW EXECUTE FUNCTION fn_alert_on_malpractice_change();


-- DEA expiry alert trigger
CREATE OR REPLACE FUNCTION fn_alert_on_dea_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_days_until INTEGER;
  v_severity   TEXT;
  v_ikey       TEXT;
BEGIN
  IF NEW.expiration_date IS NULL THEN RETURN NEW; END IF;
  v_days_until := (NEW.expiration_date - CURRENT_DATE);
  IF    v_days_until <= 30  THEN v_severity := 'critical';
  ELSIF v_days_until <= 89  THEN v_severity := 'warning';
  ELSIF v_days_until <= 180 THEN v_severity := 'info';
  ELSE RETURN NEW; END IF;

  v_ikey := 'dea_expiring__provider_dea_registrations__' || NEW.id::text || '__' || NEW.expiration_date::text;

  INSERT INTO credentialing_alerts (
    provider_id, org_id, alert_type, severity,
    subject_line, message_body,
    linked_table, linked_record_id, due_date,
    status, idempotency_key
  ) VALUES (
    NEW.provider_id, NEW.org_id,
    CASE WHEN v_days_until < 0 THEN 'dea_expired' ELSE 'dea_expiring' END,
    v_severity,
    'DEA registration (' || NEW.dea_number || ') '
      || CASE WHEN v_days_until < 0 THEN 'expired ' || ABS(v_days_until)::text || ' days ago'
              ELSE 'expires in ' || v_days_until::text || ' days'
         END,
    'State: ' || NEW.registration_state || '. Schedules: ' || array_to_string(NEW.schedules_authorized, ', ') || '.',
    'provider_dea_registrations', NEW.id, NEW.expiration_date,
    'open', v_ikey
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET severity     = EXCLUDED.severity,
        subject_line = EXCLUDED.subject_line,
        updated_at   = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dea_alert
  AFTER INSERT OR UPDATE OF expiration_date, status
  ON provider_dea_registrations
  FOR EACH ROW EXECUTE FUNCTION fn_alert_on_dea_change();


-- ══════════════════════════════════════════════════════════════════
-- USEFUL VIEWS
-- ══════════════════════════════════════════════════════════════════

-- View: credentialing_status_summary
--   One row per provider showing the status of all key credential
--   categories.  Used by the admin credentialing dashboard.
CREATE OR REPLACE VIEW credentialing_status_summary AS
SELECT
  p.id                                          AS provider_id,
  p.org_id,
  p.first_name || ' ' || p.last_name           AS provider_name,
  p.credential,
  p.npi,

  -- Most recently expiring active license
  (SELECT expiration_date FROM provider_licenses l
   WHERE l.provider_id = p.id AND l.status = 'active'
   ORDER BY expiration_date ASC LIMIT 1)       AS soonest_license_exp,

  -- DEA status
  (SELECT status FROM provider_dea_registrations d
   WHERE d.provider_id = p.id ORDER BY expiration_date DESC LIMIT 1)
                                                AS dea_status,
  (SELECT expiration_date FROM provider_dea_registrations d
   WHERE d.provider_id = p.id ORDER BY expiration_date DESC LIMIT 1)
                                                AS dea_exp,

  -- Malpractice
  (SELECT status FROM provider_malpractice_policies m
   WHERE m.provider_id = p.id ORDER BY expiration_date DESC LIMIT 1)
                                                AS malpractice_status,
  (SELECT expiration_date FROM provider_malpractice_policies m
   WHERE m.provider_id = p.id ORDER BY expiration_date DESC LIMIT 1)
                                                AS malpractice_exp,

  -- CAQH
  (SELECT profile_status FROM provider_caqh_profiles c
   WHERE c.provider_id = p.id LIMIT 1)         AS caqh_status,
  (SELECT next_attestation_due_date FROM provider_caqh_profiles c
   WHERE c.provider_id = p.id LIMIT 1)         AS caqh_attestation_due,

  -- PECOS
  (SELECT status FROM provider_pecos_records pc
   WHERE pc.provider_id = p.id LIMIT 1)        AS pecos_status,

  -- CO Medicaid enrollment
  (SELECT status FROM provider_enrollments e
   WHERE e.provider_id = p.id AND e.payer_type = 'medicaid'
   ORDER BY created_at DESC LIMIT 1)           AS medicaid_enrollment_status,

  -- Open alerts
  (SELECT COUNT(*) FROM credentialing_alerts ca
   WHERE ca.provider_id = p.id AND ca.status = 'open'
     AND ca.severity = 'critical')::INTEGER      AS critical_alerts,
  (SELECT COUNT(*) FROM credentialing_alerts ca
   WHERE ca.provider_id = p.id AND ca.status = 'open'
     AND ca.severity = 'warning')::INTEGER       AS warning_alerts

FROM providers p
WHERE p.is_active = TRUE;


-- View: upcoming_expirations (next 90 days)
--   Used by billing alerts integration to surface expiry risk.
CREATE OR REPLACE VIEW upcoming_credential_expirations AS
SELECT
  'license'             AS credential_type,
  pl.id                 AS record_id,
  pl.provider_id,
  pl.org_id,
  p.first_name || ' ' || p.last_name AS provider_name,
  pl.license_type       AS item_name,
  pl.license_number     AS identifier,
  pl.expiration_date,
  (pl.expiration_date - CURRENT_DATE) AS days_until_expiry
FROM provider_licenses pl
JOIN providers p ON p.id = pl.provider_id
WHERE pl.status = 'active'
  AND pl.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'

UNION ALL

SELECT
  'dea', pd.id, pd.provider_id, pd.org_id,
  p.first_name || ' ' || p.last_name,
  'DEA Registration', pd.dea_number, pd.expiration_date,
  (pd.expiration_date - CURRENT_DATE)
FROM provider_dea_registrations pd
JOIN providers p ON p.id = pd.provider_id
WHERE pd.status = 'active'
  AND pd.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'

UNION ALL

SELECT
  'malpractice', pm.id, pm.provider_id, pm.org_id,
  p.first_name || ' ' || p.last_name,
  'Malpractice Policy', pm.policy_number, pm.expiration_date,
  (pm.expiration_date - CURRENT_DATE)
FROM provider_malpractice_policies pm
JOIN providers p ON p.id = pm.provider_id
WHERE pm.status = 'active'
  AND pm.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'

UNION ALL

SELECT
  'enrollment', pe.id, pe.provider_id, pe.org_id,
  p.first_name || ' ' || p.last_name,
  'Enrollment (' || pe.payer_name || ')', pe.payer_provider_id::text, pe.revalidation_due_date,
  (pe.revalidation_due_date - CURRENT_DATE)
FROM provider_enrollments pe
JOIN providers p ON p.id = pe.provider_id
WHERE pe.status = 'approved'
  AND pe.revalidation_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'

ORDER BY days_until_expiry ASC;
