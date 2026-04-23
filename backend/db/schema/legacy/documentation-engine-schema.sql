-- ============================================================
-- THERASSISTANT Documentation Engine Schema
-- Commands 1-3: Core data model, relationships, last-session state
-- Colorado Medicaid / Behavioral Health
-- ============================================================

-- ─────────────────────────────────────────────
-- NOTE COMPLEXITY / VISIT TYPE
-- ─────────────────────────────────────────────

CREATE TYPE note_complexity AS ENUM (
  'routine_followup',
  'moderate_complexity',
  'high_complexity',
  'crisis_visit',
  'intake_assessment'
);

CREATE TYPE note_status AS ENUM (
  'draft',
  'in_progress',
  'signed',
  'cosigned',
  'amended',
  'voided'
);

CREATE TYPE phrase_visibility AS ENUM (
  'private',
  'org_shared',
  'role_shared'
);

CREATE TYPE session_modality AS ENUM (
  'individual',
  'group',
  'family',
  'couples',
  'telehealth_video',
  'telehealth_phone',
  'crisis',
  'assessment'
);

-- ─────────────────────────────────────────────
-- COMMAND 1: NOTE TEMPLATES
-- ─────────────────────────────────────────────

CREATE TABLE note_templates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        UUID NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  complexity    note_complexity NOT NULL DEFAULT 'routine_followup',
  service_path  TEXT NOT NULL DEFAULT 'mh' CHECK (service_path IN ('mh','sud','integrated')),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- NOTE SECTIONS
-- ─────────────────────────────────────────────

CREATE TABLE note_sections (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id     UUID REFERENCES note_templates(id) ON DELETE CASCADE,
  section_key     TEXT NOT NULL,  -- e.g. 'subjective','objective','risk','plan'
  label           TEXT NOT NULL,
  display_order   INT NOT NULL DEFAULT 0,
  is_required     BOOLEAN NOT NULL DEFAULT true,
  default_visible BOOLEAN NOT NULL DEFAULT true,
  conditional_on  TEXT,           -- JSON: { field, value } → show section when condition met
  hint_text       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- REUSABLE PHRASES
-- ─────────────────────────────────────────────

CREATE TABLE phrase_categories (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reusable_phrases (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID,
  category_id     UUID REFERENCES phrase_categories(id) ON DELETE SET NULL,
  created_by      UUID,
  label           TEXT NOT NULL,
  phrase_text     TEXT NOT NULL,            -- supports *** placeholders
  placeholder_count INT NOT NULL DEFAULT 0,
  visibility      phrase_visibility NOT NULL DEFAULT 'private',
  allowed_roles   TEXT[],                  -- e.g. ['clinician','intern']
  use_count       INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  tags            TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reusable_phrases_org ON reusable_phrases(org_id);
CREATE INDEX idx_reusable_phrases_category ON reusable_phrases(category_id);
CREATE INDEX idx_reusable_phrases_visibility ON reusable_phrases(visibility);

-- ─────────────────────────────────────────────
-- INTERVENTION LIBRARY
-- ─────────────────────────────────────────────

CREATE TABLE intervention_library (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID,
  code_key    TEXT NOT NULL,   -- e.g. 'cbt', 'dbt', 'mi'
  label       TEXT NOT NULL,
  description TEXT,
  modality    TEXT,            -- 'individual','group','family'
  skill_codes TEXT[],          -- supported billing codes e.g. ['H2014']
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- RISK RESPONSE LIBRARY
-- ─────────────────────────────────────────────

CREATE TABLE risk_response_library (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID,
  code_key    TEXT NOT NULL,
  label       TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('si','hi','self_harm','safety_plan','protective','level','other')),
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

-- Seed common risk responses
INSERT INTO risk_response_library (code_key, label, category, sort_order) VALUES
  ('no_si',           'No SI reported',                        'si', 1),
  ('passive_si',      'Passive SI without plan or intent',     'si', 2),
  ('active_si_plan',  'Active SI with plan',                   'si', 3),
  ('active_si_intent','Active SI with intent',                 'si', 4),
  ('no_hi',           'No HI reported',                        'hi', 1),
  ('active_hi',       'Active HI present',                     'hi', 2),
  ('no_sh',           'No self-harm concerns',                 'self_harm', 1),
  ('sh_urges',        'Self-harm urges present',               'self_harm', 2),
  ('sh_current',      'Current self-harm behavior',            'self_harm', 3),
  ('safety_reviewed', 'Safety plan reviewed with client',      'safety_plan', 1),
  ('safety_updated',  'Safety plan updated',                   'safety_plan', 2),
  ('safety_new',      'New safety plan created',               'safety_plan', 3),
  ('protective_present','Protective factors present',          'protective', 1),
  ('low_risk',        'Low risk level',                        'level', 1),
  ('moderate_risk',   'Moderate risk level',                   'level', 2),
  ('high_risk',       'High risk level – see plan',            'level', 3);

-- ─────────────────────────────────────────────
-- MSE LIBRARY
-- ─────────────────────────────────────────────

CREATE TABLE mse_library (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID,
  domain      TEXT NOT NULL CHECK (domain IN (
    'appearance','mood','affect','orientation','thought_process',
    'insight','judgment','speech','memory','attention','other'
  )),
  code_key    TEXT NOT NULL,
  label       TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_normal   BOOLEAN NOT NULL DEFAULT false  -- flag for "within normal limits" options
);

-- Seed common MSE options
INSERT INTO mse_library (domain, code_key, label, sort_order, is_normal) VALUES
  -- Appearance
  ('appearance','app_wnl',         'Well-groomed, appropriate dress',      1, true),
  ('appearance','app_casual',      'Casually dressed, adequate hygiene',   2, true),
  ('appearance','app_disheveled',  'Disheveled appearance',                3, false),
  ('appearance','app_poor_hygiene','Poor hygiene noted',                   4, false),
  -- Mood
  ('mood','mood_euthymic',    'Euthymic',                1, true),
  ('mood','mood_depressed',   'Depressed',               2, false),
  ('mood','mood_anxious',     'Anxious',                 3, false),
  ('mood','mood_irritable',   'Irritable',               4, false),
  ('mood','mood_elevated',    'Elevated/expansive',      5, false),
  ('mood','mood_dysphoric',   'Dysphoric',               6, false),
  -- Affect
  ('affect','aff_full',       'Full range',              1, true),
  ('affect','aff_constricted','Constricted',             2, false),
  ('affect','aff_flat',       'Flat',                    3, false),
  ('affect','aff_blunted',    'Blunted',                 4, false),
  ('affect','aff_labile',     'Labile',                  5, false),
  ('affect','aff_congruent',  'Mood congruent',          6, true),
  -- Orientation
  ('orientation','ori_x4',      'Oriented x4 (person, place, time, situation)', 1, true),
  ('orientation','ori_x3',      'Oriented x3',              2, false),
  ('orientation','ori_impaired','Orientation impaired',     3, false),
  -- Thought process
  ('thought_process','tp_logical',    'Logical and linear',     1, true),
  ('thought_process','tp_tangential', 'Tangential',             2, false),
  ('thought_process','tp_circumstantial','Circumstantial',      3, false),
  ('thought_process','tp_loose',      'Loose associations',     4, false),
  ('thought_process','tp_racing',     'Racing thoughts',        5, false),
  ('thought_process','tp_perseverating','Perseveration noted',  6, false),
  -- Insight
  ('insight','ins_good',   'Good insight',    1, true),
  ('insight','ins_fair',   'Fair insight',    2, false),
  ('insight','ins_limited','Limited insight', 3, false),
  ('insight','ins_poor',   'Poor insight',    4, false),
  -- Judgment
  ('judgment','jud_intact', 'Judgment intact', 1, true),
  ('judgment','jud_fair',   'Fair judgment',   2, false),
  ('judgment','jud_impaired','Impaired judgment',3, false),
  -- Speech
  ('speech','sp_wnl',       'Normal rate, rhythm, volume',  1, true),
  ('speech','sp_pressured', 'Pressured speech',             2, false),
  ('speech','sp_slowed',    'Slowed/reduced speech',        3, false),
  ('speech','sp_loud',      'Loud/elevated volume',         4, false),
  ('speech','sp_quiet',     'Quiet/soft speech',            5, false),
  -- Memory
  ('memory','mem_intact',  'Memory intact',              1, true),
  ('memory','mem_short',   'Short-term memory impaired', 2, false),
  ('memory','mem_long',    'Long-term memory impaired',  3, false),
  -- Attention
  ('attention','att_intact',   'Attention and concentration intact', 1, true),
  ('attention','att_distractible','Easily distracted',               2, false),
  ('attention','att_impaired', 'Attention significantly impaired',   3, false);

-- ─────────────────────────────────────────────
-- TREATMENT GOALS LIBRARY
-- ─────────────────────────────────────────────

CREATE TABLE treatment_goal_library (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID,
  theme           TEXT NOT NULL,
  problem_area    TEXT NOT NULL,
  goal_text       TEXT NOT NULL,
  objective_text  TEXT NOT NULL,
  intervention_text TEXT NOT NULL,
  frequency_rec   TEXT,
  icd10_codes     TEXT[],
  billing_codes   TEXT[],
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- DIAGNOSIS HISTORY
-- ─────────────────────────────────────────────

CREATE TABLE patient_diagnosis_history (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id     UUID NOT NULL,
  clinician_id   UUID NOT NULL,
  encounter_id   UUID,
  icd10_code     TEXT NOT NULL,
  icd10_label    TEXT NOT NULL,
  diagnosis_type TEXT NOT NULL DEFAULT 'primary' CHECK (diagnosis_type IN ('primary','secondary','rule_out','historical')),
  onset_date     DATE,
  resolved_date  DATE,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagnosis_patient ON patient_diagnosis_history(patient_id);
CREATE INDEX idx_diagnosis_active ON patient_diagnosis_history(patient_id, is_active);

-- ─────────────────────────────────────────────
-- CODING SESSIONS
-- ─────────────────────────────────────────────

CREATE TABLE coding_sessions (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id         UUID NOT NULL,
  patient_id           UUID NOT NULL,
  clinician_id         UUID NOT NULL,
  org_id               UUID NOT NULL,
  dos                  DATE NOT NULL,
  session_minutes      INT,
  session_start        TIME,
  session_end          TIME,
  parser_version       TEXT DEFAULT '1.0',
  raw_note_snapshot    TEXT,              -- snapshot of note text at time of coding
  matched_signals      JSONB,            -- output of signal parser
  suggested_codes      JSONB,            -- array of suggested codes
  applied_codes        TEXT[],           -- clinician-confirmed codes
  missing_elements     JSONB,
  conflicts            JSONB,
  addendum_suggestions JSONB,
  confidence_scores    JSONB,
  longitudinal_alerts  JSONB,
  coding_status        TEXT NOT NULL DEFAULT 'draft' CHECK (coding_status IN ('draft','reviewed','finalized','submitted')),
  reviewed_by          UUID,
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coding_sessions_encounter ON coding_sessions(encounter_id);
CREATE INDEX idx_coding_sessions_patient ON coding_sessions(patient_id);
CREATE INDEX idx_coding_sessions_clinician ON coding_sessions(clinician_id);
CREATE INDEX idx_coding_sessions_dos ON coding_sessions(dos);

-- ─────────────────────────────────────────────
-- COMMAND 2: RELATIONSHIPS
-- ─────────────────────────────────────────────

-- Notes (progress notes / encounters)
CREATE TABLE clinical_notes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            UUID NOT NULL,
  patient_id        UUID NOT NULL,
  clinician_id      UUID NOT NULL,
  appointment_id    UUID,
  template_id       UUID REFERENCES note_templates(id) ON DELETE SET NULL,
  coding_session_id UUID REFERENCES coding_sessions(id) ON DELETE SET NULL,

  -- Visit metadata
  dos               DATE NOT NULL,
  session_start     TIME,
  session_end       TIME,
  session_minutes   INT,
  modality          session_modality NOT NULL DEFAULT 'individual',
  complexity        note_complexity NOT NULL DEFAULT 'routine_followup',
  pos_code          TEXT,            -- place of service code
  service_path      TEXT NOT NULL DEFAULT 'mh' CHECK (service_path IN ('mh','sud','integrated')),

  -- Content sections (JSONB for flexibility)
  subjective        TEXT,
  objective         TEXT,
  assessment        TEXT,
  plan              TEXT,
  full_note_text    TEXT,            -- rendered full note
  note_data         JSONB,           -- raw structured data from UI form

  -- Diagnoses
  primary_diagnosis_code  TEXT,
  primary_diagnosis_label TEXT,
  diagnosis_list    JSONB,           -- array of {code, label, type}

  -- Status
  status            note_status NOT NULL DEFAULT 'draft',
  signed_at         TIMESTAMPTZ,
  signed_by         UUID,
  cosigned_at       TIMESTAMPTZ,
  cosigned_by       UUID,
  locked            BOOLEAN NOT NULL DEFAULT false,

  -- Carry-forward metadata
  carried_from_note_id UUID REFERENCES clinical_notes(id) ON DELETE SET NULL,
  carry_forward_fields TEXT[],      -- which fields were carried forward

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_patient ON clinical_notes(patient_id);
CREATE INDEX idx_notes_clinician ON clinical_notes(clinician_id);
CREATE INDEX idx_notes_dos ON clinical_notes(dos);
CREATE INDEX idx_notes_status ON clinical_notes(status);
CREATE INDEX idx_notes_appointment ON clinical_notes(appointment_id);

-- Treatment plans linked to patients (active plan per patient)
CREATE TABLE treatment_plans (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              UUID NOT NULL,
  patient_id          UUID NOT NULL,
  clinician_id        UUID NOT NULL,
  version             INT NOT NULL DEFAULT 1,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  effective_date      DATE NOT NULL,
  next_review_date    DATE,
  last_reviewed_at    DATE,
  last_reviewed_by    UUID,
  problem_list        JSONB,         -- array of {code, description}
  goals               JSONB,         -- array of goal objects
  objectives          JSONB,
  interventions_plan  JSONB,
  frequency           TEXT,          -- e.g. 'weekly'
  discharge_criteria  TEXT,
  client_signature    BOOLEAN NOT NULL DEFAULT false,
  client_signed_at    TIMESTAMPTZ,
  clinician_signature BOOLEAN NOT NULL DEFAULT false,
  clinician_signed_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_treatment_plans_patient ON treatment_plans(patient_id, is_active);

-- Link notes to treatment plans (which plan was active at time of note)
CREATE TABLE note_treatment_plan_links (
  note_id     UUID NOT NULL REFERENCES clinical_notes(id) ON DELETE CASCADE,
  plan_id     UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, plan_id)
);

-- ─────────────────────────────────────────────
-- COMMAND 3: LAST SESSION STATE (SMART DEFAULTS)
-- ─────────────────────────────────────────────

-- Stores the last-known clinical state for each patient/clinician pair
-- Updated whenever a note is signed
CREATE TABLE patient_last_session_state (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id            UUID NOT NULL,
  clinician_id          UUID NOT NULL,
  org_id                UUID NOT NULL,
  last_note_id          UUID REFERENCES clinical_notes(id) ON DELETE SET NULL,
  last_note_date        DATE,
  last_signed_note_text TEXT,

  -- Last diagnosis snapshot
  last_diagnosis_list   JSONB,       -- [{code, label, type}]
  last_primary_dx_code  TEXT,
  last_primary_dx_label TEXT,

  -- Last treatment goals
  last_treatment_goals  JSONB,       -- [{goal_text, objective_text, progress}]
  last_plan_id          UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
  last_plan_review_date DATE,
  last_plan_next_review DATE,

  -- Last MSE
  last_mse              JSONB,       -- {appearance, mood, affect, orientation, ...}

  -- Last risk assessment
  last_risk_level       TEXT,
  last_risk_si          TEXT,
  last_risk_hi          TEXT,
  last_risk_self_harm   TEXT,
  last_safety_plan_updated BOOLEAN DEFAULT false,
  last_risk_notes       TEXT,

  -- Last interventions
  last_interventions    TEXT[],

  -- Last progress summary
  last_progress_summary TEXT,
  last_subjective       TEXT,
  last_objective        TEXT,
  last_assessment       TEXT,
  last_plan_section     TEXT,

  -- Last billing applied
  last_applied_codes    TEXT[],
  last_session_minutes  INT,
  last_modality         session_modality,
  last_pos_code         TEXT,

  -- Service metadata
  last_insurance_payer  TEXT,
  last_service_location TEXT,

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (patient_id, clinician_id)
);

CREATE INDEX idx_last_session_patient ON patient_last_session_state(patient_id);

-- ─────────────────────────────────────────────
-- NOTE SETTINGS (Command 5)
-- ─────────────────────────────────────────────

CREATE TYPE smart_default_mode AS ENUM (
  'always',
  'returning_patients_only',
  'never'
);

CREATE TABLE clinician_note_settings (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinician_id          UUID NOT NULL UNIQUE,
  org_id                UUID NOT NULL,
  smart_default_mode    smart_default_mode NOT NULL DEFAULT 'returning_patients_only',
  default_modality      session_modality DEFAULT 'individual',
  default_complexity    note_complexity DEFAULT 'routine_followup',
  default_service_path  TEXT DEFAULT 'mh',
  default_pos_code      TEXT,
  preferred_interventions TEXT[],
  show_coding_panel     BOOLEAN NOT NULL DEFAULT true,
  show_treatment_plan_panel BOOLEAN NOT NULL DEFAULT true,
  auto_carry_forward    BOOLEAN NOT NULL DEFAULT true,
  carry_forward_fields  TEXT[] DEFAULT ARRAY[
    'diagnoses','treatment_goals','mse','risk_assessment','interventions','progress_summary'
  ],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TRIGGERS: Keep last session state up to date
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_last_session_state()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when note status becomes 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN
    INSERT INTO patient_last_session_state (
      patient_id,
      clinician_id,
      org_id,
      last_note_id,
      last_note_date,
      last_signed_note_text,
      last_diagnosis_list,
      last_primary_dx_code,
      last_primary_dx_label,
      last_interventions,
      last_session_minutes,
      last_modality,
      last_pos_code,
      last_subjective,
      last_objective,
      last_assessment,
      last_plan_section,
      updated_at
    )
    VALUES (
      NEW.patient_id,
      NEW.clinician_id,
      NEW.org_id,
      NEW.id,
      NEW.dos,
      NEW.full_note_text,
      NEW.diagnosis_list,
      NEW.primary_diagnosis_code,
      NEW.primary_diagnosis_label,
      (SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.note_data->'interventions'))),
      NEW.session_minutes,
      NEW.modality,
      NEW.pos_code,
      NEW.subjective,
      NEW.objective,
      NEW.assessment,
      NEW.plan,
      now()
    )
    ON CONFLICT (patient_id, clinician_id) DO UPDATE SET
      last_note_id          = EXCLUDED.last_note_id,
      last_note_date        = EXCLUDED.last_note_date,
      last_signed_note_text = EXCLUDED.last_signed_note_text,
      last_diagnosis_list   = EXCLUDED.last_diagnosis_list,
      last_primary_dx_code  = EXCLUDED.last_primary_dx_code,
      last_primary_dx_label = EXCLUDED.last_primary_dx_label,
      last_interventions    = EXCLUDED.last_interventions,
      last_session_minutes  = EXCLUDED.last_session_minutes,
      last_modality         = EXCLUDED.last_modality,
      last_pos_code         = EXCLUDED.last_pos_code,
      last_subjective       = EXCLUDED.last_subjective,
      last_objective        = EXCLUDED.last_objective,
      last_assessment       = EXCLUDED.last_assessment,
      last_plan_section     = EXCLUDED.last_plan_section,
      updated_at            = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_last_session_state
AFTER UPDATE ON clinical_notes
FOR EACH ROW EXECUTE FUNCTION update_last_session_state();

-- ─────────────────────────────────────────────
-- UPDATED_AT TRIGGERS
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at_clinical_notes
BEFORE UPDATE ON clinical_notes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_treatment_plans
BEFORE UPDATE ON treatment_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_coding_sessions
BEFORE UPDATE ON coding_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_reusable_phrases
BEFORE UPDATE ON reusable_phrases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
