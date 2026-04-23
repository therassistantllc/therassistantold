-- ============================================================
-- THERASSISTANT Claims & Billing Reference Schema
-- Colorado Medicaid Behavioral Health — v1.0
-- PostgreSQL / Supabase
-- CMS-1500 / X12 837P Professional Claim / ASC X12 5010
--
-- Covers:
--   Section  1  — ALTER TABLE claims          (org, appt, provider FKs, freq code,
--                                              supervisor billing, soft delete, audit)
--   Section  2  — ALTER TABLE claim_line_items (soft delete, audit, FK linkage)
--   Section  3  — cpt_codes                   (CPT procedure code reference)
--   Section  4  — hcpcs_codes                 (HCPCS Level II; CO Medicaid H-codes seeded)
--   Section  5  — modifiers                   (modifier reference; CO Medicaid BH seeded)
--   Section  6  — claim_diagnosis_codes       (CMS-1500 Box 21 A–L normalization)
--   Section  7  — claim_submission_history    (per-claim submission attempt log)
--   Section  8  — claim_rejections            (X12 999/TA1 technical rejections)
--   Section  9  — clearinghouse_responses     (structured 999/TA1/277CA catalog)
--   Section 10  — Deferred FK Constraints     (prior_auth_id, referral_id, appeal_id)
--   Section 11  — Supervising Provider Billing (required fields + rules)
--   Section 12  — claim_readiness_check VIEW  (draft claim completeness evaluation)
--   Section 13  — Triggers
--   Section 14  — RLS Policies
--   Section 15  — Relationship Map
--
-- Prerequisites (run order):
--   1. auth-schema.sql
--   2. admin-clients-schema.sql            (clinician_accounts, patient_records)
--   3. patient-scheduling-schema.sql       (appointments)
--   4. patient-insurance-schema.sql        (insurance_payers, insurance_policies, subscribers)
--   5. coding-billing-schema.sql           (claims, claim_line_items, claim_status_history,
--                                           denials, appeals, prior_authorizations, referrals,
--                                           eras, era_line_items, office_ally_transactions)
--   6. provider-billing-identity-schema.sql (organizations, rendering_providers,
--                                            billing_providers, service_facilities)
--   7. THIS FILE
--   8. admin-claims-schema.sql             (claim_notes, claim_attachments, correspondence)
--
-- Colorado Medicaid Specifics enforced here:
--   - Timely filing = 365 days from DOS
--   - Medicaid is payer of last resort (COB enforced at insurance_policies level)
--   - Supervising NPI required when supervised clinician is not independently enrolled
--   - Crossover claims (Medicare → CO Medicaid) require is_crossover = TRUE
--   - HCPF payer EDI ID = SKCO0 on Availity
--   - Behavioral health carve-out payer rules enforced at application layer
-- ============================================================


-- Guard: shared trigger function (idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- SECTION 1 — ALTER TABLE claims
-- ============================================================
--
-- Adds to the existing claims table in coding-billing-schema.sql:
--
--   Org & appointment linkage:
--     org_id                  → organizations(id)          -- billing entity org
--     appointment_id          → appointments(id)           -- source appointment
--
--   Structured provider FKs (denormalized NPIs already present as TEXT):
--     billing_provider_id     → billing_providers(id)      -- CMS-1500 Box 33
--     rendering_provider_id   → rendering_providers(id)    -- CMS-1500 Box 24J
--     supervising_provider_id → rendering_providers(id)    -- CMS-1500 Box 17 (when supervising)
--     service_facility_id     → service_facilities(id)     -- CMS-1500 Box 32
--
--   Payer FK:
--     payer_ref_id            → insurance_payers(id)       -- structured payer reference
--     insurance_policy_id     → insurance_policies(id)     -- patient's active policy on DOS
--     subscriber_ref_id       → subscribers(id)            -- policy holder
--
--   837P claim type:
--     claim_frequency_code    X12 CLM05-3: 1=Original, 7=Corrected/Replacement, 8=Void
--     original_claim_id       Points to the claim being corrected/voided (when freq=7 or 8)
--
--   Supervising provider billing:
--     supervisor_cosign_required  TRUE when claim cannot submit without supervisor co-sign
--     supervisor_cosign_at        Timestamp when supervisor co-signed the note
--     supervisor_cosign_by        auth.users.id of the supervisor
--     bill_under_supervisor       TRUE = submit under supervisor NPI (Box 33/24J swapped)
--
--   Soft delete + full audit block:
--     updated_by, deleted_at, deleted_by
-- ============================================================

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS org_id                    UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id            UUID REFERENCES appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_provider_id       UUID REFERENCES billing_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rendering_provider_id     UUID REFERENCES rendering_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervising_provider_id   UUID REFERENCES rendering_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_facility_id       UUID REFERENCES service_facilities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_ref_id              UUID REFERENCES insurance_payers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurance_policy_id       UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscriber_ref_id         UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_frequency_code      TEXT NOT NULL DEFAULT '1'
                             CHECK (claim_frequency_code IN ('1','7','8')),
                             -- 1 = Original
                             -- 7 = Corrected/Replacement
                             -- 8 = Void
  ADD COLUMN IF NOT EXISTS original_claim_id         UUID REFERENCES claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_cosign_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supervisor_cosign_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supervisor_cosign_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bill_under_supervisor     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_claims_org         ON claims(org_id);
CREATE INDEX IF NOT EXISTS idx_claims_appt        ON claims(appointment_id);
CREATE INDEX IF NOT EXISTS idx_claims_bp          ON claims(billing_provider_id);
CREATE INDEX IF NOT EXISTS idx_claims_rp          ON claims(rendering_provider_id);
CREATE INDEX IF NOT EXISTS idx_claims_sup         ON claims(supervising_provider_id);
CREATE INDEX IF NOT EXISTS idx_claims_sf          ON claims(service_facility_id);
CREATE INDEX IF NOT EXISTS idx_claims_payer_ref   ON claims(payer_ref_id);
CREATE INDEX IF NOT EXISTS idx_claims_policy      ON claims(insurance_policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_freq        ON claims(claim_frequency_code);
CREATE INDEX IF NOT EXISTS idx_claims_orig        ON claims(original_claim_id);
CREATE INDEX IF NOT EXISTS idx_claims_deleted     ON claims(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_claims_cosign      ON claims(supervisor_cosign_required, supervisor_cosign_at)
  WHERE supervisor_cosign_required = TRUE;

COMMENT ON COLUMN claims.claim_frequency_code IS
  'X12 CLM05-3: 1=Original, 7=Corrected/Replacement, 8=Void. '
  'Must be 7 or 8 with original_claim_id populated for corrected/void claims.';

COMMENT ON COLUMN claims.supervisor_cosign_required IS
  'TRUE when the rendering provider requires supervisor co-signature before claim submission. '
  'Driven by supervision_relationships.cosign_required. '
  'Claim is blocked from Ready to Submit status until supervisor_cosign_at is populated.';

COMMENT ON COLUMN claims.bill_under_supervisor IS
  'TRUE = claim is submitted under the supervising provider NPI in Box 33/24J. '
  'Applicable when supervised clinician is not independently enrolled with the payer. '
  'When TRUE, supervising_npi must be populated and supervising_provider_id must be set.';

COMMENT ON COLUMN claims.original_claim_id IS
  'For claim_frequency_code 7 (corrected) or 8 (void): points to the original claim record. '
  'The original claim status is updated to Corrected & Resubmitted or Voided when this is set.';


-- ============================================================
-- SECTION 2 — ALTER TABLE claim_line_items
-- ============================================================
--
-- Adds:
--   cpt_code_id   → cpt_codes(id)   (optional FK to CPT reference; set after table created)
--   hcpcs_code_id → hcpcs_codes(id) (optional FK to HCPCS reference; set after table created)
--   updated_by, deleted_at, deleted_by  (full audit block)
--   rendering_provider_id  (line-level override when rendering provider differs per line)
-- ============================================================

ALTER TABLE claim_line_items
  ADD COLUMN IF NOT EXISTS rendering_provider_id  UUID REFERENCES rendering_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_claim_lines_rp       ON claim_line_items(rendering_provider_id);
CREATE INDEX IF NOT EXISTS idx_claim_lines_deleted   ON claim_line_items(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN claim_line_items.rendering_provider_id IS
  'Line-level rendering provider override. Populated when a single claim has '
  'service lines from different rendering providers (rare but valid for group practices). '
  'Falls back to claims.rendering_provider_id when NULL.';


-- ============================================================
-- SECTION 3 — cpt_codes
-- ============================================================
--
-- Purpose:
--   Current Procedural Terminology (CPT) reference table.
--   NOTE: Full CPT code set is copyright AMA. This table
--   holds internally managed records; a licensed feed is
--   required for a complete set.
--
-- Key Fields:
--   code               5-character CPT code
--   short_description  AMA short descriptor (~28 chars)
--   long_description   Full descriptor
--   category           Behavioral health relevant grouping
--   is_time_based      TRUE = billing units calculated from minutes
--   typical_minutes    Time basis for time-based codes
--   min_units / max_units_per_day  Unit limits
--   requires_modifier  Specific modifier required (e.g. '95' for telehealth)
--   co_medicaid_covered  Covered by Colorado Medicaid FFS
--   co_medicaid_rate   Colorado Medicaid fee schedule rate (HCPF published)
--   requires_prior_auth  Triggers PA workflow when TRUE
--   documentation_requirements  Key documentation bullets
--
-- Relationships:
--   ← claim_line_items.hcpcs_code (text match; use cpt_code_id FK after seed)
-- ============================================================

CREATE TABLE IF NOT EXISTS cpt_codes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        TEXT UNIQUE NOT NULL,
  short_description           TEXT NOT NULL,
  long_description            TEXT,
  category                    TEXT NOT NULL
                                CHECK (category IN (
                                  'Psychiatric Diagnostic','Psychotherapy',
                                  'Crisis Intervention','E/M Office',
                                  'E/M Hospital','Group Therapy',
                                  'Family Therapy','Pharmacologic Management',
                                  'Neuropsychological Testing','Health & Behavior',
                                  'Preventive Screening','Other'
                                )),

  -- Time basis (CMS time-based billing rules)
  is_time_based               BOOLEAN NOT NULL DEFAULT FALSE,
  typical_minutes             INTEGER,         -- canonical time unit (e.g. 53 for 90837)
  min_minutes                 INTEGER,         -- threshold before next code (e.g. 38 → 90832)
  max_minutes                 INTEGER,         -- upper bound before next code

  -- Units
  default_units               NUMERIC(6,2) NOT NULL DEFAULT 1,
  min_units                   NUMERIC(6,2) DEFAULT 1,
  max_units_per_day           NUMERIC(6,2),

  -- Modifiers
  common_modifiers            TEXT[],          -- ['GT','95','HO','HF'] — typical modifiers
  requires_modifier           TEXT,            -- must include this modifier
  incompatible_modifiers      TEXT[],          -- cannot combine these modifiers

  -- Place of service rules
  valid_pos_codes             TEXT[],          -- ['02','10','11','12'] — valid POS for this code

  -- Coverage
  co_medicaid_covered         BOOLEAN NOT NULL DEFAULT FALSE,
  co_medicaid_rate            NUMERIC(10,2),   -- Published HCPF rate (USD)
  co_medicaid_rate_effective  DATE,
  requires_prior_auth         BOOLEAN NOT NULL DEFAULT FALSE,
  telehealth_eligible         BOOLEAN NOT NULL DEFAULT FALSE,

  -- Documentation requirements
  documentation_requirements  TEXT[],  -- key bullets from billing compliance rules

  -- Billing rules
  not_separately_billable_with TEXT[], -- codes that cannot be billed on same DOS
  is_add_on                   BOOLEAN NOT NULL DEFAULT FALSE,
  add_on_parent_codes         TEXT[],  -- parent codes required when is_add_on=TRUE

  -- Metadata
  ama_year                    SMALLINT,  -- CPT edition year (e.g. 2025)
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_cpt_category    ON cpt_codes(category);
CREATE INDEX idx_cpt_active      ON cpt_codes(is_active);
CREATE INDEX idx_cpt_co_medicaid ON cpt_codes(co_medicaid_covered);
CREATE INDEX idx_cpt_telehealth  ON cpt_codes(telehealth_eligible);
CREATE INDEX idx_cpt_time_based  ON cpt_codes(is_time_based);

ALTER TABLE cpt_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_read_cpt_codes" ON cpt_codes
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_cpt_codes" ON cpt_codes
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE cpt_codes IS
  'CPT procedure code reference. Full set requires AMA license. '
  'is_time_based drives unit calculation from session duration. '
  'co_medicaid_rate is the published HCPF fee schedule rate. '
  'documentation_requirements drives billing compliance warnings in the UI.';

-- Seed behavioral health CPT codes
INSERT INTO cpt_codes (
  code, short_description, long_description, category,
  is_time_based, typical_minutes, min_minutes, max_minutes,
  default_units, min_units, max_units_per_day,
  common_modifiers, valid_pos_codes,
  co_medicaid_covered, co_medicaid_rate, co_medicaid_rate_effective,
  requires_prior_auth, telehealth_eligible,
  documentation_requirements, ama_year, is_active
) VALUES

  -- PSYCHIATRIC DIAGNOSTIC
  ('90791',
   'Psych diag evaluation',
   'Psychiatric diagnostic evaluation',
   'Psychiatric Diagnostic',
   FALSE, NULL, NULL, NULL,
   1, 1, 1,
   ARRAY['GT','95','HO','HP'],
   ARRAY['02','10','11','12','13','22'],
   TRUE, 195.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'Document reason for referral and chief complaint',
     'Complete psychiatric history including prior diagnoses, hospitalizations, medications',
     'Mental Status Examination with all domains',
     'DSM-5 diagnosis with diagnostic reasoning',
     'Risk assessment: SI, HI, self-harm, substance use',
     'Functional impairment documentation',
     'Treatment recommendations'
   ],
   2025, TRUE),

  ('90792',
   'Psych diag eval w/med svcs',
   'Psychiatric diagnostic evaluation with medical services',
   'Psychiatric Diagnostic',
   FALSE, NULL, NULL, NULL,
   1, 1, 1,
   ARRAY['GT','95'],
   ARRAY['02','10','11','12','22'],
   FALSE, NULL, NULL,
   FALSE, TRUE,
   ARRAY[
     'Document medical evaluation components',
     'Complete psychiatric diagnostic documentation (see 90791)',
     'Medication evaluation or prescription management documented',
     'Must be performed by physician, NP, or PA'
   ],
   2025, TRUE),

  -- INDIVIDUAL PSYCHOTHERAPY
  ('90832',
   'Psychotherapy, 30 min',
   'Psychotherapy, 30 minutes with patient and/or family member',
   'Psychotherapy',
   TRUE, 30, 16, 37,
   1, 1, 1,
   ARRAY['GT','95','HO','HF','HA','HB'],
   ARRAY['02','10','11','12','13'],
   TRUE, 65.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'Document presenting problem and patient response',
     'Interventions used and clinical rationale',
     'Therapeutic progress toward treatment plan goals',
     'Risk assessment if indicated',
     'Plan and next appointment'
   ],
   2025, TRUE),

  ('90834',
   'Psychotherapy, 45 min',
   'Psychotherapy, 45 minutes with patient and/or family member',
   'Psychotherapy',
   TRUE, 45, 38, 52,
   1, 1, 1,
   ARRAY['GT','95','HO','HF','HA','HB'],
   ARRAY['02','10','11','12','13'],
   TRUE, 98.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'Document presenting problem and patient response',
     'Interventions used and clinical rationale',
     'Therapeutic progress toward treatment plan goals',
     'Risk assessment if indicated',
     'Plan and next appointment'
   ],
   2025, TRUE),

  ('90837',
   'Psychotherapy, 60 min',
   'Psychotherapy, 60 minutes with patient and/or family member',
   'Psychotherapy',
   TRUE, 60, 53, NULL,
   1, 1, 1,
   ARRAY['GT','95','HO','HF','HA','HB'],
   ARRAY['02','10','11','12','13'],
   TRUE, 145.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'Document presenting problem and patient response',
     'Interventions used and clinical rationale',
     'Therapeutic progress toward treatment plan goals',
     'Risk assessment if indicated',
     'Plan and next appointment',
     'Session must reach 53 minutes minimum'
   ],
   2025, TRUE),

  -- CRISIS INTERVENTION
  ('90839',
   'Psychotherapy for crisis, 1st 60 min',
   'Psychotherapy for crisis; first 60 minutes',
   'Crisis Intervention',
   TRUE, 60, 30, NULL,
   1, 1, 1,
   ARRAY['GT','95'],
   ARRAY['02','10','11','12','13','22','23'],
   TRUE, 175.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'Document nature and onset of crisis',
     'Risk assessment: SI/HI level and basis',
     'Safety plan reviewed or developed',
     'Interventions and patient response',
     'Disposition and follow-up plan',
     'Start and stop times required'
   ],
   2025, TRUE),

  ('90840',
   'Psychotherapy for crisis, each add''l 30 min',
   'Psychotherapy for crisis; each additional 30 minutes (List separately)',
   'Crisis Intervention',
   TRUE, 30, 15, NULL,
   1, 1, NULL,
   ARRAY['GT','95'],
   ARRAY['02','10','11','12','13','22','23'],
   TRUE, 75.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'Add-on to 90839 only',
     'Document continued crisis intervention beyond 60 minutes',
     'Start and stop times required'
   ],
   2025, TRUE),

  -- GROUP THERAPY
  ('90853',
   'Group psychotherapy',
   'Group psychotherapy (other than of a multiple-family group)',
   'Group Therapy',
   FALSE, NULL, NULL, NULL,
   1, 1, 1,
   ARRAY['HQ','HO','HF','GT','95'],
   ARRAY['02','10','11','12'],
   TRUE, 40.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'HQ modifier required',
     'Document group size and composition',
     'Group theme or focus documented',
     'Individual patient participation noted',
     'Progress toward treatment plan goals for each member'
   ],
   2025, TRUE),

  -- FAMILY THERAPY
  ('90846',
   'Family psychotherapy w/o patient',
   'Family psychotherapy (without the patient present)',
   'Family Therapy',
   FALSE, NULL, NULL, NULL,
   1, 1, 1,
   ARRAY['GT','95','HO'],
   ARRAY['02','10','11','12'],
   TRUE, 100.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'Document who attended (relationship to patient)',
     'Clinical rationale for meeting without patient',
     'Content and interventions',
     'Plan for patient involvement'
   ],
   2025, TRUE),

  ('90847',
   'Family psychotherapy w/ patient',
   'Family psychotherapy (conjoint psychotherapy) (with patient present)',
   'Family Therapy',
   FALSE, NULL, NULL, NULL,
   1, 1, 1,
   ARRAY['GT','95','HS','HO'],
   ARRAY['02','10','11','12'],
   TRUE, 115.00, '2025-01-01',
   FALSE, TRUE,
   ARRAY[
     'Document who attended (relationship to patient)',
     'Focus of session and presenting issue',
     'Interventions used',
     'Patient and family response',
     'Treatment plan progress'
   ],
   2025, TRUE)

ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- SECTION 4 — hcpcs_codes
-- ============================================================
--
-- Purpose:
--   HCPCS Level II procedure code reference table.
--   Colorado Medicaid uses H-codes extensively for behavioral
--   health. CMS publishes HCPCS Level II codes publicly.
--
-- Key Fields:
--   code_set            L2 (Level II); codes begin with letter A-V
--   co_medicaid_covered Flag for HCPF coverage
--   co_medicaid_rate    Published HCPF fee schedule rate
--   unit_definition     What 1 unit represents (e.g. 'per 15 minutes')
--   requires_npi_type_1 Some H-codes require individual NPI in 24J
--   supervisor_modifier_required  TRUE = HO/HN/HP required for this code
--
-- Relationships:
--   ← claim_line_items.hcpcs_code (text match)
-- ============================================================

CREATE TABLE IF NOT EXISTS hcpcs_codes (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                         TEXT UNIQUE NOT NULL,
  code_set                     TEXT NOT NULL DEFAULT 'L2'
                                 CHECK (code_set IN ('L1','L2','S','T')),
  short_description            TEXT NOT NULL,
  long_description             TEXT,
  category                     TEXT NOT NULL
                                 CHECK (category IN (
                                   'Mental Health Assessment','SUD Assessment',
                                   'Mental Health Treatment','SUD Treatment',
                                   'Crisis Services','Case Management',
                                   'Community Support','Residential',
                                   'Methadone/MAT','Peer Support',
                                   'Screening','Other'
                                 )),

  -- Unit definition
  unit_definition              TEXT,            -- 'per 15 minutes', 'per diem', 'per session'
  default_units                NUMERIC(6,2) NOT NULL DEFAULT 1,
  min_units                    NUMERIC(6,2) DEFAULT 1,
  max_units_per_day            NUMERIC(6,2),
  typical_minutes_per_unit     INTEGER,         -- minutes represented by 1 unit

  -- Modifiers
  common_modifiers             TEXT[],
  supervisor_modifier_required BOOLEAN NOT NULL DEFAULT FALSE,
  -- When TRUE, HO/HN/HP/HM modifier identifying clinician credential is required

  -- Place of service
  valid_pos_codes              TEXT[],

  -- Coverage
  co_medicaid_covered          BOOLEAN NOT NULL DEFAULT FALSE,
  co_medicaid_rate             NUMERIC(10,2),
  co_medicaid_rate_effective   DATE,
  co_medicaid_rate_per_unit    BOOLEAN DEFAULT TRUE,  -- rate is per-unit (vs per-diem)
  requires_prior_auth          BOOLEAN NOT NULL DEFAULT FALSE,
  telehealth_eligible          BOOLEAN NOT NULL DEFAULT FALSE,
  requires_npi_type_1          BOOLEAN NOT NULL DEFAULT TRUE,  -- individual NPI required in Box 24J

  -- Documentation requirements
  documentation_requirements   TEXT[],

  -- Metadata
  cms_year                     SMALLINT,
  is_active                    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_hcpcs_category    ON hcpcs_codes(category);
CREATE INDEX idx_hcpcs_active      ON hcpcs_codes(is_active);
CREATE INDEX idx_hcpcs_co_medicaid ON hcpcs_codes(co_medicaid_covered);
CREATE INDEX idx_hcpcs_telehealth  ON hcpcs_codes(telehealth_eligible);

ALTER TABLE hcpcs_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_read_hcpcs_codes" ON hcpcs_codes
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_hcpcs_codes" ON hcpcs_codes
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE hcpcs_codes IS
  'HCPCS Level II procedure code reference. CMS publishes Level II publicly. '
  'supervisor_modifier_required drives validation that HO/HN/HP/HM is present on the line. '
  'unit_definition identifies billing basis (per 15 min, per diem, per session). '
  'co_medicaid_rate is the published Colorado HCPF fee schedule rate.';

-- Seed Colorado Medicaid H-codes
INSERT INTO hcpcs_codes (
  code, code_set, short_description, long_description, category,
  unit_definition, default_units, min_units, max_units_per_day,
  typical_minutes_per_unit,
  common_modifiers, supervisor_modifier_required,
  valid_pos_codes,
  co_medicaid_covered, co_medicaid_rate, co_medicaid_rate_effective,
  co_medicaid_rate_per_unit, requires_prior_auth, telehealth_eligible,
  documentation_requirements, cms_year, is_active
) VALUES

  ('H0001',
   'L2', 'Alcohol and/or drug assessment',
   'Alcohol and/or drug assessment',
   'SUD Assessment',
   'per assessment', 1, 1, 1, NULL,
   ARRAY['HO','HN','HP','HM','GT','95'],
   TRUE,
   ARRAY['02','10','11','12','13','22'],
   TRUE, 175.00, '2025-01-01',
   TRUE, FALSE, TRUE,
   ARRAY[
     'Document all substances used: type, frequency, quantity, route',
     'DSM-5 SUD diagnosis for each substance',
     'CAGE-AID, AUDIT, or DAST screening scores if used',
     'ASAM level of care determination',
     'Prior treatment history',
     'Medical and psychiatric co-morbidities',
     'Social determinants (housing, employment, legal)',
     'Treatment recommendations with clinical rationale',
     'Clinician credential modifier required (HO/HN/HP/HM)'
   ],
   2025, TRUE),

  ('H0031',
   'L2', 'Mental health assessment, by non-physician',
   'Mental health assessment, by non-physician',
   'Mental Health Assessment',
   'per assessment', 1, 1, 1, NULL,
   ARRAY['HO','HN','HP','HM','GT','95','U4'],
   TRUE,
   ARRAY['02','10','11','12','13','22'],
   TRUE, 195.00, '2025-01-01',
   TRUE, FALSE, TRUE,
   ARRAY[
     'Chief complaint and presenting problem',
     'History of present illness',
     'Psychiatric and medical history',
     'Mental Status Examination (all domains)',
     'DSM-5 diagnosis with clinical rationale',
     'Risk assessment (SI, HI, self-harm, substance use)',
     'Functional impairment documentation',
     'Treatment recommendations',
     'Clinician credential modifier required (HO/HN/HP/HM)',
     'U4 optional for assessment/diagnostic distinction'
   ],
   2025, TRUE),

  ('H0032',
   'L2', 'Mental health service plan development by non-physician',
   'Mental health service plan development, by non-physician',
   'Mental Health Treatment',
   'per plan', 1, 1, 1, NULL,
   ARRAY['HO','HN','HP','HM'],
   TRUE,
   ARRAY['02','10','11','12'],
   TRUE, 125.00, '2025-01-01',
   TRUE, FALSE, FALSE,
   ARRAY[
     'DSM-5 diagnosis must be established prior to or concurrent with plan',
     'Measurable, time-bound treatment goals',
     'Specific objectives for each goal',
     'Interventions and frequency of services',
     'Client strengths identified',
     'Barriers to treatment addressed',
     'Client signature or documented attempt to obtain',
     'Clinician credential modifier required (HO/HN/HP/HM)'
   ],
   2025, TRUE),

  ('H0004',
   'L2', 'Behavioral health counseling and therapy, per 15 min',
   'Behavioral health counseling and therapy, per 15 minutes',
   'Mental Health Treatment',
   'per 15 minutes', 4, 1, 8, 15,
   ARRAY['HO','HN','HP','HM','GT','95','HF'],
   TRUE,
   ARRAY['02','10','11','12','13'],
   TRUE, 30.00, '2025-01-01',
   TRUE, FALSE, TRUE,
   ARRAY[
     'Clinician credential modifier required (HO/HN/HP/HM)',
     'HF modifier required for SUD-specific sessions',
     'Document start and stop times',
     'Presenting problem, interventions, patient response',
     'Progress toward treatment plan goals'
   ],
   2025, TRUE),

  ('H2011',
   'L2', 'Crisis intervention service, per 15 min',
   'Crisis intervention service, per 15 minutes',
   'Crisis Services',
   'per 15 minutes', 1, 1, 16, 15,
   ARRAY['HO','HN','HP','HM','HG','GT','95'],
   TRUE,
   ARRAY['02','10','11','12','13','22','23'],
   TRUE, 35.00, '2025-01-01',
   TRUE, FALSE, TRUE,
   ARRAY[
     'Document nature and onset of crisis',
     'Risk level assessment documented',
     'Safety plan reviewed or developed',
     'Interventions and patient response',
     'Disposition and follow-up plan',
     'HG modifier for crisis intervention setting',
     'Start and stop times required'
   ],
   2025, TRUE),

  ('H2014',
   'L2', 'Skills training and development, per 15 min',
   'Skills training and development, per 15 minutes',
   'Community Support',
   'per 15 minutes', 1, 1, 8, 15,
   ARRAY['HO','HN','HP','HM'],
   TRUE,
   ARRAY['11','12','99'],
   TRUE, 22.00, '2025-01-01',
   TRUE, FALSE, FALSE,
   ARRAY[
     'Specific skill being taught must be documented',
     'Alignment with treatment plan goal',
     'Patient progress and response to skill training',
     'Start and stop times',
     'Clinician credential modifier required'
   ],
   2025, TRUE),

  ('H2015',
   'L2', 'Comprehensive community support svcs, per 15 min',
   'Comprehensive community support services, per 15 minutes',
   'Community Support',
   'per 15 minutes', 1, 1, 8, 15,
   ARRAY['HO','HN','HP','HM'],
   TRUE,
   ARRAY['11','12','99'],
   TRUE, 25.00, '2025-01-01',
   TRUE, FALSE, FALSE,
   ARRAY[
     'Document specific community support activity',
     'Location (home, community) must be documented',
     'Purpose and alignment with treatment plan',
     'Start and stop times required',
     'Clinician credential modifier required'
   ],
   2025, TRUE),

  ('H2019',
   'L2', 'Therapeutic behavioral services, per 15 min',
   'Therapeutic behavioral services, per 15 minutes',
   'Mental Health Treatment',
   'per 15 minutes', 4, 1, 8, 15,
   ARRAY['HO','HN','HP','HM','HA','HB'],
   TRUE,
   ARRAY['11','12'],
   TRUE, 28.00, '2025-01-01',
   TRUE, FALSE, FALSE,
   ARRAY[
     'Behavioral intervention procedures documented',
     'Target behaviors specified with baseline',
     'Intervention strategy and data collected',
     'Progress or regression noted',
     'Clinician credential modifier required'
   ],
   2025, TRUE),

  ('H0015',
   'L2', 'SUD intensive outpatient treatment',
   'Alcohol and/or drug services; intensive outpatient (treatment program that operates at least 3 hours/day and at least 3 days/week)',
   'SUD Treatment',
   'per diem', 1, 1, 1, NULL,
   ARRAY['HF','HO','HN','HP','HM'],
   TRUE,
   ARRAY['11','57'],
   TRUE, 120.00, '2025-01-01',
   FALSE, TRUE, FALSE,
   ARRAY[
     'IOP criteria must be met and documented',
     'Minimum 3 hours service per day documented',
     'Group and individual services documented',
     'Daily clinical note with patient response',
     'HF modifier required',
     'Prior auth typically required'
   ],
   2025, TRUE),

  ('H0020',
   'L2', 'Alcohol and/or drug services; methadone admin',
   'Alcohol and/or drug services; methadone administration and/or service (provision of the drug by a licensed program)',
   'Methadone/MAT',
   'per diem', 1, 1, 1, NULL,
   ARRAY['HF'],
   FALSE,
   ARRAY['11'],
   TRUE, 14.00, '2025-01-01',
   FALSE, FALSE, FALSE,
   ARRAY[
     'Licensed OTP (Opioid Treatment Program) required',
     'Daily dose and administration documented',
     'DEA Schedule II registration required',
     'Federal OTP regulations apply (42 CFR Part 8)'
   ],
   2025, TRUE),

  ('H2023',
   'L2', 'Supported employment, per 15 min',
   'Supported employment, per 15 minutes',
   'Community Support',
   'per 15 minutes', 1, 1, 8, 15,
   ARRAY['HO','HN','HP','HM'],
   TRUE,
   ARRAY['11','99'],
   TRUE, 18.00, '2025-01-01',
   TRUE, FALSE, FALSE,
   ARRAY[
     'Employment goal documented in treatment plan',
     'Specific supported employment activity documented',
     'Job site or employer documented where applicable',
     'Start and stop times required'
   ],
   2025, TRUE)

ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- SECTION 5 — modifiers
-- ============================================================
--
-- Purpose:
--   HCPCS/CPT modifier reference table. Modifiers append to
--   procedure codes to indicate special circumstances (setting,
--   provider credential, service type, telehealth). Up to 4
--   modifiers per service line (837P SV1 segment).
--
-- Key Fields:
--   code            2-character modifier code
--   modifier_type   Pricing (affects reimbursement) | Informational | Non-payable
--   applies_to      Code families this modifier is valid for
--   billing_impact  How this modifier affects claim adjudication
--   co_medicaid_accepted  FALSE blocks claim from CO Medicaid submission
--
-- Colorado Medicaid Note:
--   HO/HN/HP/HM identify clinician credential level for most H-codes.
--   GT/95 identify telehealth delivery method.
--   U1–U9 are Colorado Medicaid state-specific modifiers.
--
-- Relationships:
--   Referenced by claim_line_items.modifier_1..4 (TEXT columns)
-- ============================================================

CREATE TABLE IF NOT EXISTS modifiers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT UNIQUE NOT NULL,
  description          TEXT NOT NULL,
  long_description     TEXT,
  modifier_type        TEXT NOT NULL DEFAULT 'Informational'
                         CHECK (modifier_type IN ('Pricing','Informational','Non-payable')),
  modifier_group       TEXT NOT NULL
                         CHECK (modifier_group IN (
                           'Credential Level','Service Setting','Telehealth',
                           'Population','Program Type','Funding Source',
                           'State-Specific','Billing','Other'
                         )),
  applies_to           TEXT[],   -- ['H0031','H0001','90837','ALL'] or code families
  co_medicaid_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  billing_impact       TEXT,     -- narrative of effect on claim adjudication
  use_case_notes       TEXT,     -- when to use this modifier
  cannot_combine_with  TEXT[],   -- incompatible modifier codes
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_modifiers_group    ON modifiers(modifier_group);
CREATE INDEX idx_modifiers_accepted ON modifiers(co_medicaid_accepted);
CREATE INDEX idx_modifiers_active   ON modifiers(is_active);
CREATE INDEX idx_modifiers_applies  ON modifiers USING GIN(applies_to);

ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_read_modifiers" ON modifiers
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_modifiers" ON modifiers
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE modifiers IS
  'HCPCS/CPT modifier reference. Up to 4 modifiers per service line per X12 SV1. '
  'co_medicaid_accepted = FALSE blocks submission to CO Medicaid. '
  'cannot_combine_with enforces modifier compatibility rules at the application layer.';

-- Seed Colorado Medicaid Behavioral Health modifiers
INSERT INTO modifiers (
  code, description, long_description, modifier_type, modifier_group,
  applies_to, co_medicaid_accepted, billing_impact, use_case_notes, cannot_combine_with, is_active
) VALUES

  -- ── CREDENTIAL LEVEL MODIFIERS ────────────────────────────────────
  ('HO', 'Master''s degree-level',
   'Master''s degree level',
   'Informational', 'Credential Level',
   ARRAY['H0001','H0031','H0032','H0004','H2011','H2014','H2015','H2019','H2023'],
   TRUE,
   'Identifies rendering clinician holds a Master''s degree (LPC, LCSW, LMFT, LAC). '
   'Required by CO Medicaid on most H-codes.',
   'Use when rendering provider holds an LPC, LCSW, LMFT, LAC, or equivalent CO-licensed Master''s credential.',
   ARRAY['HN','HP','HM'], TRUE),

  ('HN', 'Bachelor''s degree-level',
   'Bachelor''s degree level',
   'Informational', 'Credential Level',
   ARRAY['H0001','H0031','H0032','H0004','H2014','H2015','H2019'],
   TRUE,
   'Identifies rendering clinician holds a Bachelor''s degree. '
   'Rate may differ from HO. Required on applicable H-codes.',
   'Use when rendering provider holds a Bachelor''s degree as highest credential for this service.',
   ARRAY['HO','HP','HM'], TRUE),

  ('HP', 'Doctoral level',
   'Doctoral level',
   'Informational', 'Credential Level',
   ARRAY['H0001','H0031','H0032','H0004','H2011','H2014','H2015'],
   TRUE,
   'Identifies rendering clinician holds a doctoral degree (PhD, PsyD, EdD). '
   'May affect reimbursement rate per CO Medicaid fee schedule.',
   'Use when rendering provider is a licensed psychologist or doctoral-level clinician.',
   ARRAY['HO','HN','HM'], TRUE),

  ('HM', 'Less than bachelor''s degree-level',
   'Less than bachelor''s degree level',
   'Informational', 'Credential Level',
   ARRAY['H0004','H2014','H2015','H2019'],
   TRUE,
   'Identifies rendering staff with less than a bachelor''s degree. '
   'Typically applies to paraprofessionals and community health workers.',
   'Use for paraprofessionals providing skills training, community support, or peer services.',
   ARRAY['HO','HN','HP'], TRUE),

  -- ── SERVICE SETTING/PROGRAM MODIFIERS ─────────────────────────────
  ('HE', 'Mental health program',
   'Mental health program',
   'Informational', 'Program Type',
   ARRAY['ALL'],
   TRUE,
   'Identifies service delivered within a mental health program context.',
   'Use to indicate mental health program setting when payer requires program identification.',
   ARRAY['HF'], TRUE),

  ('HF', 'Substance abuse program',
   'Substance abuse program',
   'Informational', 'Program Type',
   ARRAY['H0001','H0004','H0015','H0020','H2011'],
   TRUE,
   'Identifies service delivered within a substance use/addiction treatment program. '
   'Required on most SUD H-codes for CO Medicaid.',
   'Required for SUD-specific H-codes. Cannot combine with HE on same line.',
   ARRAY['HE'], TRUE),

  ('HG', 'Crisis intervention',
   'Crisis intervention program',
   'Informational', 'Program Type',
   ARRAY['H2011','90839','90840'],
   TRUE,
   'Identifies service delivered in crisis intervention context.',
   'Use on H2011 and 90839/90840 when service is a formal crisis intervention.',
   ARRAY[], TRUE),

  ('HA', 'Child/adolescent program',
   'Child/adolescent program',
   'Informational', 'Population',
   ARRAY['ALL'],
   TRUE,
   'Identifies service targeted to child and/or adolescent population. '
   'May affect rate or coverage determination.',
   'Use when patient is a child or adolescent and payer requires population identifier.',
   ARRAY['HB','HC'], TRUE),

  ('HB', 'Adult program, non-geriatric',
   'Adult program, non-geriatric',
   'Informational', 'Population',
   ARRAY['ALL'],
   TRUE,
   'Identifies service for adult non-geriatric population.',
   'Use when payer requires adult population identification. Typically not required for routine billing.',
   ARRAY['HA','HC'], TRUE),

  ('HC', 'Adult program, geriatric',
   'Adult program, geriatric',
   'Informational', 'Population',
   ARRAY['ALL'],
   TRUE,
   'Identifies service for geriatric population.',
   'Use when patient is geriatric and payer requires population identification.',
   ARRAY['HA','HB'], TRUE),

  ('HD', 'Pregnant/parenting women''s program',
   'Pregnant/parenting women''s program',
   'Informational', 'Population',
   ARRAY['H0001','H0004','H0015'],
   TRUE,
   'Identifies service delivered in a pregnant/parenting women''s program.',
   'Use for women who are pregnant or parenting in specialized SUD treatment programs.',
   ARRAY[], TRUE),

  ('HH', 'Integrated MH/SUD program',
   'Integrated mental health/substance abuse program',
   'Informational', 'Program Type',
   ARRAY['H0031','H0001','H0032','H0004'],
   TRUE,
   'Identifies service delivered in a co-occurring/integrated MH+SUD program.',
   'Use when the program treats both mental health and substance use disorders concurrently.',
   ARRAY['HE','HF'], TRUE),

  ('HI', 'Integrated MH/ID-DD program',
   'Integrated mental health and intellectual disability/developmental disabilities program',
   'Informational', 'Program Type',
   ARRAY['ALL'],
   TRUE,
   'Identifies service in program serving both MH and ID/DD populations.',
   'Use when program serves individuals with co-occurring mental health and developmental disabilities.',
   ARRAY[], TRUE),

  ('HJ', 'Employee of the client',
   'Employee of the client',
   'Informational', 'Service Setting',
   ARRAY['ALL'],
   TRUE,
   'Identifies that the rendering provider is employed by the patient/client (EAP context).',
   'Rarely used in standard behavioral health. Applies to EAP-funded services.',
   ARRAY[], TRUE),

  ('HK', 'Specialized MH for high-risk populations',
   'Specialized mental health programs for high-risk populations',
   'Informational', 'Program Type',
   ARRAY['ALL'],
   TRUE,
   'Identifies specialized program serving high-risk mental health population (e.g. ACT, FACT).',
   'Use for Assertive Community Treatment, Forensic ACT, or other designated high-risk programs.',
   ARRAY[], TRUE),

  ('HQ', 'Group setting',
   'Group setting',
   'Informational', 'Service Setting',
   ARRAY['90853','H0004','H2011'],
   TRUE,
   'Identifies service delivered in group format. Required for 90853.',
   'Required on group therapy codes. Identifies 2 or more patients receiving service simultaneously.',
   ARRAY['HS','HR'], TRUE),

  ('HR', 'Family/couple without client present',
   'Family/couple with or without client present; non-client-centered',
   'Informational', 'Service Setting',
   ARRAY['90846'],
   TRUE,
   'Identifies family therapy delivered without the identified patient present.',
   'Use with 90846 (family therapy without patient). Documents patient is not in session.',
   ARRAY['HQ','HS'], TRUE),

  ('HS', 'Family/couple with client present',
   'Family/couple with client present',
   'Informational', 'Service Setting',
   ARRAY['90847'],
   TRUE,
   'Identifies conjoint family therapy with patient present.',
   'Use with 90847 (family therapy with patient). Documents patient attended the session.',
   ARRAY['HQ','HR'], TRUE),

  ('HT', 'Multi-disciplinary team',
   'Multi-disciplinary team',
   'Informational', 'Service Setting',
   ARRAY['ALL'],
   TRUE,
   'Identifies service delivered by or in coordination with a multi-disciplinary team.',
   'Use for ACT team services, collaborative care model, or IDT/MDT services.',
   ARRAY[], TRUE),

  ('HU', 'Funded by child welfare agency',
   'Funded by child welfare agency',
   'Informational', 'Funding Source',
   ARRAY['ALL'],
   TRUE,
   'Identifies service funded through a child welfare agency (DHS, foster care).',
   'Use when child welfare agency is the funding source or payor for services.',
   ARRAY['HV','HW'], TRUE),

  ('HV', 'Funded by state addictions agency',
   'Funded by state addictions agency',
   'Informational', 'Funding Source',
   ARRAY['H0001','H0004','H0015','H0020'],
   TRUE,
   'Identifies service funded by state substance use disorder treatment agency.',
   'Use for BHASO-funded or CBHC SUD-specific contracts.',
   ARRAY['HU','HW'], TRUE),

  ('HW', 'Funded by state MH agency',
   'Funded by state mental health agency',
   'Informational', 'Funding Source',
   ARRAY['H0031','H0032','H0004'],
   TRUE,
   'Identifies service funded by state mental health agency.',
   'Use for CBHC/CMH contracts where state mental health agency is the primary funder.',
   ARRAY['HU','HV'], TRUE),

  -- ── TELEHEALTH MODIFIERS ──────────────────────────────────────────
  ('GT', 'Via interactive audio and video',
   'Via interactive audio and video telecommunication systems',
   'Informational', 'Telehealth',
   ARRAY['ALL'],
   TRUE,
   'Identifies telehealth service via synchronous audio-video. '
   'Required by many payers for telehealth billing. Use with POS 02 or 10.',
   'Use for synchronous video-based services. Requires HIPAA-compliant platform (BAA required). '
   'POS 02 (telehealth) or POS 10 (telehealth in patient''s home) required.',
   ARRAY['GQ'], TRUE),

  ('95', 'Synchronous telemedicine; interactive audio/video',
   'Synchronous telemedicine service rendered via a real-time interactive audio and video telecommunications system',
   'Informational', 'Telehealth',
   ARRAY['ALL'],
   TRUE,
   'Identifies synchronous telemedicine per CMS telehealth policy. '
   'Required by many commercial payers. Use with POS 02 or 10.',
   'CMS preferred modifier for telehealth since 2022. More widely accepted than GT for commercial payers. '
   'Requires real-time interactive audio-video, HIPAA-compliant platform, and patient consent.',
   ARRAY['GQ'], TRUE),

  ('GQ', 'Via asynchronous telecommunications',
   'Via asynchronous telecommunications system',
   'Informational', 'Telehealth',
   ARRAY['ALL'],
   FALSE,
   'CO Medicaid does not accept asynchronous telehealth. Not billable for standard BH services.',
   'Asynchronous (store-and-forward) telehealth. NOT accepted by CO Medicaid for behavioral health. '
   'Check individual payer policies before use.',
   ARRAY['GT','95'], TRUE),

  -- ── STATE-SPECIFIC (COLORADO MEDICAID) ────────────────────────────
  ('U1', 'Medicaid level of care 1',
   'Medicaid level of care 1',
   'Informational', 'State-Specific',
   ARRAY['ALL'],
   TRUE,
   'Colorado Medicaid state-specific modifier. Level of care designation 1.',
   'CO Medicaid state modifier. Consult HCPF billing guidance for current use.',
   ARRAY[], TRUE),

  ('U2', 'Medicaid level of care 2',
   'Medicaid level of care 2',
   'Informational', 'State-Specific',
   ARRAY['ALL'],
   TRUE,
   'Colorado Medicaid state-specific modifier. Level of care designation 2.',
   'CO Medicaid state modifier. Consult HCPF billing guidance for current use.',
   ARRAY[], TRUE),

  ('U4', 'Medicaid level of care 4 / assessment/diagnostic',
   'Medicaid level of care 4; often used to designate assessment or diagnostic service',
   'Informational', 'State-Specific',
   ARRAY['H0031','H0001'],
   TRUE,
   'CO Medicaid modifier often used to distinguish assessment/diagnostic services. '
   'Drives reimbursement decisions at the payer level.',
   'Used with H0031 and H0001 when service is the initial assessment/diagnostic encounter. '
   'Consult HCPF billing bulletins for current guidance.',
   ARRAY[], TRUE),

  ('U5', 'Medicaid — alcohol use',
   'Medicaid level of care 5; alcohol use',
   'Informational', 'State-Specific',
   ARRAY['H0001','H0004','H0015'],
   TRUE,
   'CO Medicaid state modifier indicating primary substance is alcohol.',
   'Use when primary substance of concern is alcohol. Applies to SUD assessment and treatment codes.',
   ARRAY['U6','U7'], TRUE),

  ('U6', 'Medicaid — drug other than alcohol',
   'Medicaid level of care 6; drug other than alcohol',
   'Informational', 'State-Specific',
   ARRAY['H0001','H0004','H0015'],
   TRUE,
   'CO Medicaid state modifier indicating primary substance is a drug other than alcohol.',
   'Use when primary substance of concern is a drug other than alcohol (opioids, stimulants, cannabis, etc.).',
   ARRAY['U5','U7'], TRUE),

  ('U7', 'Medicaid — multiple substances',
   'Medicaid level of care 7; multiple substances',
   'Informational', 'State-Specific',
   ARRAY['H0001','H0004','H0015'],
   TRUE,
   'CO Medicaid state modifier indicating multiple substances of concern.',
   'Use when patient presents with polysubstance use as the primary clinical focus.',
   ARRAY['U5','U6'], TRUE),

  ('U8', 'Medicaid — services to other',
   'Medicaid level of care 8; services to significant other',
   'Informational', 'State-Specific',
   ARRAY['ALL'],
   TRUE,
   'CO Medicaid state modifier for services directed at a significant other (not the patient).',
   'Use when the beneficiary of service is a family member or significant other, not the enrolled patient.',
   ARRAY[], TRUE),

  ('U9', 'Medicaid — client is member of specific group',
   'Medicaid level of care 9; client is a member of a specific group',
   'Informational', 'State-Specific',
   ARRAY['ALL'],
   TRUE,
   'CO Medicaid state modifier for services to a member of a designated priority population.',
   'Consult CO Medicaid HCPF billing guidance for current population designations requiring U9.',
   ARRAY[], TRUE),

  -- ── BILLING MODIFIERS ─────────────────────────────────────────────
  ('SA', 'NP collaboration with physician',
   'Nurse practitioner rendering service in collaboration with physician',
   'Informational', 'Billing',
   ARRAY['ALL'],
   TRUE,
   'Used when NP renders service under physician collaborative agreement.',
   'Required when a nurse practitioner is providing services under a physician collaborative practice agreement. '
   'Verify CO NP scope of practice and payer requirements.',
   ARRAY[], TRUE),

  ('TF', 'Intermediate level of care',
   'Intermediate level of care',
   'Pricing', 'Billing',
   ARRAY['H0015'],
   TRUE,
   'Designates intermediate level of care within a tiered service program.',
   'Used to distinguish service intensity levels in IOP and residential programs.',
   ARRAY['TG'], TRUE),

  ('TG', 'Complex/high-tech level of care',
   'Complex/high tech level of care',
   'Pricing', 'Billing',
   ARRAY['H0015'],
   TRUE,
   'Designates complex or high-technology level of care within a tiered program.',
   'Used for highest acuity level in tiered IOP/residential programs.',
   ARRAY['TF'], TRUE),

  ('TJ', 'Program group, child and/or adolescent',
   'Program group, child and/or adolescent',
   'Informational', 'Program Type',
   ARRAY['90853','H0004'],
   TRUE,
   'Identifies group service delivered within a child/adolescent program.',
   'Combine with HA (child/adolescent) population modifier when both program type and group format needed.',
   ARRAY[], TRUE),

  ('XE', 'Separate encounter',
   'Separate encounter, a service that is distinct because it occurred during a separate encounter',
   'Non-payable', 'Billing',
   ARRAY['ALL'],
   FALSE,
   'Indicates service occurred during a separate and distinct encounter. '
   'CO Medicaid typically does not accept XE modifier. Verify per-payer.',
   'Use when two same-code services occur on the same DOS but in separate, distinct encounters. '
   'Not typically required for behavioral health in CO Medicaid.',
   ARRAY[], TRUE)

ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- SECTION 6 — claim_diagnosis_codes
-- ============================================================
--
-- Purpose:
--   Normalized CMS-1500 Box 21 diagnosis codes at the claim
--   header level. Up to 12 entries per claim (pointers A–L).
--   Service line pointer references in claim_line_items.
--   icd10_pointer_1..4 reference these pointer_letters.
--
-- Key Fields:
--   pointer_letter   A through L (CMS-1500 Box 21 ordering)
--   sequence         1–12 (numeric equivalent for sorting)
--   icd10_code       ICD-10-CM code string (e.g. 'F32.1')
--   is_principal     TRUE = first-listed/principal diagnosis
--   is_admitting     Used for inpatient claims; admitting dx
--
-- Relationships:
--   → claims(id)                       (claim_id)
--   → icd10_codes(id) (optional FK)    (icd10_code_id — set after icd10_codes created)
--
-- Service line pointers:
--   claim_line_items.icd10_pointer_1..4 reference the
--   pointer_letter values stored here (e.g. 'A', 'B', 'C').
--
-- Note:
--   Distinct from appointment_diagnoses which captures clinical
--   diagnosis-to-appointment assignment. This table captures the
--   claim submission fact — the codes as submitted on the 837P.
-- ============================================================

CREATE TABLE IF NOT EXISTS claim_diagnosis_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  pointer_letter  TEXT NOT NULL
                    CHECK (pointer_letter IN ('A','B','C','D','E','F','G','H','I','J','K','L')),
  sequence        SMALLINT NOT NULL
                    CHECK (sequence BETWEEN 1 AND 12),
  icd10_code      TEXT NOT NULL,    -- ICD-10-CM code e.g. 'F32.1', 'Z59.9'
  icd10_code_id   UUID,             -- FK to icd10_codes(id) once that table exists
  is_principal    BOOLEAN NOT NULL DEFAULT FALSE,
  is_admitting    BOOLEAN NOT NULL DEFAULT FALSE,  -- Inpatient only
  code_qualifier  TEXT NOT NULL DEFAULT 'ABK'
                    CHECK (code_qualifier IN ('ABK','ABF','BK','BF')),
                    -- ABK = ICD-10-CM Principal Diagnosis (837P BHT03 = 'ABK')
                    -- ABF = ICD-10-CM Other Diagnosis
                    -- BK = obsolete ICD-9 principal
                    -- BF = obsolete ICD-9 other
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_claim_dx_pointer ON claim_diagnosis_codes(claim_id, pointer_letter);
CREATE UNIQUE INDEX idx_claim_dx_seq     ON claim_diagnosis_codes(claim_id, sequence);
CREATE UNIQUE INDEX idx_claim_dx_principal ON claim_diagnosis_codes(claim_id)
  WHERE is_principal = TRUE;
CREATE INDEX idx_claim_dx_claim          ON claim_diagnosis_codes(claim_id);
CREATE INDEX idx_claim_dx_code           ON claim_diagnosis_codes(icd10_code);

ALTER TABLE claim_diagnosis_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_claim_dx" ON claim_diagnosis_codes
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE claim_diagnosis_codes IS
  'CMS-1500 Box 21 diagnosis code assignment. One row per pointer letter (A–L). '
  'pointer_letter matches icd10_pointer_1..4 on claim_line_items. '
  'code_qualifier ABK = principal diagnosis ICD-10-CM per X12 837P HI segment. '
  'is_principal must be TRUE for exactly one row per claim. '
  'Distinct from appointment_diagnoses (clinical record); this is the claim submission record.';


-- ============================================================
-- SECTION 7 — claim_submission_history
-- ============================================================
--
-- Purpose:
--   Per-claim log of every submission and resubmission attempt.
--   Distinct from claim_status_history (which tracks status
--   transitions) and office_ally_transactions (which is per
--   API call). This table provides a billing-facing timeline
--   of when a claim was built, exported, and transmitted.
--
-- Key Fields:
--   submission_number     Sequential attempt counter (1st, 2nd, etc.)
--   claim_frequency_code  1=Original, 7=Corrected, 8=Void
--   clearinghouse         Transmission destination
--   batch_ref             Clearinghouse batch identifier
--   icn_assigned          Internal Control Number assigned by clearinghouse
--   payer_icn             Payer's claim control number (CMS-1500 Box 22)
--   ta1_received          999/TA1 interchange acknowledgment received
--   ta1_result            Accepted/Rejected
--   fa_received           999 Functional Acknowledgment received
--   fa_result             Accepted/Rejected
--   is_accepted           Final accept/reject determination
--   rejection_codes       Array of error codes from TA1 or 999
--
-- Relationships:
--   → claims(id)                    (claim_id)
--   → office_ally_transactions(id)  (oa_transaction_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS claim_submission_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id              UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  oa_transaction_id     UUID REFERENCES office_ally_transactions(id) ON DELETE SET NULL,

  -- Submission sequencing
  submission_number     SMALLINT NOT NULL DEFAULT 1,
  claim_frequency_code  TEXT NOT NULL DEFAULT '1'
                          CHECK (claim_frequency_code IN ('1','7','8')),
  is_resubmission       BOOLEAN NOT NULL DEFAULT FALSE,
  is_corrected          BOOLEAN NOT NULL DEFAULT FALSE,
  is_void               BOOLEAN NOT NULL DEFAULT FALSE,
  prior_claim_ref       TEXT,   -- ICN or payer claim number being corrected/voided

  -- Transmission
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submission_method     TEXT NOT NULL DEFAULT 'EDI'
                          CHECK (submission_method IN ('EDI','Portal','Paper','Fax','Direct')),
  clearinghouse         TEXT NOT NULL DEFAULT 'Office Ally',
  batch_ref             TEXT,   -- Clearinghouse batch ID (OA batch number)
  edi_837_filename      TEXT,   -- Filename of 837P file if applicable

  -- Clearinghouse identifiers
  icn_assigned          TEXT,   -- Internal Control Number from clearinghouse
  payer_icn             TEXT,   -- Payer's claim control number (Box 22 resubmission)
  oa_batch_id           TEXT,   -- Office Ally batch identifier

  -- TA1 Interchange Acknowledgment
  ta1_received_at       TIMESTAMPTZ,
  ta1_result            TEXT CHECK (ta1_result IN ('Accepted','Rejected',NULL)),
  ta1_error_code        TEXT,   -- TA1 segment error code (e.g. I14, I15)
  ta1_error_description TEXT,

  -- 999 Functional Acknowledgment
  fa_received_at        TIMESTAMPTZ,
  fa_result             TEXT CHECK (fa_result IN ('Accepted','Rejected','Accepted_With_Errors',NULL)),
  fa_error_segment      TEXT,   -- 999 AK2/AK5 segment identifier
  fa_error_codes        TEXT[], -- Array of functional error codes

  -- Final determination
  is_accepted           BOOLEAN,        -- NULL = pending; TRUE = accepted; FALSE = rejected
  rejection_codes       TEXT[],         -- All rejection reason codes collected
  rejection_description TEXT,           -- Human-readable rejection summary

  -- Amounts transmitted
  total_billed          NUMERIC(12,2),  -- Claim total at time of submission
  line_count            SMALLINT,       -- Number of service lines transmitted

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_submission_hist_number ON claim_submission_history(claim_id, submission_number);
CREATE INDEX idx_submission_hist_claim          ON claim_submission_history(claim_id);
CREATE INDEX idx_submission_hist_at             ON claim_submission_history(submitted_at);
CREATE INDEX idx_submission_hist_accepted       ON claim_submission_history(is_accepted);
CREATE INDEX idx_submission_hist_icn            ON claim_submission_history(icn_assigned);
CREATE INDEX idx_submission_hist_payer_icn      ON claim_submission_history(payer_icn);
CREATE INDEX idx_submission_hist_batch          ON claim_submission_history(batch_ref);

ALTER TABLE claim_submission_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_submission_hist" ON claim_submission_history
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE claim_submission_history IS
  'Per-claim submission attempt log. One row per transmission. '
  'submission_number increments with each resubmission. '
  'ta1_result is the X12 TA1 interchange acknowledgment (envelope-level). '
  'fa_result is the X12 999 functional acknowledgment (transaction-set-level). '
  'is_accepted = FALSE triggers a claim_rejection record creation.';


-- ============================================================
-- SECTION 8 — claim_rejections
-- ============================================================
--
-- Purpose:
--   Technical rejection records for claims rejected at the
--   clearinghouse or payer pre-adjudication level.
--
--   DISTINCT FROM denials (denials = payer adjudication decision).
--   Rejections are X12 999/TA1/277CA level failures — the claim
--   was never adjudicated because it failed technical or format
--   validation at the clearinghouse or prior to payer review.
--
--   Common rejection scenarios:
--     - TA1: Invalid ISA envelope (sender ID, date/time format)
--     - 999 FA rejected: Loop/segment structure error in 837P
--     - 277CA: Claim accepted by clearinghouse but rejected by payer
--       (EDI edits: invalid NPI, inactive subscriber, invalid DOS format)
--     - Portal rejection: Pre-submission edits failed in the portal
--
-- Key Fields:
--   rejection_source   Where the rejection originated
--   rejection_level    Technical level of rejection (TA1/999/277CA)
--   error_code         Specific error code from the rejection response
--   fix_required       Text description of what must be corrected
--   fix_status         Tracks resolution workflow
--
-- Relationships:
--   → claims(id)                    (claim_id)
--   → claim_submission_history(id)  (submission_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS claim_rejections (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rejection_ref          TEXT UNIQUE NOT NULL DEFAULT 'REJ-' || gen_random_uuid()::text,
  claim_id               UUID NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
  submission_id          UUID REFERENCES claim_submission_history(id) ON DELETE SET NULL,
  clinician_id           TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,
  patient_id             TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,

  -- Rejection origin
  rejection_source       TEXT NOT NULL
                           CHECK (rejection_source IN (
                             'Clearinghouse','Payer Pre-Adjudication','Portal',
                             'EDI Translation','Office Ally','Manual Review'
                           )),
  rejection_level        TEXT NOT NULL DEFAULT '999 Functional'
                           CHECK (rejection_level IN (
                             'TA1 Interchange','999 Functional','277CA',
                             'Portal Edit','Pre-Authorization Edit','Other'
                           )),

  -- Error detail
  rejection_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  error_code             TEXT NOT NULL,   -- e.g. 'I14', '6', 'PR33', 'E003'
  error_description      TEXT NOT NULL,
  error_segment          TEXT,            -- 837P loop/segment where error occurred
  error_element          TEXT,            -- Specific data element position
  raw_error_response     TEXT,            -- Full TA1 or 999 raw text for debugging

  -- Claim context
  dos                    DATE,
  hcpcs_codes            TEXT[],          -- Which service lines were affected
  payer                  TEXT,

  -- Fix tracking
  fix_required           TEXT NOT NULL,   -- What must be corrected before resubmission
  fix_status             TEXT NOT NULL DEFAULT 'Open'
                           CHECK (fix_status IN (
                             'Open','In Progress','Fixed',
                             'Resubmitted','Voided','Cannot Correct'
                           )),
  fixed_at               TIMESTAMPTZ,
  fixed_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fix_notes              TEXT,

  -- Resubmission tracking
  resubmitted_claim_id   UUID REFERENCES claims(id) ON DELETE SET NULL,
  resubmitted_at         TIMESTAMPTZ,

  -- Assignment
  assigned_to            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at            TIMESTAMPTZ,
  follow_up_date         DATE,

  -- Metadata
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_rejections_claim      ON claim_rejections(claim_id);
CREATE INDEX idx_rejections_clinician  ON claim_rejections(clinician_id);
CREATE INDEX idx_rejections_patient    ON claim_rejections(patient_id);
CREATE INDEX idx_rejections_status     ON claim_rejections(fix_status);
CREATE INDEX idx_rejections_source     ON claim_rejections(rejection_source);
CREATE INDEX idx_rejections_date       ON claim_rejections(rejection_date);
CREATE INDEX idx_rejections_assigned   ON claim_rejections(assigned_to);
CREATE INDEX idx_rejections_followup   ON claim_rejections(follow_up_date);

ALTER TABLE claim_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_rejections" ON claim_rejections
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE claim_rejections IS
  'Technical rejection records. NOT payer denials (see denials table). '
  'Rejections occur before payer adjudication: TA1 envelope error, 999 FA rejected, '
  '277CA pre-adjudication edit failure, or portal edit failures. '
  'fix_status tracks correction workflow through to resubmission. '
  'raw_error_response preserves full response text for IT debugging.';


-- ============================================================
-- SECTION 9 — clearinghouse_responses
-- ============================================================
--
-- Purpose:
--   Structured catalog of clearinghouse response records
--   (999, TA1, 277CA) keyed to specific claims. Extends
--   office_ally_transactions by providing normalized, claim-
--   centric response tracking with structured error segments.
--
--   One row per response file/transaction received from the
--   clearinghouse for a specific claim or batch.
--
-- Key Fields:
--   response_type     999 FA / TA1 / 277CA / ERA Summary / Eligibility 271
--   isa_control       ISA control number for matching
--   ack_code          999 AK9 acceptance code: A=Accepted, R=Rejected, P=Partial
--   error_segments    JSONB array of error segment details from 999 AK2/AK3/AK4
--
-- Relationships:
--   → claims(id)                    (claim_id)
--   → claim_submission_history(id)  (submission_id)
--   → office_ally_transactions(id)  (oa_transaction_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS clearinghouse_responses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id            UUID REFERENCES claims(id) ON DELETE SET NULL,
  submission_id       UUID REFERENCES claim_submission_history(id) ON DELETE SET NULL,
  oa_transaction_id   UUID REFERENCES office_ally_transactions(id) ON DELETE SET NULL,
  clinician_id        TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,

  -- Response identification
  response_type       TEXT NOT NULL
                        CHECK (response_type IN (
                          '999 Functional Acknowledgment','TA1 Interchange Acknowledgment',
                          '277CA Claim Status','835 ERA','271 Eligibility Response',
                          'Portal Response','Other'
                        )),
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  clearinghouse       TEXT NOT NULL DEFAULT 'Office Ally',

  -- X12 envelope identifiers
  isa_control_number  TEXT,
  gs_control_number   TEXT,
  transaction_set_id  TEXT,
  sender_id           TEXT,
  receiver_id         TEXT,

  -- Acknowledgment
  ack_code            TEXT CHECK (ack_code IN ('A','R','P','E',NULL)),
                      --  A = Accepted
                      --  R = Rejected
                      --  P = Partially Accepted
                      --  E = Accepted with Errors
  ack_description     TEXT,

  -- 277CA Claim-level status (when response_type = '277CA Claim Status')
  claim_status_category_code TEXT,   -- X12 STC01-1 (A1, A2, A3, A7, A8, R0–R9, etc.)
  claim_status_code          TEXT,   -- X12 STC01-2
  entity_identifier_code     TEXT,   -- STC02 entity
  claim_ICN_from_payer       TEXT,   -- payer-assigned ICN

  -- Structured errors (from 999 AK2/AK3/AK4 or 277CA STC)
  error_segments      JSONB,
  -- [
  --   {
  --     "segment": "NM1",
  --     "element_position": "09",
  --     "error_code": "8",
  --     "error_description": "Invalid/Missing Identification Number"
  --   }
  -- ]

  -- Raw response
  raw_response        TEXT,         -- Full X12 transaction text

  -- Resolution link
  rejection_id        UUID REFERENCES claim_rejections(id) ON DELETE SET NULL,

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ch_responses_claim      ON clearinghouse_responses(claim_id);
CREATE INDEX idx_ch_responses_submission ON clearinghouse_responses(submission_id);
CREATE INDEX idx_ch_responses_type       ON clearinghouse_responses(response_type);
CREATE INDEX idx_ch_responses_isa        ON clearinghouse_responses(isa_control_number);
CREATE INDEX idx_ch_responses_ack        ON clearinghouse_responses(ack_code);
CREATE INDEX idx_ch_responses_received   ON clearinghouse_responses(received_at);
CREATE INDEX idx_ch_responses_errors     ON clearinghouse_responses USING GIN(error_segments);

ALTER TABLE clearinghouse_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_ch_responses" ON clearinghouse_responses
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE clearinghouse_responses IS
  'Structured clearinghouse response catalog (999 FA, TA1, 277CA). '
  'Extends office_ally_transactions with normalized claim-centric response data. '
  'error_segments JSONB array maps directly to X12 AK2/AK3/AK4 error identification. '
  'claim_status_category_code and claim_status_code are X12 STC01 values from 277CA. '
  'ack_code: A=Accepted, R=Rejected, P=Partial, E=Accepted with Errors.';


-- ============================================================
-- SECTION 10 — DEFERRED FK CONSTRAINTS
-- ============================================================
--
-- These constraints could not be added in coding-billing-schema.sql
-- because the referenced tables (prior_authorizations, referrals,
-- appeals, insurance_payers, insurance_policies) did not yet exist
-- at the time that schema runs. Apply here after all prerequisites
-- are in place.
-- ============================================================

-- prior_auth_id FK on claims
ALTER TABLE claims
  ADD CONSTRAINT fk_claims_prior_auth
  FOREIGN KEY (prior_auth_id)
  REFERENCES prior_authorizations(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- referral_id FK on claims
ALTER TABLE claims
  ADD CONSTRAINT fk_claims_referral
  FOREIGN KEY (referral_id)
  REFERENCES referrals(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- appeal_id FK on denials (back-reference)
ALTER TABLE denials
  ADD CONSTRAINT fk_denials_appeal
  FOREIGN KEY (appeal_id)
  REFERENCES appeals(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- icd10_code_id FK on claim_diagnosis_codes
-- (Deferred until icd10_codes table is created in appointment-clinical-schema.sql)
-- ALTER TABLE claim_diagnosis_codes
--   ADD CONSTRAINT fk_claim_dx_icd10
--   FOREIGN KEY (icd10_code_id)
--   REFERENCES icd10_codes(id)
--   ON DELETE SET NULL
--   DEFERRABLE INITIALLY DEFERRED;


-- ============================================================
-- SECTION 11 — SUPERVISING PROVIDER BILLING REQUIREMENTS
-- ============================================================
--
-- Colorado Medicaid Rules for Supervised Clinician Billing:
--
--   1. Supervised clinician must hold an active NPI (Type 1) and
--      be enrolled with HCPF as a rendering provider.
--
--   2. The clinical note must be co-signed by the supervisor
--      BEFORE the claim is submitted.
--      → claims.supervisor_cosign_required = TRUE
--      → claims.supervisor_cosign_at must be populated
--      → Enforced by claim_readiness_check VIEW
--
--   3. The supervisor's NPI goes in CMS-1500 Box 17a/17b
--      (Referring/Ordering/Supervising Provider).
--      → claims.supervising_npi (TEXT, denormalized)
--      → claims.supervising_provider_id (FK to rendering_providers)
--
--   4. The supervised clinician's NPI goes in Box 24J
--      (Rendering Provider per line).
--      → claim_line_items rendering NPI = supervised clinician's NPI
--
--   5. When bill_under_supervisor = TRUE:
--      - Supervisor's NPI is also used in Box 33 (Billing Provider)
--      - This requires billing_provider_id points to a billing
--        entity that lists the supervisor as the billing NPI.
--      - The supervised clinician's NPI is still in Box 24J.
--
--   6. The supervisor must be credentialed with the payer.
--      → provider_credentials.payer_credentialing_status = 'Active'
--      → Validated at application layer via rendering_providers.id
--
--   7. Credential identifier for CO Medicaid:
--      → supervising_npi must match a provider_npis record with
--        npi_type = 'Type 1' and is_active = TRUE
--
-- Required claim fields when supervisor billing is active:
-- ──────────────────────────────────────────────────────────
-- Field                     Type           Required
-- ──────────────────────────────────────────────────────────
-- claims.supervising_npi        TEXT         REQUIRED
-- claims.supervising_provider_id UUID        REQUIRED (FK)
-- claims.supervisor_cosign_required BOOLEAN  SET TRUE
-- claims.supervisor_cosign_at   TIMESTAMPTZ  REQUIRED BEFORE SUBMIT
-- claims.supervisor_cosign_by   UUID         REQUIRED BEFORE SUBMIT
-- claims.rendering_npi          TEXT         REQUIRED (supervised clinician)
-- claims.rendering_provider_id  UUID         REQUIRED (FK)
-- supervision_relationships.*   existing     Verified independently
-- ============================================================

-- View: which claims are blocked pending supervisor co-sign
CREATE OR REPLACE VIEW claims_pending_cosign AS
SELECT
  c.id                          AS claim_id,
  c.claim_ref,
  c.patient_id,
  c.clinician_id,
  c.dos_from,
  c.payer_name,
  c.status,
  c.rendering_npi,
  c.supervising_npi,
  c.supervisor_cosign_required,
  c.supervisor_cosign_at,
  c.supervisor_cosign_by,
  c.bill_under_supervisor,
  c.created_at
FROM  claims c
WHERE c.supervisor_cosign_required = TRUE
  AND c.supervisor_cosign_at IS NULL
  AND c.deleted_at IS NULL
  AND c.status NOT IN ('Voided','Closed','Paid');

COMMENT ON VIEW claims_pending_cosign IS
  'Claims that require supervisor co-sign and have not yet received it. '
  'These claims are blocked from moving to Ready to Submit status. '
  'Used by the clinician dashboard and billing queue to surface co-sign tasks.';


-- ============================================================
-- SECTION 12 — claim_readiness_check VIEW
-- ============================================================
--
-- Purpose:
--   Evaluates each draft claim for completeness before
--   submission. Returns a boolean per validation check
--   and a composite is_ready_to_submit flag.
--
-- Required for submission (ALL must be TRUE):
--   ✓ patient_id is set
--   ✓ billing_npi is set
--   ✓ dos_from and dos_to are set
--   ✓ payer_name is set
--   ✓ total_billed > 0
--   ✓ At least one claim_line_item exists
--   ✓ At least one diagnosis code in claim_diagnosis_codes with is_principal = TRUE
--   ✓ Supervisor co-sign requirement met (if applicable)
--   ✓ Prior authorization status = Approved (if auth linked and required)
--   ✓ timely_filing_deadline is NULL or >= today
--   ✓ claim is not soft-deleted
--   ✓ If claim_frequency_code = '7' or '8': original_claim_id is set
-- ============================================================

CREATE OR REPLACE VIEW claim_readiness_check AS
SELECT
  c.id                            AS claim_id,
  c.claim_ref,
  c.status,
  c.dos_from,
  c.payer_name,

  -- Field-level checks
  (c.patient_id IS NOT NULL)                                    AS has_patient,
  (c.billing_npi IS NOT NULL AND length(c.billing_npi) >= 10)   AS has_billing_npi,
  (c.dos_from IS NOT NULL AND c.dos_to IS NOT NULL)              AS has_service_dates,
  (c.payer_name IS NOT NULL AND c.payer_name <> '')              AS has_payer,
  (c.total_billed > 0)                                           AS has_billed_amount,
  (c.claim_frequency_code = '1'
   OR (c.claim_frequency_code IN ('7','8')
       AND c.original_claim_id IS NOT NULL))                     AS frequency_code_valid,

  -- Service lines
  EXISTS (
    SELECT 1 FROM claim_line_items li
    WHERE li.claim_id = c.id
      AND li.deleted_at IS NULL
  )                                                              AS has_line_items,

  -- Diagnosis (Box 21 — at least one principal dx)
  EXISTS (
    SELECT 1 FROM claim_diagnosis_codes dx
    WHERE dx.claim_id = c.id
      AND dx.is_principal = TRUE
  )                                                              AS has_principal_diagnosis,

  -- Supervisor co-sign
  (
    NOT c.supervisor_cosign_required
    OR c.supervisor_cosign_at IS NOT NULL
  )                                                              AS supervisor_cosign_met,

  -- Prior authorization (if a PA is linked, it must be Approved)
  (
    c.prior_auth_id IS NULL
    OR EXISTS (
      SELECT 1 FROM prior_authorizations pa
      WHERE pa.id = c.prior_auth_id
        AND pa.status = 'Approved'
        AND (pa.end_date IS NULL OR pa.end_date >= c.dos_from)
        AND (pa.remaining_units IS NULL OR pa.remaining_units > 0)
    )
  )                                                              AS auth_check_passed,

  -- Timely filing
  (
    c.timely_filing_deadline IS NULL
    OR c.timely_filing_deadline >= CURRENT_DATE
  )                                                              AS timely_filing_ok,

  -- Soft delete check
  (c.deleted_at IS NULL)                                         AS not_deleted,

  -- Supervising provider required fields (when bill_under_supervisor = TRUE)
  (
    NOT c.bill_under_supervisor
    OR (c.supervising_npi IS NOT NULL
        AND c.supervising_provider_id IS NOT NULL)
  )                                                              AS supervisor_npi_present,

  -- Composite readiness
  (
    c.patient_id IS NOT NULL
    AND c.billing_npi IS NOT NULL AND length(c.billing_npi) >= 10
    AND c.dos_from IS NOT NULL AND c.dos_to IS NOT NULL
    AND c.payer_name IS NOT NULL AND c.payer_name <> ''
    AND c.total_billed > 0
    AND (c.claim_frequency_code = '1'
         OR (c.claim_frequency_code IN ('7','8') AND c.original_claim_id IS NOT NULL))
    AND EXISTS (
          SELECT 1 FROM claim_line_items li
          WHERE li.claim_id = c.id AND li.deleted_at IS NULL
        )
    AND EXISTS (
          SELECT 1 FROM claim_diagnosis_codes dx
          WHERE dx.claim_id = c.id AND dx.is_principal = TRUE
        )
    AND (NOT c.supervisor_cosign_required OR c.supervisor_cosign_at IS NOT NULL)
    AND (c.prior_auth_id IS NULL
         OR EXISTS (
              SELECT 1 FROM prior_authorizations pa
              WHERE pa.id = c.prior_auth_id
                AND pa.status = 'Approved'
                AND (pa.end_date IS NULL OR pa.end_date >= c.dos_from)
                AND (pa.remaining_units IS NULL OR pa.remaining_units > 0)
            ))
    AND (c.timely_filing_deadline IS NULL OR c.timely_filing_deadline >= CURRENT_DATE)
    AND c.deleted_at IS NULL
    AND (NOT c.bill_under_supervisor
         OR (c.supervising_npi IS NOT NULL AND c.supervising_provider_id IS NOT NULL))
  )                                                              AS is_ready_to_submit

FROM claims c
WHERE c.status IN ('Draft','Ready to Submit','On Hold');

COMMENT ON VIEW claim_readiness_check IS
  'Evaluates completeness of draft claims before submission to clearinghouse. '
  'is_ready_to_submit = TRUE means all required fields are present and valid. '
  'Individual boolean columns identify exactly which check(s) are failing. '
  'Scoped to Draft, Ready to Submit, and On Hold claim statuses. '
  'Application should transition status to Ready to Submit only when is_ready_to_submit = TRUE.';


-- ============================================================
-- SECTION 13 — TRIGGERS
-- ============================================================

-- Updated-at triggers
CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_claim_line_items_updated_at
  BEFORE UPDATE ON claim_line_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cpt_codes_updated_at
  BEFORE UPDATE ON cpt_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_hcpcs_codes_updated_at
  BEFORE UPDATE ON hcpcs_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_modifiers_updated_at
  BEFORE UPDATE ON modifiers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_claim_rejections_updated_at
  BEFORE UPDATE ON claim_rejections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ──────────────────────────────────────────────────────────
-- TRIGGER: auto_set_claim_frequency_code
-- Purpose: When original_claim_id is set on a claim that was
--          previously NULL, auto-advance claim_frequency_code
--          to '7' (Corrected) unless explicitly set to '8' (Void).
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_set_claim_frequency_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.original_claim_id IS NOT NULL
     AND OLD.original_claim_id IS NULL
     AND NEW.claim_frequency_code = '1' THEN
    NEW.claim_frequency_code := '7';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_claim_frequency
  BEFORE UPDATE ON claims
  FOR EACH ROW
  WHEN (OLD.original_claim_id IS DISTINCT FROM NEW.original_claim_id)
  EXECUTE FUNCTION auto_set_claim_frequency_code();


-- ──────────────────────────────────────────────────────────
-- TRIGGER: increment_submission_number
-- Purpose: Auto-increment submission_number on
--          claim_submission_history to prevent manual errors.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_submission_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  SELECT COALESCE(MAX(submission_number), 0) + 1
  INTO   NEW.submission_number
  FROM   claim_submission_history
  WHERE  claim_id = NEW.claim_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_submission_number
  BEFORE INSERT ON claim_submission_history
  FOR EACH ROW EXECUTE FUNCTION set_submission_number();


-- ──────────────────────────────────────────────────────────
-- TRIGGER: create_rejection_on_submission_fail
-- Purpose: When claim_submission_history.is_accepted is set
--          to FALSE, auto-insert a claim_rejections record
--          if one doesn't already exist for this submission.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_rejection_on_fail()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_clinician_id  TEXT;
  v_patient_id    TEXT;
BEGIN
  IF NEW.is_accepted = FALSE AND (OLD.is_accepted IS NULL OR OLD.is_accepted = TRUE) THEN
    SELECT clinician_id, patient_id
    INTO   v_clinician_id, v_patient_id
    FROM   claims
    WHERE  id = NEW.claim_id;

    INSERT INTO claim_rejections (
      claim_id, submission_id, clinician_id, patient_id,
      rejection_source, rejection_level,
      error_code, error_description,
      fix_required, fix_status,
      rejection_codes
    )
    VALUES (
      NEW.claim_id,
      NEW.id,
      v_clinician_id,
      v_patient_id,
      'Clearinghouse',
      CASE
        WHEN NEW.ta1_result = 'Rejected' THEN 'TA1 Interchange'
        WHEN NEW.fa_result  = 'Rejected' THEN '999 Functional'
        ELSE '277CA'
      END,
      COALESCE(NEW.ta1_error_code, NEW.fa_error_segment, 'Unknown'),
      COALESCE(NEW.ta1_error_description, NEW.rejection_description, 'Submission rejected — see details'),
      'Review rejection codes and correct claim before resubmission',
      'Open',
      NEW.rejection_codes
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_rejection_on_fail
  AFTER UPDATE ON claim_submission_history
  FOR EACH ROW
  WHEN (NEW.is_accepted = FALSE)
  EXECUTE FUNCTION create_rejection_on_fail();


-- ──────────────────────────────────────────────────────────
-- TRIGGER: auto_sequence_claim_diagnosis
-- Purpose: Auto-assign sequence (1–12) from pointer_letter
--          on claim_diagnosis_codes insert.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_dx_sequence()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.sequence := CASE NEW.pointer_letter
    WHEN 'A' THEN 1  WHEN 'B' THEN 2  WHEN 'C' THEN 3
    WHEN 'D' THEN 4  WHEN 'E' THEN 5  WHEN 'F' THEN 6
    WHEN 'G' THEN 7  WHEN 'H' THEN 8  WHEN 'I' THEN 9
    WHEN 'J' THEN 10 WHEN 'K' THEN 11 WHEN 'L' THEN 12
  END;
  -- Enforce code_qualifier based on is_principal
  IF NEW.is_principal = TRUE THEN
    NEW.code_qualifier := 'ABK';
  ELSE
    NEW.code_qualifier := 'ABF';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_dx_sequence
  BEFORE INSERT OR UPDATE ON claim_diagnosis_codes
  FOR EACH ROW EXECUTE FUNCTION assign_dx_sequence();


-- ============================================================
-- SECTION 14 — RLS POLICIES
-- ============================================================

-- claim_submission_history — already handled above
-- claim_rejections — already handled above
-- clearinghouse_responses — already handled above
-- claim_diagnosis_codes — already handled above

-- Add clinician self-read policy to key tables
-- (billing_staff/admin/super_admin already covered by existing policies)

CREATE POLICY "clinician_read_own_claim_dx" ON claim_diagnosis_codes
  FOR SELECT TO authenticated
  USING (
    claim_id IN (
      SELECT id FROM claims
      WHERE clinician_id IN (
        SELECT id FROM clinician_accounts
        WHERE email = auth.jwt() ->> 'email'
      )
    )
  );

CREATE POLICY "clinician_read_submission_hist" ON claim_submission_history
  FOR SELECT TO authenticated
  USING (
    claim_id IN (
      SELECT id FROM claims
      WHERE clinician_id IN (
        SELECT id FROM clinician_accounts
        WHERE email = auth.jwt() ->> 'email'
      )
    )
  );


-- ============================================================
-- SECTION 15 — RELATIONSHIP MAP
-- ============================================================
--
--  clinician_accounts                 [admin-clients-schema.sql]
--    ├── patient_records              [admin-clients-schema.sql]
--    └── coding_sessions              [coding-billing-schema.sql]
--          └── claims                 [coding-billing-schema.sql + THIS FILE]
--                │
--                ├── org_id             → organizations
--                ├── appointment_id     → appointments
--                ├── payer_ref_id       → insurance_payers
--                ├── insurance_policy_id→ insurance_policies
--                ├── subscriber_ref_id  → subscribers
--                ├── billing_provider_id→ billing_providers
--                ├── rendering_provider_id → rendering_providers
--                ├── supervising_provider_id → rendering_providers
--                ├── service_facility_id→ service_facilities
--                ├── prior_auth_id      → prior_authorizations
--                ├── referral_id        → referrals
--                ├── original_claim_id  → claims (self-ref: corrected/void)
--                │
--                ├── claim_line_items           (claim_id) — service lines SV1
--                │     └── rendering_provider_id → rendering_providers
--                │
--                ├── claim_diagnosis_codes      (claim_id) — Box 21 A-L
--                │
--                ├── claim_status_history       (claim_id) — status audit trail
--                │
--                ├── claim_submission_history   (claim_id) — THIS FILE
--                │     └── clearinghouse_responses (submission_id) — THIS FILE
--                │           └── claim_rejections  (submission_id) — THIS FILE
--                │
--                ├── denials                   (claim_id)
--                │     └── appeals             (denial_id)
--                │
--                ├── claim_notes               (claim_id) [admin-claims-schema.sql]
--                ├── claim_attachments         (claim_id) [admin-claims-schema.sql]
--                │
--                ├── payment_postings          (claim_id)
--                └── claim_provider_links      (claim_id) [provider-billing-identity-schema.sql]
--
--
--  PROCEDURE CODE REFERENCE TABLES (THIS FILE):
--    cpt_codes             ← claim_line_items.hcpcs_code (text match)
--    hcpcs_codes           ← claim_line_items.hcpcs_code (text match)
--    modifiers             ← claim_line_items.modifier_1..4 (text match)
--
--
--  REQUIRED FIELDS BEFORE CLAIM CAN BE SUBMITTED
--  (enforced by claim_readiness_check VIEW):
--  ────────────────────────────────────────────────────────
--  Field                          Source
--  ────────────────────────────────────────────────────────
--  claims.patient_id              Patient registration
--  claims.billing_npi             billing_providers.billing_npi
--  claims.dos_from                Appointment date
--  claims.dos_to                  Appointment date (same as dos_from for outpatient)
--  claims.payer_name              insurance_payers.name
--  claims.total_billed            Sum of claim_line_items.billed_amount
--  claim_line_items ≥ 1 row       Service line generation
--  claim_diagnosis_codes.A        Principal diagnosis (ICD-10-CM)
--  supervisor_cosign_at           When supervisor_cosign_required = TRUE
--  prior_auth status = Approved   When prior_auth_id is set
--  timely_filing_deadline ≥ today Colorado Medicaid: 365 days from DOS
--  ────────────────────────────────────────────────────────
--
--
--  REQUIRED FIELDS FOR SUPERVISING PROVIDER BILLING:
--  ────────────────────────────────────────────────────────
--  Field                           When Required
--  ────────────────────────────────────────────────────────
--  claims.supervising_npi          Always when supervisor billing
--  claims.supervising_provider_id  Always when supervisor billing
--  claims.supervisor_cosign_at     Always when cosign_required = TRUE
--  claims.supervisor_cosign_by     Always when cosign_required = TRUE
--  claims.bill_under_supervisor    Set TRUE when supervisee not enrolled
--  claims.rendering_npi            Supervisee NPI (Box 24J)
--  claims.rendering_provider_id    FK to supervised clinician's record
--  supervision_relationships.*     Verified at credentialing layer
--  ────────────────────────────────────────────────────────
--
-- ============================================================
