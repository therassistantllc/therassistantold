-- ============================================================
-- THERASSISTANT ERA / Payment Tracking Database Schema
-- ASC X12 5010 835 Electronic Remittance Advice
-- Supabase / PostgreSQL
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- TABLE 1: era_imports
--   Master record per uploaded ERA / 835 file
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_imports (
  id                  TEXT PRIMARY KEY DEFAULT 'ERA-' || gen_random_uuid()::text,
  file_name           TEXT NOT NULL,
  file_size_bytes     INTEGER,
  payer_name          TEXT,
  payer_id            TEXT,
  payer_qualifier     TEXT,       -- NM1*PR qualifier
  payment_date        DATE,
  check_date          DATE,
  check_number        TEXT,
  eft_trace           TEXT,
  total_payment       NUMERIC(12,2) DEFAULT 0,
  total_adjustments   NUMERIC(12,2) DEFAULT 0,
  total_claims        INTEGER DEFAULT 0,
  matched_claims      INTEGER DEFAULT 0,
  unmatched_claims    INTEGER DEFAULT 0,
  denial_count        INTEGER DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending','Processing','Complete','Partial','Error','Archived')),
  parse_errors        INTEGER DEFAULT 0,
  raw_text            TEXT,       -- full 835 X12 text for reprocessing
  imported_by         UUID REFERENCES auth.users(id),
  imported_at         TIMESTAMPTZ DEFAULT now(),
  archived_at         TIMESTAMPTZ,
  reprocessed_at      TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE era_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_era_imports" ON era_imports
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));


-- ──────────────────────────────────────────────────────────
-- TABLE 2: era_claims
--   One row per CLP segment parsed from an ERA file
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_claims (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_import_id       TEXT NOT NULL REFERENCES era_imports(id) ON DELETE CASCADE,

  -- CLP segment fields
  claim_number        TEXT NOT NULL,       -- CLP01 — submitter claim control number
  claim_status        TEXT,                -- CLP02 decoded: Processed/Denied/Reversed
  billed_amount       NUMERIC(12,2),       -- CLP03
  paid_amount         NUMERIC(12,2),       -- CLP04
  patient_resp        NUMERIC(12,2),       -- CLP05 patient responsibility
  claim_filing_ind    TEXT,                -- CLP06 CI/MC/etc
  payer_claim_num     TEXT,                -- CLP07 payer's ICN / claim reference

  -- Patient / subscriber info (NM1*QC / NM1*IL loops)
  patient_name        TEXT,
  subscriber_id       TEXT,
  subscriber_name     TEXT,
  patient_account_num TEXT,

  -- Provider info (NM1*82 / NM1*85 loops)
  rendering_name      TEXT,
  rendering_npi       TEXT,
  billing_name        TEXT,
  billing_npi         TEXT,

  -- Dates (DTM segments)
  dos                 DATE,
  service_start       DATE,
  service_end         DATE,
  claim_paid_date     DATE,
  claim_received_date DATE,

  -- Code-level summary
  primary_service_code TEXT,   -- first SVC service code
  carc_codes          TEXT[],  -- array of CARC codes on claim
  rarc_codes          TEXT[],  -- array of RARC codes on claim
  denial_reason       TEXT,    -- human-readable denial description

  -- Posting status
  posting_status      TEXT NOT NULL DEFAULT 'Pending'
                        CHECK (posting_status IN ('Pending','Posted','Partially Posted','Denied','Unmatched','On Hold','On Appeal','Recoupment')),
  posted_amount       NUMERIC(12,2),
  posted_date         DATE,
  posted_by           UUID REFERENCES auth.users(id),

  -- Matching
  matched             BOOLEAN DEFAULT FALSE,
  linked_patient_id   TEXT,    -- FK to patient_records if matched
  linked_client_id    TEXT,    -- FK to clinician_accounts if matched
  linked_claim_id     UUID,    -- FK to an internal claims table
  match_method        TEXT,    -- 'subscriber_id'|'patient_name'|'claim_number'|'manual'

  -- Meta
  notes               TEXT,
  alert_created       BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_era_claims_import     ON era_claims(era_import_id);
CREATE INDEX idx_era_claims_number     ON era_claims(claim_number);
CREATE INDEX idx_era_claims_patient    ON era_claims(linked_patient_id);
CREATE INDEX idx_era_claims_status     ON era_claims(posting_status);

ALTER TABLE era_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_era_claims" ON era_claims
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));


-- ──────────────────────────────────────────────────────────
-- TABLE 3: era_service_lines
--   One row per SVC segment (line-level detail within a claim)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_service_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_claim_id     UUID NOT NULL REFERENCES era_claims(id) ON DELETE CASCADE,
  era_import_id    TEXT NOT NULL,

  -- SVC segment
  service_qualifier TEXT,   -- HC, WK, etc
  service_code      TEXT NOT NULL,   -- CPT / HCPCS
  service_modifier  TEXT,
  billed_amount     NUMERIC(12,2),
  paid_amount       NUMERIC(12,2),
  units             INTEGER DEFAULT 1,

  -- Revenue codes / NDC / compound
  revenue_code      TEXT,
  ndc_code          TEXT,

  -- SVC dates (DTM within SVC loop)
  dos               DATE,

  -- Adjustments on this line (CAS within SVC loop)
  carc_codes        TEXT[],
  rarc_codes        TEXT[],
  adjustment_amount NUMERIC(12,2) DEFAULT 0,

  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_svc_lines_claim ON era_service_lines(era_claim_id);

ALTER TABLE era_service_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_svc_lines" ON era_service_lines
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));


-- ──────────────────────────────────────────────────────────
-- TABLE 4: era_adjustments
--   One row per CAS element group per claim or service line
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_adjustments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_claim_id     UUID NOT NULL REFERENCES era_claims(id) ON DELETE CASCADE,
  era_service_id   UUID REFERENCES era_service_lines(id) ON DELETE SET NULL,
  era_import_id    TEXT NOT NULL,

  -- CAS fields
  adjustment_group TEXT NOT NULL  -- CO, PR, OA, PI, CR
                    CHECK (adjustment_group IN ('CO','PR','OA','PI','CR')),
  carc_code        TEXT NOT NULL,  -- Claim Adjustment Reason Code
  adjustment_amount NUMERIC(12,2) NOT NULL,
  units            INTEGER,

  -- Lookup fields
  carc_description  TEXT,
  group_description TEXT,

  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_era_adj_claim ON era_adjustments(era_claim_id);
CREATE INDEX idx_era_adj_carc  ON era_adjustments(carc_code);

ALTER TABLE era_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_era_adj" ON era_adjustments
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));


-- ──────────────────────────────────────────────────────────
-- TABLE 5: era_denials
--   Materialized denial records for quick reporting
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_denials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_claim_id     UUID NOT NULL REFERENCES era_claims(id) ON DELETE CASCADE,
  era_import_id    TEXT NOT NULL,

  claim_number     TEXT,
  patient_name     TEXT,
  subscriber_id    TEXT,
  dos              DATE,
  service_code     TEXT,
  billed_amount    NUMERIC(12,2),
  paid_amount      NUMERIC(12,2) DEFAULT 0,
  payer_name       TEXT,

  -- Denial detail
  primary_carc     TEXT,        -- primary CARC code
  carc_codes       TEXT[],
  rarc_codes       TEXT[],
  denial_reason    TEXT,        -- human-readable
  appeal_deadline  DATE,        -- DOS + 180 days typically

  -- Resolution
  status           TEXT DEFAULT 'Open'
                    CHECK (status IN ('Open','Appealed','Resolved','Accepted','Written Off')),
  appeal_date      DATE,
  appeal_note      TEXT,
  resolved_by      UUID REFERENCES auth.users(id),
  resolved_at      TIMESTAMPTZ,

  -- Linking
  linked_patient_id TEXT,
  linked_client_id  TEXT,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_era_denials_import ON era_denials(era_import_id);
CREATE INDEX idx_era_denials_status ON era_denials(status);
CREATE INDEX idx_era_denials_carc   ON era_denials USING GIN (carc_codes);

ALTER TABLE era_denials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_era_denials" ON era_denials
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));


-- ──────────────────────────────────────────────────────────
-- TABLE 6: era_unmatched_claims
--   Unmatched claims pending manual review and linking
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_unmatched_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_claim_id     UUID NOT NULL REFERENCES era_claims(id) ON DELETE CASCADE,
  era_import_id    TEXT NOT NULL,

  claim_number     TEXT,
  patient_name     TEXT,
  subscriber_id    TEXT,
  dos              DATE,
  service_code     TEXT,
  paid_amount      NUMERIC(12,2),
  payer_name       TEXT,
  rendering_npi    TEXT,
  unmatch_reason   TEXT,        -- 'no_subscriber_match'|'no_name_match'|'ambiguous_match'

  -- Resolution
  resolved         BOOLEAN DEFAULT FALSE,
  linked_patient_id TEXT,
  linked_client_id  TEXT,
  linked_by        UUID REFERENCES auth.users(id),
  linked_at        TIMESTAMPTZ,
  link_note        TEXT,

  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE era_unmatched_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_unmatched" ON era_unmatched_claims
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));


-- ──────────────────────────────────────────────────────────
-- TABLE 7: era_parse_errors
--   Segment-level parse errors for debugging
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_parse_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_import_id   TEXT NOT NULL REFERENCES era_imports(id) ON DELETE CASCADE,

  segment_id      TEXT,         -- e.g. 'ISA', 'GS', 'CLP'
  segment_index   INTEGER,      -- position in file
  raw_segment     TEXT,         -- first 200 chars of the raw segment
  error_message   TEXT NOT NULL,
  severity        TEXT DEFAULT 'Error'
                    CHECK (severity IN ('Error','Warning','Info')),

  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parse_errors_import ON era_parse_errors(era_import_id);

ALTER TABLE era_parse_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_parse_errors" ON era_parse_errors
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));


-- ──────────────────────────────────────────────────────────
-- TABLE 8: carc_codes
--   CARC code reference library
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carc_codes (
  code              TEXT PRIMARY KEY,
  description       TEXT NOT NULL,
  adjustment_group  TEXT,        -- CO, PR, OA, PI
  typical_cause     TEXT,
  recommended_action TEXT,
  appeal_strategy   TEXT,
  is_appealable     BOOLEAN DEFAULT TRUE,
  is_active         BOOLEAN DEFAULT TRUE,

  -- Usage stats (denormalized counts updated by trigger/function)
  usage_count       INTEGER DEFAULT 0,
  total_dollar_impact NUMERIC(14,2) DEFAULT 0,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

INSERT INTO carc_codes (code, description, adjustment_group, typical_cause, recommended_action, is_appealable) VALUES
  ('1',  'Deductible amount',                               'PR', 'Patient deductible not met',         'Bill patient or secondary insurance',                  FALSE),
  ('2',  'Coinsurance amount',                              'PR', 'Patient coinsurance portion owed',    'Bill patient the coinsurance amount',                  FALSE),
  ('3',  'Co-payment amount',                               'PR', 'Plan requires copay for service',     'Collect copay from patient at point of service',       FALSE),
  ('4',  'Service not covered',                             'CO', 'Benefit not in member plan',          'Verify benefits; appeal with clinical justification',  TRUE),
  ('18', 'Duplicate claim',                                 'CO', 'Service billed more than once',       'Remove duplicate; resubmit if original claim exists',  TRUE),
  ('22', 'Not medically necessary per LCD/NCD',             'CO', 'Clinical criteria not met',           'Submit medical necessity documentation',               TRUE),
  ('27', 'Expenses after coverage termination',             'CO', 'Service after plan end date',         'Verify eligibility on DOS',                            TRUE),
  ('29', 'Timely filing limit exceeded',                    'CO', 'Claim past filing deadline',          'Submit timely filing exception with proof',            TRUE),
  ('45', 'Charge exceeds fee schedule',                     'CO', 'Billed > contracted allowed amount',  'Write off — contractual obligation, not billable',     FALSE),
  ('50', 'Non-covered by payer',                            'CO', 'Service excluded from plan',          'Bill secondary or patient; verify plan document',      TRUE),
  ('96', 'Non-covered charges',                             'CO', 'Procedure excluded from benefit',     'Bill patient if allowable; verify plan',               TRUE),
  ('97', 'Payment included in another adjustment',          'CO', 'Bundled into another service',        'Review CCI edits; appeal if separately billable',      TRUE),
  ('B7', 'Unauthorized service',                            'CO', 'Prior auth not obtained',             'Submit retro-auth or appeal with clinical need',       TRUE),
  ('B8', 'Not covered per managed care agreement',          'CO', 'Out-of-network or plan exclusion',    'Verify contract; appeal if in-network per agreement',  TRUE)
ON CONFLICT (code) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- TABLE 9: rarc_codes
--   RARC code reference library
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rarc_codes (
  code              TEXT PRIMARY KEY,
  description       TEXT NOT NULL,
  recommended_action TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT now()
);

INSERT INTO rarc_codes (code, description, recommended_action) VALUES
  ('N290',  'Missing/invalid claim submission reason code',         'Resubmit with correct reason code'),
  ('MA130', 'Claim lacks required data — see remittance',           'Submit corrected claim with all required fields'),
  ('N20',   'Service not separately reimbursable',                  'Review CCI edits; appeal if separate necessity documented'),
  ('M51',   'Missing/incomplete/invalid procedure code',            'Correct CPT/HCPCS and resubmit'),
  ('N115',  'Decision based on Local Coverage Determination (LCD)', 'Review LCD; submit supporting clinical documentation'),
  ('MA04',  'Secondary payment not made — liability transferred',   'Bill patient as primary for remaining balance'),
  ('M97',   'Not covered at this time of service',                  'Confirm eligibility on DOS and re-bill if valid'),
  ('N19',   'Procedure code incidental to primary procedure',       'Verify CCI edits; unbundle with modifier if applicable'),
  ('MA01',  'Alert: Alert if MR in effect — send records',          'Submit records to support medical necessity')
ON CONFLICT (code) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- TABLE 10: era_activity_log
--   Audit trail for all ERA import actions
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_import_id   TEXT REFERENCES era_imports(id) ON DELETE SET NULL,
  era_claim_id    UUID REFERENCES era_claims(id) ON DELETE SET NULL,

  action_type     TEXT NOT NULL,  -- 'imported'|'reprocessed'|'archived'|'claim_posted'|'claim_denied'|'linked'|'alert_created'|'appeal_filed'
  performed_by    UUID REFERENCES auth.users(id),
  performed_at    TIMESTAMPTZ DEFAULT now(),
  detail          TEXT,
  old_value       JSONB,
  new_value       JSONB,

  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_era_activity_import ON era_activity_log(era_import_id);
CREATE INDEX idx_era_activity_claim  ON era_activity_log(era_claim_id);
CREATE INDEX idx_era_activity_type   ON era_activity_log(action_type);

ALTER TABLE era_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_era_activity" ON era_activity_log
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));


-- ──────────────────────────────────────────────────────────
-- TRIGGER: update updated_at on era_imports
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_era_imports_updated_at
  BEFORE UPDATE ON era_imports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_era_claims_updated_at
  BEFORE UPDATE ON era_claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_era_denials_updated_at
  BEFORE UPDATE ON era_denials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ──────────────────────────────────────────────────────────
-- VIEW: era_claims_summary
--   Quick per-import stats for the import list page
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW era_claims_summary AS
SELECT
  ei.id AS era_import_id,
  ei.file_name,
  ei.payer_name,
  ei.payment_date,
  ei.check_number,
  ei.eft_trace,
  ei.total_payment,
  ei.status AS import_status,
  COUNT(ec.id)                                           AS total_claims,
  COUNT(ec.id) FILTER (WHERE ec.matched)                AS matched_claims,
  COUNT(ec.id) FILTER (WHERE NOT ec.matched)            AS unmatched_claims,
  COUNT(ec.id) FILTER (WHERE ec.posting_status='Posted') AS posted_claims,
  COUNT(ec.id) FILTER (WHERE ec.posting_status='Denied') AS denied_claims,
  SUM(ec.paid_amount)                                    AS sum_paid,
  SUM(ec.billed_amount - COALESCE(ec.paid_amount,0))     AS sum_adjustments
FROM era_imports ei
LEFT JOIN era_claims ec ON ec.era_import_id = ei.id
GROUP BY ei.id;


-- ──────────────────────────────────────────────────────────
-- VIEW: revenue_by_payer
--   Used by the Revenue Dashboard payer analysis tab
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW revenue_by_payer AS
SELECT
  ei.payer_name,
  COUNT(DISTINCT ei.id)                         AS era_files_count,
  COUNT(ec.id)                                  AS total_claims,
  SUM(ec.billed_amount)                         AS total_billed,
  SUM(ec.paid_amount)                           AS total_paid,
  SUM(ec.billed_amount - COALESCE(ec.paid_amount,0)) AS total_adjustments,
  COUNT(ec.id) FILTER (WHERE ec.posting_status='Denied') AS denial_count,
  ROUND(
    COUNT(ec.id) FILTER (WHERE ec.posting_status='Denied') * 100.0
    / NULLIF(COUNT(ec.id), 0), 1
  )                                              AS denial_rate_pct,
  ROUND(
    SUM(ec.paid_amount) * 100.0
    / NULLIF(SUM(ec.billed_amount), 0), 1
  )                                              AS collection_rate_pct
FROM era_imports ei
JOIN era_claims ec ON ec.era_import_id = ei.id
GROUP BY ei.payer_name
ORDER BY total_paid DESC;
