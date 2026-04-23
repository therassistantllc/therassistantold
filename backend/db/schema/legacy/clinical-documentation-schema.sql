-- ============================================================
-- THERASSISTANT Clinical Documentation Database Schema
-- Colorado Medicaid Behavioral Health Platform
-- Supabase / PostgreSQL
-- ============================================================
-- Tables:
--   1.  progress_notes
--   2.  treatment_plans
--   3.  treatment_plan_reviews
--   4.  assessments
--   5.  screening_results
--   6.  diagnoses
--   7.  diagnosis_history
--   8.  medications
--   9.  group_notes
--   10. group_note_participants
--   11. family_session_notes
--   12. note_addendums
--   13. supervisor_signatures
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- TABLE 1: progress_notes
--   One row per individual therapy session.
--   Covers billed codes: H0001, 90837, 90834, 90832, 90839, 90840.
--   Telehealth modifier GT is captured via service_modifier.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_notes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient & practice linkage
  patient_id                TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id                 TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,
  clinician_id              UUID NOT NULL REFERENCES auth.users(id),       -- rendering provider

  -- Session logistics
  session_date              DATE NOT NULL,
  start_time                TIME,
  end_time                  TIME,
  duration_minutes          INTEGER,                                        -- stored for billing audit
  service_code              TEXT NOT NULL,                                  -- H0001, 90837, 90834, etc.
  service_modifier          TEXT,                                           -- HO, HN, GT, U1, etc.
  place_of_service          TEXT DEFAULT '11',                              -- 11=Office, 02=Telehealth
  telehealth                BOOLEAN DEFAULT FALSE,
  telehealth_platform       TEXT,                                           -- Zoom, Doxy, SimplePractice, etc.

  -- Clinical content
  presenting_concerns       TEXT,
  mental_status_exam        JSONB,     -- {appearance, behavior, mood, affect, thought_process,
                                       --  thought_content, cognition, insight, judgment}
  interventions             TEXT[],    -- CBT, DBT, MI, Psychoeducation, etc.
  response_to_treatment     TEXT,
  progress_toward_goals     TEXT,
  plan                      TEXT,

  -- Risk documentation
  risk_level                TEXT CHECK (risk_level IN ('none','low','moderate','high')),
  risk_assessment_text      TEXT,
  safety_plan_updated       BOOLEAN DEFAULT FALSE,

  -- Goal linkage (references treatment_plans.short_term_objectives goal IDs)
  goal_ids                  UUID[],

  -- Generated / AI-assisted note
  generated_note_text       TEXT,
  billing_code_confirmed    BOOLEAN DEFAULT FALSE,

  -- Workflow status
  note_status               TEXT NOT NULL DEFAULT 'draft'
                              CHECK (note_status IN
                                ('draft','complete','signed','cosigned','locked','amended')),
  signed_at                 TIMESTAMPTZ,
  signed_by                 UUID REFERENCES auth.users(id),
  locked_at                 TIMESTAMPTZ,
  locked_by                 UUID REFERENCES auth.users(id),

  -- Supervision
  supervisor_signature_id   UUID,      -- FK set after supervisor_signatures insert (see FK below)

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pn_patient        ON progress_notes(patient_id);
CREATE INDEX idx_pn_client         ON progress_notes(client_id);
CREATE INDEX idx_pn_clinician      ON progress_notes(clinician_id);
CREATE INDEX idx_pn_session_date   ON progress_notes(session_date DESC);
CREATE INDEX idx_pn_status         ON progress_notes(note_status);
CREATE INDEX idx_pn_service_code   ON progress_notes(service_code);

ALTER TABLE progress_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_progress_notes" ON progress_notes
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 2: treatment_plans
--   Master treatment plan document.
--   Colorado Medicaid requires a signed TP prior to most ongoing services.
--   Goals / objectives stored as JSONB arrays for flexible schema.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS treatment_plans (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id                TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id                 TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,
  clinician_id              UUID NOT NULL REFERENCES auth.users(id),

  -- Plan dates
  plan_date                 DATE NOT NULL,
  expiration_date           DATE,                          -- typically plan_date + 1 year
  status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','expired','superseded','closed')),

  -- Clinical content
  presenting_problems       TEXT,
  patient_strengths         TEXT,
  barriers_to_treatment     TEXT,

  -- Goals / objectives as JSONB arrays
  --   long_term_goals: [{id, description, target_date}]
  --   short_term_objectives: [{id, goal_id, description, target_date, status, measure}]
  --   interventions: [{modality, frequency, description}]
  long_term_goals           JSONB DEFAULT '[]'::jsonb,
  short_term_objectives     JSONB DEFAULT '[]'::jsonb,
  interventions_planned     JSONB DEFAULT '[]'::jsonb,

  -- Service parameters
  service_frequency         TEXT,                          -- e.g. "Weekly individual therapy, 60 min"
  estimated_duration_weeks  INTEGER,
  level_of_care             TEXT,                          -- Outpatient, IOP, PHP, etc.
  discharge_criteria        TEXT,

  -- Consent / signatures
  patient_consented         BOOLEAN DEFAULT FALSE,
  patient_signed_at         TIMESTAMPTZ,
  patient_signature_method  TEXT CHECK (patient_signature_method
                              IN ('wet','electronic','verbal_consent','guardian_signed')),

  clinician_signed_at       TIMESTAMPTZ,
  clinician_signed_by       UUID REFERENCES auth.users(id),

  -- Supervision
  supervisor_signature_id   UUID,

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tp_patient       ON treatment_plans(patient_id);
CREATE INDEX idx_tp_client        ON treatment_plans(client_id);
CREATE INDEX idx_tp_status        ON treatment_plans(status);
CREATE INDEX idx_tp_expiration    ON treatment_plans(expiration_date);

ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_treatment_plans" ON treatment_plans
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 3: treatment_plan_reviews
--   Periodic clinical reviews of treatment plans.
--   Colorado Medicaid requires review at least every 90 days
--   for H0001 and annually for some codes.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS treatment_plan_reviews (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  treatment_plan_id         UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE RESTRICT,
  patient_id                TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id                 TEXT NOT NULL REFERENCES clinician_accounts(id),
  clinician_id              UUID NOT NULL REFERENCES auth.users(id),

  -- Review dates
  review_date               DATE NOT NULL,
  next_review_date          DATE,
  review_type               TEXT NOT NULL DEFAULT '90_day'
                              CHECK (review_type IN ('90_day','annual','crisis','discharge')),

  -- Progress summary
  overall_progress          TEXT CHECK (overall_progress IN
                              ('substantial','moderate','minimal','no_progress','regression')),
  -- Per-goal progress updates:
  --   [{goal_id, description, prior_status, current_status, notes}]
  goal_progress_updates     JSONB DEFAULT '[]'::jsonb,

  -- Plan changes
  diagnosis_changes         TEXT,
  service_changes           JSONB,                         -- {code, frequency, rationale}
  modifications_summary     TEXT,
  plan_status               TEXT NOT NULL DEFAULT 'continued'
                              CHECK (plan_status IN
                                ('continued','modified','closed','referred_out','hospitalized')),

  -- Signatures
  clinician_signed_at       TIMESTAMPTZ,
  clinician_signed_by       UUID REFERENCES auth.users(id),
  supervisor_signature_id   UUID,

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tpr_plan         ON treatment_plan_reviews(treatment_plan_id);
CREATE INDEX idx_tpr_patient      ON treatment_plan_reviews(patient_id);
CREATE INDEX idx_tpr_client       ON treatment_plan_reviews(client_id);
CREATE INDEX idx_tpr_review_date  ON treatment_plan_reviews(review_date DESC);

ALTER TABLE treatment_plan_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_tp_reviews" ON treatment_plan_reviews
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 4: assessments
--   Full clinical assessments: intake, comprehensive (H0031),
--   mental health (H0001), substance use (H0032), crisis, annual.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessments (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id                     TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id                      TEXT NOT NULL REFERENCES clinician_accounts(id),
  clinician_id                   UUID NOT NULL REFERENCES auth.users(id),

  -- Assessment classification
  assessment_type                TEXT NOT NULL
                                   CHECK (assessment_type IN
                                     ('intake','comprehensive','mental_health',
                                      'substance_use','crisis','annual','psychological')),
  assessment_date                DATE NOT NULL,
  service_code                   TEXT,                    -- H0031, H0001, H0032, 90791, 90792
  service_modifier               TEXT,

  -- Clinical narrative sections
  chief_complaint                TEXT,
  history_of_present_illness     TEXT,

  -- Structured history sections (JSONB for conditional depth)
  psychiatric_history            JSONB,    -- {prior_diagnoses, hospitalizations, prior_tx, meds_hx}
  substance_use_history          JSONB,    -- {substances: [{name, onset, pattern, last_use, cravings}],
                                           --  treatment_history, recovery_supports}
  medical_history                TEXT,
  family_psychiatric_history     TEXT,
  social_history                 JSONB,    -- {housing, employment, education, legal, relationships,
                                           --  support_system, cultural_factors}
  trauma_history                 TEXT,
  developmental_history          TEXT,

  -- Mental Status Exam
  mental_status_exam             JSONB,    -- {appearance, behavior, eye_contact, speech, mood,
                                           --  affect, thought_process, thought_content,
                                           --  perceptual_disturbances, cognition, memory,
                                           --  insight, judgment, impulse_control}

  -- Risk
  risk_assessment                JSONB,    -- {suicidal_ideation, plan, intent, means_access,
                                           --  homicidal_ideation, self_harm, risk_level,
                                           --  protective_factors, disposition}

  -- Formulation & recommendations
  strengths                      TEXT,
  barriers_to_treatment          TEXT,
  clinical_formulation           TEXT,
  level_of_care_recommendation   TEXT,
  treatment_recommendations      TEXT,
  release_of_information_parties TEXT[],

  -- Workflow status
  status                         TEXT NOT NULL DEFAULT 'draft'
                                   CHECK (status IN
                                     ('draft','complete','signed','cosigned','locked')),
  signed_at                      TIMESTAMPTZ,
  signed_by                      UUID REFERENCES auth.users(id),

  supervisor_signature_id        UUID,

  created_at                     TIMESTAMPTZ DEFAULT now(),
  updated_at                     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_asmnt_patient       ON assessments(patient_id);
CREATE INDEX idx_asmnt_client        ON assessments(client_id);
CREATE INDEX idx_asmnt_clinician     ON assessments(clinician_id);
CREATE INDEX idx_asmnt_date          ON assessments(assessment_date DESC);
CREATE INDEX idx_asmnt_type          ON assessments(assessment_type);
CREATE INDEX idx_asmnt_service_code  ON assessments(service_code);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_assessments" ON assessments
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 5: screening_results
--   Standardized screening tool scores.
--   Tools: PHQ-9, GAD-7, AUDIT, AUDIT-C, DAST-10, CSSRS,
--          PCL-5, MDQ, YBOCS, WHODAS, ASI, etc.
--   Linked optionally to a progress_note or assessment.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS screening_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id            TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Optional source document linkage
  progress_note_id      UUID REFERENCES progress_notes(id),
  assessment_id         UUID REFERENCES assessments(id),

  -- Tool metadata
  tool_name             TEXT NOT NULL,          -- 'PHQ-9', 'GAD-7', 'CSSRS', etc.
  tool_version          TEXT,                   -- e.g. 'PHQ-9 2001' for documentation

  administered_date     DATE NOT NULL,
  administered_by       UUID NOT NULL REFERENCES auth.users(id),

  -- Scored data
  -- responses: {question_1: 2, question_2: 1, ...}
  responses             JSONB DEFAULT '{}'::jsonb,
  total_score           NUMERIC(6,2),
  -- subscale_scores: {somatic: 5, cognitive: 8} (PHQ-9 example)
  subscale_scores       JSONB DEFAULT '{}'::jsonb,

  -- Interpretation
  severity_level        TEXT,                   -- none/minimal/mild/moderate/moderately_severe/severe
  clinical_interpretation TEXT,

  -- Flags for high-risk item responses (e.g. PHQ-9 item 9, CSSRS active SI)
  flags                 JSONB DEFAULT '{}'::jsonb,
  follow_up_required    BOOLEAN DEFAULT FALSE,
  follow_up_notes       TEXT,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sr_patient        ON screening_results(patient_id);
CREATE INDEX idx_sr_client         ON screening_results(client_id);
CREATE INDEX idx_sr_tool           ON screening_results(tool_name);
CREATE INDEX idx_sr_date           ON screening_results(administered_date DESC);
CREATE INDEX idx_sr_note           ON screening_results(progress_note_id);
CREATE INDEX idx_sr_assessment     ON screening_results(assessment_id);
CREATE INDEX idx_sr_flags          ON screening_results USING gin(flags);

ALTER TABLE screening_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_screening" ON screening_results
  FOR ALL TO authenticated
  USING (administered_by = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 6: diagnoses
--   Current active diagnosis list per patient.
--   ICD-10-CM codes; supports primary, secondary, rule-out.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnoses (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id                  TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id                   TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Diagnosis identification
  icd10_code                  TEXT NOT NULL,               -- F32.1, F41.1, F10.20, etc.
  icd10_description           TEXT NOT NULL,
  dsm5_specifiers             TEXT[],                      -- e.g. ['with anxious distress']
  diagnosis_type              TEXT NOT NULL DEFAULT 'primary'
                                CHECK (diagnosis_type IN
                                  ('primary','secondary','tertiary','rule_out','historical')),
  severity                    TEXT CHECK (severity IN
                                ('mild','moderate','severe','in_remission',
                                 'in_partial_remission','unspecified')),

  -- History
  onset_date                  DATE,                        -- estimated or reported onset
  established_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  established_by              UUID NOT NULL REFERENCES auth.users(id),

  -- Source document where diagnosis was first established
  established_in_document_type TEXT CHECK (established_in_document_type IN
                                  ('assessment','treatment_plan','progress_note')),
  established_in_document_id  UUID,

  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN
                                  ('active','inactive','resolved','rule_out')),
  clinical_notes              TEXT,

  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dx_patient      ON diagnoses(patient_id);
CREATE INDEX idx_dx_client       ON diagnoses(client_id);
CREATE INDEX idx_dx_icd10        ON diagnoses(icd10_code);
CREATE INDEX idx_dx_status       ON diagnoses(status);
CREATE INDEX idx_dx_type         ON diagnoses(diagnosis_type);

ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_diagnoses" ON diagnoses
  FOR ALL TO authenticated
  USING (established_by = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 7: diagnosis_history
--   Immutable audit trail of every diagnosis change.
--   Append-only: never UPDATE rows in this table.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnosis_history (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  diagnosis_id            UUID NOT NULL REFERENCES diagnoses(id) ON DELETE RESTRICT,
  patient_id              TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id               TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- What changed
  change_type             TEXT NOT NULL
                            CHECK (change_type IN
                              ('added','modified','deactivated','resolved','reinstated')),

  -- Before / after snapshot
  prior_icd10_code        TEXT,                            -- NULL on initial 'added'
  new_icd10_code          TEXT NOT NULL,
  prior_status            TEXT,
  new_status              TEXT NOT NULL,
  prior_diagnosis_type    TEXT,
  new_diagnosis_type      TEXT NOT NULL,
  prior_severity          TEXT,
  new_severity            TEXT,

  -- Reason for change and attribution
  change_reason           TEXT,
  changed_by              UUID NOT NULL REFERENCES auth.users(id),
  changed_by_name         TEXT,                            -- denormalized for audit readability

  -- Source document that triggered the change
  source_document_type    TEXT CHECK (source_document_type IN
                            ('assessment','progress_note','treatment_plan',
                             'treatment_plan_review','note_addendum')),
  source_document_id      UUID,

  changed_at              TIMESTAMPTZ NOT NULL DEFAULT now()  -- no updated_at; rows are immutable
);

CREATE INDEX idx_dxhx_diagnosis   ON diagnosis_history(diagnosis_id);
CREATE INDEX idx_dxhx_patient     ON diagnosis_history(patient_id);
CREATE INDEX idx_dxhx_changed_at  ON diagnosis_history(changed_at DESC);
CREATE INDEX idx_dxhx_change_type ON diagnosis_history(change_type);

ALTER TABLE diagnosis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_diagnosis_history" ON diagnosis_history
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff')
    OR changed_by = auth.uid());

CREATE POLICY "insert_diagnosis_history" ON diagnosis_history
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);


-- ──────────────────────────────────────────────────────────
-- TABLE 8: medications
--   Medication reconciliation list per patient.
--   Colorado Medicaid expects documentation of current meds
--   in assessments and treatment plans.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id            TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Medication identification
  medication_name       TEXT NOT NULL,                     -- as prescribed / reported
  generic_name          TEXT,
  brand_name            TEXT,

  -- Prescription details
  dosage                TEXT,                              -- '50mg', '0.5mg/mL'
  frequency             TEXT,                              -- 'QD', 'BID', 'QHS', 'PRN'
  route                 TEXT DEFAULT 'oral',               -- oral, IM, sublingual, transdermal

  -- Prescriber info
  prescriber_name       TEXT,
  prescriber_npi        TEXT,
  prescriber_practice   TEXT,

  -- Dates
  start_date            DATE,
  end_date              DATE,                              -- NULL if currently active

  -- Status
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN
                            ('active','discontinued','on_hold','unknown','patient_reported')),
  indication            TEXT,                              -- linked diagnosis or description
  patient_reported      BOOLEAN DEFAULT TRUE,              -- vs. received from prescriber

  -- Reconciliation
  reconciliation_date   DATE,
  reconciled_by         UUID REFERENCES auth.users(id),
  notes                 TEXT,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_med_patient   ON medications(patient_id);
CREATE INDEX idx_med_client    ON medications(client_id);
CREATE INDEX idx_med_status    ON medications(status);
CREATE INDEX idx_med_name      ON medications(medication_name);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_medications" ON medications
  FOR ALL TO authenticated
  USING (reconciled_by = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 9: group_notes
--   Group therapy session-level header record.
--   Covers H0004, H0005, 90853.
--   Individual member notes are in group_note_participants.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_notes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id               TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Group identity
  group_name              TEXT NOT NULL,
  group_topic             TEXT,
  therapeutic_modality    TEXT,                             -- CBT, DBT, Psychoeducation, etc.

  -- Session logistics
  session_date            DATE NOT NULL,
  start_time              TIME,
  end_time                TIME,
  duration_minutes        INTEGER,
  service_code            TEXT NOT NULL,                   -- H0004, H0005, 90853
  service_modifier        TEXT,
  place_of_service        TEXT DEFAULT '11',

  -- Facilitators (auth.users IDs)
  facilitator_ids         UUID[] NOT NULL DEFAULT '{}',    -- primary facilitators
  co_facilitator_ids      UUID[] DEFAULT '{}',

  -- Session content
  attendance_count        INTEGER DEFAULT 0,               -- updated from group_note_participants
  overall_session_summary TEXT,
  interventions           TEXT[],
  group_dynamics          TEXT,

  -- Workflow status
  note_status             TEXT NOT NULL DEFAULT 'draft'
                            CHECK (note_status IN
                              ('draft','complete','signed','locked')),
  signed_at               TIMESTAMPTZ,
  signed_by               UUID REFERENCES auth.users(id),

  supervisor_signature_id UUID,

  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gn_client       ON group_notes(client_id);
CREATE INDEX idx_gn_date         ON group_notes(session_date DESC);
CREATE INDEX idx_gn_status       ON group_notes(note_status);
CREATE INDEX idx_gn_service_code ON group_notes(service_code);

ALTER TABLE group_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_group_notes" ON group_notes
  FOR ALL TO authenticated
  USING (auth.uid() = ANY(facilitator_ids)
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 10: group_note_participants
--   One row per member per group session.
--   Colorado Medicaid requires individualized documentation
--   per member in order to bill separately per participant.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_note_participants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  group_note_id         UUID NOT NULL REFERENCES group_notes(id) ON DELETE CASCADE,
  patient_id            TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Attendance
  attendance_status     TEXT NOT NULL DEFAULT 'present'
                          CHECK (attendance_status IN
                            ('present','absent','late','left_early','call_in')),

  -- Individualized clinical documentation (required for billing)
  participation_level   TEXT CHECK (participation_level IN
                          ('active','passive','minimal','disruptive','withdrawn')),
  individual_response   TEXT,                              -- how this member responded to session
  goals_addressed       TEXT[],                            -- which treatment goals were worked on
  individualized_note   TEXT NOT NULL DEFAULT '',          -- the per-member billing note

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE (group_note_id, patient_id)                       -- one entry per member per session
);

CREATE INDEX idx_gnp_group_note  ON group_note_participants(group_note_id);
CREATE INDEX idx_gnp_patient     ON group_note_participants(patient_id);
CREATE INDEX idx_gnp_client      ON group_note_participants(client_id);
CREATE INDEX idx_gnp_attendance  ON group_note_participants(attendance_status);

ALTER TABLE group_note_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_gnp" ON group_note_participants
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff')
    OR EXISTS (
      SELECT 1 FROM group_notes gn
      WHERE gn.id = group_note_participants.group_note_id
        AND auth.uid() = ANY(gn.facilitator_ids)
    ));


-- ──────────────────────────────────────────────────────────
-- TABLE 11: family_session_notes
--   Family and conjoint therapy session notes.
--   Service codes: 90847 (with patient), 90846 (without patient),
--   90849 (multiple family group therapy).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_session_notes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  identified_patient_id     TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id                 TEXT NOT NULL REFERENCES clinician_accounts(id),
  clinician_id              UUID NOT NULL REFERENCES auth.users(id),

  -- Session logistics
  session_date              DATE NOT NULL,
  start_time                TIME,
  end_time                  TIME,
  duration_minutes          INTEGER,
  service_code              TEXT NOT NULL,                 -- 90847, 90846, 90849
  service_modifier          TEXT,
  place_of_service          TEXT DEFAULT '11',
  telehealth                BOOLEAN DEFAULT FALSE,

  -- Participants (non-patient family/support members)
  -- [{name, relationship, dob, patient_id_if_registered}]
  participants              JSONB DEFAULT '[]'::jsonb,

  -- Clinical content
  presenting_concerns       TEXT,
  family_dynamics           TEXT,
  systems_assessed          TEXT[],                        -- family, parental, sibling, etc.
  interventions             TEXT,
  response_to_session       TEXT,
  plan                      TEXT,

  -- Workflow status
  note_status               TEXT NOT NULL DEFAULT 'draft'
                              CHECK (note_status IN
                                ('draft','complete','signed','cosigned','locked','amended')),
  signed_at                 TIMESTAMPTZ,
  signed_by                 UUID REFERENCES auth.users(id),

  supervisor_signature_id   UUID,

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fsn_patient     ON family_session_notes(identified_patient_id);
CREATE INDEX idx_fsn_client      ON family_session_notes(client_id);
CREATE INDEX idx_fsn_clinician   ON family_session_notes(clinician_id);
CREATE INDEX idx_fsn_date        ON family_session_notes(session_date DESC);
CREATE INDEX idx_fsn_status      ON family_session_notes(note_status);

ALTER TABLE family_session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_family_notes" ON family_session_notes
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 12: note_addendums
--   Append-only corrections/additions to any signed document.
--   Signed source documents must NOT be edited; addendums
--   preserve the integrity of the original record.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS note_addendums (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic parent reference
  parent_note_type        TEXT NOT NULL
                            CHECK (parent_note_type IN
                              ('progress_note','assessment','group_note',
                               'family_session_note','treatment_plan',
                               'treatment_plan_review')),
  parent_note_id          UUID NOT NULL,                   -- ID in the referenced table

  patient_id              TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id               TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Addendum content
  addendum_text           TEXT NOT NULL,
  reason                  TEXT NOT NULL,                   -- why the addendum is being added

  -- Author (denormalized for permanent audit trail)
  author_id               UUID NOT NULL REFERENCES auth.users(id),
  author_name             TEXT NOT NULL,
  author_credential       TEXT,                            -- LCSW, LPC, CACIII, etc.

  -- Workflow status
  status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','signed','locked')),
  signed_at               TIMESTAMPTZ,

  supervisor_signature_id UUID,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at: addendums should be treated as append-only after signing.
);

CREATE INDEX idx_na_parent        ON note_addendums(parent_note_id);
CREATE INDEX idx_na_parent_type   ON note_addendums(parent_note_type);
CREATE INDEX idx_na_patient       ON note_addendums(patient_id);
CREATE INDEX idx_na_client        ON note_addendums(client_id);
CREATE INDEX idx_na_author        ON note_addendums(author_id);

ALTER TABLE note_addendums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinician_own_addendums" ON note_addendums
  FOR ALL TO authenticated
  USING (author_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin','billing_staff'));


-- ──────────────────────────────────────────────────────────
-- TABLE 13: supervisor_signatures
--   Cosignature records for supervision workflows.
--   Required in Colorado for pre-licensed clinicians (LAC, LSW, LPC
--   candidates) working under clinical supervision.
--   Polymorphic: references any signable document type.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supervisor_signatures (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The document being signed
  document_type             TEXT NOT NULL
                              CHECK (document_type IN
                                ('progress_note','assessment','treatment_plan',
                                 'treatment_plan_review','group_note',
                                 'family_session_note','note_addendum')),
  document_id               UUID NOT NULL,                 -- ID in the referenced table

  -- Supervisee (the clinician who wrote the note)
  supervisee_clinician_id   UUID NOT NULL REFERENCES auth.users(id),
  supervisee_name           TEXT NOT NULL,                 -- denormalized for audit trail
  supervisee_credential     TEXT,                          -- LAC, LSW, CACII, etc.

  -- Supervisor
  supervisor_id             UUID NOT NULL REFERENCES auth.users(id),
  supervisor_name           TEXT NOT NULL,                 -- denormalized for audit trail
  supervisor_npi            TEXT,
  supervisor_credential     TEXT NOT NULL,                 -- LCSW, LPC, Psychologist, MD, etc.
  supervisor_license_number TEXT,

  -- Supervision details
  supervision_type          TEXT NOT NULL DEFAULT 'cosignature'
                              CHECK (supervision_type IN
                                ('cosignature','oversight','collaborative','consultation')),
  attestation_text          TEXT,                          -- the legal attestation statement

  notes                     TEXT,

  -- Timestamps (signed_at is the authoritative signature time)
  signed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ss_document      ON supervisor_signatures(document_id);
CREATE INDEX idx_ss_doc_type      ON supervisor_signatures(document_type);
CREATE INDEX idx_ss_supervisor    ON supervisor_signatures(supervisor_id);
CREATE INDEX idx_ss_supervisee    ON supervisor_signatures(supervisee_clinician_id);
CREATE INDEX idx_ss_signed_at     ON supervisor_signatures(signed_at DESC);

ALTER TABLE supervisor_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supervisor_own_signatures" ON supervisor_signatures
  FOR ALL TO authenticated
  USING (supervisor_id = auth.uid()
    OR supervisee_clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','super_admin'));


-- ──────────────────────────────────────────────────────────
-- Deferred Foreign Keys: supervisor_signature_id columns
-- must be added as FKs after supervisor_signatures is created
-- to avoid circular dependency. Run after all tables exist.
-- ──────────────────────────────────────────────────────────
ALTER TABLE progress_notes
  ADD CONSTRAINT fk_pn_supervisor
  FOREIGN KEY (supervisor_signature_id) REFERENCES supervisor_signatures(id);

ALTER TABLE treatment_plans
  ADD CONSTRAINT fk_tp_supervisor
  FOREIGN KEY (supervisor_signature_id) REFERENCES supervisor_signatures(id);

ALTER TABLE treatment_plan_reviews
  ADD CONSTRAINT fk_tpr_supervisor
  FOREIGN KEY (supervisor_signature_id) REFERENCES supervisor_signatures(id);

ALTER TABLE assessments
  ADD CONSTRAINT fk_asmnt_supervisor
  FOREIGN KEY (supervisor_signature_id) REFERENCES supervisor_signatures(id);

ALTER TABLE group_notes
  ADD CONSTRAINT fk_gn_supervisor
  FOREIGN KEY (supervisor_signature_id) REFERENCES supervisor_signatures(id);

ALTER TABLE family_session_notes
  ADD CONSTRAINT fk_fsn_supervisor
  FOREIGN KEY (supervisor_signature_id) REFERENCES supervisor_signatures(id);

ALTER TABLE note_addendums
  ADD CONSTRAINT fk_na_supervisor
  FOREIGN KEY (supervisor_signature_id) REFERENCES supervisor_signatures(id);


-- ──────────────────────────────────────────────────────────
-- Trigger: auto-update updated_at on row changes
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'progress_notes','treatment_plans','treatment_plan_reviews',
    'assessments','screening_results','diagnoses','medications',
    'group_notes','group_note_participants','family_session_notes'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;
