-- ============================================================
-- THERASSISTANT — Patient Insurance & COB Schema         v1.0
-- Colorado Medicaid Behavioral Health Billing Platform
--
-- Covers:
--   Section  1  patients                    (ALTER — adds MRN, account number, updated_by)
--   Section  2  patient_demographics_extended  SDOH, disability, veteran, housing
--   Section  3  guarantors                  (ALTER — adds audit, soft delete)
--   Section  4  insurance_payers            Master payer registry
--   Section  5  payer_ids                   Clearinghouse / EDI payer ID mappings
--   Section  6  payer_addresses             Submission, remit, appeals, eligibility
--   Section  7  subscribers                 Subscriber identity (self or third-party)
--   Section  8  patient_subscriber_relationships  Patient ↔ subscriber link + CMS Box 6
--   Section  9  insurance_policies          (ALTER — adds payer FK, subscriber FK,
--                                            audit, soft delete, secondary/tertiary
--                                            COB coordination fields)
--   Section 10  cob_setups                  COB order determination per patient
--   Section 11  cob_claim_records           Per-claim COB tracking (primary → secondary)
--   Section 12  Indexes, triggers, RLS
--
-- Dependencies (must run first):
--   auth-schema.sql                → auth.users, organizations
--   admin-clients-schema.sql       → clinician_accounts
--   patient-scheduling-schema.sql  → patients, guarantors, insurance_policies
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- SHARED HELPERS
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- SHARED ENUM TYPES
-- ════════════════════════════════════════════════════════════

-- CMS-1500 Box 6 / X12 837P Loop 2010CA REL-02 relationship codes
CREATE TYPE subscriber_relationship_type AS ENUM (
  'self',          -- 18
  'spouse',        -- 01
  'child',         -- 19
  'other',         -- G8
  'employee',      -- 21 (self-employed)
  'unknown'        -- codes not yet mapped
);

-- Policy priority tier (mirrors policy_order INT in insurance_policies)
CREATE TYPE insurance_tier AS ENUM ('primary', 'secondary', 'tertiary');

-- Insurance / payer classification
CREATE TYPE payer_category AS ENUM (
  'medicaid',
  'medicaid_managed_care',
  'medicare_part_b',
  'medicare_advantage',
  'commercial',
  'chip_chp_plus',
  'tricare',
  'workers_comp',
  'auto_liability',
  'self_pay',
  'sliding_scale',
  'grant_funded',
  'other'
);

-- Address purpose for a payer
CREATE TYPE payer_address_type AS ENUM (
  'claims_submission',
  'electronic_remittance',
  'paper_remittance',
  'appeals',
  'eligibility',
  'credentialing',
  'provider_relations',
  'general'
);


-- ════════════════════════════════════════════════════════════
-- SECTION 1 — PATIENTS (Extended)
-- Extends patient-scheduling-schema.sql patients with
-- MRN, account number, updated_by, and intake metadata.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: patients (ALTER — additive extension)
--
-- Purpose:
--   Adds billing-critical identifiers missing from the base
--   table: medical record number (MRN), practice account
--   number, COB active flag, and full audit trail.
--
-- New Fields:
--   mrn                  Internal medical record number (auto-assigned)
--   account_number       Billing account number (may differ from MRN)
--   updated_by           FK to auth.users — who last updated the record
--   has_active_cob       TRUE if patient has 2+ active insurance policies
--   date_of_death        For deceased patient claims processing
--   primary_payer_id     Quick FK to primary insurance_payer (denormalized)
-- ──────────────────────────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS mrn                    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS account_number         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS has_active_cob         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS date_of_death          DATE,
  ADD COLUMN IF NOT EXISTS primary_payer_id       UUID,  -- FK to insurance_payers(id), set post-insert
  ADD COLUMN IF NOT EXISTS updated_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Sequence for auto-generated MRN: MRN-YYYY-NNNNNN
CREATE SEQUENCE IF NOT EXISTS mrn_seq START 1000;

-- Auto-assign MRN on insert if not provided
CREATE OR REPLACE FUNCTION assign_patient_mrn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.mrn IS NULL THEN
    NEW.mrn := 'MRN-' || to_char(now(), 'YYYY') || '-' ||
               lpad(nextval('mrn_seq')::TEXT, 6, '0');
  END IF;
  IF NEW.account_number IS NULL THEN
    NEW.account_number := 'ACCT-' || to_char(now(), 'YYYY') || '-' ||
                          lpad(nextval('mrn_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_patient_mrn
  BEFORE INSERT ON patients
  FOR EACH ROW EXECUTE FUNCTION assign_patient_mrn();

CREATE INDEX IF NOT EXISTS idx_patients_mrn
  ON patients(mrn) WHERE mrn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_account
  ON patients(account_number) WHERE account_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_cob
  ON patients(has_active_cob) WHERE has_active_cob = TRUE;


-- ════════════════════════════════════════════════════════════
-- SECTION 2 — PATIENT DEMOGRAPHICS EXTENDED
-- Supplemental demographic and SDOH data for population
-- health, grant reporting, and HRSN screening.
-- One row per patient; extends the patients table.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: patient_demographics_extended
--
-- Purpose:
--   Captures Social Determinants of Health (SDOH), disability
--   status, veteran status, housing stability, and language
--   access needs that drive Colorado Medicaid reporting
--   and APM/VBP performance measures.
--
--   Stored separately from patients to minimize PHI exposure
--   in contexts not requiring SDOH data (e.g., billing views).
--
-- Colorado Medicaid Reporting Fields:
--   race_code / ethnicity_code   OMB categories (used in UDS / APM reporting)
--   housing_status               AHC HRSN screening Item 1
--   food_insecurity              AHC HRSN screening Item 10
--   transportation_barrier       AHC HRSN screening Item 11
--   interpersonal_safety         AHC HRSN screening Item 12-13
--   utility_needs                AHC HRSN screening Item
--   ace_score                    Adverse Childhood Events (0-10)
--
-- Required for Colorado Behavioral Health Medicaid Reporting:
--   race_code, ethnicity_code, primary_language, interpreter_needed
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_demographics_extended (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,

  -- ── Extended Race / Ethnicity (OMB 2024 categories) ──────
  race_code                   TEXT,            -- OMB: W, B, A, AIAN, NHOPI, M, Unk
  race_label                  TEXT,
  detailed_race               TEXT,            -- Sub-category (e.g. "Chinese", "Filipino")
  ethnicity_code              TEXT,            -- Hispanic/Latino, Not Hispanic/Latino, Unknown
  ethnicity_label             TEXT,
  country_of_origin           TEXT,
  years_in_us                 SMALLINT,
  us_born                     BOOLEAN,

  -- ── Language Access ───────────────────────────────────────
  primary_language_code       TEXT,            -- BCP-47 language code (en, es, so, vi, etc.)
  primary_language_label      TEXT,
  secondary_language_code     TEXT,
  interpreter_needed          BOOLEAN NOT NULL DEFAULT FALSE,
  interpreter_type            TEXT
    CHECK (interpreter_type IN ('in_person','phone','video','none','unknown')),
  asl_needed                  BOOLEAN DEFAULT FALSE,  -- American Sign Language

  -- ── Disability Status ─────────────────────────────────────
  has_disability              BOOLEAN DEFAULT FALSE,
  disability_type             TEXT[],    -- 'physical','cognitive','sensory','psychiatric','other'
  ada_accommodations_needed   BOOLEAN DEFAULT FALSE,
  ada_accommodation_notes     TEXT,

  -- ── Veteran / Military Status ─────────────────────────────
  veteran_status              TEXT
    CHECK (veteran_status IN (
      'not_veteran','active_duty','veteran_honorable','veteran_other',
      'national_guard','reserve','unknown','prefer_not_to_say'
    )),
  branch_of_service           TEXT,
  combat_exposure             BOOLEAN DEFAULT FALSE,
  tricare_eligible            BOOLEAN DEFAULT FALSE,
  va_enrolled                 BOOLEAN DEFAULT FALSE,

  -- ── Housing Stability (AHC HRSN Item 1) ───────────────────
  housing_status              TEXT
    CHECK (housing_status IN (
      'stable_owned','stable_rented','unstable_couch_surfing',
      'shelter','unsheltered','transitional','hotel','sober_living',
      'group_home','board_and_care','unknown'
    )),
  housing_concern             BOOLEAN DEFAULT FALSE,   -- "Worried about losing housing"
  housing_concern_detail      TEXT,
  homeless_episode_past_year  BOOLEAN DEFAULT FALSE,

  -- ── Food Insecurity (AHC HRSN Item 10) ───────────────────
  food_insecurity             TEXT
    CHECK (food_insecurity IN ('none','sometimes','often','unknown')),
  snap_enrolled               BOOLEAN DEFAULT FALSE,
  wic_enrolled                BOOLEAN DEFAULT FALSE,

  -- ── Transportation (AHC HRSN Item 11) ────────────────────
  transportation_barrier      BOOLEAN DEFAULT FALSE,
  transportation_type         TEXT,

  -- ── Utilities (AHC HRSN) ─────────────────────────────────
  utility_shutoff_threat      BOOLEAN DEFAULT FALSE,

  -- ── Interpersonal Safety (AHC HRSN Items 12–13) ──────────
  interpersonal_safety_concern BOOLEAN DEFAULT FALSE,  -- PHQ-related safety screening

  -- ── Education / Employment ────────────────────────────────
  highest_education           TEXT
    CHECK (highest_education IN (
      'no_formal','some_hs','hs_diploma_ged','some_college',
      'associates','bachelors','graduate','professional','unknown'
    )),
  employment_status           TEXT,    -- mirrors patients.employment_status
  employer_industry           TEXT,

  -- ── Adverse Childhood Events ──────────────────────────────
  ace_screen_completed        BOOLEAN DEFAULT FALSE,
  ace_screen_date             DATE,
  ace_score                   SMALLINT CHECK (ace_score BETWEEN 0 AND 10),

  -- ── Colorado-Specific HCPF Fields ─────────────────────────
  hcpf_rcco_region            TEXT,    -- RCCO region code
  hcpf_rae_region             TEXT,    -- RAE (Regional Accountable Entity) region
  medicaid_aid_category       TEXT,    -- CO Medicaid aid category code
  foster_care_youth           BOOLEAN DEFAULT FALSE,
  justice_involved            BOOLEAN DEFAULT FALSE,
  self_directed               BOOLEAN DEFAULT FALSE,    -- Self-directed waiver participant

  -- ── HIPAA / 42 CFR Flags ──────────────────────────────────
  contains_42_cfr_pt2_data    BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Status ────────────────────────────────────────────────
  last_updated_source         TEXT DEFAULT 'intake_form'
    CHECK (last_updated_source IN (
      'intake_form','clinical_update','import','patient_portal','admin'
    )),

  -- ── Soft Delete ───────────────────────────────────────────
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (patient_id)
);

CREATE INDEX IF NOT EXISTS idx_demographics_patient
  ON patient_demographics_extended(patient_id);

CREATE INDEX IF NOT EXISTS idx_demographics_org
  ON patient_demographics_extended(org_id);

CREATE INDEX IF NOT EXISTS idx_demographics_race
  ON patient_demographics_extended(race_code);

CREATE INDEX IF NOT EXISTS idx_demographics_housing
  ON patient_demographics_extended(housing_status);

CREATE INDEX IF NOT EXISTS idx_demographics_veteran
  ON patient_demographics_extended(veteran_status)
  WHERE veteran_status NOT IN ('not_veteran','unknown');


-- ════════════════════════════════════════════════════════════
-- SECTION 3 — GUARANTORS (Extended)
-- Extends patient-scheduling-schema.sql guarantors with
-- full audit trail and soft delete support.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: guarantors (ALTER — additive extension)
-- ──────────────────────────────────────────────────────────
ALTER TABLE guarantors
  ADD COLUMN IF NOT EXISTS updated_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active              BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_guarantors_active
  ON guarantors(patient_id, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_guarantors_deleted
  ON guarantors(deleted_at) WHERE deleted_at IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- SECTION 4 — INSURANCE PAYERS
-- Master registry of insurance companies and government
-- health programs.  Shared across all organizations in the
-- platform.  Contains billing/electronic transaction identity,
-- Colorado-specific Medicaid program classification, and
-- behavioral health carve-out information.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: insurance_payers
--
-- Purpose:
--   Authoritative payer registry that normalizes the payer_name
--   TEXT field currently stored on insurance_policies.
--   Each row represents one insurance company or government
--   health program entity.
--
--   is_system_record = TRUE rows are maintained by THERASSISTANT
--   and shared across all organizations.
--   Organizations may create private payer records (is_system_record = FALSE).
--
-- Key Fields:
--   payer_code           Internal short code ('co_medicaid_ffs', 'bcbs_co', etc.)
--   national_payer_id    CMS National Plan and Provider Enumeration System payer ID
--   cms_certification_number  CMS-assigned number for Medicare/Medicaid payers
--   is_colorado_medicaid       Drives Medicaid-specific claim rules
--   is_medicaid_managed_care   MCO/RAE that manages Medicaid lives
--   bh_carve_out        TRUE when behavioral health is carved out to a separate entity
--   bh_payer_id         FK to the BH carve-out payer (for medical-BH different payers)
--
-- Relationships:
--   payer_ids       → payer_ids(payer_id)
--   payer_addresses → payer_addresses(payer_id)
--   payer_contracts (credentialing-schema) links via payer_name or payer_id FK
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_payers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      TEXT REFERENCES clinician_accounts(id) ON DELETE SET NULL,
  -- NULL = system-wide shared record; non-null = org-specific private payer

  -- ── Identity ─────────────────────────────────────────────
  payer_name                  TEXT NOT NULL,          -- "Health First Colorado (Medicaid)"
  payer_code                  TEXT UNIQUE,            -- 'co_medicaid_ffs', 'aetna_bh', etc.
  short_name                  TEXT,                   -- "CO Medicaid", "Aetna BH"
  legal_name                  TEXT,
  doing_business_as           TEXT,
  payer_category              payer_category NOT NULL DEFAULT 'commercial',

  -- ── National / Federal IDs ────────────────────────────────
  national_payer_id           TEXT,                   -- MPID / NPPES national payer ID
  cms_certification_number    TEXT,                   -- CMS CCN
  tin                         TEXT,                   -- Payer tax ID for remittance
  naic_code                   TEXT,                   -- Insurance dept registration code

  -- ── Colorado Medicaid / RAE Flags ────────────────────────
  is_colorado_medicaid        BOOLEAN NOT NULL DEFAULT FALSE,
  is_medicaid_managed_care    BOOLEAN NOT NULL DEFAULT FALSE,
  medicaid_program_type       TEXT
    CHECK (medicaid_program_type IN (
      'ffs',               -- Health First Colorado FFS (HCPF direct)
      'acc_phase3',         -- Accountable Care Collaborative Phase 3 (RAE)
      'bh_capitation',      -- BH Capitation program
      'chp_plus',           -- Child Health Plan Plus
      'long_term_care',     -- LTSS waiver
      'foster_care',        -- Foster Care Medicaid
      'not_applicable'
    )),
  rae_region                  TEXT,                   -- RAE region name/code
  rcco_name                   TEXT,                   -- Legacy RCCO name (pre-ACC Phase 3)

  -- ── Behavioral Health Carve-Out ───────────────────────────
  bh_carve_out                BOOLEAN NOT NULL DEFAULT FALSE,
  bh_payer_id                 UUID REFERENCES insurance_payers(id) ON DELETE SET NULL,
  -- ^ when TRUE, BH claims go to this other payer

  -- ── Electronic Transaction Capabilities ──────────────────
  accepts_edi_837p            BOOLEAN NOT NULL DEFAULT TRUE,   -- Professional claims
  accepts_edi_837i            BOOLEAN DEFAULT FALSE,           -- Institutional claims
  accepts_edi_270_271         BOOLEAN NOT NULL DEFAULT TRUE,   -- Eligibility
  accepts_edi_276_277         BOOLEAN DEFAULT TRUE,            -- Claim status
  accepts_edi_835             BOOLEAN NOT NULL DEFAULT TRUE,   -- ERA/remittance
  accepts_edi_278             BOOLEAN DEFAULT FALSE,           -- Prior auth

  -- ── Claims Filing Rules ───────────────────────────────────
  timely_filing_days          INTEGER DEFAULT 365,   -- Days from DOS to file initial claim
  timely_appeal_days          INTEGER DEFAULT 180,   -- Days from denial to file appeal
  corrected_claim_days        INTEGER DEFAULT 365,
  requires_prior_auth_bh      BOOLEAN DEFAULT FALSE,
  requires_referral_bh        BOOLEAN DEFAULT FALSE,
  accepts_telehealth          BOOLEAN DEFAULT TRUE,
  telehealth_modifier_required TEXT,               -- 'GT', '95', 'GQ', etc.
  requires_npi_on_claim       BOOLEAN NOT NULL DEFAULT TRUE,
  requires_taxonomy_on_claim  BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Clearinghouse Preferences ────────────────────────────
  preferred_clearinghouse     TEXT
    CHECK (preferred_clearinghouse IN ('availity','waystar','officeally','trizetto','other')),

  -- ── Contact ───────────────────────────────────────────────
  provider_services_phone     TEXT,
  provider_services_fax       TEXT,
  provider_portal_url         TEXT,
  eligibility_phone           TEXT,
  prior_auth_phone            TEXT,
  appeal_phone                TEXT,
  appeal_fax                  TEXT,

  -- ── Record Management ─────────────────────────────────────
  is_system_record            BOOLEAN NOT NULL DEFAULT TRUE,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  notes                       TEXT,

  -- ── Soft Delete ───────────────────────────────────────────
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payers_code
  ON insurance_payers(payer_code) WHERE payer_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payers_category
  ON insurance_payers(payer_category);

CREATE INDEX IF NOT EXISTS idx_payers_co_medicaid
  ON insurance_payers(is_colorado_medicaid) WHERE is_colorado_medicaid = TRUE;

CREATE INDEX IF NOT EXISTS idx_payers_active
  ON insurance_payers(is_active);

CREATE INDEX IF NOT EXISTS idx_payers_org
  ON insurance_payers(org_id) WHERE org_id IS NOT NULL;

-- ── System-seeded payers (Colorado Medicaid + major BH payers) ───────────────

INSERT INTO insurance_payers
  (payer_name, payer_code, short_name, payer_category,
   is_colorado_medicaid, is_medicaid_managed_care, medicaid_program_type,
   timely_filing_days, timely_appeal_days,
   accepts_edi_837p, accepts_edi_270_271, accepts_edi_835,
   preferred_clearinghouse, provider_services_phone, eligibility_phone,
   is_system_record, is_active)
VALUES
  -- Colorado Medicaid FFS (HCPF)
  ('Health First Colorado (Medicaid FFS)', 'co_medicaid_ffs',
   'CO Medicaid FFS', 'medicaid',
   TRUE, FALSE, 'ffs',
   365, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-844-235-2387', '1-844-235-2387',
   TRUE, TRUE),

  -- ACC Phase 3 / RAE (managed Medicaid)
  ('Colorado Access (RAE 3 & 4)', 'co_access_rae34',
   'Colorado Access', 'medicaid_managed_care',
   TRUE, TRUE, 'acc_phase3',
   365, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-866-333-6789', '1-866-333-6789',
   TRUE, TRUE),

  ('Rocky Mountain Health Plans (RAE 1)', 'rmhp_rae1',
   'RMHP RAE', 'medicaid_managed_care',
   TRUE, TRUE, 'acc_phase3',
   365, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-800-609-7647', '1-800-609-7647',
   TRUE, TRUE),

  ('Northeast Health Partners (RAE 2)', 'nhp_rae2',
   'NHP RAE', 'medicaid_managed_care',
   TRUE, TRUE, 'acc_phase3',
   365, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-855-444-3747', '1-855-444-3747',
   TRUE, TRUE),

  ('Anthem BCBS Colorado Medicaid (RAE 5)', 'anthem_rae5',
   'Anthem RAE', 'medicaid_managed_care',
   TRUE, TRUE, 'acc_phase3',
   365, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-855-396-0092', '1-855-396-0092',
   TRUE, TRUE),

  -- CHP+
  ('Child Health Plan Plus (CHP+)', 'co_chp_plus',
   'CHP+', 'chip_chp_plus',
   TRUE, FALSE, 'chp_plus',
   365, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-800-359-1991', '1-800-359-1991',
   TRUE, TRUE),

  -- Medicare Part B
  ('Medicare Part B (Novitas Solutions / CGS)', 'medicare_part_b',
   'Medicare', 'medicare_part_b',
   FALSE, FALSE, NULL,
   365, 120,
   TRUE, TRUE, TRUE, 'availity',
   '1-855-518-0022', '1-855-518-0022',
   TRUE, TRUE),

  -- Major commercial payers
  ('Aetna Better Health of Colorado', 'aetna_bh_co',
   'Aetna BH', 'medicaid_managed_care',
   TRUE, TRUE, 'acc_phase3',
   365, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-855-242-0802', '1-855-242-0802',
   TRUE, TRUE),

  ('Anthem Blue Cross Blue Shield of Colorado', 'anthem_bcbs_co',
   'Anthem BCBS', 'commercial',
   FALSE, FALSE, NULL,
   180, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-855-396-0092', '1-855-396-0092',
   TRUE, TRUE),

  ('United Behavioral Health (Optum)', 'united_bh',
   'United BH', 'commercial',
   FALSE, FALSE, NULL,
   180, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-800-888-2998', '1-888-362-3368',
   TRUE, TRUE),

  ('Cigna Behavioral Health', 'cigna_bh',
   'Cigna BH', 'commercial',
   FALSE, FALSE, NULL,
   180, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-800-274-7603', '1-800-274-7603',
   TRUE, TRUE),

  ('Humana Behavioral Health', 'humana_bh',
   'Humana BH', 'commercial',
   FALSE, FALSE, NULL,
   180, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-800-444-9730', '1-800-444-9730',
   TRUE, TRUE),

  ('TriCare / Defense Health Agency', 'tricare',
   'TriCare', 'tricare',
   FALSE, FALSE, NULL,
   365, 180,
   TRUE, TRUE, TRUE, 'availity',
   '1-888-874-9378', '1-888-874-9378',
   TRUE, TRUE),

  ('Self Pay', 'self_pay',
   'Self Pay', 'self_pay',
   FALSE, FALSE, NULL,
   NULL, NULL,
   FALSE, FALSE, FALSE, NULL,
   NULL, NULL,
   TRUE, TRUE),

  ('Sliding Scale', 'sliding_scale',
   'Sliding Scale', 'sliding_scale',
   FALSE, FALSE, NULL,
   NULL, NULL,
   FALSE, FALSE, FALSE, NULL,
   NULL, NULL,
   TRUE, TRUE)

ON CONFLICT (payer_code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- SECTION 5 — PAYER IDS
-- Maps each payer to its clearinghouse-specific EDI payer ID.
-- A single payer may have different IDs on Availity, Waystar,
-- OfficeAlly, etc. and for different transaction types.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: payer_ids
--
-- Purpose:
--   Clearinghouse / EDI payer number per payer per transaction type.
--   Required when submitting electronic claims via 837P or
--   triggering real-time eligibility (270/271) through a
--   clearinghouse.  One row per payer–clearinghouse–transaction
--   type combination.
--
-- Key Fields:
--   payer_id              → insurance_payers(id)
--   clearinghouse         The clearinghouse routing this transaction
--   edi_payer_id          The 2–10 character ID used in the ISA/GS/NM1 loop
--   transaction_type      Claims, eligibility, status, ERA, prior auth
--   loop_segment          837P loop where this ID appears (e.g., '2010B NM109')
--
-- Required for Colorado Medicaid FFS EDI:
--   clearinghouse = 'availity'
--   edi_payer_id  = 'SKCO0' (professional claims to HCPF)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payer_ids (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id                    UUID NOT NULL REFERENCES insurance_payers(id) ON DELETE CASCADE,

  -- ── EDI Routing ───────────────────────────────────────────
  clearinghouse               TEXT NOT NULL
    CHECK (clearinghouse IN (
      'availity','waystar','officeally','trizetto',
      'change_healthcare','direct_payer','other'
    )),
  edi_payer_id                TEXT NOT NULL,   -- The actual payer number used in EDI
  payer_name_override         TEXT,            -- If payer name differs at this clearinghouse

  -- ── Transaction type ─────────────────────────────────────
  transaction_type            TEXT NOT NULL
    CHECK (transaction_type IN (
      'claims_837p',                -- Professional claim
      'claims_837i',                -- Institutional claim
      'eligibility_270_271',        -- Real-time eligibility
      'claim_status_276_277',       -- Claim status inquiry
      'remittance_835',             -- ERA / electronic remittance
      'prior_auth_278',             -- Prior authorization
      'all'
    )),

  -- ── 837P Loop Reference ───────────────────────────────────
  loop_segment                TEXT,    -- e.g. '2010B NM109', '2010B N4', 'GS03'

  -- ── Validation ────────────────────────────────────────────
  is_verified                 BOOLEAN NOT NULL DEFAULT FALSE,
  last_verified_at            TIMESTAMPTZ,
  verified_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_notes          TEXT,

  -- ── Status ────────────────────────────────────────────────
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date              DATE,
  expiration_date             DATE,
  notes                       TEXT,

  -- ── Soft Delete ───────────────────────────────────────────
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (payer_id, clearinghouse, transaction_type)
);

CREATE INDEX IF NOT EXISTS idx_payer_ids_payer
  ON payer_ids(payer_id);

CREATE INDEX IF NOT EXISTS idx_payer_ids_clearinghouse
  ON payer_ids(clearinghouse, edi_payer_id);

CREATE INDEX IF NOT EXISTS idx_payer_ids_active
  ON payer_ids(is_active);

-- ── Seed EDI payer IDs for Colorado Medicaid (Availity) ──────────────────────

INSERT INTO payer_ids
  (payer_id, clearinghouse, edi_payer_id, transaction_type, is_verified, is_active)
SELECT
  p.id,
  v.clearinghouse,
  v.edi_payer_id,
  v.transaction_type,
  TRUE,
  TRUE
FROM insurance_payers p
CROSS JOIN (VALUES
  ('co_medicaid_ffs', 'availity', 'SKCO0',  'claims_837p'),
  ('co_medicaid_ffs', 'availity', 'SKCO0',  'eligibility_270_271'),
  ('co_medicaid_ffs', 'officeally','COLO1', 'claims_837p'),
  ('medicare_part_b', 'availity', '01192',  'claims_837p'),
  ('medicare_part_b', 'availity', '01192',  'eligibility_270_271'),
  ('anthem_bcbs_co',  'availity', 'BC001',  'all'),
  ('united_bh',       'availity', '87726',  'all'),
  ('cigna_bh',        'availity', '62308',  'all'),
  ('tricare',         'availity', 'TRIS0',  'claims_837p')
) AS v(payer_code, clearinghouse, edi_payer_id, transaction_type)
WHERE p.payer_code = v.payer_code
ON CONFLICT (payer_id, clearinghouse, transaction_type) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- SECTION 6 — PAYER ADDRESSES
-- Physical and electronic addresses per payer, organized
-- by purpose (claims submission, remittance, appeals, etc.)
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: payer_addresses
--
-- Purpose:
--   Stores all address types for each payer:
--   - CMS-1500 Box 1a mailing address (claims submission)
--   - Remittance address (paper EOB/RA)
--   - Appeals address (Box 15 of payer denial letter)
--   - Eligibility verification phone/address
--   - Provider relations and credentialing contacts
--
--   address_type distinguishes purpose.
--   is_electronic indicates that the "address" is actually a
--   clearinghouse ID or portal URL rather than a mailing address.
--
-- Required for Colorado Medicaid appeals:
--   address_type = 'appeals', payer_id = co_medicaid_ffs ID
--   HCPF Office of Appeals, 303-866-5882, PO Box 30, Denver CO 80202
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payer_addresses (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id                    UUID NOT NULL REFERENCES insurance_payers(id) ON DELETE CASCADE,

  -- ── Address Purpose ───────────────────────────────────────
  address_type                payer_address_type NOT NULL,
  address_label               TEXT,            -- e.g. "Claims Mailing Address"

  -- ── Mailing Address ───────────────────────────────────────
  is_electronic               BOOLEAN NOT NULL DEFAULT FALSE,
  -- When TRUE, address fields describe an EDI/portal endpoint not a physical address

  address_line1               TEXT,
  address_line2               TEXT,
  city                        TEXT,
  state                       TEXT,
  zip                         TEXT,
  country                     TEXT DEFAULT 'US',

  -- ── Electronic / Portal ───────────────────────────────────
  portal_url                  TEXT,
  clearinghouse               TEXT,
  edi_submission_id           TEXT,    -- EDI payer ID for this endpoint

  -- ── Contact ───────────────────────────────────────────────
  phone                       TEXT,
  fax                         TEXT,
  email                       TEXT,
  contact_name                TEXT,
  contact_title               TEXT,

  -- ── Hours / Notes ────────────────────────────────────────
  business_hours              TEXT,    -- e.g. "Mon-Fri 8am-5pm MT"
  notes                       TEXT,

  -- ── Status ────────────────────────────────────────────────
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date              DATE,
  expiration_date             DATE,

  -- ── Soft Delete ───────────────────────────────────────────
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payer_addresses_payer
  ON payer_addresses(payer_id);

CREATE INDEX IF NOT EXISTS idx_payer_addresses_type
  ON payer_addresses(payer_id, address_type);

CREATE INDEX IF NOT EXISTS idx_payer_addresses_active
  ON payer_addresses(is_active);


-- ════════════════════════════════════════════════════════════
-- SECTION 7 — SUBSCRIBERS
-- Insurance subscriber identity.  A subscriber holds the
-- insurance policy.  The patient may be the subscriber (self)
-- or a dependent of the subscriber (child, spouse, domestic
-- partner).  Required for CMS-1500 Boxes 4, 6, 7.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: subscribers
--
-- Purpose:
--   Subscriber is the person named on the insurance card who
--   holds the policy with the payer.  One subscriber may have
--   multiple dependents (patients) on their plan.
--
--   When is_self = TRUE:  subscriber IS the patient.
--     patient_id FK connects to the patient's own record.
--   When is_self = FALSE: subscriber is a third party
--     (parent, spouse, employer-sponsored person, etc.)
--
--   Subscriber data populates:
--     CMS-1500 Box 4   — Insured's Name
--     CMS-1500 Box 7   — Insured's Address
--     CMS-1500 Box 11  — Insured's Policy Group / FECA number
--     X12 837P Loop 2010B — Subscriber / Insured Name
--
-- Required Fields for Colorado Medicaid Claims:
--   subscriber_id (member ID), dob, first_name, last_name
--
-- Required Fields for Commercial Claims:
--   subscriber_id, group_number, dob, first_name, last_name
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,

  -- ── Self-subscribe vs third-party ────────────────────────
  is_self                     BOOLEAN NOT NULL DEFAULT FALSE,
  patient_id                  UUID REFERENCES patients(id) ON DELETE SET NULL,
  -- ^ Populated when subscriber is also a patient in the system

  -- ── Identity (required for CMS-1500 Box 4) ───────────────
  first_name                  TEXT NOT NULL,
  last_name                   TEXT NOT NULL,
  middle_name                 TEXT,
  name_suffix                 TEXT,    -- Jr, Sr, II
  dob                         DATE NOT NULL,    -- Required for all payers
  gender                      TEXT CHECK (gender IN ('M','F','X','Unknown')),
  ssn_last4                   TEXT,    -- Last 4 only; never store full SSN

  -- ── Insurance Identifiers ─────────────────────────────────
  subscriber_member_id        TEXT NOT NULL,   -- CMS-1500 Box 1a / Box 11
  group_number                TEXT,            -- CMS-1500 Box 11
  group_name                  TEXT,            -- CMS-1500 Box 11 (employer/plan name)

  -- ── Address (CMS-1500 Box 7) ─────────────────────────────
  address_line1               TEXT,
  address_line2               TEXT,
  city                        TEXT,
  state                       TEXT DEFAULT 'CO',
  zip                         TEXT,
  country                     TEXT DEFAULT 'US',
  phone                       TEXT,
  phone_type                  TEXT CHECK (phone_type IN ('home','work','mobile','other')),

  -- ── Employment (for group coverage) ──────────────────────
  employer_name               TEXT,
  employer_phone              TEXT,
  employer_address            TEXT,
  employment_status           TEXT CHECK (employment_status IN (
                                'full_time','part_time','retired',
                                'self_employed','disabled','student','other')),

  -- ── Colorado Medicaid Subscriber Fields ──────────────────
  -- For Medicaid FFS and RAE, subscriber = patient self most of the time.
  -- For CHP+, subscriber may be a parent (child enrolled on parent's account).
  medicaid_member_id          TEXT,    -- Colorado Medicaid member ID (Health First CO)
  medicaid_benefit_package    TEXT,    -- A01, A04 (standard BH), A07 (comprehensive), etc.

  -- ── Status ────────────────────────────────────────────────
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,

  -- ── Soft Delete ───────────────────────────────────────────
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_org
  ON subscribers(org_id);

CREATE INDEX IF NOT EXISTS idx_subscribers_patient
  ON subscribers(patient_id) WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscribers_member_id
  ON subscribers(subscriber_member_id);

CREATE INDEX IF NOT EXISTS idx_subscribers_active
  ON subscribers(is_active, org_id);


-- ════════════════════════════════════════════════════════════
-- SECTION 8 — PATIENT ↔ SUBSCRIBER RELATIONSHIPS
-- Links a patient (dependent or self) to a subscriber.
-- Captures the CMS-1500 Box 6 relationship code and the
-- relationship type used in X12 837P Loop 2000C / 2010CA.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: patient_subscriber_relationships
--
-- Purpose:
--   Associates a patient to one or more subscribers.
--   Required when the patient is a dependent on another
--   person's insurance policy (child on parent's plan, etc.)
--
--   CMS-1500 Box 6 — Patient's Relationship to Insured:
--     Self (18), Spouse (01), Child (19), Other (G8)
--
--   X12 837P Loops:
--     Loop 2000C — Patient Information (when patient ≠ subscriber)
--     Loop 2010CA — Patient Name
--     REL02       — Patient relationship code
--
-- Medicaid-specific:
--   For Colorado Medicaid FFS/RAE, the patient IS always the
--   subscriber (relationship = 'self').  CHP+ may have
--   parent as subscriber; beneficiary relationship = 'child'.
--
-- Key Fields:
--   policy_id              → insurance_policies(id)
--   patient_id             → patients(id)
--   subscriber_id          → subscribers(id)
--   relationship_code      CMS / X12 relationship code
--   is_primary_subscriber  TRUE when this is the primary policy's subscriber
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_subscriber_relationships (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,

  -- ── Core FK Triple ────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  subscriber_id               UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  policy_id                   UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,

  -- ── CMS-1500 Box 6 Relationship ──────────────────────────
  relationship_type           subscriber_relationship_type NOT NULL DEFAULT 'self',
  -- CMS / X12 relationship code (18=self, 01=spouse, 19=child, G8=other)
  cms_relationship_code       TEXT NOT NULL DEFAULT '18'
    CHECK (cms_relationship_code IN (
      '18',   -- Self
      '01',   -- Spouse
      '19',   -- Child
      '20',   -- Employee
      '21',   -- Unknown
      '39',   -- Organ Donor
      'G8',   -- Other
      'FM',   -- Former member (COBRA)
      'SP',   -- Stepchild
      'DC',   -- Dependent Child (legal)
      'DP'    -- Domestic Partner
    )),

  -- ── Policy Assignment ─────────────────────────────────────
  insurance_tier              insurance_tier NOT NULL DEFAULT 'primary',
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,

  -- ── Dates ────────────────────────────────────────────────
  effective_date              DATE,
  termination_date            DATE,
  enrollment_date             DATE,    -- Date patient was enrolled as dependent

  -- ── Verification ─────────────────────────────────────────
  eligibility_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  eligibility_verified_date   DATE,

  notes                       TEXT,

  -- ── Soft Delete ───────────────────────────────────────────
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (patient_id, subscriber_id, policy_id)
);

CREATE INDEX IF NOT EXISTS idx_psr_patient
  ON patient_subscriber_relationships(patient_id);

CREATE INDEX IF NOT EXISTS idx_psr_subscriber
  ON patient_subscriber_relationships(subscriber_id);

CREATE INDEX IF NOT EXISTS idx_psr_policy
  ON patient_subscriber_relationships(policy_id);

CREATE INDEX IF NOT EXISTS idx_psr_active
  ON patient_subscriber_relationships(patient_id, is_active) WHERE is_active = TRUE;


-- ════════════════════════════════════════════════════════════
-- SECTION 9 — INSURANCE POLICIES (Extended)
-- Extends patient-scheduling-schema.sql insurance_policies
-- with payer FK, subscriber FK, full audit trail,
-- soft delete, and COB coordination fields for secondary
-- and tertiary insurance.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: insurance_policies (ALTER — additive extension)
--
-- Policy Order / Insurance Tier:
--   policy_order = 1 → PRIMARY insurance  (always required for billing)
--   policy_order = 2 → SECONDARY insurance (COB — Medicare, commercial second)
--   policy_order = 3 → TERTIARY insurance  (rare; state supplemental, wrap-around)
--
-- Colorado Medicaid Required Fields on ALL Claims:
--   subscriber_id (member ID)        ← already in table
--   medicaid_type                    ← already in table
--   policy_effective_date            ← already in table
--   medicaid_member_id (on patient)  ← on patients table
--
-- COB-Specific Fields Added Here:
--   cob_determination_method         How primary payer was determined
--   crossover_claim                  TRUE when Medicare/Medicaid crossover
--   msp_type                         Medicare Secondary Payer type code
--   other_insured_name               Name on other policy (Box 9 CMS-1500)
--   other_policy_group               Group number on other policy
--   other_insured_dob                DOB of other insured
--   other_payer_name                 Other payer name (Box 9d)
--   msn_required                     Medicare Summary Notice required
-- ──────────────────────────────────────────────────────────
ALTER TABLE insurance_policies
  -- ── Payer reference FK (links to insurance_payers registry) ──
  ADD COLUMN IF NOT EXISTS payer_ref_id           UUID REFERENCES insurance_payers(id) ON DELETE SET NULL,

  -- ── Subscriber reference FK ──────────────────────────────
  ADD COLUMN IF NOT EXISTS subscriber_ref_id      UUID REFERENCES subscribers(id) ON DELETE SET NULL,

  -- ── Insurance tier (alias for policy_order readability) ──
  ADD COLUMN IF NOT EXISTS insurance_tier         insurance_tier NOT NULL DEFAULT 'primary',

  -- ── Medicaid claim required fields (added for completeness) ─
  ADD COLUMN IF NOT EXISTS medicaid_benefit_package TEXT,  -- A01, A04, A07, etc.
  ADD COLUMN IF NOT EXISTS medicaid_aid_category   TEXT,   -- HCPF internal aid category
  ADD COLUMN IF NOT EXISTS ra_number               TEXT,   -- Remittance Advice number from payer
  ADD COLUMN IF NOT EXISTS hmo_ipa_name            TEXT,   -- If Medicaid MCO or HMO

  -- ── COB Determination (applies to secondary / tertiary policies) ─
  ADD COLUMN IF NOT EXISTS cob_determination_method TEXT
    CHECK (cob_determination_method IN (
      'birthday_rule',           -- Birthday rule (most common for commercial dual)
      'gender_rule',             -- Older gender rule (discontinued in most states)
      'active_vs_retired',       -- Active employment coverage primary
      'non_dependent_first',     -- Coverage as non-dependent takes priority
      'medicaid_always_last',    -- Medicaid is always payer of last resort
      'medicare_always_last',    -- Medicare is always payer of last resort
      'state_law',               -- State-specific COB law
      'coordination_agreement',  -- Payer-to-payer agreement
      'court_order',             -- Court-ordered COB arrangement
      'manual'                   -- Manually determined
    )),
  ADD COLUMN IF NOT EXISTS cob_order_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cob_order_confirmed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cob_order_confirmed_at  TIMESTAMPTZ,

  -- ── Medicare Secondary Payer (MSP) Fields ────────────────
  ADD COLUMN IF NOT EXISTS is_crossover_claim      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS msp_type                TEXT
    CHECK (msp_type IN (
      '12',    -- Working Aged + spouse with employer plan
      '13',    -- ESRD
      '14',    -- No-fault (auto/liability)
      '15',    -- Workers compensation
      '41',    -- Black Lung
      '42',    -- Dept of Veterans Affairs
      '43',    -- Disabled beneficiary under age 65 with large group plan
      '47',    -- Liability insurance
      'none'
    )),
  ADD COLUMN IF NOT EXISTS msn_required            BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── CMS-1500 Box 9 — Other Insured Info ────────────────
  -- Populated on the primary policy when a secondary policy exists
  ADD COLUMN IF NOT EXISTS other_insured_first_name TEXT,
  ADD COLUMN IF NOT EXISTS other_insured_last_name  TEXT,
  ADD COLUMN IF NOT EXISTS other_insured_dob         DATE,
  ADD COLUMN IF NOT EXISTS other_insured_gender       TEXT CHECK (other_insured_gender IN ('M','F','X')),
  ADD COLUMN IF NOT EXISTS other_policy_group_number  TEXT,
  ADD COLUMN IF NOT EXISTS other_payer_name          TEXT,
  ADD COLUMN IF NOT EXISTS other_payer_ref_id         UUID REFERENCES insurance_payers(id) ON DELETE SET NULL,

  -- ── Status / Lifecycle ────────────────────────────────────
  ADD COLUMN IF NOT EXISTS status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'active','inactive','pending','terminated','replaced','cobra','unknown'
    )),
  ADD COLUMN IF NOT EXISTS replaced_by_policy_id   UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termination_reason      TEXT,

  -- ── Soft Delete ───────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS deleted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Back-fill created_by from existing rows if org has a default admin
-- (org teams run this manually after initial migration)

CREATE INDEX IF NOT EXISTS idx_ins_policies_payer_ref
  ON insurance_policies(payer_ref_id) WHERE payer_ref_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ins_policies_subscriber_ref
  ON insurance_policies(subscriber_ref_id) WHERE subscriber_ref_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ins_policies_tier
  ON insurance_policies(patient_id, insurance_tier);

CREATE INDEX IF NOT EXISTS idx_ins_policies_cob
  ON insurance_policies(patient_id, policy_order)
  WHERE policy_order > 1;

CREATE INDEX IF NOT EXISTS idx_ins_policies_status
  ON insurance_policies(status);

CREATE INDEX IF NOT EXISTS idx_ins_policies_crossover
  ON insurance_policies(is_crossover_claim) WHERE is_crossover_claim = TRUE;

-- ── Constraint: patient may have at most one active policy per tier ──────────
CREATE UNIQUE INDEX IF NOT EXISTS uidx_ins_policies_one_active_per_tier
  ON insurance_policies(patient_id, policy_order)
  WHERE is_active = TRUE AND deleted_at IS NULL;


-- ════════════════════════════════════════════════════════════
-- SECTION 10 — COB SETUPS
-- Defines the Coordination of Benefits order for a patient
-- who has two or more active insurance policies.
-- One row per patient.  The cob_order_* fields record the
-- current determination result and the method used.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: cob_setups
--
-- Purpose:
--   Captures the overall COB setup for a dual-covered patient:
--   which policy is primary, secondary, and (optionally) tertiary.
--   Records the effective date of the current order, the
--   determination method, and whether it has been confirmed
--   by staff or auto-determined by the system.
--
-- COB Rules for Colorado Medicaid:
--   Per CMS and Colorado HCPF:
--   ● Medicaid is ALWAYS the payer of last resort
--   ● When a patient has Medicare + Medicaid (dual-eligible):
--       Medicare is primary, Medicaid is secondary (crossover claim)
--   ● When a patient has commercial + Medicaid:
--       Commercial is primary, Medicaid is secondary
--   ● Birthday rule applies for two commercial policies
--     (parent whose birthday month/day is earlier = primary)
--   ● For CHP+: commercial comes first, CHP+ is secondary
--
-- Required for Colorado Medicaid Crossover Claims:
--   primary_policy_id        → Medicare or commercial policy
--   secondary_policy_id      → Medicaid policy
--   is_medicaid_secondary TRUE
--   is_medicare_crossover  TRUE (when Medicare is primary)
--   primary_paid_amount      From the primary EOB (needed on secondary claim)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cob_setups (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,

  -- ── Policy Order ─────────────────────────────────────────
  primary_policy_id           UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  secondary_policy_id         UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  tertiary_policy_id          UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,

  -- ── Determination ─────────────────────────────────────────
  cob_determination_method    TEXT NOT NULL DEFAULT 'manual'
    CHECK (cob_determination_method IN (
      'birthday_rule','active_vs_retired','non_dependent_first',
      'medicaid_always_last','medicare_always_last','state_law',
      'coordination_agreement','court_order','manual'
    )),
  determination_notes         TEXT,
  determined_at               TIMESTAMPTZ,
  determined_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_confirmed                BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at                TIMESTAMPTZ,
  confirmed_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  next_review_date            DATE,     -- Review COB order annually or on policy change

  -- ── Medicaid-Specific COB Flags ───────────────────────────
  is_medicaid_secondary       BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE → Medicaid is always last resort payer; commercial/Medicare is primary

  is_medicare_crossover       BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE → Medicare primary + Medicaid secondary; file crossover claim

  is_dual_eligible            BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE → Patient has both Medicare and Medicaid (full dual)

  dual_eligibility_level      TEXT
    CHECK (dual_eligibility_level IN (
      'full_dual',       -- QMB Plus or SLMB Plus (Medicare + full Medicaid)
      'partial_dual',    -- QMB-only / SLMB-only (Medicare + limited Medicaid)
      'not_applicable'
    )),

  -- ── MSP (Medicare Secondary Payer) Setup ─────────────────
  msp_questionnaire_completed BOOLEAN NOT NULL DEFAULT FALSE,
  msp_questionnaire_date      DATE,
  msp_type                    TEXT,   -- MSP type code from insurance_policies

  -- ── Birthday Rule Fields (commercial dual) ───────────────
  birthday_rule_applicable    BOOLEAN DEFAULT FALSE,
  primary_subscriber_birthday SMALLINT CHECK (primary_subscriber_birthday BETWEEN 1 AND 12),
  -- Month of birth only (1–12); minimizes PHI exposure vs storing full DOB

  -- ── Status ────────────────────────────────────────────────
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at              TIMESTAMPTZ,
  deactivated_reason          TEXT,

  -- ── Soft Delete ───────────────────────────────────────────
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (patient_id)
);

CREATE INDEX IF NOT EXISTS idx_cob_setups_patient
  ON cob_setups(patient_id);

CREATE INDEX IF NOT EXISTS idx_cob_setups_org
  ON cob_setups(org_id);

CREATE INDEX IF NOT EXISTS idx_cob_setups_dual
  ON cob_setups(is_dual_eligible) WHERE is_dual_eligible = TRUE;

CREATE INDEX IF NOT EXISTS idx_cob_setups_medicaid_sec
  ON cob_setups(is_medicaid_secondary) WHERE is_medicaid_secondary = TRUE;

CREATE INDEX IF NOT EXISTS idx_cob_setups_crossover
  ON cob_setups(is_medicare_crossover) WHERE is_medicare_crossover = TRUE;

CREATE INDEX IF NOT EXISTS idx_cob_setups_review
  ON cob_setups(next_review_date) WHERE next_review_date IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- SECTION 11 — COB CLAIM RECORDS
-- Per-claim Coordination of Benefits tracking.
-- Captures what the primary payer paid (from the EOB/ERA),
-- and what was filed to the secondary payer as a crossover
-- or COB claim.  Drives secondary billing and patient
-- responsibility calculations.
-- ════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- TABLE: cob_claim_records
--
-- Purpose:
--   One row per claim that involves COB (secondary or tertiary
--   billing).  Stores the primary payer's EOB adjudication data
--   and the secondary submission amounts.
--
-- COB Claim Workflow:
--   1. Primary claim filed → primary payer adjudicates
--   2. ERA received → primary_paid_amount, primary_contractual_adj,
--      primary_carc, primary_rarc captured here
--   3. Secondary claim built: billed to secondary payer using
--      other_payer_paid field = primary_paid_amount
--   4. Secondary adjudicates → secondary_paid_amount captured
--   5. Patient responsibility = secondary_billed - secondary_paid
--
-- Colorado Medicaid Crossover Claims (Medicare primary):
--   Required on secondary Medicaid claim:
--     OI01 (Other Insurance) loop in 837P
--     AMT*D segment: Medicare paid amount
--     Claim adjustment group codes from Medicare RA:
--       CO-45 (contracted adjustment), PR-2 (coinsurance), PR-3 (deductible)
--
-- Required Fields for Medicaid Secondary Crossover Claims:
--   primary_claim_id, primary_payer_id (Medicare NPI/PTAN),
--   primary_paid_amount, primary_allowed_amount,
--   primary_contractual_adj, primary_carc, primary_rarc,
--   crossover_medicare_paid, crossover_claim_indicator
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cob_claim_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  cob_setup_id                UUID REFERENCES cob_setups(id) ON DELETE SET NULL,

  -- ── Claim References ─────────────────────────────────────
  -- primary_claim_id references the claims table in coding-billing-schema.sql
  primary_claim_id            UUID,    -- FK to claims(id) — primary payer claim
  secondary_claim_id          UUID,    -- FK to claims(id) — secondary payer claim
  tertiary_claim_id           UUID,    -- FK to claims(id) — tertiary payer claim (rare)

  -- ── Policy References ────────────────────────────────────
  primary_policy_id           UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
  secondary_policy_id         UUID REFERENCES insurance_policies(id) ON DELETE RESTRICT,
  tertiary_policy_id          UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,

  -- ── Claim Identifiers ─────────────────────────────────────
  date_of_service             DATE NOT NULL,
  primary_claim_number        TEXT,
  secondary_claim_number      TEXT,
  tertiary_claim_number       TEXT,

  -- ── Primary Payer Adjudication Results ───────────────────
  primary_billed_amount       NUMERIC(10,2) NOT NULL,
  primary_allowed_amount      NUMERIC(10,2),
  primary_paid_amount         NUMERIC(10,2),
  primary_contractual_adj     NUMERIC(10,2) DEFAULT 0,   -- CO-45
  primary_noncovered          NUMERIC(10,2) DEFAULT 0,   -- CO-96
  primary_deductible          NUMERIC(10,2) DEFAULT 0,   -- PR-1
  primary_coinsurance         NUMERIC(10,2) DEFAULT 0,   -- PR-2
  primary_copay               NUMERIC(10,2) DEFAULT 0,   -- PR-3
  primary_carc                TEXT[],    -- Claim Adjustment Reason Codes
  primary_rarc                TEXT[],    -- Remittance Advice Remark Codes
  primary_eob_date            DATE,
  primary_era_received        BOOLEAN NOT NULL DEFAULT FALSE,
  primary_era_reference       TEXT,    -- ERA transaction control number

  -- ── Medicare Crossover (MSP) Fields ──────────────────────
  is_crossover_claim          BOOLEAN NOT NULL DEFAULT FALSE,
  crossover_medicare_paid     NUMERIC(10,2),   -- AMT*D in 837P
  msp_type                    TEXT,    -- From cob_setups or insurance_policies
  medicare_beneficiary_id     TEXT,    -- From insurance_policies, used in OI loop
  crossover_claim_indicator   BOOLEAN DEFAULT FALSE,
  -- When TRUE, this is a crossover claim and payer has auto-forwarded to Medicaid

  -- ── Secondary Payer Billing ───────────────────────────────
  secondary_billed_amount     NUMERIC(10,2),
  secondary_billed_date       DATE,
  secondary_allowed_amount    NUMERIC(10,2),
  secondary_paid_amount       NUMERIC(10,2),
  secondary_contractual_adj   NUMERIC(10,2) DEFAULT 0,
  secondary_deductible        NUMERIC(10,2) DEFAULT 0,
  secondary_coinsurance       NUMERIC(10,2) DEFAULT 0,
  secondary_copay             NUMERIC(10,2) DEFAULT 0,
  secondary_carc              TEXT[],
  secondary_rarc              TEXT[],
  secondary_eob_date          DATE,
  secondary_era_received      BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Tertiary Payer Billing ────────────────────────────────
  tertiary_billed_amount      NUMERIC(10,2),
  tertiary_billed_date        DATE,
  tertiary_paid_amount        NUMERIC(10,2),
  tertiary_eob_date           DATE,

  -- ── Patient Responsibility ────────────────────────────────
  total_billed                NUMERIC(10,2) GENERATED ALWAYS AS
    (primary_billed_amount) STORED,
  total_payer_paid            NUMERIC(10,2),    -- Sum after all payers; set by trigger
  patient_responsibility      NUMERIC(10,2),    -- Balance after all COB
  patient_balance_on_file     BOOLEAN NOT NULL DEFAULT FALSE,
  patient_statement_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  patient_statement_date      DATE,

  -- ── COB Status ────────────────────────────────────────────
  cob_status                  TEXT NOT NULL DEFAULT 'pending_primary'
    CHECK (cob_status IN (
      'pending_primary',         -- Waiting for primary payer to adjudicate
      'primary_adjudicated',     -- Primary done; ready to bill secondary
      'secondary_billed',        -- Secondary claim filed
      'secondary_adjudicated',   -- Both payers done
      'tertiary_billed',
      'tertiary_adjudicated',
      'closed',                  -- COB complete; no more balances expected
      'balance_billed_patient',  -- Patient billed for final balance
      'voided'
    )),

  -- ── Workflow ─────────────────────────────────────────────
  ready_to_bill_secondary     BOOLEAN NOT NULL DEFAULT FALSE,
  secondary_bill_hold         BOOLEAN NOT NULL DEFAULT FALSE,
  secondary_bill_hold_reason  TEXT,

  notes                       TEXT,

  -- ── Soft Delete ───────────────────────────────────────────
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Audit ─────────────────────────────────────────────────
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cob_claims_patient
  ON cob_claim_records(patient_id);

CREATE INDEX IF NOT EXISTS idx_cob_claims_org
  ON cob_claim_records(org_id);

CREATE INDEX IF NOT EXISTS idx_cob_claims_primary_claim
  ON cob_claim_records(primary_claim_id) WHERE primary_claim_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cob_claims_secondary_claim
  ON cob_claim_records(secondary_claim_id) WHERE secondary_claim_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cob_claims_primary_policy
  ON cob_claim_records(primary_policy_id);

CREATE INDEX IF NOT EXISTS idx_cob_claims_status
  ON cob_claim_records(cob_status);

CREATE INDEX IF NOT EXISTS idx_cob_claims_ready_secondary
  ON cob_claim_records(ready_to_bill_secondary, cob_status)
  WHERE ready_to_bill_secondary = TRUE AND cob_status = 'primary_adjudicated';

CREATE INDEX IF NOT EXISTS idx_cob_claims_crossover
  ON cob_claim_records(is_crossover_claim)
  WHERE is_crossover_claim = TRUE;

CREATE INDEX IF NOT EXISTS idx_cob_claims_dos
  ON cob_claim_records(date_of_service);


-- ════════════════════════════════════════════════════════════
-- SECTION 12 — TRIGGERS, RLS, COMMENTS
-- ════════════════════════════════════════════════════════════

-- ── updated_at triggers ──────────────────────────────────────────────────────

CREATE TRIGGER trg_patient_demographics_updated_at
  BEFORE UPDATE ON patient_demographics_extended
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_insurance_payers_updated_at
  BEFORE UPDATE ON insurance_payers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payer_ids_updated_at
  BEFORE UPDATE ON payer_ids
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payer_addresses_updated_at
  BEFORE UPDATE ON payer_addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subscribers_updated_at
  BEFORE UPDATE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_psr_updated_at
  BEFORE UPDATE ON patient_subscriber_relationships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cob_setups_updated_at
  BEFORE UPDATE ON cob_setups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cob_claims_updated_at
  BEFORE UPDATE ON cob_claim_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Auto-update patients.has_active_cob ─────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_patient_cob_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  active_policy_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO   active_policy_count
  FROM   insurance_policies
  WHERE  patient_id = COALESCE(NEW.patient_id, OLD.patient_id)
    AND  is_active = TRUE
    AND  deleted_at IS NULL;

  UPDATE patients
  SET    has_active_cob = (active_policy_count > 1),
         updated_at     = now()
  WHERE  id = COALESCE(NEW.patient_id, OLD.patient_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refresh_cob_flag_on_policy_change
  AFTER INSERT OR UPDATE OR DELETE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION refresh_patient_cob_flag();

-- ── Auto-flag cob_claim_records.ready_to_bill_secondary ─────────────────────

CREATE OR REPLACE FUNCTION flag_ready_to_bill_secondary()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.primary_era_received = TRUE
     AND NEW.secondary_policy_id IS NOT NULL
     AND NEW.cob_status = 'pending_primary'
  THEN
    NEW.cob_status          := 'primary_adjudicated';
    NEW.ready_to_bill_secondary := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_flag_secondary_billing
  BEFORE UPDATE ON cob_claim_records
  FOR EACH ROW EXECUTE FUNCTION flag_ready_to_bill_secondary();

-- ── Auto-set insurance_policies.insurance_tier from policy_order ─────────────

CREATE OR REPLACE FUNCTION sync_insurance_tier()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.insurance_tier := CASE NEW.policy_order
    WHEN 1 THEN 'primary'::insurance_tier
    WHEN 2 THEN 'secondary'::insurance_tier
    WHEN 3 THEN 'tertiary'::insurance_tier
    ELSE 'primary'::insurance_tier
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_insurance_tier
  BEFORE INSERT OR UPDATE OF policy_order ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION sync_insurance_tier();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE patient_demographics_extended      ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_payers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_ids                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_addresses                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_subscriber_relationships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cob_setups                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cob_claim_records                  ENABLE ROW LEVEL SECURITY;

-- All authenticated users may read system-wide payer registry
CREATE POLICY "all_read_system_payers"
  ON insurance_payers FOR SELECT TO authenticated
  USING (is_system_record = TRUE AND is_active = TRUE AND deleted_at IS NULL);

-- Org users read their own private payer records
CREATE POLICY "org_read_own_payers"
  ON insurance_payers FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
  ));

-- Admin can write payers
CREATE POLICY "admin_write_payers"
  ON insurance_payers FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));

-- All authenticated users read payer IDs and addresses (payer registry is public-ish)
CREATE POLICY "all_read_payer_ids"
  ON payer_ids FOR SELECT TO authenticated
  USING (is_active = TRUE AND deleted_at IS NULL);

CREATE POLICY "all_read_payer_addresses"
  ON payer_addresses FOR SELECT TO authenticated
  USING (is_active = TRUE AND deleted_at IS NULL);

-- Demographics: same org access
CREATE POLICY "org_access_demographics"
  ON patient_demographics_extended FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  );

-- Subscribers: same org access
CREATE POLICY "org_access_subscribers"
  ON subscribers FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  );

-- PSR: same org access
CREATE POLICY "org_access_psr"
  ON patient_subscriber_relationships FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  );

-- COB setups and claim records: billing access
CREATE POLICY "org_access_cob_setups"
  ON cob_setups FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  );

CREATE POLICY "org_access_cob_claims"
  ON cob_claim_records FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  );

-- ── Back-fill patients.primary_payer_id FK ───────────────────────────────────
-- Run after migration:
-- ALTER TABLE patients ADD CONSTRAINT fk_patient_primary_payer
--   FOREIGN KEY (primary_payer_id) REFERENCES insurance_payers(id)
--   ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- ── Table Comments ─────────────────────────────────────────────────────────

COMMENT ON TABLE insurance_payers IS
  'Master payer registry. is_system_record = TRUE → shared THERASSISTANT-maintained list. '
  'is_colorado_medicaid = TRUE drives Medicaid-specific claim rules and timely filing limits. '
  'bh_carve_out = TRUE → BH claims route to bh_payer_id instead.';

COMMENT ON TABLE payer_ids IS
  'EDI clearinghouse payer ID per payer per transaction type. '
  'A single payer may have different IDs on Availity vs Waystar vs OfficeAlly. '
  'edi_payer_id for CO Medicaid FFS on Availity = SKCO0.';

COMMENT ON TABLE payer_addresses IS
  'Purpose-specific addresses for each payer: claims submission, remittance, '
  'appeals, eligibility, credentialing. is_electronic = TRUE → describes EDI/portal endpoint.';

COMMENT ON TABLE subscribers IS
  'Insurance subscriber (policy holder). is_self = TRUE → subscriber = patient. '
  'is_self = FALSE → third-party holder (parent, spouse, employer). '
  'subscriber_member_id populates CMS-1500 Box 1a (member ID).';

COMMENT ON TABLE patient_subscriber_relationships IS
  'Connects patient (dependent or self) to subscriber. '
  'cms_relationship_code populates CMS-1500 Box 6: 18=self, 01=spouse, 19=child, G8=other. '
  'One row per patient-subscriber-policy triple.';

COMMENT ON TABLE cob_setups IS
  'COB order determination per patient. Medicaid is ALWAYS last resort per HCPF rules. '
  'is_medicare_crossover = TRUE triggers Medicare→Medicaid crossover claim workflow. '
  'is_dual_eligible = TRUE (full dual) enables automatic ERA matching across both payers.';

COMMENT ON TABLE cob_claim_records IS
  'Per-claim COB tracking. primary_paid_amount from ERA feeds into secondary claim (OI loop). '
  'cob_status drives work queue: pending_primary → primary_adjudicated → secondary_billed. '
  'For CO Medicaid crossover: crossover_medicare_paid → AMT*D in 837P secondary submission.';

COMMENT ON TABLE patient_demographics_extended IS
  'SDOH, disability, veteran status, and HRSN screening data. '
  'Colorado Medicaid APM/VBP reporting requires race_code, ethnicity_code, housing_status. '
  'contains_42_cfr_pt2_data = TRUE requires separate consent before disclosure.';
