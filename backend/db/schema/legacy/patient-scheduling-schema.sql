-- ============================================================
-- THERASSISTANT Patient & Scheduling Database Schema
-- Colorado Medicaid Behavioral Health Platform
-- Supabase / PostgreSQL  ·  HIPAA-compliant design
-- ============================================================
--
-- Contents
-- ──────────────────────────────────────────────────────────
--  1.  patients
--  2.  patient_contacts
--  3.  emergency_contacts
--  4.  guarantors
--  5.  insurance_policies
--  6.  insurance_verifications
--  7.  appointments
--  8.  recurring_appointments
--  9.  appointment_status_history
-- 10.  telehealth_sessions
-- 11.  patient_documents
-- 12.  patient_portal_messages
-- ============================================================
--
-- COMPLIANCE NOTES
-- ──────────────────────────────────────────────────────────
--  • HIPAA Privacy Rule  — Minimum Necessary standard enforced
--    through Row Level Security policies on every table.
--  • 42 CFR Part 2       — Substance use disorder records require
--    additional consent before disclosure.  Tables that may
--    contain SUD data include a `contains_sud_info` flag.
--  • Colorado HB 23-1056 — All PHI access is logged separately;
--    audit tooling should consume the activity_log table in the
--    client schema.
--  • Encryption at rest  — Supabase encrypts storage-layer data.
--    SSN and similar high-sensitivity fields store last-4 only.
-- ============================================================


-- ============================================================
-- 1. patients
-- ============================================================
-- Purpose: Core demographic, clinical, and administrative record
-- for every patient treated by a THERASSISTANT clinician account.
-- One row per unique patient per organization.
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Organization & Clinician Assignments ─────────────────
  org_id                      TEXT NOT NULL
                                REFERENCES clinician_accounts(id) ON DELETE RESTRICT,
  primary_clinician_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  secondary_clinician_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Demographics ─────────────────────────────────────────
  first_name                  TEXT NOT NULL,
  middle_name                 TEXT,
  last_name                   TEXT NOT NULL,
  preferred_name              TEXT,
  dob                         DATE NOT NULL,
  ssn_last4                   TEXT,           -- Last 4 only; never store full SSN
  gender                      TEXT CHECK (gender IN ('M','F','X','Unknown','Declined')),
  gender_identity             TEXT,           -- Patient-reported free text
  pronouns                    TEXT,
  race                        TEXT,           -- OMB categories for UDS reporting
  ethnicity                   TEXT,           -- Hispanic / Non-Hispanic / Unknown
  primary_language            TEXT DEFAULT 'English',
  interpreter_needed          BOOLEAN DEFAULT FALSE,
  interpreter_language        TEXT,

  -- ── Contact Information ───────────────────────────────────
  address_line1               TEXT,
  address_line2               TEXT,
  city                        TEXT,
  state                       TEXT DEFAULT 'CO',
  zip                         TEXT,
  phone_primary               TEXT,
  phone_mobile                TEXT,
  phone_home                  TEXT,
  ok_to_text                  BOOLEAN DEFAULT FALSE,
  ok_to_leave_voicemail       BOOLEAN DEFAULT TRUE,
  email                       TEXT,
  ok_to_email                 BOOLEAN DEFAULT FALSE,

  -- ── Social & Employment ───────────────────────────────────
  marital_status              TEXT CHECK (marital_status IN (
                                'Single','Married','Separated','Divorced',
                                'Widowed','Domestic Partnership','Unknown')),
  employment_status           TEXT CHECK (employment_status IN (
                                'Full-Time','Part-Time','Unemployed',
                                'Retired','Student','Disabled','Unknown')),
  employer_name               TEXT,

  -- ── Minor / Guardian ─────────────────────────────────────
  is_minor                    BOOLEAN NOT NULL DEFAULT FALSE,
  minor_consent_on_file       BOOLEAN DEFAULT FALSE,
  minor_consent_date          DATE,

  -- ── Referral ─────────────────────────────────────────────
  referral_source             TEXT,           -- Medicaid, self, physician, school, etc.
  referral_clinician_name     TEXT,
  referral_date               DATE,

  -- ── Clinical ─────────────────────────────────────────────
  primary_diagnosis           TEXT,           -- Primary ICD-10 code
  diagnosis_codes             TEXT[],         -- All active ICD-10 codes
  level_of_care               TEXT CHECK (level_of_care IN (
                                'Outpatient','IOP','PHP','Residential',
                                'Crisis Stabilization','Crisis Residential',
                                'Case Management','Community Support')),
  sud_program                 BOOLEAN DEFAULT FALSE,
  sud_level_of_care           TEXT,           -- ASAM level: 0.5, 1, 2.1, 2.5, 3.1, etc.
  contains_42_cfr_pt2_data    BOOLEAN DEFAULT FALSE,  -- 42 CFR Part 2 flag

  -- ── Colorado Medicaid Fields ──────────────────────────────
  medicaid_member_id          TEXT,           -- Health First Colorado member ID
  medicaid_status             TEXT CHECK (medicaid_status IN (
                                'Active','Inactive','Pending','Unknown','Not Applicable')),
  medicaid_rcco               TEXT,           -- Regional Care Collaborative Organization
  medicaid_program            TEXT,           -- FFS, RCCO_Managed, CHP+, Long_Term_Care
  medicaid_bh_program         TEXT,           -- ACC Phase 3, BH Capitation, FFS BH, etc.

  -- ── Patient Status ────────────────────────────────────────
  patient_status              TEXT NOT NULL DEFAULT 'Active'
                                CHECK (patient_status IN (
                                  'Active','Inactive','Discharged','Deceased',
                                  'Transferred','Waitlist','Intake Pending')),
  intake_date                 DATE,
  discharge_date              DATE,
  discharge_reason            TEXT,
  discharge_summary_on_file   BOOLEAN DEFAULT FALSE,

  -- ── Consents & HIPAA ─────────────────────────────────────
  consent_to_treat            BOOLEAN DEFAULT FALSE,
  consent_to_treat_date       DATE,
  hipaa_npoa_signed           BOOLEAN DEFAULT FALSE,  -- Notice of Privacy Practices
  hipaa_npoa_signed_date      DATE,
  financial_policy_signed     BOOLEAN DEFAULT FALSE,
  financial_policy_date       DATE,

  -- ── Patient Portal ────────────────────────────────────────
  portal_access_enabled       BOOLEAN DEFAULT FALSE,
  portal_invite_sent_at       TIMESTAMPTZ,
  portal_user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_last_login           TIMESTAMPTZ,

  -- ── Import / Source Tracking ─────────────────────────────
  imported_from               TEXT,           -- SimplePractice, manual, CSV_import, API
  external_id                 TEXT,           -- ID from source system at import time

  -- ── Soft Delete ──────────────────────────────────────────
  is_deleted                  BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  UUID REFERENCES auth.users(id),

  -- ── Audit ─────────────────────────────────────────────────
  created_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_patients_org           ON patients(org_id);
CREATE INDEX idx_patients_clinician     ON patients(primary_clinician_id);
CREATE INDEX idx_patients_status        ON patients(patient_status);
CREATE INDEX idx_patients_dob           ON patients(dob);
CREATE INDEX idx_patients_medicaid_id   ON patients(medicaid_member_id);
CREATE INDEX idx_patients_last_name     ON patients(last_name);
CREATE INDEX idx_patients_deleted       ON patients(is_deleted);
CREATE INDEX idx_patients_org_status    ON patients(org_id, patient_status);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Clinicians access patients within their own organization
CREATE POLICY "clinician_own_org_patients" ON patients
  FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT id FROM clinician_accounts
      WHERE email = (auth.jwt() ->> 'email')
    )
  );

-- Admin roles see all patients
CREATE POLICY "admin_all_patients" ON patients
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

-- Patients access their own record via portal
CREATE POLICY "patient_portal_own_record" ON patients
  FOR SELECT TO authenticated
  USING (portal_user_id = auth.uid());


-- ============================================================
-- 2. patient_contacts
-- ============================================================
-- Purpose: General contacts — parents/guardians, authorized
-- representatives, attorneys, case managers. Separate from
-- emergency contacts.  Tracks HIPAA authorizations per contact.
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_contacts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,

  -- ── Contact Type & Role ───────────────────────────────────
  contact_type                TEXT NOT NULL CHECK (contact_type IN (
                                'Parent','Guardian','Legal Guardian',
                                'Authorized Representative','Spouse','Partner',
                                'Sibling','Other Family','Friend',
                                'Case Manager','Attorney','Other')),
  relationship                TEXT,           -- Specific relationship label

  -- ── Identity ─────────────────────────────────────────────
  first_name                  TEXT NOT NULL,
  last_name                   TEXT NOT NULL,

  -- ── Contact Info ─────────────────────────────────────────
  phone_primary               TEXT,
  phone_secondary             TEXT,
  email                       TEXT,
  address_line1               TEXT,
  city                        TEXT,
  state                       TEXT DEFAULT 'CO',
  zip                         TEXT,

  -- ── Authorization (HIPAA) ─────────────────────────────────
  can_receive_phi             BOOLEAN NOT NULL DEFAULT FALSE,
  phi_auth_on_file            BOOLEAN DEFAULT FALSE,
  phi_auth_signed_at          TIMESTAMPTZ,
  phi_auth_expires_at         TIMESTAMPTZ,
  phi_auth_scope              TEXT,           -- What PHI they can receive
  can_make_clinical_decisions BOOLEAN DEFAULT FALSE,
  is_legal_guardian           BOOLEAN DEFAULT FALSE,
  guardianship_doc_on_file    BOOLEAN DEFAULT FALSE,

  -- ── Preferences ───────────────────────────────────────────
  preferred_contact_method    TEXT CHECK (preferred_contact_method IN (
                                'Phone','Text','Email','Portal','Mail')),
  is_primary_contact          BOOLEAN DEFAULT FALSE,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_patient_contacts_patient ON patient_contacts(patient_id);
CREATE INDEX idx_patient_contacts_org     ON patient_contacts(org_id);
CREATE INDEX idx_patient_contacts_active  ON patient_contacts(patient_id, is_active);

ALTER TABLE patient_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_patient_contacts" ON patient_contacts
  FOR ALL TO authenticated
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


-- ============================================================
-- 3. emergency_contacts
-- ============================================================
-- Purpose: Emergency-specific contacts for patient safety
-- planning and crisis situations.  Ordered by priority when
-- multiple contacts exist.  Separate from general contacts
-- to allow distinct safety-plan access logic.
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,

  -- ── Identity ─────────────────────────────────────────────
  first_name                  TEXT NOT NULL,
  last_name                   TEXT NOT NULL,
  relationship                TEXT NOT NULL,

  -- ── Contact Info ─────────────────────────────────────────
  phone_primary               TEXT NOT NULL,
  phone_secondary             TEXT,
  phone_work                  TEXT,
  email                       TEXT,
  address_line1               TEXT,
  city                        TEXT,
  state                       TEXT,
  zip                         TEXT,

  -- ── Authorization ─────────────────────────────────────────
  can_receive_phi             BOOLEAN DEFAULT FALSE,
  phi_auth_on_file            BOOLEAN DEFAULT FALSE,

  -- ── Priority & Status ─────────────────────────────────────
  priority_order              INTEGER NOT NULL DEFAULT 1,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_emergency_contacts_patient   ON emergency_contacts(patient_id);
CREATE INDEX idx_emergency_contacts_priority  ON emergency_contacts(patient_id, priority_order);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_emergency_contacts" ON emergency_contacts
  FOR ALL TO authenticated
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


-- ============================================================
-- 4. guarantors
-- ============================================================
-- Purpose: Financial responsibility holder for a patient.
-- May be the patient (is_self = TRUE) or another person such
-- as a parent for a minor.  Drives billing address, sliding
-- scale approval, and copay responsibility.
-- ============================================================
CREATE TABLE IF NOT EXISTS guarantors (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,

  -- ── Type ─────────────────────────────────────────────────
  is_self                     BOOLEAN NOT NULL DEFAULT FALSE,
  relationship                TEXT CHECK (relationship IN (
                                'Self','Parent','Spouse','Partner',
                                'Sibling','Grandparent','Other')),

  -- ── Identity ─────────────────────────────────────────────
  first_name                  TEXT NOT NULL,
  last_name                   TEXT NOT NULL,
  dob                         DATE,
  ssn_last4                   TEXT,           -- Last 4 only

  -- ── Contact Info ─────────────────────────────────────────
  phone                       TEXT,
  email                       TEXT,
  address_line1               TEXT,
  address_line2               TEXT,
  city                        TEXT,
  state                       TEXT DEFAULT 'CO',
  zip                         TEXT,

  -- ── Employment ────────────────────────────────────────────
  employer_name               TEXT,
  employer_phone              TEXT,
  employer_address            TEXT,

  -- ── Sliding Scale / Financial Hardship ────────────────────
  income_level                TEXT,           -- Self-reported income bracket
  household_size              INTEGER,
  sliding_scale_approved      BOOLEAN DEFAULT FALSE,
  sliding_scale_rate          NUMERIC(10,2),  -- Approved session rate
  sliding_scale_approved_by   UUID REFERENCES auth.users(id),
  sliding_scale_review_date   DATE,
  federal_poverty_level_pct   NUMERIC(5,2),   -- % FPL at time of approval

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_guarantors_patient ON guarantors(patient_id);
CREATE INDEX idx_guarantors_org     ON guarantors(org_id);

ALTER TABLE guarantors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_guarantors" ON guarantors
  FOR ALL TO authenticated
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


-- ============================================================
-- 5. insurance_policies
-- ============================================================
-- Purpose: Insurance coverage records for a patient.
-- A patient may have up to 3 active policies (primary /
-- secondary / tertiary).  Links to guarantors for subscriber
-- information when the subscriber is not the patient.
-- Includes fields specific to Colorado Medicaid (RCCO,
-- managed care, CHP+) and BH-specific benefits.
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_policies (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  guarantor_id                UUID REFERENCES guarantors(id) ON DELETE SET NULL,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,

  -- ── Policy Order ─────────────────────────────────────────
  policy_order                INTEGER NOT NULL DEFAULT 1
                                CHECK (policy_order BETWEEN 1 AND 3),
                                -- 1 = Primary, 2 = Secondary, 3 = Tertiary

  -- ── Payer ─────────────────────────────────────────────────
  insurance_name              TEXT NOT NULL,
  payer_id                    TEXT,           -- EDI / clearinghouse payer ID
  plan_name                   TEXT,
  plan_type                   TEXT NOT NULL CHECK (plan_type IN (
                                'Medicaid','Medicare','Medicare_Advantage',
                                'Commercial','CHIP_CHP+','Tricare',
                                'Self_Pay','Sliding_Scale','Other')),

  -- ── Subscriber / Member ───────────────────────────────────
  subscriber_id               TEXT NOT NULL,  -- Member ID
  group_number                TEXT,
  subscriber_first_name       TEXT,
  subscriber_last_name        TEXT,
  subscriber_dob              DATE,
  subscriber_relationship     TEXT CHECK (subscriber_relationship IN (
                                'Self','Spouse','Child','Other')),

  -- ── Coverage Dates ────────────────────────────────────────
  policy_effective_date       DATE,
  policy_termination_date     DATE,

  -- ── Cost Share ────────────────────────────────────────────
  copay_amount                NUMERIC(10,2),
  copay_applies_to            TEXT,           -- e.g. "BH visits only", "All visits"
  deductible_amount           NUMERIC(10,2),
  deductible_met              NUMERIC(10,2) DEFAULT 0,
  deductible_met_date         DATE,
  out_of_pocket_max           NUMERIC(10,2),
  oop_met                     NUMERIC(10,2) DEFAULT 0,
  oop_met_date                DATE,

  -- ── BH-Specific Benefits ─────────────────────────────────
  bh_benefit_covered          BOOLEAN DEFAULT TRUE,
  bh_visit_limit              INTEGER,        -- Annual BH visit cap (NULL = unlimited)
  bh_visits_used              INTEGER DEFAULT 0,
  substance_use_covered       BOOLEAN DEFAULT TRUE,
  su_visit_limit              INTEGER,
  su_visits_used              INTEGER DEFAULT 0,

  -- ── Prior Authorization ───────────────────────────────────
  auth_required               BOOLEAN DEFAULT FALSE,
  auth_phone                  TEXT,
  current_auth_number         TEXT,
  current_auth_start          DATE,
  current_auth_end            DATE,
  current_auth_visits         INTEGER,        -- Total visits approved on current auth
  current_auth_visits_used    INTEGER DEFAULT 0,

  -- ── Contact Info ─────────────────────────────────────────
  payer_phone                 TEXT,
  payer_portal_url            TEXT,

  -- ── Pharmacy (if applicable) ──────────────────────────────
  rx_bin                      TEXT,
  rx_pcn                      TEXT,
  rx_group                    TEXT,

  -- ── Colorado Medicaid-Specific ────────────────────────────
  medicaid_type               TEXT CHECK (medicaid_type IN (
                                'FFS','RCCO_Managed','ACC_Phase3',
                                'BH_Capitation','CHP+','Long_Term_Care',
                                'Not_Applicable')),
  medicaid_rcco               TEXT,           -- RCCO region/name
  medicaid_program_code       TEXT,           -- HCPFs internal program designation
  medicaid_span_dates         TEXT,           -- Eligibility span returned by PEAK/EVS

  -- ── Status ────────────────────────────────────────────────
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at              TIMESTAMPTZ,
  deactivated_reason          TEXT,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ins_policies_patient    ON insurance_policies(patient_id);
CREATE INDEX idx_ins_policies_org        ON insurance_policies(org_id);
CREATE INDEX idx_ins_policies_order      ON insurance_policies(patient_id, policy_order);
CREATE INDEX idx_ins_policies_active     ON insurance_policies(patient_id, is_active);
CREATE INDEX idx_ins_policies_subscriber ON insurance_policies(subscriber_id);
CREATE INDEX idx_ins_policies_payer      ON insurance_policies(payer_id);

ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_insurance_policies" ON insurance_policies
  FOR ALL TO authenticated
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


-- ============================================================
-- 6. insurance_verifications
-- ============================================================
-- Purpose: Eligibility check history.  Each row records one
-- verification event — real-time 270/271 transaction, phone
-- call to payer, payer portal lookup, or manual entry.
-- Provides an audit trail for billing disputes and supports
-- the auto-verification workflow scheduled before each visit.
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_verifications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  policy_id                   UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,
  verified_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Verification Method ───────────────────────────────────
  verification_method         TEXT NOT NULL CHECK (verification_method IN (
                                'Real_Time_270_271','Phone','Payer_Portal',
                                'Manual_Entry','Automated_Batch')),

  -- ── Results ───────────────────────────────────────────────
  eligible                    BOOLEAN,
  coverage_active             BOOLEAN,
  ineligibility_reason        TEXT,           -- If not eligible

  -- ── Coverage Details Returned ─────────────────────────────
  plan_name                   TEXT,
  subscriber_id               TEXT,
  effective_date              DATE,
  termination_date            DATE,
  copay                       NUMERIC(10,2),
  deductible                  NUMERIC(10,2),
  deductible_met              NUMERIC(10,2),
  oop_max                     NUMERIC(10,2),
  oop_met                     NUMERIC(10,2),

  -- ── BH-Specific Returned Data ─────────────────────────────
  bh_visits_authorized        INTEGER,
  bh_visits_used              INTEGER,
  prior_auth_required         BOOLEAN,
  auth_number                 TEXT,
  auth_start_date             DATE,
  auth_end_date               DATE,
  auth_visits_approved        INTEGER,
  auth_visits_used            INTEGER,

  -- ── Response Data ─────────────────────────────────────────
  payer_response_code         TEXT,           -- X12 271 response code
  raw_response                JSONB,          -- Full 271 payload or payer API response
  notes                       TEXT,

  -- ── Scheduling Integration ────────────────────────────────
  verified_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_verification_due       DATE,           -- Suggested re-check date
  triggered_by_appointment_id UUID,           -- If run pre-visit

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ins_verif_patient    ON insurance_verifications(patient_id);
CREATE INDEX idx_ins_verif_policy     ON insurance_verifications(policy_id);
CREATE INDEX idx_ins_verif_verified   ON insurance_verifications(verified_at DESC);
CREATE INDEX idx_ins_verif_eligible   ON insurance_verifications(patient_id, eligible);
CREATE INDEX idx_ins_verif_next_check ON insurance_verifications(next_verification_due);

ALTER TABLE insurance_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_insurance_verifications" ON insurance_verifications
  FOR ALL TO authenticated
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


-- ============================================================
-- 7. appointments
-- ============================================================
-- Purpose: Individual appointment bookings.  The central hub
-- linking patients, clinicians, insurance, and billing.
-- Each appointment may link to: a recurring series, a
-- telehealth session record, an insurance policy, a
-- THERASSISTANT coding session note, and a claim.
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinician_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,

  -- ── Service Details ───────────────────────────────────────
  service_code                TEXT,           -- H0031, H0001, H0032, 90837, 90791, etc.
  service_description         TEXT,
  appointment_type            TEXT CHECK (appointment_type IN (
                                'Initial Intake','Follow-Up','Assessment',
                                'Individual Therapy','Group Therapy',
                                'Family Therapy','Telehealth','Crisis',
                                'Case Management','Consultation',
                                'Med Management','Peer Support')),
  location_type               TEXT NOT NULL DEFAULT 'In Office'
                                CHECK (location_type IN (
                                  'In Office','Telehealth','Home Visit',
                                  'School','Community','Other')),
  location_name               TEXT,           -- Office/site name

  -- ── Scheduling ────────────────────────────────────────────
  scheduled_start             TIMESTAMPTZ NOT NULL,
  scheduled_end               TIMESTAMPTZ NOT NULL,
  duration_minutes            INTEGER NOT NULL,
  actual_start                TIMESTAMPTZ,
  actual_end                  TIMESTAMPTZ,
  actual_duration_minutes     INTEGER,        -- Computed or charted by clinician

  -- ── Status ────────────────────────────────────────────────
  status                      TEXT NOT NULL DEFAULT 'Scheduled'
                                CHECK (status IN (
                                  'Scheduled','Confirmed','Reminder Sent',
                                  'Checked In','In Session','Completed',
                                  'Cancelled','No Show','Rescheduled',
                                  'Late Cancel','Excused Absence')),

  -- ── Series Link ───────────────────────────────────────────
  recurring_appointment_id    UUID REFERENCES recurring_appointments(id) ON DELETE SET NULL,
  series_occurrence_number    INTEGER,        -- Which occurrence in the series

  -- ── Telehealth Link ───────────────────────────────────────
  telehealth_session_id       UUID,           -- populated after telehealth_sessions insert
                                              -- FK added post-create to avoid circular dep.

  -- ── Insurance & Billing ───────────────────────────────────
  insurance_policy_id         UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  auth_number                 TEXT,
  copay_due                   NUMERIC(10,2),
  copay_collected             NUMERIC(10,2),
  copay_collected_at          TIMESTAMPTZ,
  copay_payment_method        TEXT CHECK (copay_payment_method IN (
                                'Cash','Check','Card','Waived','Sliding Scale')),
  billing_status              TEXT DEFAULT 'Pending'
                                CHECK (billing_status IN (
                                  'Pending','Ready to Bill','Billed',
                                  'On Hold','Not Billable','Archived')),
  note_session_id             TEXT,           -- THERASSISTANT coder session ID
  claim_id                    TEXT,           -- FK to claims table

  -- ── Cancellation ─────────────────────────────────────────
  cancellation_reason         TEXT,
  cancelled_by                UUID REFERENCES auth.users(id),
  cancelled_at                TIMESTAMPTZ,

  -- ── Reminders & Confirmations ─────────────────────────────
  reminder_sent_at            TIMESTAMPTZ,
  reminder_method             TEXT CHECK (reminder_method IN (
                                'Email','SMS','Phone Call','Portal','None')),
  confirmation_sent_at        TIMESTAMPTZ,
  patient_confirmed_at        TIMESTAMPTZ,

  notes                       TEXT,
  created_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_appt_patient        ON appointments(patient_id);
CREATE INDEX idx_appt_clinician      ON appointments(clinician_id);
CREATE INDEX idx_appt_org            ON appointments(org_id);
CREATE INDEX idx_appt_status         ON appointments(status);
CREATE INDEX idx_appt_start          ON appointments(scheduled_start);
CREATE INDEX idx_appt_start_range    ON appointments(scheduled_start, scheduled_end);
CREATE INDEX idx_appt_billing        ON appointments(billing_status);
CREATE INDEX idx_appt_recurring      ON appointments(recurring_appointment_id);
CREATE INDEX idx_appt_clinician_day  ON appointments(clinician_id, scheduled_start);
CREATE INDEX idx_appt_patient_date   ON appointments(patient_id, scheduled_start DESC);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Clinicians see appointments in their org
CREATE POLICY "clinician_own_org_appointments" ON appointments
  FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "admin_all_appointments" ON appointments
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

-- Patients see their own appointments via portal
CREATE POLICY "patient_portal_own_appointments" ON appointments
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE portal_user_id = auth.uid()
    )
  );


-- ============================================================
-- 8. recurring_appointments
-- ============================================================
-- Purpose: Template record for a recurring appointment series.
-- Acts as the "master" from which individual appointment
-- rows in `appointments` are generated.  Supports weekly,
-- biweekly, and monthly recurrence patterns.  When paused
-- or ended, existing generated appointments are unaffected.
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_appointments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinician_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,

  -- ── Service Details ───────────────────────────────────────
  service_code                TEXT,
  appointment_type            TEXT CHECK (appointment_type IN (
                                'Initial Intake','Follow-Up','Assessment',
                                'Individual Therapy','Group Therapy',
                                'Family Therapy','Telehealth','Crisis',
                                'Case Management','Consultation',
                                'Med Management','Peer Support')),
  location_type               TEXT DEFAULT 'In Office'
                                CHECK (location_type IN (
                                  'In Office','Telehealth','Home Visit',
                                  'School','Community','Other')),
  location_name               TEXT,
  duration_minutes            INTEGER NOT NULL DEFAULT 60,

  -- ── Recurrence Pattern ────────────────────────────────────
  frequency                   TEXT NOT NULL CHECK (frequency IN (
                                'Weekly','Biweekly','Every 3 Weeks','Monthly','Custom')),
  interval_weeks              INTEGER NOT NULL DEFAULT 1,  -- Weeks between occurrences
  day_of_week                 INTEGER NOT NULL
                                CHECK (day_of_week BETWEEN 0 AND 6),
                                -- 0=Sunday, 1=Monday, ..., 6=Saturday
  time_of_day                 TIME NOT NULL,

  -- ── Series Bounds ─────────────────────────────────────────
  series_start_date           DATE NOT NULL,
  series_end_date             DATE,           -- NULL = open-ended
  series_end_after_count      INTEGER,        -- End after N occurrences (alternative to date)
  total_generated             INTEGER NOT NULL DEFAULT 0,
  last_generated_date         DATE,

  -- ── Insurance / Auth ─────────────────────────────────────
  insurance_policy_id         UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  auth_number                 TEXT,

  -- ── Lifecycle ────────────────────────────────────────────
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  paused_at                   TIMESTAMPTZ,
  paused_reason               TEXT,
  ended_at                    TIMESTAMPTZ,
  ended_reason                TEXT,

  notes                       TEXT,
  created_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from appointments back to recurring_appointments
-- (deferred to avoid circular reference at creation time)
ALTER TABLE appointments
  ADD CONSTRAINT fk_appt_recurring
  FOREIGN KEY (recurring_appointment_id)
  REFERENCES recurring_appointments(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Indexes
CREATE INDEX idx_recurring_patient    ON recurring_appointments(patient_id);
CREATE INDEX idx_recurring_clinician  ON recurring_appointments(clinician_id);
CREATE INDEX idx_recurring_org        ON recurring_appointments(org_id);
CREATE INDEX idx_recurring_active     ON recurring_appointments(is_active);
CREATE INDEX idx_recurring_next_gen   ON recurring_appointments(last_generated_date)
  WHERE is_active = TRUE;

ALTER TABLE recurring_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_recurring_appts" ON recurring_appointments
  FOR ALL TO authenticated
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


-- ============================================================
-- 9. appointment_status_history
-- ============================================================
-- Purpose: Immutable audit trail of every status transition
-- on an appointment.  Supports billing dispute resolution,
-- no-show/cancellation reporting, and compliance reviews.
-- Rows are append-only (no UPDATE / DELETE in normal flow).
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_status_history (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  appointment_id              UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,

  -- ── Transition ────────────────────────────────────────────
  from_status                 TEXT,           -- NULL for first status entry
  to_status                   TEXT NOT NULL,

  -- ── Actor ─────────────────────────────────────────────────
  changed_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role             TEXT CHECK (changed_by_role IN (
                                'Clinician','Admin','Billing Staff',
                                'System','Patient Portal')),
  reason                      TEXT,
  notes                       TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_appt_history_appt    ON appointment_status_history(appointment_id);
CREATE INDEX idx_appt_history_created ON appointment_status_history(created_at DESC);
CREATE INDEX idx_appt_history_status  ON appointment_status_history(to_status);

ALTER TABLE appointment_status_history ENABLE ROW LEVEL SECURITY;

-- Read access: clinicians can see history for appointments in their org
CREATE POLICY "org_read_appt_history" ON appointment_status_history
  FOR SELECT TO authenticated
  USING (
    appointment_id IN (
      SELECT id FROM appointments a
      WHERE a.org_id IN (
        SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
      )
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  );

-- Insert only (status history should never be updated or deleted)
CREATE POLICY "org_insert_appt_history" ON appointment_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM appointments a
      WHERE a.org_id IN (
        SELECT id FROM clinician_accounts WHERE email = (auth.jwt() ->> 'email')
      )
    )
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  );


-- ============================================================
-- 10. telehealth_sessions
-- ============================================================
-- Purpose: Technical record for video/audio telehealth visits.
-- Tracks platform, join times, consent, patient location
-- verification (required for multistate licensure and PH
-- emergency waivers), and connection quality.  One-to-one
-- with appointments that have location_type = 'Telehealth'.
-- ============================================================
CREATE TABLE IF NOT EXISTS telehealth_sessions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  appointment_id              UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinician_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,

  -- ── Platform ──────────────────────────────────────────────
  platform                    TEXT NOT NULL CHECK (platform IN (
                                'Doxy.me','Zoom for Healthcare',
                                'SimplePractice','Microsoft Teams',
                                'Google Meet','Phone','Other')),
  platform_session_id         TEXT,           -- Platform-side session/meeting ID
  meeting_url                 TEXT,
  patient_access_code         TEXT,

  -- ── Timing ────────────────────────────────────────────────
  clinician_started_at        TIMESTAMPTZ,
  patient_joined_at           TIMESTAMPTZ,
  session_started_at          TIMESTAMPTZ,
  session_ended_at            TIMESTAMPTZ,
  actual_duration_minutes     INTEGER,

  -- ── Patient Consent ───────────────────────────────────────
  consent_obtained            BOOLEAN NOT NULL DEFAULT FALSE,
  consent_method              TEXT CHECK (consent_method IN (
                                'Verbal Documented','Written on File',
                                'Electronic Consent Form')),

  -- ── Location Verification (required for safety & licensure) ─
  patient_location_state      TEXT DEFAULT 'CO',
  patient_location_city       TEXT,
  patient_location_confirmed  BOOLEAN DEFAULT FALSE,
  patient_location_safe       BOOLEAN,        -- Clinician-assessed safety of environment
  patient_location_private    BOOLEAN,        -- Patient has private space for session

  -- ── Regulatory / Compliance ───────────────────────────────
  interstate_compact_applies  BOOLEAN DEFAULT FALSE,
  phe_waiver_applied          BOOLEAN DEFAULT FALSE,   -- Public Health Emergency waiver
  hipaa_compliant_platform    BOOLEAN DEFAULT TRUE,
  baa_on_file                 BOOLEAN DEFAULT TRUE,    -- BAA with platform vendor

  -- ── Technical Notes ───────────────────────────────────────
  connection_quality          TEXT CHECK (connection_quality IN (
                                'Excellent','Good','Fair','Poor','Disconnected')),
  technical_issues            TEXT,
  session_interrupted         BOOLEAN DEFAULT FALSE,
  interruption_minutes        INTEGER DEFAULT 0,

  -- ── Recording ────────────────────────────────────────────
  recording_obtained          BOOLEAN DEFAULT FALSE,
  recording_consent_obtained  BOOLEAN DEFAULT FALSE,
  recording_storage_path      TEXT,           -- Supabase storage path

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wire up the deferred FK from appointments to telehealth_sessions
ALTER TABLE appointments
  ADD CONSTRAINT fk_appt_telehealth
  FOREIGN KEY (telehealth_session_id)
  REFERENCES telehealth_sessions(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Indexes
CREATE INDEX idx_telehealth_appointment ON telehealth_sessions(appointment_id);
CREATE INDEX idx_telehealth_patient     ON telehealth_sessions(patient_id);
CREATE INDEX idx_telehealth_clinician   ON telehealth_sessions(clinician_id);
CREATE INDEX idx_telehealth_platform    ON telehealth_sessions(platform);
CREATE INDEX idx_telehealth_started     ON telehealth_sessions(session_started_at DESC);

ALTER TABLE telehealth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_telehealth" ON telehealth_sessions
  FOR ALL TO authenticated
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


-- ============================================================
-- 11. patient_documents
-- ============================================================
-- Purpose: Metadata record for every document stored per
-- patient.  Actual file bytes live in Supabase Storage;
-- this table stores the path, type, signature status, and
-- renewal tracking.  Supports portal document visibility,
-- version chains (supersedes_document_id), and 42 CFR Part 2
-- flagging for SUD-related records.
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_documents (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,
  uploaded_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Document Classification ───────────────────────────────
  document_type               TEXT NOT NULL CHECK (document_type IN (
                                'Consent to Treat','HIPAA Notice (NPOA)',
                                'ROI Authorization','Financial Policy',
                                'Insurance Card Front','Insurance Card Back',
                                'Photo ID','Treatment Plan',
                                'Assessment - H0031','Assessment - H0001',
                                'Progress Note','Prior Auth Request',
                                'Prior Auth Approval','Denial Letter',
                                'Discharge Summary','Referral',
                                'Release of Records','Correspondence',
                                'Intake Form','Eligibility Response',
                                '42 CFR Part 2 Consent','Other')),
  title                       TEXT NOT NULL,
  description                 TEXT,
  tags                        TEXT[],         -- Freeform searchable tags

  -- ── File Metadata ─────────────────────────────────────────
  file_name                   TEXT NOT NULL,
  storage_path                TEXT NOT NULL,  -- Supabase storage bucket path
  file_size_bytes             INTEGER,
  mime_type                   TEXT,

  -- ── Signature Tracking ────────────────────────────────────
  requires_signature          BOOLEAN DEFAULT FALSE,
  is_signed                   BOOLEAN DEFAULT FALSE,
  signed_at                   TIMESTAMPTZ,
  signed_by_name              TEXT,
  signature_method            TEXT CHECK (signature_method IN (
                                'Wet Ink','Electronic In-Office',
                                'DocuSign','HelloSign','Manual Upload')),

  -- ── Renewal / Expiration ──────────────────────────────────
  requires_renewal            BOOLEAN DEFAULT FALSE,
  renewal_date                DATE,
  renewal_reminder_sent       BOOLEAN DEFAULT FALSE,
  renewal_reminder_sent_at    TIMESTAMPTZ,

  -- ── Versioning ────────────────────────────────────────────
  version                     INTEGER NOT NULL DEFAULT 1,
  supersedes_document_id      UUID REFERENCES patient_documents(id) ON DELETE SET NULL,

  -- ── Compliance ────────────────────────────────────────────
  contains_42_cfr_pt2_data    BOOLEAN DEFAULT FALSE,  -- SUD record — extra protections

  -- ── Portal Visibility ─────────────────────────────────────
  is_visible_to_patient       BOOLEAN DEFAULT FALSE,

  -- ── Archive / Soft Delete ────────────────────────────────
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at                 TIMESTAMPTZ,
  archived_by                 UUID REFERENCES auth.users(id),

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_docs_patient         ON patient_documents(patient_id);
CREATE INDEX idx_docs_org             ON patient_documents(org_id);
CREATE INDEX idx_docs_type            ON patient_documents(document_type);
CREATE INDEX idx_docs_active          ON patient_documents(patient_id, is_active);
CREATE INDEX idx_docs_renewal         ON patient_documents(renewal_date)
  WHERE requires_renewal = TRUE AND is_active = TRUE;
CREATE INDEX idx_docs_unsigned        ON patient_documents(patient_id, requires_signature, is_signed)
  WHERE requires_signature = TRUE AND is_signed = FALSE;
CREATE INDEX idx_docs_portal          ON patient_documents(patient_id, is_visible_to_patient)
  WHERE is_visible_to_patient = TRUE;

ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

-- Clinicians see all documents for patients in their org
CREATE POLICY "org_access_patient_docs" ON patient_documents
  FOR ALL TO authenticated
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

-- Patients may view documents their practice has shared with them
CREATE POLICY "patient_portal_own_docs" ON patient_documents
  FOR SELECT TO authenticated
  USING (
    is_visible_to_patient = TRUE
    AND patient_id IN (
      SELECT id FROM patients WHERE portal_user_id = auth.uid()
    )
  );


-- ============================================================
-- 12. patient_portal_messages
-- ============================================================
-- Purpose: Secure HIPAA-compliant asynchronous messaging
-- between patients and their care team.  Supports threaded
-- replies (reply_to_id), message categories, read receipts,
-- priority flagging for clinical urgency, and per-party
-- archive states.  Portal messages must never be emailed
-- in full — only notifications that "you have a message."
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_portal_messages (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Thread ────────────────────────────────────────────────
  thread_id                   UUID NOT NULL DEFAULT gen_random_uuid(),
                              -- Caller groups new top-level messages under same thread_id;
                              -- replies inherit the parent thread_id.

  -- ── Foreign Keys ─────────────────────────────────────────
  patient_id                  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  org_id                      TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,
  clinician_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                              -- NULL when sent by admin system or auto-reminder

  -- ── Sender ────────────────────────────────────────────────
  sender_type                 TEXT NOT NULL CHECK (sender_type IN (
                                'Patient','Clinician','Admin','System')),
  sender_id                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_display_name         TEXT,           -- Cached display name at send time

  -- ── Content ───────────────────────────────────────────────
  subject                     TEXT,
  body                        TEXT NOT NULL,
  attachments                 TEXT[],         -- Supabase storage paths

  -- ── Classification ────────────────────────────────────────
  category                    TEXT DEFAULT 'General'
                                CHECK (category IN (
                                  'Appointment','Billing','Clinical',
                                  'Prescription','General','Urgent',
                                  'Administrative','Lab Results')),
  priority                    TEXT NOT NULL DEFAULT 'Normal'
                                CHECK (priority IN ('Normal','High','Urgent')),

  -- ── Threading ────────────────────────────────────────────
  reply_to_id                 UUID REFERENCES patient_portal_messages(id) ON DELETE SET NULL,

  -- ── Read Receipts ─────────────────────────────────────────
  read_by_clinician           BOOLEAN DEFAULT FALSE,
  read_by_clinician_at        TIMESTAMPTZ,
  read_by_patient             BOOLEAN DEFAULT FALSE,
  read_by_patient_at          TIMESTAMPTZ,

  -- ── Response Tracking ────────────────────────────────────
  response_required           BOOLEAN DEFAULT FALSE,
  response_due_by             DATE,
  responded_at                TIMESTAMPTZ,
  responded_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ── Archive ───────────────────────────────────────────────
  archived_by_clinician       BOOLEAN DEFAULT FALSE,
  archived_by_patient         BOOLEAN DEFAULT FALSE,

  sent_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_portal_msg_patient    ON patient_portal_messages(patient_id);
CREATE INDEX idx_portal_msg_org        ON patient_portal_messages(org_id);
CREATE INDEX idx_portal_msg_thread     ON patient_portal_messages(thread_id);
CREATE INDEX idx_portal_msg_sent       ON patient_portal_messages(sent_at DESC);
CREATE INDEX idx_portal_msg_unread_cli ON patient_portal_messages(org_id, read_by_clinician)
  WHERE read_by_clinician = FALSE;
CREATE INDEX idx_portal_msg_unread_pat ON patient_portal_messages(patient_id, read_by_patient)
  WHERE read_by_patient = FALSE;
CREATE INDEX idx_portal_msg_priority   ON patient_portal_messages(org_id, priority)
  WHERE priority IN ('High','Urgent');
CREATE INDEX idx_portal_msg_response   ON patient_portal_messages(response_due_by)
  WHERE response_required = TRUE AND responded_at IS NULL;

ALTER TABLE patient_portal_messages ENABLE ROW LEVEL SECURITY;

-- Clinicians and admin see messages within their org
CREATE POLICY "org_access_portal_messages" ON patient_portal_messages
  FOR ALL TO authenticated
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

-- Patients see only their own messages via portal
CREATE POLICY "patient_portal_own_messages" ON patient_portal_messages
  FOR ALL TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE portal_user_id = auth.uid()
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE portal_user_id = auth.uid()
    )
    AND sender_type = 'Patient'
  );


-- ============================================================
-- Triggers: auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patients_updated
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_patient_contacts_updated
  BEFORE UPDATE ON patient_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_emergency_contacts_updated
  BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_guarantors_updated
  BEFORE UPDATE ON guarantors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_insurance_policies_updated
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_appointments_updated
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_recurring_appts_updated
  BEFORE UPDATE ON recurring_appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_telehealth_sessions_updated
  BEFORE UPDATE ON telehealth_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_patient_docs_updated
  BEFORE UPDATE ON patient_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_portal_messages_updated
  BEFORE UPDATE ON patient_portal_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- Trigger: auto-write appointment_status_history on status change
-- ============================================================
CREATE OR REPLACE FUNCTION record_appointment_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO appointment_status_history
      (appointment_id, from_status, to_status, changed_by_role)
    VALUES
      (NEW.id, OLD.status, NEW.status, 'System');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appt_status_history
  AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION record_appointment_status_change();


-- ============================================================
-- END patient-scheduling-schema.sql
-- ============================================================
