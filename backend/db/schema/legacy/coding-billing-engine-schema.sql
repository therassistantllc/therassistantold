-- ============================================================
-- THERASSISTANT Coding & Billing Engine — Full Database Schema
-- Version 1.1  |  Colorado Medicaid Behavioral Health
-- Supabase / PostgreSQL
-- ============================================================
--
-- Prerequisites:
--   admin-clients-schema.sql   → clinician_accounts, patient_records
--   auth-schema.sql            → auth.users
--   clinical-documentation-schema.sql → progress_notes, assessments
--
-- TABLES
--   1.  coding_sessions           Coding workflow session per encounter
--   2.  coding_questions          Question bank for the coding workflow
--   3.  coding_answers            Clinician answers per session
--   4.  coding_recommendations    Engine-generated code recommendations
--   5.  claims                    Master CMS-1500 claim record
--   6.  claim_line_items          Per-service-line billing detail
--   7.  claim_status_history      Full status change audit trail
--   8.  eras                      Electronic Remittance Advice headers
--   9.  era_line_items            Per-service-line ERA payment detail
--  10.  payments                  Insurance / patient payment records
--  11.  payment_postings          Granular payment-to-claim-line postings
--  12.  patient_balances          Open patient-responsibility balances
--  13.  statements                Patient billing statements
--  14.  refunds                   Overpayment / patient refund log
--  15.  writeoffs                 Contractual and bad-debt writeoffs
--  16.  denials                   Payer denial records
--  17.  appeals                   Formal appeal filings
--  18.  prior_authorizations      Prior auth requests and statuses
--  19.  referrals                 Provider referral tracking
--  20.  workqueue_items           CARC/RARC + aging work queues
--  21.  smart_phrases             Smart phrase template library
--  22.  eligibility_checks        Service type 98 eligibility only
--  23.  office_ally_transactions  Office Ally clearinghouse log
--  24.  coding_reports            Finalized coding report per session
--  25.  coding_comments           Threaded comments on sessions/reports
--
-- VIEWS
--   v_aging_summary               Patient AR aging buckets by client
--   v_carc_frequency              CARC code frequency across denials
--   v_denial_work_queue           Open denial queue with CARC/RARC
--   v_auth_expiring               Prior auths expiring within 30 days
--
-- CONVENTIONS
--   All PKs: UUID DEFAULT gen_random_uuid()
--   All timestamps: TIMESTAMPTZ DEFAULT now()
--   RLS enabled on every table
--   Roles: clinician | billing_staff | admin | super_admin
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- HELPER: updated_at auto-refresh trigger
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION attach_updated_at(t regclass)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %s
     FOR EACH ROW EXECUTE PROCEDURE set_updated_at()', t);
END; $$;


-- ══════════════════════════════════════════════════════════════
-- TABLE 1: coding_sessions
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   One row per clinician-initiated coding encounter. Captures
--   the full lifecycle from workflow selection through final
--   confirmed billing code. Ties directly to a progress note,
--   assessment, or group note.
--
-- Key Fields:
--   workflow_path     Which code family the engine evaluated:
--                     H0031 | H0001 | integrated | psychotherapy
--                     | SUD | group | family | assessment
--   status            draft → complete → submitted → voided
--   final_code        Confirmed CPT/HCPCS code after clinician review
--   final_modifier    Accepted modifier (HO, HN, GT, U2, etc.)
--   final_units       Units billed
--   final_diagnosis_codes  ICD-10 codes on the submitted claim
--   smart_phrase_tags Free-text smart phrase tokens applied to session
--
-- Foreign Keys:
--   patient_id  → patient_records(id)
--   client_id   → clinician_accounts(id)
--   clinician_id → auth.users(id)
--   note_id     → progress_notes(id)  (nullable — may code before note locked)
--   claim_id    → claims(id)           (set when claim is generated)
--
-- Relationships:
--   1-to-many → coding_answers
--   1-to-many → coding_recommendations
--   1-to-1    → claims (once submitted)
--
-- Recommended Indexes:
--   (patient_id, session_date DESC)   — patient history view
--   (client_id, session_date DESC)    — clinician dashboard
--   (status)                          — work queue filters
--   (workflow_path)                   — analytics by code family
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coding_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  patient_id            TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,
  clinician_id          UUID NOT NULL REFERENCES auth.users(id),
  note_id               UUID,       -- FK to progress_notes(id) — set post-note creation
  assessment_id         UUID,       -- FK to assessments(id) — for H0031 sessions
  claim_id              UUID,       -- FK to claims(id) — set when claim generated (circular; set after)

  -- Session context
  session_date          DATE NOT NULL,
  service_code_source   TEXT,       -- SimplePractice, Manual, Imported
  workflow_path         TEXT NOT NULL
                          CHECK (workflow_path IN (
                            'H0031','H0001','integrated','psychotherapy',
                            'SUD','group','family','assessment'
                          )),
  telehealth            BOOLEAN DEFAULT FALSE,
  place_of_service      TEXT DEFAULT '11',   -- 11=Office, 02=Telehealth

  -- Results
  final_code            TEXT,
  final_modifier        TEXT,
  final_units           INTEGER DEFAULT 1,
  final_diagnosis_codes TEXT[],
  prior_auth_required   BOOLEAN DEFAULT FALSE,
  prior_auth_number     TEXT,

  -- Workflow state
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','complete','submitted','voided')),
  completed_at          TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  voided_at             TIMESTAMPTZ,
  voided_reason         TEXT,

  -- Smart phrase / commenting
  smart_phrase_tags     TEXT[],     -- e.g. ['.h0031-telehealth', '.auth-attach']
  session_notes         TEXT,       -- free-form internal note on session

  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cs_patient       ON coding_sessions(patient_id, session_date DESC);
CREATE INDEX idx_cs_client        ON coding_sessions(client_id, session_date DESC);
CREATE INDEX idx_cs_clinician     ON coding_sessions(clinician_id);
CREATE INDEX idx_cs_status        ON coding_sessions(status);
CREATE INDEX idx_cs_workflow      ON coding_sessions(workflow_path);
CREATE INDEX idx_cs_date          ON coding_sessions(session_date DESC);

SELECT attach_updated_at('coding_sessions');
ALTER TABLE coding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_clinician_own" ON coding_sessions
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE coding_sessions IS
  'One row per coding encounter. Drives the adaptive question workflow '
  'and stores the confirmed billing code before claim generation.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 2: coding_questions
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Stores the question bank used by the coding engine. Questions
--   are keyed by workflow_path and question_key. The trigger_condition
--   JSONB field encodes the conditional display logic so the engine
--   can evaluate which questions are relevant for each session
--   without hard-coded branching.
--
-- Key Fields:
--   workflow_path     Which workflow this question belongs to
--   question_key      Unique identifier within workflow (e.g. "has_sud_flags")
--   question_type     boolean | select | multi_select | text | numeric | date
--   options           For select/multi_select: [{value, label}]
--   trigger_condition JSONB rule: {field, operator, value} or nested AND/OR
--   section           Logical section heading for UI grouping
--   display_order     Sort order within section
--   is_active         Soft-disable without deletion
--
-- Relationships:
--   1-to-many → coding_answers
--
-- Recommended Indexes:
--   (workflow_path, display_order)  — question loading order
--   (question_key)                  — answer join
--   (is_active)                     — active-only query
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coding_questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_path     TEXT NOT NULL,
  question_key      TEXT NOT NULL,
  UNIQUE (workflow_path, question_key),

  -- Content
  question_text     TEXT NOT NULL,
  help_text         TEXT,
  section           TEXT,
  display_order     INTEGER NOT NULL DEFAULT 0,

  -- Type + options
  question_type     TEXT NOT NULL DEFAULT 'boolean'
                      CHECK (question_type IN (
                        'boolean','select','multi_select','text','numeric','date'
                      )),
  options           JSONB,    -- [{value: TEXT, label: TEXT, score?: INTEGER}]

  -- Conditional display
  trigger_condition JSONB,    -- null = always shown; else evaluated by engine
  required          BOOLEAN DEFAULT TRUE,

  -- Scoring (for H0031 / H0001 threshold models)
  score_weight      NUMERIC(5,2) DEFAULT 0,

  -- Lifecycle
  is_active         BOOLEAN DEFAULT TRUE,
  version           INTEGER DEFAULT 1,
  deprecated_at     TIMESTAMPTZ,

  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cq_workflow_order ON coding_questions(workflow_path, display_order);
CREATE INDEX idx_cq_key            ON coding_questions(question_key);
CREATE INDEX idx_cq_active         ON coding_questions(is_active);

SELECT attach_updated_at('coding_questions');
ALTER TABLE coding_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cq_read_clinician" ON coding_questions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cq_write_admin" ON coding_questions
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','super_admin'));

COMMENT ON TABLE coding_questions IS
  'Question bank for the adaptive coding workflow. trigger_condition '
  'encodes branch logic; evaluated by the coder-engine at runtime.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 3: coding_answers
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Records clinician answers to coding_questions for a specific
--   coding_session. One row per question per session. For
--   multi_select questions the answer_values array captures all
--   selected options; answer_value stores the serialized form.
--
-- Key Fields:
--   session_id      Parent coding session
--   question_id     Question being answered
--   question_key    Denormalized for fast engine evaluation without join
--   answer_value    Scalar answer (TEXT; cast by engine as needed)
--   answer_values   Array answer for multi_select
--   numeric_value   Pre-cast numeric for threshold scoring
--   score_contribution  Points contributed to code-selection score
--   answered_at     When the answer was recorded
--
-- Foreign Keys:
--   session_id  → coding_sessions(id)
--   question_id → coding_questions(id)
--
-- Relationships:
--   many-to-1 → coding_sessions
--   many-to-1 → coding_questions
--
-- Recommended Indexes:
--   (session_id)                — load all answers for a session
--   (session_id, question_key)  — answer lookup by key
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coding_answers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES coding_sessions(id) ON DELETE CASCADE,
  question_id          UUID NOT NULL REFERENCES coding_questions(id),
  question_key         TEXT NOT NULL,
  UNIQUE (session_id, question_id),

  -- Answer data
  answer_value         TEXT,
  answer_values        TEXT[],       -- multi_select
  numeric_value        NUMERIC,      -- pre-cast for threshold logic
  score_contribution   NUMERIC(5,2) DEFAULT 0,

  -- Audit
  answered_at          TIMESTAMPTZ DEFAULT now(),
  answered_by          UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ca_session      ON coding_answers(session_id);
CREATE INDEX idx_ca_session_key  ON coding_answers(session_id, question_key);
CREATE INDEX idx_ca_question     ON coding_answers(question_id);

ALTER TABLE coding_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_session_owner" ON coding_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coding_sessions cs
      WHERE cs.id = session_id
        AND (cs.clinician_id = auth.uid()
             OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
    )
  );

COMMENT ON TABLE coding_answers IS
  'Clinician answers to coding questions within a session. '
  'question_key is denormalized for engine evaluation without joins.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 4: coding_recommendations
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Engine-generated code recommendations produced at the end of
--   each coding session. Multiple recommendations may be generated
--   (primary + alternatives ranked by confidence). Tracks whether
--   the clinician accepted, overrode, or rejected the suggestion.
--
-- Key Fields:
--   recommended_code      CPT/HCPCS code the engine selected
--   recommended_modifier  Modifier the engine selected (HO, GT, etc.)
--   confidence            high | moderate | low
--   reasoning             Plain-English rationale shown to clinician
--   trigger_rules         JSONB snapshot of which rules fired
--   is_accepted           True when clinician confirms this recommendation
--   override_code         Code actually selected if clinician overrode
--   override_reason       Why the clinician did not accept
--   rank                  1 = primary recommendation; 2,3 = alternatives
--
-- Foreign Keys:
--   session_id → coding_sessions(id)
--
-- Relationships:
--   many-to-1 → coding_sessions
--
-- Recommended Indexes:
--   (session_id, rank)    — primary recommendation retrieval
--   (recommended_code)    — analytics by code
--   (is_accepted)         — acceptance rate reporting
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coding_recommendations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES coding_sessions(id) ON DELETE CASCADE,

  -- Recommendation
  rank                  INTEGER NOT NULL DEFAULT 1,
  recommended_code      TEXT NOT NULL,
  recommended_modifier  TEXT,
  recommended_units     INTEGER DEFAULT 1,
  confidence            TEXT NOT NULL DEFAULT 'high'
                          CHECK (confidence IN ('high','moderate','low')),
  reasoning             TEXT,
  trigger_rules         JSONB,   -- snapshot: [{rule_id, rule_name, matched: true/false}]

  -- Clinician decision
  is_accepted           BOOLEAN,
  override_code         TEXT,
  override_modifier     TEXT,
  override_reason       TEXT,
  decided_at            TIMESTAMPTZ,
  decided_by            UUID REFERENCES auth.users(id),

  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cr_session_rank ON coding_recommendations(session_id, rank);
CREATE INDEX idx_cr_code         ON coding_recommendations(recommended_code);
CREATE INDEX idx_cr_accepted     ON coding_recommendations(is_accepted);

ALTER TABLE coding_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cr_session_owner" ON coding_recommendations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coding_sessions cs
      WHERE cs.id = session_id
        AND (cs.clinician_id = auth.uid()
             OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
    )
  );

COMMENT ON TABLE coding_recommendations IS
  'Engine-generated billing code recommendations per coding session. '
  'Multiple ranks allow primary + alternative suggestions. '
  'Override fields capture clinician deviation for audit and model improvement.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 5: claims
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Master CMS-1500 claim record. One row per claim submission,
--   covering the full lifecycle from generation through payment.
--   Supports corrected claims (original_claim_id self-reference),
--   crossover claims, defer dates for work queue management, and
--   Office Ally clearinghouse tracking fields.
--
-- Key Fields:
--   claim_number          Display ID: CLM-YYYY-#### (unique per client)
--   billed_amount         Total billed across all line items
--   allowed_amount        Payer allowed (populated after ERA)
--   paid_amount           Total paid by payer
--   patient_responsibility  Patient portion per ERA/EOB
--   status                Draft → Ready → Submitted → Accepted →
--                         Paid | Denied | Partial | Voided |
--                         Resubmitted | Appealed | Written Off
--   submission_method     Office Ally | Manual | API | Paper
--   clearinghouse_claim_id  Office Ally transaction reference
--   payer_claim_id        Payer ICN/DCN
--   defer_until           Do-not-work-before date for work queues
--   is_corrected          True when this replaces original_claim_id
--
-- Foreign Keys:
--   patient_id          → patient_records(id)
--   client_id           → clinician_accounts(id)
--   clinician_id        → auth.users(id)
--   coding_session_id   → coding_sessions(id)
--   note_id             → progress_notes(id)
--   prior_auth_id       → prior_authorizations(id)
--   referral_id         → referrals(id)
--   original_claim_id   → claims(id)  [self-reference for corrected claims]
--
-- Relationships:
--   1-to-many → claim_line_items
--   1-to-many → claim_status_history
--   1-to-many → denials
--   1-to-many → payment_postings
--   1-to-many → writeoffs
--   1-to-many → workqueue_items
--
-- Recommended Indexes:
--   (patient_id, dos DESC)            — patient AR history
--   (client_id, status)               — clinician claim queue
--   (status, dos)                     — aging / work queue
--   (payer_primary, status)           — payer-level reporting
--   (clearinghouse_claim_id)          — Office Ally match
--   (payer_claim_id)                  — ERA match
--   (defer_until) WHERE defer_until IS NOT NULL  — deferred queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claims (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number            TEXT NOT NULL,
  UNIQUE (client_id, claim_number),

  -- Linkage
  patient_id              TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id               TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,
  clinician_id            UUID REFERENCES auth.users(id),
  coding_session_id       UUID REFERENCES coding_sessions(id),
  note_id                 UUID,       -- soft FK → progress_notes(id)
  prior_auth_id           UUID,       -- soft FK → prior_authorizations(id)
  referral_id             UUID,       -- soft FK → referrals(id)
  original_claim_id       UUID REFERENCES claims(id),   -- corrected claim chain

  -- Dates of service
  dos                     DATE NOT NULL,
  dos_to                  DATE,
  statement_from          DATE,
  statement_through       DATE,

  -- Provider
  rendering_npi           TEXT,
  rendering_name          TEXT,
  billing_npi             TEXT,
  billing_name            TEXT,
  supervising_npi         TEXT,
  supervising_name        TEXT,

  -- Facility
  place_of_service        TEXT DEFAULT '11',  -- 11 Office, 02 Telehealth
  facility_name           TEXT,
  facility_npi            TEXT,

  -- Payer
  payer_primary           TEXT NOT NULL,
  payer_primary_id        TEXT,
  payer_secondary         TEXT,
  payer_secondary_id      TEXT,
  member_id               TEXT,
  group_number            TEXT,
  prior_auth_number       TEXT,

  -- Diagnosis
  primary_diagnosis       TEXT,                     -- ICD-10 principal code
  diagnosis_codes         TEXT[] DEFAULT '{}',      -- all ICD-10 codes (up to 12)

  -- Financials
  billed_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowed_amount          NUMERIC(12,2),
  paid_amount             NUMERIC(12,2) DEFAULT 0,
  patient_responsibility  NUMERIC(12,2) DEFAULT 0,
  adjustment_amount       NUMERIC(12,2) DEFAULT 0,
  balance_due             NUMERIC(12,2),

  -- Status
  status                  TEXT NOT NULL DEFAULT 'Draft'
                            CHECK (status IN (
                              'Draft','Ready','Submitted','Accepted','In Review',
                              'Paid','Denied','Partial','Voided','Resubmitted',
                              'Appealed','Written Off','Rejected'
                            )),

  -- Submission / clearinghouse
  submission_method       TEXT DEFAULT 'Office Ally'
                            CHECK (submission_method IN (
                              'Office Ally','Manual','API','Paper','Other'
                            )),
  clearinghouse           TEXT DEFAULT 'Office Ally',
  clearinghouse_claim_id  TEXT,    -- Office Ally batch/transaction ID
  clearinghouse_status    TEXT,    -- Accepted, Rejected, Pending
  clearinghouse_message   TEXT,
  payer_claim_id          TEXT,    -- ICN / DCN from ERA or phone
  payer_message           TEXT,

  -- Key dates
  submitted_at            TIMESTAMPTZ,
  accepted_at             TIMESTAMPTZ,
  paid_at                 TIMESTAMPTZ,
  denied_at               TIMESTAMPTZ,
  voided_at               TIMESTAMPTZ,

  -- Work queue controls
  defer_until             DATE,
  defer_reason            TEXT,
  smart_phrase_comment    TEXT,    -- applied Smart Phrase template text
  billing_notes           TEXT,

  -- Flags
  is_crossover            BOOLEAN DEFAULT FALSE,
  is_corrected            BOOLEAN DEFAULT FALSE,
  is_reopened             BOOLEAN DEFAULT FALSE,
  requires_attachment     BOOLEAN DEFAULT FALSE,

  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_claims_patient_dos   ON claims(patient_id, dos DESC);
CREATE INDEX idx_claims_client_status ON claims(client_id, status);
CREATE INDEX idx_claims_status_dos    ON claims(status, dos);
CREATE INDEX idx_claims_payer         ON claims(payer_primary, status);
CREATE INDEX idx_claims_oa_id         ON claims(clearinghouse_claim_id);
CREATE INDEX idx_claims_payer_claim   ON claims(payer_claim_id);
CREATE INDEX idx_claims_defer         ON claims(defer_until) WHERE defer_until IS NOT NULL;
CREATE INDEX idx_claims_clinician     ON claims(clinician_id);
CREATE INDEX idx_claims_auth          ON claims(prior_auth_id);

SELECT attach_updated_at('claims');
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claims_clinician_own" ON claims
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE claims IS
  'Master CMS-1500 claim record. Covers full lifecycle from draft through '
  'payment/writeoff. original_claim_id chains corrected claims. '
  'defer_until supports work queue scheduling.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 6: claim_line_items
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Individual service line detail for a claim (CMS-1500 Box 24).
--   Each line represents one CPT/HCPCS service with its own
--   financial values. Stores CARC/RARC codes when populated from
--   an ERA so denial analysis can be performed at line level.
--
-- Key Fields:
--   line_number       1-based sequence within claim
--   service_code      CPT or HCPCS code
--   modifiers         Up to 4 modifiers as array
--   units             Units of service
--   billed_amount     Charge for this line
--   paid_amount       Payer payment for this line (from ERA)
--   carc_codes        CARC codes from ERA adjustment
--   rarc_codes        RARC remark codes from ERA
--   denial_reason     Human-readable interpretation
--   line_status       Open | Paid | Denied | Adjusted | Voided
--
-- Foreign Keys:
--   claim_id → claims(id)
--
-- Relationships:
--   many-to-1 → claims
--   1-to-many → payment_postings
--   1-to-many → writeoffs
--   1-to-many → denials (when denial is at line level)
--
-- Recommended Indexes:
--   (claim_id, line_number)    — line retrieval
--   (service_code)             — code-level analytics
--   (carc_codes)               — CARC work queue (GIN)
--   (line_status)              — open line tracking
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claim_line_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  line_number             INTEGER NOT NULL DEFAULT 1,

  -- Service
  service_code            TEXT NOT NULL,
  modifiers               TEXT[] DEFAULT '{}',  -- up to 4
  description             TEXT,
  units                   INTEGER NOT NULL DEFAULT 1,
  dos                     DATE,
  dos_to                  DATE,
  place_of_service        TEXT,
  revenue_code            TEXT,                 -- UB-04 / facility billing
  ndc_code                TEXT,                 -- drug claims

  -- Diagnosis pointers (maps to claim.diagnosis_codes[])
  diagnosis_pointer       TEXT[],               -- ['A','B'] → 1st and 2nd dx codes

  -- Provider
  rendering_npi           TEXT,
  rendering_name          TEXT,

  -- Financials (charge-level)
  billed_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowed_amount          NUMERIC(12,2),
  paid_amount             NUMERIC(12,2) DEFAULT 0,
  adjustment_amount       NUMERIC(12,2) DEFAULT 0,
  patient_responsibility  NUMERIC(12,2) DEFAULT 0,
  contractual_adjustment  NUMERIC(12,2) DEFAULT 0,  -- CO-45 amount

  -- ERA / denial detail
  carc_codes              TEXT[] DEFAULT '{}',
  rarc_codes              TEXT[] DEFAULT '{}',
  denial_reason           TEXT,
  pr_code                 TEXT,   -- Patient Responsibility CARC (PR-xx)

  -- Status
  line_status             TEXT NOT NULL DEFAULT 'Open'
                            CHECK (line_status IN (
                              'Open','Paid','Partially Paid','Denied',
                              'Adjusted','Voided','Appealed'
                            )),

  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cli_claim_line   ON claim_line_items(claim_id, line_number);
CREATE INDEX idx_cli_code         ON claim_line_items(service_code);
CREATE INDEX idx_cli_status       ON claim_line_items(line_status);
CREATE INDEX idx_cli_carc         ON claim_line_items USING gin(carc_codes);
CREATE INDEX idx_cli_rarc         ON claim_line_items USING gin(rarc_codes);
CREATE INDEX idx_cli_dos          ON claim_line_items(dos);

SELECT attach_updated_at('claim_line_items');
ALTER TABLE claim_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cli_billing_staff" ON claim_line_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims c WHERE c.id = claim_id
        AND (c.clinician_id = auth.uid()
             OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
    )
  );

COMMENT ON TABLE claim_line_items IS
  'Per-service-line billing detail for CMS-1500 Box 24. '
  'CARC/RARC populated from ERA after remittance parsing. '
  'GIN index on carc_codes enables array-based work queue queries.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 7: claim_status_history
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Immutable append-only audit trail of every status change on
--   a claim. Records who changed the status, the previous and new
--   value, and any associated payer or clearinghouse messages.
--   Supports Smart Phrase comments and defer dates so work queue
--   decisions are permanently logged.
--
-- Key Fields:
--   status              The new status after this event
--   previous_status     Status before this change
--   change_reason       Internal reason (manual, ERA, system)
--   payer_message       Message from payer or ERA
--   smart_phrase_comment  Smart phrase text applied at time of status change
--   defer_until         Defer-to date recorded when status moves to deferred
--
-- Foreign Keys:
--   claim_id     → claims(id)
--   changed_by   → auth.users(id)
--
-- Relationships:
--   many-to-1 → claims
--
-- Recommended Indexes:
--   (claim_id, created_at DESC)  — timeline display
--   (status)                     — status distribution reporting
--   (changed_by)                 — staff activity audit
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claim_status_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id              UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,

  -- Status change
  status                TEXT NOT NULL,
  previous_status       TEXT,
  change_reason         TEXT,

  -- Source of change
  change_source         TEXT DEFAULT 'Manual'
                          CHECK (change_source IN (
                            'Manual','ERA Import','Clearinghouse','System','API'
                          )),
  triggered_by_era_id   UUID,   -- soft FK → eras(id) if source = ERA Import
  office_ally_batch_id  TEXT,

  -- Payer feedback
  payer_message         TEXT,
  clearinghouse_message TEXT,
  carc_code             TEXT,    -- CARC code if denial-related status change
  rarc_code             TEXT,

  -- Work queue annotations
  smart_phrase_comment  TEXT,
  defer_until           DATE,
  defer_reason          TEXT,

  -- Actor
  changed_by            UUID REFERENCES auth.users(id),
  changed_by_name       TEXT,

  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_csh_claim_time  ON claim_status_history(claim_id, created_at DESC);
CREATE INDEX idx_csh_status      ON claim_status_history(status);
CREATE INDEX idx_csh_changed_by  ON claim_status_history(changed_by);

ALTER TABLE claim_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csh_billing_staff" ON claim_status_history
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE claim_status_history IS
  'Immutable status change log for every claim. Smart Phrase comments '
  'and defer dates are recorded here for permanent work queue audit.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 8: eras
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Master Electronic Remittance Advice record. One row per 835
--   file imported from Office Ally or other clearinghouse source.
--   Tracks check/EFT details, reconciliation status, total amounts,
--   and parse quality. Links to era_line_items for service-level
--   detail and to payments for deposit reconciliation.
--
-- Key Fields:
--   era_number          Display ID: ERA-YYYY-####
--   file_name           Original filename of the 835 file
--   check_number        Paper check number (if not EFT)
--   eft_trace           EFT/ACH trace number
--   total_payment       Net payment amount from ERA header
--   total_billed        Sum of billed amounts on all CLP segments
--   status              Pending → Processing → Complete | Partial | Error
--   office_ally_import_id  Reference to Office Ally import record
--   raw_text            Stored X12 835 text for reprocessing
--
-- Foreign Keys:
--   imported_by → auth.users(id)
--
-- Relationships:
--   1-to-many → era_line_items
--   1-to-many → payments
--   1-to-many → payment_postings
--
-- Recommended Indexes:
--   (payer_id, payment_date DESC)    — payer-level ERA history
--   (status)                         — unprocessed ERA queue
--   (check_number)                   — check lookup
--   (eft_trace)                      — EFT reconciliation
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eras (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_number              TEXT NOT NULL UNIQUE,   -- ERA-YYYY-####

  -- Source file
  file_name               TEXT NOT NULL,
  file_size_bytes         INTEGER,
  raw_text                TEXT,     -- full X12 835 for reprocessing

  -- Payer
  payer_name              TEXT,
  payer_id                TEXT,
  payer_qualifier         TEXT,     -- NM1*PR qualifier

  -- Payment
  payment_date            DATE,
  check_date              DATE,
  check_number            TEXT,
  eft_trace               TEXT,     -- EFT/ACH trace

  -- Totals
  total_payment           NUMERIC(12,2) DEFAULT 0,
  total_billed            NUMERIC(12,2) DEFAULT 0,
  total_adjustments       NUMERIC(12,2) DEFAULT 0,
  total_claims            INTEGER DEFAULT 0,
  matched_claims          INTEGER DEFAULT 0,
  unmatched_claims        INTEGER DEFAULT 0,
  denial_count            INTEGER DEFAULT 0,

  -- Status
  status                  TEXT NOT NULL DEFAULT 'Pending'
                            CHECK (status IN (
                              'Pending','Processing','Complete',
                              'Partial','Error','Archived'
                            )),
  parse_errors            INTEGER DEFAULT 0,

  -- Office Ally reference
  office_ally_import_id   TEXT,     -- links to admin-era-schema era_imports.id
  clearinghouse           TEXT DEFAULT 'Office Ally',

  -- Reconciliation
  deposit_matched         BOOLEAN DEFAULT FALSE,
  deposit_date            DATE,
  deposit_amount          NUMERIC(12,2),
  reconciled_at           TIMESTAMPTZ,
  reconciled_by           UUID REFERENCES auth.users(id),

  notes                   TEXT,
  imported_by             UUID REFERENCES auth.users(id),
  imported_at             TIMESTAMPTZ DEFAULT now(),
  archived_at             TIMESTAMPTZ,
  reprocessed_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_eras_payer_date    ON eras(payer_id, payment_date DESC);
CREATE INDEX idx_eras_status        ON eras(status);
CREATE INDEX idx_eras_check         ON eras(check_number);
CREATE INDEX idx_eras_eft           ON eras(eft_trace);
CREATE INDEX idx_eras_oa_import     ON eras(office_ally_import_id);

SELECT attach_updated_at('eras');
ALTER TABLE eras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eras_billing_staff" ON eras
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE eras IS
  'ERA header record per 835 file. Tracks payer payment, reconciliation '
  'status, and Office Ally import reference. raw_text enables reprocessing.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 9: era_line_items
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Per-service-line payment detail parsed from an ERA (X12 835
--   SVC loop). One row per SVC segment. Stores the CARC/RARC
--   codes at the line level and maps to the internal claim and
--   claim_line_item for automated posting.
--
-- Key Fields:
--   era_id              Parent ERA
--   claim_id            Matched internal claim (NULL if unmatched)
--   claim_line_item_id  Matched internal line item
--   service_code        SVC01 CPT/HCPCS
--   billed_amount       SVC02 submitted charge
--   paid_amount         SVC03 payment
--   carc_codes          All CARC codes from CAS loops on this line
--   rarc_codes          All RARC codes from REF*RB / LQ loops
--   adjustment_groups   JSONB [{group, carc, amount}] full CAS detail
--   posting_status      Pending | Posted | Skipped | Error
--
-- Foreign Keys:
--   era_id              → eras(id)
--   claim_id            → claims(id)
--   claim_line_item_id  → claim_line_items(id)
--
-- Relationships:
--   many-to-1 → eras
--   many-to-1 → claims
--   many-to-1 → claim_line_items
--   1-to-many → payment_postings
--
-- Recommended Indexes:
--   (era_id)                    — all lines for an ERA
--   (claim_id)                  — all ERA lines for a claim
--   (service_code)              — code-level ERA analytics
--   (carc_codes) GIN            — CARC work queue
--   (posting_status)            — unposted line queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS era_line_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_id                UUID NOT NULL REFERENCES eras(id) ON DELETE CASCADE,

  -- ERA claim context
  era_claim_number      TEXT,     -- CLP01 from ERA
  era_icn               TEXT,     -- CLP07 payer claim number

  -- Matching
  claim_id              UUID REFERENCES claims(id),
  claim_line_item_id    UUID REFERENCES claim_line_items(id),
  match_method          TEXT,     -- subscriber_id | claim_number | manual | unmatched

  -- Service line (SVC segment)
  service_qualifier     TEXT,     -- HC (HCPCS/CPT) | WK (etc.)
  service_code          TEXT NOT NULL,
  modifiers             TEXT[],
  billed_amount         NUMERIC(12,2),
  paid_amount           NUMERIC(12,2),
  units                 INTEGER DEFAULT 1,
  dos                   DATE,
  revenue_code          TEXT,
  ndc_code              TEXT,

  -- Adjustments (CAS segments)
  carc_codes            TEXT[] DEFAULT '{}',
  rarc_codes            TEXT[] DEFAULT '{}',
  adjustment_groups     JSONB DEFAULT '[]',   -- [{group: "CO", carc: "45", amount: 50.00}]
  adjustment_amount     NUMERIC(12,2) DEFAULT 0,
  patient_responsibility NUMERIC(12,2) DEFAULT 0,

  -- Posting
  posting_status        TEXT NOT NULL DEFAULT 'Pending'
                          CHECK (posting_status IN (
                            'Pending','Posted','Skipped','Error','On Hold'
                          )),
  posted_at             TIMESTAMPTZ,
  posted_by             UUID REFERENCES auth.users(id),

  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_eli_era         ON era_line_items(era_id);
CREATE INDEX idx_eli_claim       ON era_line_items(claim_id);
CREATE INDEX idx_eli_carc        ON era_line_items USING gin(carc_codes);
CREATE INDEX idx_eli_rarc        ON era_line_items USING gin(rarc_codes);
CREATE INDEX idx_eli_posting     ON era_line_items(posting_status);
CREATE INDEX idx_eli_code        ON era_line_items(service_code);

ALTER TABLE era_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eli_billing_staff" ON era_line_items
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE era_line_items IS
  'Per SVC-segment ERA line detail. Maps to internal claim_line_items. '
  'GIN indexes on carc_codes enable CARC-based work queue queries.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 10: payments
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Top-level payment record representing a single discrete
--   payment received — either an insurance check/EFT batch or
--   an individual patient payment. Tracks the payment against
--   the sourcing ERA and the Office Ally deposit record.
--   Individual application to claims is in payment_postings.
--
-- Key Fields:
--   payment_number      Display ID: PMT-YYYY-####
--   payment_type        Insurance Check | EFT | Patient Check |
--                       Credit Card | Cash | Portal | Adjustment
--   payer_type          insurance | patient | secondary | tertiary
--   era_id              Linked ERA if this is an insurance payment
--   payment_amount      Gross amount received
--   applied_amount      Sum of all payment_postings
--   unapplied_amount    payment_amount − applied_amount
--   status              Pending | Posted | Reconciled | Voided
--
-- Foreign Keys:
--   era_id       → eras(id)
--   patient_id   → patient_records(id)   (for patient payments)
--   client_id    → clinician_accounts(id)
--   created_by   → auth.users(id)
--
-- Relationships:
--   1-to-1    → eras   (insurance payments)
--   1-to-many → payment_postings
--
-- Recommended Indexes:
--   (client_id, payment_date DESC)    — payment history
--   (era_id)                          — ERA-payment link
--   (patient_id, payment_date DESC)   — patient payment history
--   (status)                          — unapplied payment queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number          TEXT NOT NULL UNIQUE,   -- PMT-YYYY-####

  -- Classification
  payment_type            TEXT NOT NULL DEFAULT 'Insurance Check'
                            CHECK (payment_type IN (
                              'Insurance Check','EFT','Patient Check',
                              'Credit Card','Cash','Portal Payment','Adjustment'
                            )),
  payer_type              TEXT NOT NULL DEFAULT 'insurance'
                            CHECK (payer_type IN (
                              'insurance','patient','secondary','tertiary'
                            )),

  -- Source
  payer_name              TEXT,
  payer_id                TEXT,
  era_id                  UUID REFERENCES eras(id),
  patient_id              TEXT REFERENCES patient_records(id),
  client_id               TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Payment instrument
  check_number            TEXT,
  eft_trace               TEXT,
  card_last_four          TEXT,

  -- Dates and amounts
  payment_date            DATE NOT NULL,
  deposit_date            DATE,
  payment_amount          NUMERIC(12,2) NOT NULL,
  applied_amount          NUMERIC(12,2) DEFAULT 0,
  unapplied_amount        NUMERIC(12,2) GENERATED ALWAYS AS
                            (payment_amount - applied_amount) STORED,

  -- Status
  status                  TEXT NOT NULL DEFAULT 'Pending'
                            CHECK (status IN (
                              'Pending','Posted','Reconciled','Voided'
                            )),
  voided_at               TIMESTAMPTZ,
  voided_reason           TEXT,

  -- Office Ally reference
  office_ally_deposit_id  TEXT,

  notes                   TEXT,
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pmts_client_date  ON payments(client_id, payment_date DESC);
CREATE INDEX idx_pmts_era          ON payments(era_id);
CREATE INDEX idx_pmts_patient_date ON payments(patient_id, payment_date DESC);
CREATE INDEX idx_pmts_status       ON payments(status);
CREATE INDEX idx_pmts_check        ON payments(check_number);

SELECT attach_updated_at('payments');
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmts_billing_staff" ON payments
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE payments IS
  'Top-level payment record (insurance or patient). Individual claim '
  'application is in payment_postings. unapplied_amount is computed.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 11: payment_postings
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Granular ledger line linking a payment to a specific claim
--   or claim line item. Supports multiple posting types including
--   insurance payments, patient payments, adjustments, writeoffs,
--   transfers, and recoupments. Reversals are tracked via
--   is_reversal / reversal_of for audit integrity.
--
-- Key Fields:
--   posting_type        Insurance Payment | Patient Payment |
--                       Contractual Adj | Writeoff | Transfer |
--                       Recoupment | Credit Balance
--   posted_amount       Amount credited to the claim or line
--   adjustment_amount   CO-45 or other contractual adjustment
--   carc_code           CARC code driving this posting (if denial/adj)
--   rarc_code           RARC remark code
--   is_reversal         True when this posting undoes another posting
--   reversal_of         UUID of original posting being reversed
--
-- Foreign Keys:
--   payment_id          → payments(id)
--   claim_id            → claims(id)
--   claim_line_item_id  → claim_line_items(id)
--   era_id              → eras(id)
--   era_line_item_id    → era_line_items(id)
--   patient_id          → patient_records(id)
--   posted_by           → auth.users(id)
--   reversal_of         → payment_postings(id)  [self]
--
-- Recommended Indexes:
--   (payment_id)                  — all postings for a payment
--   (claim_id, posted_date DESC)  — claim payment history
--   (patient_id)                  — patient payment ledger
--   (posting_type)                — posting type distribution
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_postings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  payment_id            UUID NOT NULL REFERENCES payments(id),
  claim_id              UUID NOT NULL REFERENCES claims(id),
  claim_line_item_id    UUID REFERENCES claim_line_items(id),
  era_id                UUID REFERENCES eras(id),
  era_line_item_id      UUID REFERENCES era_line_items(id),
  patient_id            TEXT REFERENCES patient_records(id),

  -- Type
  posting_type          TEXT NOT NULL DEFAULT 'Insurance Payment'
                          CHECK (posting_type IN (
                            'Insurance Payment','Patient Payment',
                            'Contractual Adjustment','Writeoff',
                            'Transfer','Recoupment','Credit Balance',
                            'Balance Adjustment'
                          )),

  -- Amounts
  posted_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustment_amount     NUMERIC(12,2) DEFAULT 0,
  patient_responsibility NUMERIC(12,2) DEFAULT 0,

  -- CARC / RARC
  carc_code             TEXT,
  rarc_code             TEXT,

  -- Date and actor
  posted_date           DATE NOT NULL DEFAULT current_date,
  posted_by             UUID REFERENCES auth.users(id),
  posting_method        TEXT DEFAULT 'Manual'
                          CHECK (posting_method IN ('Manual','ERA Auto','ERA Manual','System')),

  -- Reversals
  is_reversal           BOOLEAN DEFAULT FALSE,
  reversal_of           UUID REFERENCES payment_postings(id),
  reversal_reason       TEXT,

  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pp_payment       ON payment_postings(payment_id);
CREATE INDEX idx_pp_claim_date    ON payment_postings(claim_id, posted_date DESC);
CREATE INDEX idx_pp_patient       ON payment_postings(patient_id);
CREATE INDEX idx_pp_type          ON payment_postings(posting_type);
CREATE INDEX idx_pp_era           ON payment_postings(era_id);
CREATE INDEX idx_pp_reversal      ON payment_postings(reversal_of) WHERE reversal_of IS NOT NULL;

ALTER TABLE payment_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_billing_staff" ON payment_postings
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE payment_postings IS
  'Granular posting ledger. Each row is one payment application to a '
  'claim or line. Reversals chain via reversal_of for audit integrity.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 12: patient_balances
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Tracks open patient-responsibility balances at the claim
--   level. Supports aging bucket computation, statement linkage,
--   defer dates for collection holds, and escalation to external
--   collections. One row per open balance per claim; updated
--   as payments are posted.
--
-- Key Fields:
--   balance_type        Deductible | Copay | Coinsurance |
--                       Self-Pay | Overpayment
--   balance_amount      Current open amount owed
--   original_amount     Original patient responsibility from ERA
--   aging_bucket        0-30 | 31-60 | 61-90 | 91-120 | 120+
--                       (computed at query time via view; stored
--                        here for indexed filtering)
--   status              Open | In Process | Billed | Partial |
--                       Paid | Writeoff | Collections
--   defer_until         Work queue hold date
--   last_statement_id   Most recent statement sent
--
-- Foreign Keys:
--   patient_id    → patient_records(id)
--   client_id     → clinician_accounts(id)
--   claim_id      → claims(id)
--
-- Recommended Indexes:
--   (patient_id, aging_bucket)        — patient AR view
--   (client_id, aging_bucket, status) — clinician AR aging board
--   (status)                          — open balance queue
--   (defer_until) WHERE NOT NULL      — deferred balance queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS patient_balances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  patient_id            TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),
  claim_id              UUID REFERENCES claims(id),

  -- Balance detail
  balance_type          TEXT NOT NULL DEFAULT 'Copay'
                          CHECK (balance_type IN (
                            'Deductible','Copay','Coinsurance',
                            'Self-Pay','Overpayment','Non-Covered'
                          )),
  original_amount       NUMERIC(12,2) NOT NULL,
  balance_amount        NUMERIC(12,2) NOT NULL,
  billed_date           DATE,
  due_date              DATE,
  dos                   DATE,

  -- Aging (updated by scheduled job)
  aging_bucket          TEXT DEFAULT '0-30'
                          CHECK (aging_bucket IN (
                            '0-30','31-60','61-90','91-120','120+'
                          )),
  aging_days            INTEGER,   -- days since dos or billed_date

  -- Status
  status                TEXT NOT NULL DEFAULT 'Open'
                          CHECK (status IN (
                            'Open','In Process','Billed','Partial',
                            'Paid','Writeoff','Collections'
                          )),

  -- Statement tracking
  last_statement_id     UUID,      -- soft FK → statements(id)
  last_statement_date   DATE,
  statement_count       INTEGER DEFAULT 0,

  -- Payment tracking
  last_payment_date     DATE,
  last_payment_amount   NUMERIC(12,2),

  -- Work queue controls
  defer_until           DATE,
  defer_reason          TEXT,
  smart_phrase_comment  TEXT,

  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pb_patient_aging  ON patient_balances(patient_id, aging_bucket);
CREATE INDEX idx_pb_client_aging   ON patient_balances(client_id, aging_bucket, status);
CREATE INDEX idx_pb_status         ON patient_balances(status);
CREATE INDEX idx_pb_claim          ON patient_balances(claim_id);
CREATE INDEX idx_pb_defer          ON patient_balances(defer_until) WHERE defer_until IS NOT NULL;

SELECT attach_updated_at('patient_balances');
ALTER TABLE patient_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pb_billing_staff" ON patient_balances
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE patient_balances IS
  'Open patient-responsibility balance per claim. aging_bucket is '
  'updated by a scheduled job. defer_until suspends work queue actions.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 13: statements
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Patient billing statement records. One row per statement
--   event. Tracks the cycle type (Initial/Reminder/Final/
--   Collections), delivery method, and links the specific
--   patient_balance IDs included in the statement for traceability.
--   PDF is stored in Supabase Storage.
--
-- Key Fields:
--   statement_number    Display ID: STMT-YYYYMM-####
--   statement_type      Initial | Reminder | Final | Collections
--   delivery_method     Mail | Email | Portal | Suppressed
--   balance_due         Total amount owed on this statement
--   pdf_url             Supabase Storage signed URL
--   patient_balance_ids Array of patient_balances referenced
--   status              Draft | Sent | Viewed | Paid | Cancelled
--
-- Foreign Keys:
--   patient_id → patient_records(id)
--   client_id  → clinician_accounts(id)
--
-- Recommended Indexes:
--   (patient_id, statement_date DESC)  — patient statement history
--   (client_id, status)                — unpaid statement queue
--   (status)                           — batch statement status
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS statements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_number      TEXT NOT NULL UNIQUE,   -- STMT-YYYYMM-####

  -- Linkage
  patient_id            TEXT NOT NULL REFERENCES patient_records(id),
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Statement content
  statement_date        DATE NOT NULL DEFAULT current_date,
  due_date              DATE,
  statement_type        TEXT NOT NULL DEFAULT 'Initial'
                          CHECK (statement_type IN (
                            'Initial','Reminder','Final','Collections'
                          )),

  -- Financials
  balance_forward       NUMERIC(12,2) DEFAULT 0,
  new_charges           NUMERIC(12,2) DEFAULT 0,
  payments_received     NUMERIC(12,2) DEFAULT 0,
  adjustments           NUMERIC(12,2) DEFAULT 0,
  balance_due           NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Delivery
  delivery_method       TEXT NOT NULL DEFAULT 'Mail'
                          CHECK (delivery_method IN (
                            'Mail','Email','Portal','Suppressed'
                          )),
  email_address         TEXT,       -- target email if method=Email
  mailing_address       TEXT,

  -- Tracking
  sent_at               TIMESTAMPTZ,
  viewed_at             TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,

  -- Status
  status                TEXT NOT NULL DEFAULT 'Draft'
                          CHECK (status IN (
                            'Draft','Sent','Viewed','Partial','Paid','Cancelled'
                          )),

  -- Document
  pdf_url               TEXT,       -- Supabase Storage URL
  patient_balance_ids   UUID[],     -- patient_balances referenced in this statement

  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stmts_patient_date ON statements(patient_id, statement_date DESC);
CREATE INDEX idx_stmts_client_status ON statements(client_id, status);
CREATE INDEX idx_stmts_status       ON statements(status);
CREATE INDEX idx_stmts_due          ON statements(due_date) WHERE status NOT IN ('Paid','Cancelled');

SELECT attach_updated_at('statements');
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stmts_billing_staff" ON statements
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE statements IS
  'Patient billing statement records. patient_balance_ids array '
  'links the balances included. pdf_url stores the generated statement.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 14: refunds
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Tracks all refund events — overpayment returns to payer,
--   patient refunds for overpayments or duplicate payments,
--   and billing error corrections. Linked to the source payment
--   and posting for full audit chain.
--
-- Key Fields:
--   refund_number       Display ID: REF-YYYY-####
--   refund_type         Overpayment-Patient | Overpayment-Insurance |
--                       Patient Request | Billing Error | Recoupment
--   refund_method       Check | EFT | Credit Card | Credit on Account
--   refund_to           Payee name (patient or payer)
--   refund_amount       Amount to be refunded
--   status              Requested | Approved | Issued | Voided
--   issued_date         Date check or EFT was sent
--
-- Foreign Keys:
--   patient_id  → patient_records(id)
--   client_id   → clinician_accounts(id)
--   payment_id  → payments(id)
--   posting_id  → payment_postings(id)
--   claim_id    → claims(id)
--   approved_by → auth.users(id)
--   created_by  → auth.users(id)
--
-- Recommended Indexes:
--   (client_id, status)           — pending refund queue
--   (patient_id)                  — patient refund history
--   (payment_id)                  — refunds on a payment
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS refunds (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number         TEXT NOT NULL UNIQUE,   -- REF-YYYY-####

  -- Linkage
  patient_id            TEXT REFERENCES patient_records(id),
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),
  payment_id            UUID REFERENCES payments(id),
  posting_id            UUID REFERENCES payment_postings(id),
  claim_id              UUID REFERENCES claims(id),

  -- Classification
  refund_type           TEXT NOT NULL
                          CHECK (refund_type IN (
                            'Overpayment-Patient','Overpayment-Insurance',
                            'Patient Request','Billing Error','Recoupment'
                          )),
  refund_method         TEXT NOT NULL DEFAULT 'Check'
                          CHECK (refund_method IN (
                            'Check','EFT','Credit Card','Credit on Account'
                          )),

  -- Payee
  refund_to             TEXT NOT NULL,   -- patient or payer name
  refund_address        TEXT,

  -- Amount
  refund_amount         NUMERIC(12,2) NOT NULL,

  -- Reason
  reason                TEXT,

  -- Status
  status                TEXT NOT NULL DEFAULT 'Requested'
                          CHECK (status IN (
                            'Requested','Approved','Issued','Voided'
                          )),
  approved_by           UUID REFERENCES auth.users(id),
  approved_at           TIMESTAMPTZ,
  issued_date           DATE,
  check_number          TEXT,    -- refund check number
  eft_trace             TEXT,

  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_refunds_client_status ON refunds(client_id, status);
CREATE INDEX idx_refunds_patient       ON refunds(patient_id);
CREATE INDEX idx_refunds_payment       ON refunds(payment_id);

SELECT attach_updated_at('refunds');
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_billing_staff" ON refunds
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE refunds IS
  'Refund log for overpayments to patients or payers. '
  'Chains to source payment and posting for full audit.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 15: writeoffs
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Records contractual, bad-debt, and policy writeoffs at the
--   claim or line item level. CARC-based writeoffs (CO-45
--   contractual adjustment, CO-50 non-covered) are generated
--   automatically during ERA posting; manual writeoffs require
--   approval. Each writeoff links to the specific claim line
--   for granular AR reconciliation.
--
-- Key Fields:
--   writeoff_number     Display ID: WO-YYYY-####
--   writeoff_type       Contractual | Bad Debt | Policy Adjustment |
--                       Financial Hardship | CARC-Based | Small Balance
--   writeoff_amount     Amount being written off
--   carc_code           CARC driving the writeoff (CO-45, CO-50, etc.)
--   gl_code             General ledger allocation code
--   status              Pending | Approved | Posted | Voided
--
-- Foreign Keys:
--   patient_id          → patient_records(id)
--   client_id           → clinician_accounts(id)
--   claim_id            → claims(id)
--   claim_line_item_id  → claim_line_items(id)
--   approved_by         → auth.users(id)
--   created_by          → auth.users(id)
--
-- Recommended Indexes:
--   (client_id, status)             — pending writeoff queue
--   (claim_id)                      — writeoffs per claim
--   (carc_code, writeoff_type)      — CARC writeoff analytics
--   (created_at DESC)               — recent writeoff audit
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS writeoffs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writeoff_number       TEXT NOT NULL UNIQUE,   -- WO-YYYY-####

  -- Linkage
  patient_id            TEXT REFERENCES patient_records(id),
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),
  claim_id              UUID REFERENCES claims(id),
  claim_line_item_id    UUID REFERENCES claim_line_items(id),
  payment_posting_id    UUID REFERENCES payment_postings(id),

  -- Classification
  writeoff_type         TEXT NOT NULL
                          CHECK (writeoff_type IN (
                            'Contractual','Bad Debt','Policy Adjustment',
                            'Financial Hardship','CARC-Based','Small Balance'
                          )),
  writeoff_amount       NUMERIC(12,2) NOT NULL,

  -- CARC / RARC info
  carc_code             TEXT,
  rarc_code             TEXT,

  -- Reason
  reason                TEXT,
  gl_code               TEXT,    -- general ledger code for reporting

  -- Approval
  status                TEXT NOT NULL DEFAULT 'Pending'
                          CHECK (status IN (
                            'Pending','Approved','Posted','Voided'
                          )),
  approved_by           UUID REFERENCES auth.users(id),
  approved_at           TIMESTAMPTZ,
  posted_date           DATE,

  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wo_client_status  ON writeoffs(client_id, status);
CREATE INDEX idx_wo_claim          ON writeoffs(claim_id);
CREATE INDEX idx_wo_carc           ON writeoffs(carc_code, writeoff_type);
CREATE INDEX idx_wo_created        ON writeoffs(created_at DESC);

SELECT attach_updated_at('writeoffs');
ALTER TABLE writeoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wo_billing_staff" ON writeoffs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE writeoffs IS
  'Contractual and bad-debt writeoffs at claim or line level. '
  'CARC-Based writeoffs are auto-generated from ERA posting.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 16: denials
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Records payer denial events at the claim or line level.
--   CARC/RARC codes drive the denial classification and route
--   the record to the appropriate work queue. Supports defer
--   dates, Smart Phrase comments, staff assignment, and
--   resolution tracking for CARC-based reporting.
--
-- Key Fields:
--   denial_number       Display ID: DEN-YYYY-####
--   denial_type         Hard | Soft | Clinical | Technical |
--                       Timely Filing | Authorization |
--                       Medical Necessity | Duplicate | Coding
--   carc_code           Primary CARC code from ERA
--   rarc_code           RARC remark code
--   billed_amount       Claim amount that was denied
--   denied_amount       Specific amount denied (may be partial)
--   status              Open | In Review | Appealed |
--                       Corrected/Resubmitted | Reversed |
--                       Written Off | Closed
--   workqueue_id        Active work queue item
--   defer_until         Hold date for work queue
--   smart_phrase_comment  Smart phrase applied to this denial
--
-- Foreign Keys:
--   claim_id            → claims(id)
--   claim_line_item_id  → claim_line_items(id)
--   era_id              → eras(id)
--   patient_id          → patient_records(id)
--   client_id           → clinician_accounts(id)
--   workqueue_id        → workqueue_items(id)
--   assigned_to         → auth.users(id)
--
-- Relationships:
--   1-to-many → appeals
--   many-to-1 → workqueue_items
--
-- Recommended Indexes:
--   (client_id, status)           — denial work queue
--   (carc_code, status)           — CARC-based work queue
--   (payer, carc_code)            — payer denial pattern analysis
--   (defer_until) WHERE NOT NULL  — deferred denial queue
--   (assigned_to)                 — staff denial queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS denials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denial_number         TEXT NOT NULL UNIQUE,   -- DEN-YYYY-####

  -- Linkage
  claim_id              UUID NOT NULL REFERENCES claims(id),
  claim_line_item_id    UUID REFERENCES claim_line_items(id),
  era_id                UUID REFERENCES eras(id),
  patient_id            TEXT REFERENCES patient_records(id),
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Denial detail
  denial_date           DATE NOT NULL,
  denial_type           TEXT NOT NULL
                          CHECK (denial_type IN (
                            'Hard Denial','Soft Denial','Clinical Denial',
                            'Technical Denial','Timely Filing','Authorization',
                            'Medical Necessity','Duplicate','Coding','Other'
                          )),
  carc_code             TEXT,
  rarc_code             TEXT,
  pr_code               TEXT,      -- PR-xx patient responsibility code
  payer                 TEXT,
  denial_reason         TEXT,      -- human-readable interpretation
  payer_message         TEXT,      -- raw payer message text

  -- Amounts
  billed_amount         NUMERIC(12,2),
  denied_amount         NUMERIC(12,2),

  -- Status
  status                TEXT NOT NULL DEFAULT 'Open'
                          CHECK (status IN (
                            'Open','In Review','Appealed',
                            'Corrected/Resubmitted','Reversed',
                            'Written Off','Closed'
                          )),

  -- Work queue
  workqueue_id          UUID,    -- soft FK → workqueue_items(id)
  assigned_to           UUID REFERENCES auth.users(id),
  assigned_to_name      TEXT,

  -- Work queue controls
  defer_until           DATE,
  defer_reason          TEXT,
  smart_phrase_comment  TEXT,

  -- Resolution
  resolution            TEXT,
  resolved_at           TIMESTAMPTZ,
  resolved_by           UUID REFERENCES auth.users(id),

  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_den_client_status ON denials(client_id, status);
CREATE INDEX idx_den_carc_status   ON denials(carc_code, status);
CREATE INDEX idx_den_payer_carc    ON denials(payer, carc_code);
CREATE INDEX idx_den_defer         ON denials(defer_until) WHERE defer_until IS NOT NULL;
CREATE INDEX idx_den_assigned      ON denials(assigned_to);
CREATE INDEX idx_den_claim         ON denials(claim_id);
CREATE INDEX idx_den_era           ON denials(era_id);

SELECT attach_updated_at('denials');
ALTER TABLE denials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "den_billing_staff" ON denials
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE denials IS
  'Payer denial events at claim or line level. CARC/RARC drive work '
  'queue routing. defer_until and smart_phrase_comment enable '
  'structured follow-up workflow.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 17: appeals
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Formal appeal filing records linked to a denial. Tracks the
--   full appeal lifecycle from draft through payer decision.
--   Supports multiple appeal levels (First Level, Second Level,
--   External Review, ALJ). Stores the appeal letter and
--   supporting documents via Supabase Storage URLs.
--
-- Key Fields:
--   appeal_number       Display ID: APL-YYYY-####
--   appeal_level        First Level | Second Level | External Review | ALJ
--   appeal_type         Clinical | Technical | Timely Filing | Coding
--   filed_date          Date appeal was submitted to payer
--   deadline_date       Payer response deadline
--   status              Drafted | Submitted | Acknowledged |
--                       Decision Pending | Upheld | Overturned |
--                       Partial | Withdrawn | Expired
--   recovered_amount    Amount recovered if overturned
--   appeal_letter_url   Supabase Storage path to appeal letter
--
-- Foreign Keys:
--   denial_id   → denials(id)
--   claim_id    → claims(id)
--   patient_id  → patient_records(id)
--   client_id   → clinician_accounts(id)
--   assigned_to → auth.users(id)
--   created_by  → auth.users(id)
--
-- Relationships:
--   many-to-1 → denials
--
-- Recommended Indexes:
--   (client_id, status)           — appeal work queue
--   (denial_id)                   — appeals per denial
--   (deadline_date, status)       — expiring appeal queue
--   (appeal_level, status)        — level-based reporting
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS appeals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appeal_number         TEXT NOT NULL UNIQUE,   -- APL-YYYY-####

  -- Linkage
  denial_id             UUID NOT NULL REFERENCES denials(id),
  claim_id              UUID NOT NULL REFERENCES claims(id),
  patient_id            TEXT REFERENCES patient_records(id),
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Classification
  appeal_level          TEXT NOT NULL DEFAULT 'First Level'
                          CHECK (appeal_level IN (
                            'First Level','Second Level','External Review',
                            'ALJ','Expedited'
                          )),
  appeal_type           TEXT NOT NULL
                          CHECK (appeal_type IN (
                            'Clinical','Technical','Timely Filing','Coding','Other'
                          )),

  -- Dates
  filed_date            DATE,
  deadline_date         DATE,

  -- Status
  status                TEXT NOT NULL DEFAULT 'Drafted'
                          CHECK (status IN (
                            'Drafted','Submitted','Acknowledged','Decision Pending',
                            'Upheld','Overturned','Partial','Withdrawn','Expired'
                          )),

  -- Payer handling
  payer                 TEXT,
  payer_contact         TEXT,
  payer_reference       TEXT,   -- payer's appeal reference number

  -- Documents (Supabase Storage)
  appeal_letter_url     TEXT,
  supporting_docs_urls  TEXT[] DEFAULT '{}',

  -- Decision
  decision_date         DATE,
  decision              TEXT,   -- plain-text decision summary
  decision_reason       TEXT,
  recovered_amount      NUMERIC(12,2) DEFAULT 0,

  -- Work queue
  smart_phrase_comment  TEXT,
  assigned_to           UUID REFERENCES auth.users(id),
  assigned_to_name      TEXT,

  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_apl_client_status ON appeals(client_id, status);
CREATE INDEX idx_apl_denial        ON appeals(denial_id);
CREATE INDEX idx_apl_deadline      ON appeals(deadline_date, status);
CREATE INDEX idx_apl_level         ON appeals(appeal_level, status);

SELECT attach_updated_at('appeals');
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apl_billing_staff" ON appeals
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE appeals IS
  'Formal appeal filing per denial. Multi-level appeal chain supported. '
  'deadline_date index drives the expiring appeal work queue.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 18: prior_authorizations
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Prior authorization requests and approvals for behavioral
--   health services. Tracks the full lifecycle from draft
--   submission through approval/denial, capturing the auth
--   number, authorized service codes, units, and validity dates.
--   Concurrent and renewal auths chain via parent_auth_id.
--
-- Key Fields:
--   auth_number         Payer-assigned authorization number
--   auth_request_number  Internal request ID
--   service_code        CPT/HCPCS code requiring auth
--   requested_units     Units requested
--   approved_units      Units approved by payer
--   service_start/end   Auth validity window
--   status              Draft | Submitted | Pending | Approved |
--                       Denied | Appealed | Expired | Revoked
--   auth_type           Behavioral Health type category
--   is_concurrent       True if this is a concurrent review
--   parent_auth_id      Self-reference for renewal/concurrent chain
--   office_ally_ref     Office Ally eligibility/auth transaction ref
--
-- Foreign Keys:
--   patient_id     → patient_records(id)
--   client_id      → clinician_accounts(id)
--   clinician_id   → auth.users(id)
--   parent_auth_id → prior_authorizations(id)  [self]
--   created_by     → auth.users(id)
--
-- Relationships:
--   1-to-many → claims (via prior_auth_id on claims)
--   many-to-1 → prior_authorizations (parent_auth_id)
--
-- Recommended Indexes:
--   (patient_id, service_end DESC)        — active auth lookup
--   (client_id, status)                   — auth work queue
--   (auth_number)                         — payer auth number lookup
--   (service_end) WHERE status='Approved' — expiring auth queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prior_authorizations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_request_number   TEXT NOT NULL UNIQUE,   -- PAR-YYYY-####

  -- Linkage
  patient_id            TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),
  clinician_id          UUID REFERENCES auth.users(id),
  parent_auth_id        UUID REFERENCES prior_authorizations(id),

  -- Payer
  payer                 TEXT NOT NULL,
  payer_id              TEXT,
  member_id             TEXT,

  -- Auth detail
  auth_number           TEXT,       -- assigned by payer upon approval
  auth_type             TEXT NOT NULL DEFAULT 'Individual Behavioral Health'
                          CHECK (auth_type IN (
                            'Individual Behavioral Health',
                            'Substance Use Disorder',
                            'Assessment',
                            'Group Therapy',
                            'Family Therapy',
                            'Residential',
                            'Crisis',
                            'Other'
                          )),
  service_code          TEXT NOT NULL,
  service_description   TEXT,
  diagnosis_codes       TEXT[] DEFAULT '{}',
  place_of_service      TEXT DEFAULT '11',
  telehealth            BOOLEAN DEFAULT FALSE,

  -- Units
  requested_units       INTEGER,
  approved_units        INTEGER,
  used_units            INTEGER DEFAULT 0,
  remaining_units       INTEGER GENERATED ALWAYS AS
                          (COALESCE(approved_units, 0) - COALESCE(used_units, 0)) STORED,

  -- Dates
  request_date          DATE NOT NULL DEFAULT current_date,
  service_start         DATE,
  service_end           DATE,
  approval_date         DATE,
  denial_date           DATE,
  expiration_warn_sent  BOOLEAN DEFAULT FALSE,

  -- Status
  status                TEXT NOT NULL DEFAULT 'Draft'
                          CHECK (status IN (
                            'Draft','Submitted','Pending','Approved',
                            'Denied','Appealed','Expired','Revoked'
                          )),
  denial_reason         TEXT,
  payer_notes           TEXT,
  appeal_deadline       DATE,

  -- Flags
  is_concurrent         BOOLEAN DEFAULT FALSE,

  -- Clearinghouse
  office_ally_ref       TEXT,

  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pa_patient_end    ON prior_authorizations(patient_id, service_end DESC);
CREATE INDEX idx_pa_client_status  ON prior_authorizations(client_id, status);
CREATE INDEX idx_pa_auth_number    ON prior_authorizations(auth_number);
CREATE INDEX idx_pa_expiring       ON prior_authorizations(service_end)
  WHERE status = 'Approved';
CREATE INDEX idx_pa_parent         ON prior_authorizations(parent_auth_id) WHERE parent_auth_id IS NOT NULL;

SELECT attach_updated_at('prior_authorizations');
ALTER TABLE prior_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pa_clinician_own" ON prior_authorizations
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE prior_authorizations IS
  'Prior auth lifecycle. remaining_units is computed. '
  'parent_auth_id chains concurrent/renewal auths. '
  'Partial index on service_end for expiring auth alerting.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 19: referrals
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Tracks provider referrals required by certain payers for
--   behavioral health services. Records the referring and
--   referred-to provider information, authorized visit count,
--   usage, and expiration. Linked to claims to validate that
--   a valid referral was on file at time of service.
--
-- Key Fields:
--   referral_number     Internal display ID: REF-YYYY-####
--   referral_number_external  Payer-assigned referral number
--   authorized_visits   Number of visits authorized
--   used_visits         Visits consumed against this referral
--   remaining_visits    Computed: authorized − used
--   expiration_date     Date referral expires
--   status              Active | Expired | Exhausted | Cancelled
--
-- Foreign Keys:
--   patient_id  → patient_records(id)
--   client_id   → clinician_accounts(id)
--   created_by  → auth.users(id)
--
-- Relationships:
--   1-to-many → claims (via referral_id on claims)
--
-- Recommended Indexes:
--   (patient_id, payer, status)       — active referral lookup
--   (expiration_date, status)         — expiring referral queue
--   (referral_number_external)        — payer referral match
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS referrals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_number           TEXT NOT NULL UNIQUE,   -- RREF-YYYY-####

  -- Linkage
  patient_id                TEXT NOT NULL REFERENCES patient_records(id),
  client_id                 TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Referring provider
  referring_provider_name   TEXT,
  referring_provider_npi    TEXT,
  referring_provider_phone  TEXT,
  referring_organization    TEXT,

  -- Referred-to provider
  referred_to_name          TEXT,
  referred_to_npi           TEXT,
  referred_to_specialty     TEXT,

  -- Referral detail
  referral_date             DATE NOT NULL DEFAULT current_date,
  expiration_date           DATE,
  diagnosis_codes           TEXT[] DEFAULT '{}',
  reason                    TEXT,

  -- Payer
  payer                     TEXT,
  referral_number_external  TEXT,   -- payer-assigned referral number

  -- Visit authorization
  authorized_visits         INTEGER,
  used_visits               INTEGER DEFAULT 0,
  remaining_visits          INTEGER GENERATED ALWAYS AS
                              (COALESCE(authorized_visits, 0) - COALESCE(used_visits, 0)) STORED,

  -- Status
  status                    TEXT NOT NULL DEFAULT 'Active'
                              CHECK (status IN (
                                'Active','Expired','Exhausted','Cancelled'
                              )),

  notes                     TEXT,
  created_by                UUID REFERENCES auth.users(id),
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ref_patient_payer  ON referrals(patient_id, payer, status);
CREATE INDEX idx_ref_expiring       ON referrals(expiration_date, status);
CREATE INDEX idx_ref_ext_number     ON referrals(referral_number_external);

SELECT attach_updated_at('referrals');
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_billing_staff" ON referrals
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE referrals IS
  'Provider referral tracking. remaining_visits is computed. '
  'Partial index on expiration_date enables expiring referral alerting.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 20: workqueue_items
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Unified work queue for CARC/RARC denial actions, aging
--   patient balance follow-up, authorization renewals,
--   appeal deadlines, and statement escalations. Items are
--   created by automated rules (new denial, aging threshold
--   crossed) or manually by billing staff. Defer dates pause
--   an item until a scheduled review date. Smart Phrase
--   comments capture the structured action taken.
--
-- Key Fields:
--   queue_type          CARC | RARC | Aging | Denial | Appeal |
--                       Authorization | Statement | General
--   carc_code           Populated when queue_type is CARC
--   rarc_code           Populated when queue_type is RARC
--   aging_bucket        Populated when queue_type is Aging
--   priority            Routine | High | Urgent
--   status              New | Assigned | In Progress | Deferred |
--                       Resolved | Escalated | Closed
--   defer_until         Work queue pause date
--   smart_phrase_comment  Smart phrase text applied
--   action_taken        Free text summary of what was done
--
-- Foreign Keys:
--   claim_id    → claims(id)
--   denial_id   → denials(id)
--   patient_id  → patient_records(id)
--   client_id   → clinician_accounts(id)
--   assigned_to → auth.users(id)
--
-- Recommended Indexes:
--   (queue_type, status)          — queue routing
--   (assigned_to, status)         — staff queue
--   (carc_code, status)           — CARC-specific queue
--   (aging_bucket, status)        — aging queue
--   (defer_until) WHERE NOT NULL  — deferred item queue
--   (priority, status)            — urgent queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workqueue_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  queue_type            TEXT NOT NULL DEFAULT 'General'
                          CHECK (queue_type IN (
                            'CARC','RARC','Aging','Denial','Appeal',
                            'Authorization','Statement','General'
                          )),
  carc_code             TEXT,    -- set when queue_type='CARC'
  rarc_code             TEXT,    -- set when queue_type='RARC'
  aging_bucket          TEXT     -- set when queue_type='Aging'
                          CHECK (aging_bucket IN ('0-30','31-60','61-90','91-120','120+',NULL)),

  -- Linkage (all nullable; item may relate to multiple object types)
  claim_id              UUID REFERENCES claims(id),
  denial_id             UUID REFERENCES denials(id),
  appeal_id             UUID REFERENCES appeals(id),
  patient_id            TEXT REFERENCES patient_records(id),
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),
  auth_id               UUID REFERENCES prior_authorizations(id),
  patient_balance_id    UUID REFERENCES patient_balances(id),

  -- Priority and assignment
  priority              TEXT NOT NULL DEFAULT 'Routine'
                          CHECK (priority IN ('Routine','High','Urgent')),
  assigned_to           UUID REFERENCES auth.users(id),
  assigned_to_name      TEXT,
  due_date              DATE,

  -- Status
  status                TEXT NOT NULL DEFAULT 'New'
                          CHECK (status IN (
                            'New','Assigned','In Progress','Deferred',
                            'Resolved','Escalated','Closed'
                          )),

  -- Work queue controls
  defer_until           DATE,
  defer_reason          TEXT,
  smart_phrase_comment  TEXT,
  action_taken          TEXT,
  action_date           DATE,

  -- Resolution
  resolution            TEXT,
  resolved_by           UUID REFERENCES auth.users(id),
  resolved_at           TIMESTAMPTZ,

  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wq_type_status     ON workqueue_items(queue_type, status);
CREATE INDEX idx_wq_assigned_status ON workqueue_items(assigned_to, status);
CREATE INDEX idx_wq_carc_status     ON workqueue_items(carc_code, status);
CREATE INDEX idx_wq_aging_status    ON workqueue_items(aging_bucket, status);
CREATE INDEX idx_wq_defer           ON workqueue_items(defer_until) WHERE defer_until IS NOT NULL;
CREATE INDEX idx_wq_priority        ON workqueue_items(priority, status);
CREATE INDEX idx_wq_client          ON workqueue_items(client_id, status);
CREATE INDEX idx_wq_claim           ON workqueue_items(claim_id);

SELECT attach_updated_at('workqueue_items');
ALTER TABLE workqueue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wq_billing_staff" ON workqueue_items
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE workqueue_items IS
  'Unified CARC/RARC and aging work queue. queue_type routes to the '
  'correct workflow. defer_until suspends the item. smart_phrase_comment '
  'captures the structured action note.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 21: smart_phrases
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Library of reusable text templates (Smart Phrases) that
--   billing staff can insert into work queue notes, claim status
--   comments, denial records, and appeal letters using a keyword
--   trigger (e.g. ".co45" expands to the full contractual
--   adjustment note). Phrases can be scoped to specific CARC
--   codes and operational contexts.
--
-- Key Fields:
--   phrase_key          Trigger shortcut, e.g. ".co45", ".auth-exp"
--   phrase_title        Short display name for the phrase picker
--   phrase_text         Full expansion text
--   category            Denial | Appeal | Patient Contact |
--                       Payer Contact | Authorization | General
--   applicable_carc_codes  CARC codes this phrase is optimized for
--   applicable_contexts    Where the phrase can be used:
--                          workqueue | claim_status | denial |
--                          appeal | statement | general
--   is_active           Soft-disable without deletion
--
-- Recommended Indexes:
--   (phrase_key)          — trigger lookup (unique)
--   (category)            — category picker
--   (is_active)           — active-only query
--   (applicable_carc_codes) GIN  — CARC-to-phrase lookup
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS smart_phrases (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase_key              TEXT NOT NULL UNIQUE,   -- .co45 / .auth-exp / .timely

  -- Content
  phrase_title            TEXT NOT NULL,
  phrase_text             TEXT NOT NULL,
  category                TEXT NOT NULL DEFAULT 'General'
                            CHECK (category IN (
                              'Denial','Appeal','Patient Contact',
                              'Payer Contact','Authorization','General'
                            )),

  -- Scope
  applicable_carc_codes   TEXT[] DEFAULT '{}',
  applicable_contexts     TEXT[] DEFAULT '{general}',

  -- Metadata
  usage_count             INTEGER DEFAULT 0,
  is_active               BOOLEAN DEFAULT TRUE,
  is_system_phrase        BOOLEAN DEFAULT FALSE,  -- system defaults; not deletable

  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_sp_key       ON smart_phrases(phrase_key);
CREATE INDEX        idx_sp_category  ON smart_phrases(category);
CREATE INDEX        idx_sp_active    ON smart_phrases(is_active);
CREATE INDEX        idx_sp_carc      ON smart_phrases USING gin(applicable_carc_codes);

SELECT attach_updated_at('smart_phrases');
ALTER TABLE smart_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_read_all" ON smart_phrases
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "sp_write_admin" ON smart_phrases
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','super_admin'));

COMMENT ON TABLE smart_phrases IS
  'Smart phrase library. phrase_key is the expansion trigger. '
  'GIN index on applicable_carc_codes enables CARC-to-phrase lookup '
  'in the denial work queue.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 22: eligibility_checks
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Records 270/271 eligibility verification results scoped
--   strictly to Service Type Code 98 (Mental Health / Behavioral
--   Health). Only service type 98 is queried to match Colorado
--   Medicaid BH billing requirements. Full raw X12 271 or API
--   JSON response is stored for audit. Structured benefit fields
--   capture the actionable values without parsing raw text again.
--
-- Key Fields:
--   service_type_code   Always '98' — Behavioral Health only
--   service_type_name   Always 'Mental Health' / 'Behavioral Health'
--   status              Active | Inactive | Pending | Error | Not Found
--   eligibility_begin/end  Coverage dates from 271 EB03/EB04
--   deductible_individual  Individual deductible (in-network)
--   deductible_met_individual  Amount already met
--   copay               Copay amount
--   coinsurance_pct     Coinsurance percentage
--   prior_auth_required  True if payer requires PA for BH services
--   referral_required    True if referral required
--   network_status      In Network | Out of Network | Unknown
--   raw_response        X12 271 or JSON payload from eligibility API
--   office_ally_transaction_id  Office Ally 270/271 transaction ref
--
-- Foreign Keys:
--   patient_id  → patient_records(id)
--   client_id   → clinician_accounts(id)
--   checked_by  → auth.users(id)
--
-- Recommended Indexes:
--   (patient_id, check_date DESC)   — latest eligibility per patient
--   (patient_id, dos)               — date-of-service eligibility
--   (status)                        — error / inactive queue
--   (prior_auth_required, status)   — PA required reporting
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eligibility_checks (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  patient_id                  TEXT NOT NULL REFERENCES patient_records(id),
  client_id                   TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Check context
  check_date                  DATE NOT NULL DEFAULT current_date,
  dos                         DATE,         -- date of service this check covers
  payer                       TEXT,
  payer_id                    TEXT,         -- payer NPI or Medicaid ID
  member_id                   TEXT,

  -- Service Type (ALWAYS 98 for BH-only platform)
  service_type_code           TEXT NOT NULL DEFAULT '98'
                                CHECK (service_type_code = '98'),
  service_type_name           TEXT NOT NULL DEFAULT 'Mental Health',

  -- Coverage status
  status                      TEXT NOT NULL DEFAULT 'Active'
                                CHECK (status IN (
                                  'Active','Inactive','Pending',
                                  'Error','Not Found'
                                )),
  eligibility_begin           DATE,
  eligibility_end             DATE,
  coverage_notes              TEXT,

  -- Deductible (individual in-network)
  deductible_individual       NUMERIC(12,2),
  deductible_family           NUMERIC(12,2),
  deductible_met_individual   NUMERIC(12,2),
  deductible_met_family       NUMERIC(12,2),

  -- Out-of-pocket
  oop_individual              NUMERIC(12,2),
  oop_family                  NUMERIC(12,2),
  oop_met_individual          NUMERIC(12,2),
  oop_met_family              NUMERIC(12,2),

  -- Cost-share (BH service type 98)
  copay                       NUMERIC(12,2),
  coinsurance_pct             NUMERIC(5,2),   -- e.g. 20.00 = 20%
  limitations                 TEXT,           -- visit limits, hour limits

  -- Auth / referral flags
  prior_auth_required         BOOLEAN DEFAULT FALSE,
  referral_required           BOOLEAN DEFAULT FALSE,

  -- Network
  network_status              TEXT DEFAULT 'Unknown'
                                CHECK (network_status IN (
                                  'In Network','Out of Network','Unknown'
                                )),

  -- Raw response
  raw_response                JSONB,    -- full X12 271 parsed JSON or API payload
  error_message               TEXT,     -- if status='Error'

  -- Clearinghouse
  office_ally_transaction_id  TEXT,

  checked_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ec_patient_date   ON eligibility_checks(patient_id, check_date DESC);
CREATE INDEX idx_ec_patient_dos    ON eligibility_checks(patient_id, dos);
CREATE INDEX idx_ec_status         ON eligibility_checks(status);
CREATE INDEX idx_ec_pa_required    ON eligibility_checks(prior_auth_required, status);
CREATE INDEX idx_ec_oa_ref         ON eligibility_checks(office_ally_transaction_id);

ALTER TABLE eligibility_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_clinician_own" ON eligibility_checks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patient_records pr
      WHERE pr.id = patient_id
        AND (pr.client_id = (
              SELECT client_id FROM clinician_accounts WHERE id = client_id LIMIT 1
             )
             OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
    )
  );

COMMENT ON TABLE eligibility_checks IS
  'Eligibility verification results. service_type_code is CHECK-constrained '
  'to 98 (Behavioral Health only). raw_response stores the full 271 payload. '
  'prior_auth_required drives PA work queue creation.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 23: office_ally_transactions
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Audit log for all Office Ally clearinghouse interactions:
--   claim submissions, claim status requests (276/277), eligibility
--   requests (270/271), and ERA downloads (835). One row per
--   transaction attempt. Tracks request and response payloads
--   for debugging and retry logic. Links to the internal object
--   (claim, ERA, eligibility check) for traceability.
--
-- Key Fields:
--   transaction_type    Claim Submission | Status Request |
--                       Eligibility Request | ERA Download | Batch
--   oa_transaction_id   Office Ally's transaction/control number
--   oa_batch_id         Batch ID (for multi-claim submissions)
--   status              Pending | Sent | Accepted | Rejected | Error
--   request_payload     JSON of outbound data sent
--   response_payload    JSON of inbound response received
--   error_code          Office Ally error code if rejected
--   retry_count         Number of retry attempts
--
-- Foreign Keys:
--   claim_id     → claims(id)
--   era_id       → eras(id)
--   patient_id   → patient_records(id)
--   client_id    → clinician_accounts(id)
--   created_by   → auth.users(id)
--
-- Recommended Indexes:
--   (client_id, transaction_type, sent_at DESC)  — client transactions
--   (claim_id)                                   — claim submission log
--   (oa_transaction_id)                          — OA reference lookup
--   (status) WHERE status IN ('Pending','Error')  — retry queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS office_ally_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  transaction_type      TEXT NOT NULL
                          CHECK (transaction_type IN (
                            'Claim Submission','Status Request',
                            'Eligibility Request','ERA Download','Batch'
                          )),

  -- Office Ally references
  oa_transaction_id     TEXT UNIQUE,
  oa_batch_id           TEXT,

  -- Linked objects
  claim_id              UUID REFERENCES claims(id),
  era_id                UUID REFERENCES eras(id),
  patient_id            TEXT REFERENCES patient_records(id),
  client_id             TEXT NOT NULL REFERENCES clinician_accounts(id),

  -- Status lifecycle
  status                TEXT NOT NULL DEFAULT 'Pending'
                          CHECK (status IN (
                            'Pending','Sent','Accepted','Rejected','Error'
                          )),

  -- Payloads
  request_payload       JSONB,
  response_payload      JSONB,

  -- Error detail
  error_code            TEXT,
  error_message         TEXT,
  retry_count           INTEGER DEFAULT 0,
  last_retry_at         TIMESTAMPTZ,

  -- Timestamps
  sent_at               TIMESTAMPTZ,
  acknowledged_at       TIMESTAMPTZ,

  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_oat_client_type  ON office_ally_transactions(client_id, transaction_type, sent_at DESC);
CREATE INDEX idx_oat_claim        ON office_ally_transactions(claim_id);
CREATE INDEX idx_oat_era          ON office_ally_transactions(era_id);
CREATE INDEX idx_oat_oa_id        ON office_ally_transactions(oa_transaction_id);
CREATE INDEX idx_oat_retry        ON office_ally_transactions(status)
  WHERE status IN ('Pending','Error');

ALTER TABLE office_ally_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oat_billing_staff" ON office_ally_transactions
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE office_ally_transactions IS
  'Office Ally clearinghouse audit log. Covers claim submissions, '
  '270/271 eligibility, 276/277 status requests, and ERA downloads. '
  'Partial retry index on Pending/Error enables automated retry queue.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 24: coding_reports
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Stores the finalized coding report generated at the end of a
--   coding session. One row per session (1-to-1). Captures the
--   full structured output including code details, audit summary,
--   medical necessity guidance, required documentation, and
--   estimated revenue — matching the data shape displayed in
--   saved-reports.html.
--
-- Key Fields:
--   report_title          Display label (e.g. "H0031 — John D., 04/06/2026")
--   status                draft | final | archived
--   audit_summary         Plain-text or structured Q&A summary of answers
--   code_details          JSONB array: [{code, title, confidence, explanation,
--                           revenue, medicalNecessityStandard,
--                           requiredDocumentation[], commonDeficiencies[],
--                           suggestedDocumentationLanguage, legalCitations[]}]
--   total_estimated_revenue  Rolled-up revenue estimate across all codes
--   generated_at          When the engine produced this report
--   finalized_at          When clinician marked it final
--   exported_at           Last PDF/print export timestamp
--   export_count          Number of times exported
--
-- Foreign Keys:
--   session_id   → coding_sessions(id)
--   patient_id   → patient_records(id)
--   client_id    → clinician_accounts(id)
--   clinician_id → auth.users(id)
--
-- Relationships:
--   1-to-1   → coding_sessions
--   1-to-many → coding_comments
--
-- Recommended Indexes:
--   (session_id)                  — report lookup by session
--   (client_id, generated_at DESC) — clinician report list
--   (patient_id, generated_at DESC) — patient report history
--   (status)                       — draft vs. final filtering
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coding_reports (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  session_id               UUID NOT NULL UNIQUE REFERENCES coding_sessions(id) ON DELETE CASCADE,
  patient_id               TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,
  client_id                TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,
  clinician_id             UUID NOT NULL REFERENCES auth.users(id),

  -- Identity
  report_title             TEXT,            -- e.g. "H0031 – Jane Doe, 04/06/2026"
  workflow_path            TEXT,            -- denormalized from coding_sessions

  -- Status
  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','final','archived')),
  finalized_at             TIMESTAMPTZ,
  finalized_by             UUID REFERENCES auth.users(id),
  archived_at              TIMESTAMPTZ,

  -- Report content
  audit_summary            TEXT,            -- structured Q&A text or legacy plain-text
  code_details             JSONB,           -- [{code, title, confidence, explanation,
                                            --   revenue, medicalNecessityStandard,
                                            --   requiredDocumentation, commonDeficiencies,
                                            --   suggestedDocumentationLanguage, legalCitations}]
  total_estimated_revenue  NUMERIC(12,2),   -- rolled-up across all code_details entries

  -- Engine metadata
  engine_version           TEXT,            -- version tag for audit/reproducibility
  trigger_rules_snapshot   JSONB,           -- copy of rules that fired at generation time
  generated_at             TIMESTAMPTZ DEFAULT now(),

  -- Export tracking
  exported_at              TIMESTAMPTZ,
  export_count             INTEGER DEFAULT 0,

  created_by               UUID REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crep_session    ON coding_reports(session_id);
CREATE INDEX idx_crep_client     ON coding_reports(client_id, generated_at DESC);
CREATE INDEX idx_crep_patient    ON coding_reports(patient_id, generated_at DESC);
CREATE INDEX idx_crep_status     ON coding_reports(status);
CREATE INDEX idx_crep_clinician  ON coding_reports(clinician_id);

SELECT attach_updated_at('coding_reports');
ALTER TABLE coding_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crep_clinician_own" ON coding_reports
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (clinician_id = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE coding_reports IS
  'Finalized coding report per session. code_details JSONB mirrors the '
  'saved-reports.html display shape: code cards with confidence, revenue '
  'estimate, medical necessity standard, required documentation, common '
  'deficiencies, suggested language, and regulatory citations.';


-- ══════════════════════════════════════════════════════════════
-- TABLE 25: coding_comments
-- ══════════════════════════════════════════════════════════════
--
-- Purpose:
--   Threaded clinician and reviewer comments attached to a coding
--   session or coding report. Supports internal QA notes,
--   supervisor feedback, billing staff clarifications, and
--   dispute flags. Soft-delete via deleted_at preserves audit trail.
--
-- Key Fields:
--   parent_id         Self-reference for threaded replies (null = top-level)
--   comment_type      note | question | flag | approval | dispute
--   body              Comment text
--   is_internal       True = visible only to billing_staff/admin;
--                     False = visible to rendering clinician
--   is_resolved       Marks a flag/question as addressed
--   resolved_by       Who resolved the comment
--   resolved_at       When it was resolved
--   deleted_at        Soft-delete timestamp (null = active)
--
-- Foreign Keys:
--   session_id  → coding_sessions(id)
--   report_id   → coding_reports(id)   (nullable — comment may exist before report)
--   parent_id   → coding_comments(id)  (self-reference for threading)
--   created_by  → auth.users(id)
--
-- Relationships:
--   many-to-1 → coding_sessions
--   many-to-1 → coding_reports
--   1-to-many → coding_comments (thread replies via parent_id)
--
-- Recommended Indexes:
--   (session_id, created_at)   — comments for a session in order
--   (report_id, created_at)    — comments for a report in order
--   (parent_id)                — thread reply lookups
--   (is_resolved, comment_type) — open flag/question queue
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coding_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  session_id        UUID NOT NULL REFERENCES coding_sessions(id) ON DELETE CASCADE,
  report_id         UUID REFERENCES coding_reports(id) ON DELETE SET NULL,
  parent_id         UUID REFERENCES coding_comments(id) ON DELETE CASCADE,

  -- Content
  comment_type      TEXT NOT NULL DEFAULT 'note'
                      CHECK (comment_type IN (
                        'note','question','flag','approval','dispute'
                      )),
  body              TEXT NOT NULL,

  -- Visibility & resolution
  is_internal       BOOLEAN NOT NULL DEFAULT FALSE,
  is_resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by       UUID REFERENCES auth.users(id),
  resolved_at       TIMESTAMPTZ,
  resolution_note   TEXT,

  -- Soft delete
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES auth.users(id),

  created_by        UUID NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cc_session      ON coding_comments(session_id, created_at);
CREATE INDEX idx_cc_report       ON coding_comments(report_id, created_at);
CREATE INDEX idx_cc_parent       ON coding_comments(parent_id);
CREATE INDEX idx_cc_open_flags   ON coding_comments(is_resolved, comment_type)
  WHERE deleted_at IS NULL;

SELECT attach_updated_at('coding_comments');
ALTER TABLE coding_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_clinician_own" ON coding_comments
  FOR SELECT TO authenticated
  USING (
    (is_internal = FALSE AND EXISTS (
      SELECT 1 FROM coding_sessions cs
      WHERE cs.id = session_id AND cs.clinician_id = auth.uid()
    ))
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin')
  );

CREATE POLICY "cc_write_own" ON coding_comments
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "cc_update_own" ON coding_comments
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (created_by = auth.uid()
    OR auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE coding_comments IS
  'Threaded comments on coding sessions and reports. Supports QA notes, '
  'supervisor feedback, billing flags, and dispute tracking. '
  'is_internal restricts visibility to billing staff and admins. '
  'Soft-delete (deleted_at) preserves full audit trail.';


-- ══════════════════════════════════════════════════════════════
-- LATE-BINDING FOREIGN KEY CONSTRAINTS
-- (needed after all tables exist)
-- ══════════════════════════════════════════════════════════════

-- coding_sessions.claim_id → claims
ALTER TABLE coding_sessions
  ADD CONSTRAINT fk_cs_claim
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL;

-- coding_sessions.note_id → progress_notes (cross-schema soft ref;
--   add only if clinical-documentation-schema.sql is applied first)
-- ALTER TABLE coding_sessions
--   ADD CONSTRAINT fk_cs_note
--   FOREIGN KEY (note_id) REFERENCES progress_notes(id) ON DELETE SET NULL;

-- coding_sessions.assessment_id → assessments
-- ALTER TABLE coding_sessions
--   ADD CONSTRAINT fk_cs_assessment
--   FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL;

-- claims.prior_auth_id → prior_authorizations
ALTER TABLE claims
  ADD CONSTRAINT fk_claim_prior_auth
  FOREIGN KEY (prior_auth_id) REFERENCES prior_authorizations(id) ON DELETE SET NULL;

-- claims.referral_id → referrals
ALTER TABLE claims
  ADD CONSTRAINT fk_claim_referral
  FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE SET NULL;

-- patient_balances.last_statement_id → statements
ALTER TABLE patient_balances
  ADD CONSTRAINT fk_pb_statement
  FOREIGN KEY (last_statement_id) REFERENCES statements(id) ON DELETE SET NULL;

-- denials.workqueue_id → workqueue_items
ALTER TABLE denials
  ADD CONSTRAINT fk_denial_workqueue
  FOREIGN KEY (workqueue_id) REFERENCES workqueue_items(id) ON DELETE SET NULL;


-- ══════════════════════════════════════════════════════════════
-- VIEWS
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- v_aging_summary
--   Patient AR aging totals by client, aging bucket, and status.
--   Used for the AR Aging dashboard widget.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_aging_summary AS
SELECT
  pb.client_id,
  pb.aging_bucket,
  pb.balance_type,
  COUNT(*) AS balance_count,
  SUM(pb.balance_amount) AS total_balance
FROM patient_balances pb
WHERE pb.status NOT IN ('Paid','Writeoff','Collections')
GROUP BY pb.client_id, pb.aging_bucket, pb.balance_type;

COMMENT ON VIEW v_aging_summary IS
  'AR aging totals by client and bucket. Used for dashboard widget.';


-- ──────────────────────────────────────────────────────────
-- v_carc_frequency
--   CARC code frequency across denials and ERA line items.
--   Used for denial trending and smart phrase recommendations.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_carc_frequency AS
SELECT
  d.client_id,
  d.carc_code,
  d.payer,
  COUNT(*) AS denial_count,
  SUM(d.denied_amount) AS total_denied,
  MAX(d.created_at) AS last_occurrence
FROM denials d
WHERE d.carc_code IS NOT NULL
GROUP BY d.client_id, d.carc_code, d.payer;

COMMENT ON VIEW v_carc_frequency IS
  'CARC code frequency per client and payer. '
  'Powers denial trending reports and smart phrase suggestions.';


-- ──────────────────────────────────────────────────────────
-- v_denial_work_queue
--   Open denials enriched with CARC description placeholders,
--   smart phrase matches, and aging days. Used by the billing
--   staff CARC/RARC work queue panel.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_denial_work_queue AS
SELECT
  d.id              AS denial_id,
  d.denial_number,
  d.client_id,
  d.claim_id,
  d.carc_code,
  d.rarc_code,
  d.denial_type,
  d.payer,
  d.denial_reason,
  d.billed_amount,
  d.denied_amount,
  d.status          AS denial_status,
  d.defer_until,
  d.defer_reason,
  d.smart_phrase_comment,
  d.assigned_to,
  d.assigned_to_name,
  d.denial_date,
  (current_date - d.denial_date) AS aging_days,
  wq.status         AS workqueue_status,
  wq.priority       AS workqueue_priority,
  sp.phrase_title   AS suggested_phrase_title,
  sp.phrase_text    AS suggested_phrase_text
FROM denials d
LEFT JOIN workqueue_items wq ON wq.id = d.workqueue_id
LEFT JOIN LATERAL (
  SELECT sp.phrase_title, sp.phrase_text
  FROM smart_phrases sp
  WHERE d.carc_code = ANY(sp.applicable_carc_codes)
    AND sp.is_active = TRUE
  ORDER BY sp.usage_count DESC
  LIMIT 1
) sp ON true
WHERE d.status IN ('Open','In Review');

COMMENT ON VIEW v_denial_work_queue IS
  'Open denial queue with CARC/RARC context, aging days, '
  'work queue status, and top matched smart phrase suggestion.';


-- ──────────────────────────────────────────────────────────
-- v_auth_expiring
--   Prior auths expiring within 30 days with remaining units.
--   Used for expiration alert work queue.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_auth_expiring AS
SELECT
  pa.id,
  pa.auth_request_number,
  pa.client_id,
  pa.patient_id,
  pa.payer,
  pa.auth_number,
  pa.auth_type,
  pa.service_code,
  pa.service_start,
  pa.service_end,
  pa.approved_units,
  pa.used_units,
  pa.remaining_units,
  pa.status,
  (pa.service_end - current_date) AS days_remaining
FROM prior_authorizations pa
WHERE pa.status = 'Approved'
  AND pa.service_end IS NOT NULL
  AND pa.service_end BETWEEN current_date AND (current_date + INTERVAL '30 days');

COMMENT ON VIEW v_auth_expiring IS
  'Prior auths expiring in 30 days. Drives expiration alert '
  'work queue and clinician notification panel.';
