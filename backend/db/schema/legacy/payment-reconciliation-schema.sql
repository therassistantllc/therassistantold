-- ============================================================
-- THERASSISTANT Payment Reconciliation & OA Batch Schema
-- Run order: 8 — after claims-billing-schema.sql
--
-- New tables:
--   office_ally_batches        — Batch submission master (837P batch envelope)
--   office_ally_batch_claims   — Claim-to-batch junction
--   functional_ack_999         — Structured 999 functional acknowledgment
--   claim_status_277           — Structured 277CA claim status response
--   era_match_log              — ERA matching audit trail
--   insurance_balances         — Payer-level AR aging
--   payment_adjustments        — Standalone CO/PR/OA/PI/CR adjustments
--   payment_reconciliation     — ERA vs. bank deposit reconciliation
--   cob_payment_sequence       — Coordination of benefits payment order
--
-- Deferred FK upgrades:
--   claims.oa_batch_id         TEXT  →  UUID FK → office_ally_batches(id)
--   eras.office_ally_batch_id  TEXT  →  UUID FK → office_ally_batches(id)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- TABLE 1: office_ally_batches
--
-- Purpose:
--   Master record for each 837P batch envelope submitted to
--   Office Ally. One row per ISA/GS envelope. Tracks the full
--   lifecycle from Draft through 999 acknowledgment.
--
-- Key Fields:
--   batch_ref               Human-readable BATCH-xxx identifier
--   isa_control_number      ISA13 control number (9-digit, zero-padded)
--   gs_control_number       GS06 group control number
--   ta1_ack_code            TA1 interchange acknowledgment code (A/R/E)
--   ack_999_code            999 functional group ack code (A/R/P/E)
--   status                  Lifecycle: Draft→Submitted→Acknowledged→Accepted/Rejected
--   raw_837                 Full 837P X12 text for resubmission if needed
--
-- Foreign Keys:
--   clinician_id → clinician_accounts(id)
--   submitted_by → auth.users(id)
--
-- Relationships:
--   → office_ally_batch_claims  (batch_id)
--   → functional_ack_999        (batch_id)
--   → claim_status_277          (batch_id)
--   → office_ally_transactions  (oa_batch_id — TEXT join until FK migration)
--   ← claims                    (oa_batch_id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_ally_batches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref               TEXT UNIQUE NOT NULL DEFAULT 'BATCH-' || gen_random_uuid()::text,
  clinician_id            TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE RESTRICT,

  -- 837P ISA/GS envelope identifiers
  isa_control_number      TEXT,         -- ISA13 — 9-digit, zero-padded, must be unique per sender
  gs_control_number       TEXT,         -- GS06 — group control number
  submitter_id            TEXT,         -- ISA06 sender ID (OA-assigned submitter ID)
  receiver_id             TEXT DEFAULT 'OFFICEALLY',

  -- Batch metadata
  claim_count             INTEGER NOT NULL DEFAULT 0,
  total_billed            NUMERIC(12,2) NOT NULL DEFAULT 0,
  submission_type         TEXT NOT NULL DEFAULT 'Original'
                            CHECK (submission_type IN ('Original','Corrected','Void','Resubmission')),
  frequency_code          TEXT DEFAULT '1'
                            CHECK (frequency_code IN ('1','7','8')), -- 1=Original, 7=Replacement, 8=Void

  -- Lifecycle status
  status                  TEXT NOT NULL DEFAULT 'Draft'
                            CHECK (status IN (
                              'Draft','Ready','Submitted','Acknowledged',
                              'Accepted','Rejected','Partially Accepted','Voided'
                            )),
  submitted_at            TIMESTAMPTZ,
  acknowledged_at         TIMESTAMPTZ,
  accepted_at             TIMESTAMPTZ,

  -- TA1 interchange acknowledgment (received synchronously with 999)
  ta1_ack_code            TEXT          CHECK (ta1_ack_code IN ('A','R','E')),  -- A=Accepted, R=Rejected, E=Error
  ta1_ack_note            TEXT,
  ta1_received_at         TIMESTAMPTZ,

  -- 999 functional group acknowledgment
  ack_999_code            TEXT          CHECK (ack_999_code IN ('A','R','P','E')),  -- A=Accepted, R=Rejected, P=Partial, E=Error
  ack_999_note            TEXT,
  ack_999_received_at     TIMESTAMPTZ,
  accepted_transaction_count  INTEGER DEFAULT 0,
  rejected_transaction_count  INTEGER DEFAULT 0,

  -- Raw X12
  raw_837                 TEXT,         -- full 837P for resubmission; store encrypted if PII present
  raw_999                 TEXT,         -- full 999 X12 response
  raw_ta1                 TEXT,         -- full TA1 interchange response

  -- Audit
  submitted_by            UUID REFERENCES auth.users(id),
  voided_by               UUID REFERENCES auth.users(id),
  voided_at               TIMESTAMPTZ,
  void_reason             TEXT,
  notes                   TEXT,
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_oa_batches_clinician   ON office_ally_batches(clinician_id);
CREATE INDEX idx_oa_batches_status      ON office_ally_batches(status);
CREATE INDEX idx_oa_batches_isa         ON office_ally_batches(isa_control_number);
CREATE INDEX idx_oa_batches_submitted   ON office_ally_batches(submitted_at);

ALTER TABLE office_ally_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_oa_batches" ON office_ally_batches
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE office_ally_batches IS
  'Master record for each 837P batch envelope submitted to Office Ally. '
  'One row per ISA/GS envelope. Tracks TA1 interchange acknowledgment and '
  '999 functional acknowledgment. claim_count and total_billed are updated '
  'by trigger when office_ally_batch_claims rows are inserted or removed. '
  'raw_837 stores the full X12 text for resubmission.';


-- ──────────────────────────────────────────────────────────
-- TABLE 2: office_ally_batch_claims
--
-- Purpose:
--   Junction table linking individual claims to their batch
--   submission envelope. One row per claim per batch.
--   Tracks per-claim OA status after submission.
--
-- Key Fields:
--   sequence_number         837P claim order within the batch (ST segment)
--   oa_clm_control_number   OA-assigned claim control number returned in 999/277
--   submission_status       Per-claim status after OA processing
--
-- Foreign Keys:
--   batch_id  → office_ally_batches(id)
--   claim_id  → claims(id)
--
-- Unique constraint: one claim per batch (cannot submit same claim twice in same batch)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_ally_batch_claims (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                UUID NOT NULL REFERENCES office_ally_batches(id) ON DELETE CASCADE,
  claim_id                UUID NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
  sequence_number         INTEGER NOT NULL,   -- position within the 837P batch (1-based)

  -- OA-assigned identifiers
  oa_clm_control_number   TEXT,          -- OA claim control number (returned in 999 loop 2200)
  oa_transaction_set_id   TEXT,          -- ST02 transaction set control number

  -- Per-claim acknowledgment
  submission_status       TEXT NOT NULL DEFAULT 'Pending'
                            CHECK (submission_status IN (
                              'Pending','Accepted','Rejected','Warning','Duplicate'
                            )),
  rejection_reason        TEXT,
  rejection_code          TEXT,          -- 999 IK5/IK3 error codes

  -- Tracking
  included_at             TIMESTAMPTZ DEFAULT now(),
  acknowledged_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),

  UNIQUE (batch_id, claim_id),
  UNIQUE (batch_id, sequence_number)
);

CREATE INDEX idx_oa_batch_claims_batch  ON office_ally_batch_claims(batch_id);
CREATE INDEX idx_oa_batch_claims_claim  ON office_ally_batch_claims(claim_id);
CREATE INDEX idx_oa_batch_claims_status ON office_ally_batch_claims(submission_status);

ALTER TABLE office_ally_batch_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_oa_batch_claims" ON office_ally_batch_claims
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE office_ally_batch_claims IS
  'Junction table linking claims to their 837P batch submission envelope. '
  'sequence_number preserves claim order within the X12 ST/SE transaction set. '
  'submission_status is updated when the 999 acknowledgment is parsed. '
  'Unique constraint prevents the same claim from appearing twice in one batch.';


-- ──────────────────────────────────────────────────────────
-- TABLE 3: functional_ack_999
--
-- Purpose:
--   Structured 999 Functional Acknowledgment records, one row
--   per functional group (GS/GE envelope). Currently clearinghouse_responses
--   stores only raw JSONB — this provides structured relational access
--   to acknowledgment outcomes per batch and per claim.
--
-- Key Fields:
--   batch_id                Parent batch envelope
--   isa_control_number      ISA13 — matches the submitted 837P ISA13
--   gs_control_number       GS06 — functional group control number
--   ack_code                AK901: A=Accepted, R=Rejected, P=Partial, E=Error
--   error_segments          JSONB array of IK3/IK4/IK5 errors with segment IDs
--   transaction_count       AK903 — number of transactions included
--   accepted_count          AK904 — number accepted
--   rejected_count          AK905 — number rejected
--
-- Foreign Keys:
--   batch_id → office_ally_batches(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS functional_ack_999 (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                UUID REFERENCES office_ally_batches(id) ON DELETE SET NULL,

  -- 999 envelope identifiers
  isa_control_number      TEXT NOT NULL,   -- matches submitted 837P ISA13
  gs_control_number       TEXT,            -- GS06
  transaction_set_id      TEXT,            -- ST02 of the 999 itself

  -- Acknowledgment result (AK1/AK9 segments)
  functional_id_code      TEXT DEFAULT 'HC',  -- AK101 — HC=healthcare (837)
  ack_code                TEXT NOT NULL
                            CHECK (ack_code IN ('A','R','P','E')),
                            -- A=Accepted, R=Rejected, P=Partial Error, E=Group Error
  ack_note                TEXT,
  transaction_count       INTEGER DEFAULT 0,   -- AK903
  accepted_count          INTEGER DEFAULT 0,   -- AK904
  rejected_count          INTEGER DEFAULT 0,   -- AK905

  -- Structured error detail (IK3/IK4/IK5 loops)
  error_segments          JSONB,
  -- Expected structure:
  -- [
  --   {
  --     "loop": "2200",
  --     "transaction_set_id": "0001",
  --     "ik304_error_code": "001",
  --     "ik304_segment_id": "NM1",
  --     "ik403_element_position": 3,
  --     "ik403_error_code": "008",
  --     "ak501_ack_code": "R"
  --   }
  -- ]

  -- Raw X12
  raw_999                 TEXT,            -- full 999 X12 for reprocessing
  interchange_date        DATE,
  received_at             TIMESTAMPTZ DEFAULT now(),

  -- Audit
  created_at              TIMESTAMPTZ DEFAULT now()
  -- Immutable: no updated_at (999 records should not be modified)
);

CREATE INDEX idx_999_batch        ON functional_ack_999(batch_id);
CREATE INDEX idx_999_isa          ON functional_ack_999(isa_control_number);
CREATE INDEX idx_999_ack_code     ON functional_ack_999(ack_code);
CREATE INDEX idx_999_received     ON functional_ack_999(received_at);

ALTER TABLE functional_ack_999 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_999" ON functional_ack_999
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE functional_ack_999 IS
  'Structured 999 Functional Acknowledgment records per 837P batch. '
  'isa_control_number links back to the submitted batch. '
  'error_segments JSONB array provides per-segment IK3/IK4/IK5 error details. '
  'Records are immutable — 999 acknowledgments are never updated, only appended. '
  'Raw 999 X12 stored in raw_999 for audit and reprocessing.';


-- ──────────────────────────────────────────────────────────
-- TABLE 4: claim_status_277
--
-- Purpose:
--   Structured 277CA (Claim Acknowledgment) and 277U (Claim Status)
--   response records. One row per claim-level status segment in the
--   277 response. Currently clearinghouse_responses stores only raw JSONB.
--
-- Claim Status Category Codes (loop 2200D STC01-1):
--   A1 = Acknowledged, Pending
--   A2 = Acknowledged, Returned as Unprocessable
--   A3 = Acknowledged, Returned for Missing or Invalid Data
--   A4 = Acknowledged, Returned for Incomplete Claim
--   A5 = Rejected, Patient Not Eligible
--   A6 = Rejected, Claim Under Investigation
--   A7 = Rejected, Age Exceeds Maximum
--   A8 = Rejected, Diagnosis-Procedure Code Mismatch
--   F0 = Finalized, No Payment (Denial or Zero-Pay)
--   F1 = Finalized, Payment (Paid)
--   F2 = Finalized, More Information Requested
--   F3 = Finalized, Claim Previously Paid (Duplicate)
--   R0 = Requests for Additional Information (RAI)
--
-- Key Fields:
--   claim_status_category_code  STC01-1 primary category
--   claim_status_code           STC01-2 detail code
--   entity_code                 STC01-3 entity responsible
--   follow_up_action_code       STC03 corrective action required
--
-- Foreign Keys:
--   claim_id  → claims(id)
--   batch_id  → office_ally_batches(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claim_status_277 (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                    UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  batch_id                    UUID REFERENCES office_ally_batches(id) ON DELETE SET NULL,

  -- 277 envelope identifiers
  isa_control_number          TEXT,    -- links to submitted 837P batch
  response_transaction_set_id TEXT,    -- ST02 of the 277 itself

  -- Payer-assigned identifiers (loop 2200)
  payer_icn                   TEXT,    -- payer's internal claim number (CLP07 / REF*1K)
  payer_claim_number          TEXT,    -- REF*D9 — alternate payer reference
  oa_claim_control_number     TEXT,    -- OA claim reference

  -- Claim status (STC segments — loop 2200D)
  claim_status_category_code  TEXT NOT NULL,  -- STC01-1 (A1-A8, F0-F3, R0)
  claim_status_code           TEXT,           -- STC01-2 detail code
  entity_code                 TEXT,           -- STC01-3 entity responsible (2B=payer, 1P=billing provider)
  status_date                 DATE,           -- STC02

  -- Corrective action
  follow_up_action_code       TEXT,           -- STC03 (WQ=Resubmission, C=Correct & Resubmit, etc.)
  follow_up_action_note       TEXT,           -- human-readable interpretation

  -- Claim amounts in 277 (STC04-09 claim-level amounts)
  charge_amount               NUMERIC(12,2),
  payment_amount              NUMERIC(12,2),
  patient_responsibility      NUMERIC(12,2),

  -- Loop 2200 claim identifiers
  loop_id                     TEXT DEFAULT '2200',
  reference_qualifier         TEXT,           -- REF qualifier (D9/1K/etc.)
  reference_id                TEXT,

  -- Raw X12 fragments for debugging
  raw_stc_segment             TEXT,           -- raw STC segment string
  raw_277                     TEXT,           -- full 277 X12 (stored once on first row per batch+claim)

  -- Soft delete
  is_voided                   BOOLEAN DEFAULT FALSE,
  voided_at                   TIMESTAMPTZ,
  voided_reason               TEXT,

  -- Audit
  received_at                 TIMESTAMPTZ DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ DEFAULT now()
  -- Immutable: status responses are not updated, new rows appended per 277 response
);

CREATE INDEX idx_277_claim        ON claim_status_277(claim_id);
CREATE INDEX idx_277_batch        ON claim_status_277(batch_id);
CREATE INDEX idx_277_payer_icn    ON claim_status_277(payer_icn);
CREATE INDEX idx_277_category     ON claim_status_277(claim_status_category_code);
CREATE INDEX idx_277_received     ON claim_status_277(received_at);
CREATE INDEX idx_277_isa          ON claim_status_277(isa_control_number);

ALTER TABLE claim_status_277 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_277" ON claim_status_277
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE claim_status_277 IS
  'Structured 277CA/277U claim status response records. One row per claim-level '
  'STC segment in the 277 response. claim_status_category_code follows the X12 '
  'STC01-1 code set (A1-A8, F0-F3, R0). Records are immutable — new 277 responses '
  'append new rows; use received_at DESC to get current status. '
  'payer_icn links to ERA matching and payment_reconciliation.';


-- ──────────────────────────────────────────────────────────
-- TABLE 5: era_match_log
--
-- Purpose:
--   Immutable audit trail of every ERA-to-claim matching
--   decision. Records how and why each ERA line item was matched
--   (or not matched) to a specific claim. Supports match override
--   workflows and post-match audits.
--
-- Key Fields:
--   match_method            Algorithm used (subscriber_id/claim_number/
--                           name_dos/manual/unmatched/auto_icn)
--   match_score             0.0–1.0 confidence score for automated matches
--   auto_matched            TRUE if matched by algorithm; FALSE if manually confirmed
--   candidate_claim_id      Best candidate claim identified but not yet confirmed
--   matched_claim_id        Confirmed match (NULL if unmatched)
--
-- Foreign Keys:
--   era_id         → eras(id)
--   era_line_item_id → era_line_items(id)
--   candidate_claim_id → claims(id)
--   matched_claim_id   → claims(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_match_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_id                  UUID NOT NULL REFERENCES eras(id) ON DELETE CASCADE,
  era_line_item_id        UUID REFERENCES era_line_items(id) ON DELETE CASCADE,

  -- Match candidates
  candidate_claim_id      UUID REFERENCES claims(id) ON DELETE SET NULL,
  matched_claim_id        UUID REFERENCES claims(id) ON DELETE SET NULL,

  -- Match decision
  match_method            TEXT NOT NULL
                            CHECK (match_method IN (
                              'subscriber_id',    -- matched on subscriber ID + DOS
                              'claim_number',     -- matched on submitter claim control number
                              'name_dos',         -- matched on patient name + DOS
                              'payer_icn',        -- matched on payer ICN from 277
                              'oa_batch_ref',     -- matched via OA batch reference
                              'manual',           -- staff manually confirmed match
                              'unmatched',        -- no match found; requires manual review
                              'auto_icn'          -- matched on internal claim number
                            )),
  match_score             NUMERIC(5,4) DEFAULT 0  -- 0.0000 to 1.0000
                            CHECK (match_score >= 0 AND match_score <= 1),
  auto_matched            BOOLEAN NOT NULL DEFAULT FALSE,

  -- Override tracking
  overridden              BOOLEAN DEFAULT FALSE,
  override_reason         TEXT,
  override_by             UUID REFERENCES auth.users(id),
  override_at             TIMESTAMPTZ,

  -- Personnel
  matched_by              UUID REFERENCES auth.users(id),
  matched_at              TIMESTAMPTZ DEFAULT now(),

  -- Supplemental match data
  match_data              JSONB,
  -- Expected structure:
  -- {
  --   "candidate_subscriber_id": "ABC123",
  --   "era_subscriber_id": "ABC123",
  --   "candidate_dos": "2024-01-15",
  --   "era_dos": "2024-01-15",
  --   "billed_amount_match": true,
  --   "name_similarity": 0.97
  -- }

  -- Immutable audit fields
  created_at              TIMESTAMPTZ DEFAULT now()
  -- No updated_at — this table must remain immutable for audit integrity
);

CREATE INDEX idx_era_match_era        ON era_match_log(era_id);
CREATE INDEX idx_era_match_line       ON era_match_log(era_line_item_id);
CREATE INDEX idx_era_match_matched    ON era_match_log(matched_claim_id);
CREATE INDEX idx_era_match_method     ON era_match_log(match_method);
CREATE INDEX idx_era_match_auto       ON era_match_log(auto_matched);

ALTER TABLE era_match_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_era_match_log" ON era_match_log
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE era_match_log IS
  'Immutable audit trail of ERA-to-claim matching decisions. '
  'One row per matching attempt per era_line_item. '
  'match_method documents the algorithm; match_score is confidence (0–1). '
  'When a manual override occurs, overridden=TRUE and override_reason documents why. '
  'This table must never be updated to preserve audit integrity.';


-- ──────────────────────────────────────────────────────────
-- TABLE 6: insurance_balances
--
-- Purpose:
--   Payer-level AR aging summary. Mirrors patient_balances
--   (which covers patient-side AR only) but tracks what each
--   payer owes. Recalculated on demand or by trigger.
--
--   Aging buckets follow standard 0-30 / 31-60 / 61-90 /
--   91-120 / 120+ days from DOS. Used in the insurance AR
--   dashboard and collections work queue.
--
-- Key Fields:
--   payer_id / payer_name      Identifies the payer
--   ar_balance                 Total outstanding (billed - paid - adjustments)
--   bucket_0_30 .. bucket_120_plus  AR aging by days outstanding
--   open_claims_count          Active unpaid claims
--   denied_count               Claims currently in denied status
--   calculated_at              Timestamp of last recalculation
--
-- Foreign Keys:
--   clinician_id → clinician_accounts(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_balances (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id            TEXT NOT NULL REFERENCES clinician_accounts(id) ON DELETE CASCADE,
  payer_id                TEXT NOT NULL,
  payer_name              TEXT NOT NULL,
  plan_type               TEXT,               -- Medicaid, CHP+, Medicare, Commercial

  -- Summary totals
  total_billed            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_allowed           NUMERIC(12,2) DEFAULT 0,
  total_paid              NUMERIC(12,2) DEFAULT 0,
  total_contractual_adj   NUMERIC(12,2) DEFAULT 0,
  total_writeoffs         NUMERIC(12,2) DEFAULT 0,
  ar_balance              NUMERIC(12,2) NOT NULL DEFAULT 0,  -- total_billed - total_paid - adjustments

  -- AR aging buckets (days from DOS)
  bucket_0_30             NUMERIC(12,2) DEFAULT 0,
  bucket_31_60            NUMERIC(12,2) DEFAULT 0,
  bucket_61_90            NUMERIC(12,2) DEFAULT 0,
  bucket_91_120           NUMERIC(12,2) DEFAULT 0,
  bucket_120_plus         NUMERIC(12,2) DEFAULT 0,

  -- Claim counts
  open_claims_count       INTEGER DEFAULT 0,
  denied_count            INTEGER DEFAULT 0,
  pending_count           INTEGER DEFAULT 0,
  on_hold_count           INTEGER DEFAULT 0,
  appeal_count            INTEGER DEFAULT 0,

  -- Performance metrics
  avg_days_to_payment     NUMERIC(8,2),        -- average days from DOS to payment
  first_pass_rate         NUMERIC(5,4),         -- % claims paid on first submission (0–1)
  denial_rate             NUMERIC(5,4),         -- denied_count / total_claims (0–1)

  -- Calculated timestamp (stale after this)
  calculated_at           TIMESTAMPTZ DEFAULT now(),
  calculation_period_start DATE,
  calculation_period_end  DATE,

  -- Audit
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),

  UNIQUE (clinician_id, payer_id)
);

CREATE INDEX idx_ins_bal_clinician   ON insurance_balances(clinician_id);
CREATE INDEX idx_ins_bal_payer       ON insurance_balances(payer_id);
CREATE INDEX idx_ins_bal_ar          ON insurance_balances(ar_balance);
CREATE INDEX idx_ins_bal_calculated  ON insurance_balances(calculated_at);

ALTER TABLE insurance_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_ins_balances" ON insurance_balances
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

CREATE POLICY "clinician_own_ins_balances" ON insurance_balances
  FOR SELECT TO authenticated
  USING (
    clinician_id = (SELECT id FROM clinician_accounts WHERE user_id = auth.uid())
    AND auth.jwt() ->> 'role' IN ('clinician','supervisor')
  );

COMMENT ON TABLE insurance_balances IS
  'Payer-level AR aging summary, updated by trigger or on-demand recalculation. '
  'Mirrors patient_balances but tracks insurance AR instead of patient AR. '
  'UNIQUE (clinician_id, payer_id) — one row per payer per clinician. '
  'ar_balance = total_billed - total_paid - total_contractual_adj - total_writeoffs. '
  'calculated_at indicates freshness; stale rows should be recalculated before display.';


-- ──────────────────────────────────────────────────────────
-- TABLE 7: payment_adjustments
--
-- Purpose:
--   Standalone adjustment records for CO/PR/OA/PI/CR groups.
--   Complements write-offs (which are linked to payment_postings)
--   by capturing adjustments that arrive outside of ERA posting —
--   manual adjustments, COB adjustments, Medicaid crossover adjustments.
--
-- X12 835 adjustment group codes:
--   CO = Contractual Obligation (write-off — payer contract rate)
--   PR = Patient Responsibility (deductible / copay / coinsurance)
--   OA = Other Adjustment (credit balance memos, rebundling, etc.)
--   PI = Payer Initiated Reductions (not contractual)
--   CR = Correction and Reversal (reversal of prior payment)
--
-- Key Fields:
--   adjustment_group        CO/PR/OA/PI/CR
--   carc_code               CARC (Claim Adjustment Reason Code)
--   rarc_code               RARC (Remittance Advice Remark Code)
--   amount                  Adjustment amount (positive = reduction)
--   source                  ERA (auto-created) or Manual (staff-entered)
--
-- Foreign Keys:
--   claim_id           → claims(id)
--   claim_line_id      → claim_line_items(id)
--   payment_posting_id → payment_postings(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_adjustments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_line_id           UUID REFERENCES claim_line_items(id) ON DELETE CASCADE,
  payment_posting_id      UUID REFERENCES payment_postings(id) ON DELETE SET NULL,

  -- Adjustment classification (835 CAS segment)
  adjustment_group        TEXT NOT NULL
                            CHECK (adjustment_group IN ('CO','PR','OA','PI','CR')),
  carc_code               TEXT NOT NULL,    -- CARC from CAS02
  rarc_code               TEXT,             -- RARC (optional, from MOA/LQ segments)

  -- Amount
  amount                  NUMERIC(12,2) NOT NULL  -- positive = amount reduced from billed
                            CHECK (amount >= 0),
  adjustment_type         TEXT NOT NULL DEFAULT 'Reduction'
                            CHECK (adjustment_type IN ('Reduction','Credit','Reversal','Write-off','Crossover')),

  -- Source and application
  source                  TEXT NOT NULL DEFAULT 'ERA'
                            CHECK (source IN ('ERA','Manual','Crossover','COB','Recoupment','Void')),
  applied_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  era_id                  UUID REFERENCES eras(id) ON DELETE SET NULL,
  era_line_item_id        UUID REFERENCES era_line_items(id) ON DELETE SET NULL,

  -- Narrative
  adjustment_note         TEXT,

  -- Soft delete
  is_reversed             BOOLEAN DEFAULT FALSE,
  reversed_at             TIMESTAMPTZ,
  reversed_by             UUID REFERENCES auth.users(id),
  reversal_reason         TEXT,

  -- Audit
  created_by              UUID REFERENCES auth.users(id),
  approved_by             UUID REFERENCES auth.users(id),  -- required for manual adjustments
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pay_adj_claim        ON payment_adjustments(claim_id);
CREATE INDEX idx_pay_adj_line         ON payment_adjustments(claim_line_id);
CREATE INDEX idx_pay_adj_posting      ON payment_adjustments(payment_posting_id);
CREATE INDEX idx_pay_adj_group        ON payment_adjustments(adjustment_group);
CREATE INDEX idx_pay_adj_carc         ON payment_adjustments(carc_code);
CREATE INDEX idx_pay_adj_date         ON payment_adjustments(applied_date);
CREATE INDEX idx_pay_adj_source       ON payment_adjustments(source);
CREATE INDEX idx_pay_adj_reversed     ON payment_adjustments(is_reversed);

ALTER TABLE payment_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_pay_adj" ON payment_adjustments
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE payment_adjustments IS
  'Standalone X12 835 CAS-segment adjustment records. '
  'adjustment_group follows X12 codes: CO=Contractual, PR=Patient Responsibility, '
  'OA=Other Adjustment, PI=Payer Initiated, CR=Correction/Reversal. '
  'source=ERA rows are auto-created when ESAs are parsed; source=Manual requires approved_by. '
  'is_reversed tracks voided adjustments for audit without deleting the record.';


-- ──────────────────────────────────────────────────────────
-- TABLE 8: payment_reconciliation
--
-- Purpose:
--   Reconcile ERA payment records against actual bank EFT /
--   check deposits. Identifies variances between what the ERA
--   says was paid and what actually arrived in the bank.
--
--   One row per ERA-to-deposit match attempt. Multiple ERAs
--   may reconcile to one deposit (bundled EFT). One ERA may
--   reconcile to multiple deposits (split payments).
--
-- Status lifecycle:
--   Unmatched  →  Matched (when deposit_ref linked and amounts agree within tolerance)
--             →  Variance (flagged — ERA and deposit amounts differ)
--             →  Voided   (deposit voided / returned)
--
-- Key Fields:
--   era_id / payment_id        Source payment records
--   bank_transaction_ref       Bank statement / lockbox transaction ID
--   era_amount                 Total payment per ERA (NTE record)
--   deposit_amount             Actual deposit amount in bank
--   variance                   era_amount - deposit_amount (0 = clean reconciliation)
--   reconciliation_status      Matched/Variance/Unmatched/Voided
--
-- Foreign Keys:
--   era_id     → eras(id)
--   payment_id → payments(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_reconciliation (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_id                  UUID REFERENCES eras(id) ON DELETE SET NULL,
  payment_id              UUID REFERENCES payments(id) ON DELETE SET NULL,

  -- ERA payment details (from 835 header / BPR segment)
  era_amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  era_check_number        TEXT,         -- BPR10 or TRN02
  era_eft_trace           TEXT,         -- TRN02 for EFT; BPR16 for check
  era_payment_date        DATE,         -- BPR09
  era_payment_method      TEXT          CHECK (era_payment_method IN ('ACH','CHK','NON','FWT','BOP','TFT')),
  payer_id                TEXT,
  payer_name              TEXT,

  -- Bank transaction details
  bank_transaction_ref    TEXT,         -- bank statement reference / lockbox ID
  deposit_date            DATE,
  deposit_amount          NUMERIC(12,2) DEFAULT 0,
  bank_account_last4      TEXT,

  -- Reconciliation result
  variance                NUMERIC(12,2) GENERATED ALWAYS AS (era_amount - deposit_amount) STORED,
  reconciliation_status   TEXT NOT NULL DEFAULT 'Unmatched'
                            CHECK (reconciliation_status IN (
                              'Unmatched','Matched','Variance','Voided','Under Review'
                            )),
  variance_reason         TEXT,         -- required when status = 'Variance'

  -- Resolution tracking
  reconciled_by           UUID REFERENCES auth.users(id),
  reconciled_at           TIMESTAMPTZ,
  reviewed_by             UUID REFERENCES auth.users(id),
  reviewed_at             TIMESTAMPTZ,

  -- Soft delete
  is_voided               BOOLEAN DEFAULT FALSE,
  voided_at               TIMESTAMPTZ,
  voided_by               UUID REFERENCES auth.users(id),
  void_reason             TEXT,

  -- Audit
  notes                   TEXT,
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pay_recon_era        ON payment_reconciliation(era_id);
CREATE INDEX idx_pay_recon_payment    ON payment_reconciliation(payment_id);
CREATE INDEX idx_pay_recon_status     ON payment_reconciliation(reconciliation_status);
CREATE INDEX idx_pay_recon_deposit    ON payment_reconciliation(deposit_date);
CREATE INDEX idx_pay_recon_bank_ref   ON payment_reconciliation(bank_transaction_ref);
CREATE INDEX idx_pay_recon_variance   ON payment_reconciliation(variance);

ALTER TABLE payment_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_pay_recon" ON payment_reconciliation
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

COMMENT ON TABLE payment_reconciliation IS
  'Reconciles ERA payment records against bank EFT/check deposits. '
  'variance is a computed column: era_amount - deposit_amount. '
  'status=Matched means the ERA payment arrived in the bank as expected. '
  'status=Variance requires variance_reason explanation and supervisor review. '
  'Multiple ERAs may share one bank_transaction_ref (bundled EFT deposits).';


-- ──────────────────────────────────────────────────────────
-- TABLE 9: cob_payment_sequence
--
-- Purpose:
--   Coordination of Benefits (COB) payment order tracking.
--   One row per payer tier per claim. Tracks primary → secondary
--   → tertiary payment progression and crossover claim linkage.
--
--   Colorado Medicaid is typically the payer of last resort
--   (Tertiary). Crossover claims are automatically forwarded
--   from Medicare/commercial payers.
--
-- Key Fields:
--   cob_tier               1=Primary, 2=Secondary, 3=Tertiary
--   payer_id / payer_name  Identifies the payer at this tier
--   billed_amount          Amount submitted to this payer
--   paid_amount            Amount paid by this payer
--   patient_responsibility Patient balance forwarded to next tier
--   crossover_to_claim_id  UUID of the crossover claim submitted to the next payer
--
-- Foreign Keys:
--   claim_id   → claims(id)
--   patient_id → patient_records(id)
--   crossover_to_claim_id → claims(id)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cob_payment_sequence (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                    UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  patient_id                  TEXT NOT NULL REFERENCES patient_records(id) ON DELETE RESTRICT,

  -- COB tier
  cob_tier                    INTEGER NOT NULL CHECK (cob_tier IN (1,2,3)),
                              -- 1 = Primary, 2 = Secondary, 3 = Tertiary (e.g., Medicaid)
  payer_id                    TEXT NOT NULL,
  payer_name                  TEXT NOT NULL,
  claim_filing_indicator      TEXT,           -- claim_filing_ind for this tier (MC, MB, CI, etc.)

  -- Payment tracking
  billed_amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowed_amount              NUMERIC(12,2) DEFAULT 0,
  paid_amount                 NUMERIC(12,2) DEFAULT 0,
  contractual_adjustment      NUMERIC(12,2) DEFAULT 0,
  other_adjustments           NUMERIC(12,2) DEFAULT 0,
  patient_responsibility      NUMERIC(12,2) DEFAULT 0,  -- amount forwarded to next tier / patient

  -- Payer reference numbers (for COB loops in secondary 837P)
  payer_icn                   TEXT,           -- payer's ICN / claim reference
  payer_paid_date             DATE,
  remittance_advice_number    TEXT,           -- RA / EOB number from this payer

  -- Crossover claim linkage
  crossover_auto_forwarded    BOOLEAN DEFAULT FALSE,  -- TRUE if payer auto-forwarded to next tier
  crossover_to_claim_id       UUID REFERENCES claims(id) ON DELETE SET NULL,  -- secondary/tertiary claim
  crossover_submitted_at      TIMESTAMPTZ,

  -- Status at this tier
  tier_status                 TEXT NOT NULL DEFAULT 'Pending'
                                CHECK (tier_status IN (
                                  'Pending','Submitted','Paid','Denied','No Coverage','Crossover Forwarded'
                                )),

  -- Soft delete
  is_voided                   BOOLEAN DEFAULT FALSE,
  voided_at                   TIMESTAMPTZ,
  voided_reason               TEXT,

  -- Audit
  created_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now(),

  UNIQUE (claim_id, cob_tier)
);

CREATE INDEX idx_cob_claim        ON cob_payment_sequence(claim_id);
CREATE INDEX idx_cob_patient      ON cob_payment_sequence(patient_id);
CREATE INDEX idx_cob_tier         ON cob_payment_sequence(cob_tier);
CREATE INDEX idx_cob_payer        ON cob_payment_sequence(payer_id);
CREATE INDEX idx_cob_crossover    ON cob_payment_sequence(crossover_to_claim_id);
CREATE INDEX idx_cob_tier_status  ON cob_payment_sequence(tier_status);

ALTER TABLE cob_payment_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_staff_cob" ON cob_payment_sequence
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin','billing_staff','super_admin'));

CREATE POLICY "clinician_own_cob" ON cob_payment_sequence
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patient_records
      WHERE clinician_id = (SELECT id FROM clinician_accounts WHERE user_id = auth.uid())
    )
    AND auth.jwt() ->> 'role' IN ('clinician','supervisor')
  );

COMMENT ON TABLE cob_payment_sequence IS
  'COB payment order tracking. One row per payer tier per claim. '
  'UNIQUE (claim_id, cob_tier) enforces single payer-per-tier. '
  'cob_tier: 1=Primary, 2=Secondary, 3=Tertiary (Colorado Medicaid is last resort). '
  'crossover_to_claim_id links to the claim submitted to the next tier. '
  'patient_responsibility at each tier is the amount forwarded to the next payer or patient.';


-- ============================================================
-- DEFERRED FK UPGRADES
--
-- These ALTER statements upgrade TEXT-only foreign key fields
-- on existing tables to proper UUID FK constraints referencing
-- the newly created office_ally_batches table.
--
-- NOTE: Run these ONLY after all existing data has been migrated.
--       For greenfield deployments (no existing rows), run immediately.
-- ============================================================

-- Add UUID FK column on claims for batch reference
-- (existing oa_batch_id TEXT column is retained as oa_batch_ref for legacy OA string values)
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS oa_batch_uuid UUID REFERENCES office_ally_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_claims_oa_batch_uuid ON claims(oa_batch_uuid);

COMMENT ON COLUMN claims.oa_batch_uuid IS
  'Structured FK to office_ally_batches. Replaces the legacy oa_batch_id TEXT field '
  'for claims submitted after this schema migration. oa_batch_id TEXT is retained for '
  'historical OA string references.';

-- Add UUID FK column on eras for batch reference
ALTER TABLE eras
  ADD COLUMN IF NOT EXISTS oa_batch_uuid UUID REFERENCES office_ally_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eras_oa_batch_uuid ON eras(oa_batch_uuid);

COMMENT ON COLUMN eras.oa_batch_uuid IS
  'Structured FK to office_ally_batches. Replaces the legacy office_ally_batch_id TEXT '
  'field for ERAs matched to known batches after this schema migration.';


-- ============================================================
-- TRIGGERS
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- TRIGGER: Recalculate insurance_balances when a claim is closed
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_insurance_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Upsert insurance_balances aggregation for the payer on the affected clinician
  INSERT INTO insurance_balances (
    clinician_id, payer_id, payer_name,
    total_billed, total_paid, total_contractual_adj,
    ar_balance, open_claims_count, denied_count,
    pending_count, calculated_at
  )
  SELECT
    c.clinician_id,
    c.payer_id,
    c.payer_name,
    COALESCE(SUM(c.total_billed), 0),
    COALESCE(SUM(c.total_paid), 0),
    COALESCE(SUM(c.total_adjustments), 0),
    COALESCE(SUM(c.balance), 0),
    COUNT(*) FILTER (WHERE c.status NOT IN ('Paid','Voided','Closed','Denied')),
    COUNT(*) FILTER (WHERE c.status = 'Denied'),
    COUNT(*) FILTER (WHERE c.status IN ('Submitted','Pending','Acknowledged')),
    now()
  FROM claims c
  WHERE c.clinician_id = NEW.clinician_id
    AND c.payer_id = NEW.payer_id
  GROUP BY c.clinician_id, c.payer_id, c.payer_name
  ON CONFLICT (clinician_id, payer_id)
  DO UPDATE SET
    total_billed          = EXCLUDED.total_billed,
    total_paid            = EXCLUDED.total_paid,
    total_contractual_adj = EXCLUDED.total_contractual_adj,
    ar_balance            = EXCLUDED.ar_balance,
    open_claims_count     = EXCLUDED.open_claims_count,
    denied_count          = EXCLUDED.denied_count,
    pending_count         = EXCLUDED.pending_count,
    calculated_at         = now(),
    updated_at            = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalculate_insurance_balance
  AFTER INSERT OR UPDATE OF status, total_paid, balance ON claims
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_insurance_balance();


-- ──────────────────────────────────────────────────────────
-- TRIGGER: Update batch status when 999 is received
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_batch_status_on_999()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE office_ally_batches
    SET
      ack_999_code         = NEW.ack_code,
      ack_999_note         = NEW.ack_note,
      ack_999_received_at  = NEW.received_at,
      accepted_transaction_count = NEW.accepted_count,
      rejected_transaction_count = NEW.rejected_count,
      status = CASE
        WHEN NEW.ack_code = 'A' THEN 'Accepted'
        WHEN NEW.ack_code = 'R' THEN 'Rejected'
        WHEN NEW.ack_code = 'P' THEN 'Partially Accepted'
        ELSE 'Acknowledged'
      END,
      acknowledged_at = COALESCE(acknowledged_at, now()),
      updated_at = now()
    WHERE id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_batch_status_on_999
  AFTER INSERT ON functional_ack_999
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_status_on_999();


-- ──────────────────────────────────────────────────────────
-- TRIGGER: Maintain batch claim_count and total_billed
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_batch_claim_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_batch_id UUID;
  v_count INTEGER;
  v_total NUMERIC(12,2);
BEGIN
  v_batch_id := COALESCE(NEW.batch_id, OLD.batch_id);

  SELECT COUNT(*), COALESCE(SUM(c.total_billed), 0)
  INTO v_count, v_total
  FROM office_ally_batch_claims oabc
  JOIN claims c ON c.id = oabc.claim_id
  WHERE oabc.batch_id = v_batch_id;

  UPDATE office_ally_batches
  SET claim_count  = v_count,
      total_billed = v_total,
      updated_at   = now()
  WHERE id = v_batch_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_batch_claim_totals
  AFTER INSERT OR DELETE ON office_ally_batch_claims
  FOR EACH ROW
  EXECUTE FUNCTION sync_batch_claim_totals();


-- ============================================================
-- VIEWS
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- VIEW: claim_oa_readiness
--
-- Purpose:
--   Checks whether a claim has all required fields to generate
--   a valid 837P and submit to Office Ally. Returns a row per
--   claim with a boolean readiness flag and a JSONB array of
--   missing required fields.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW claim_oa_readiness AS
SELECT
  c.id                  AS claim_id,
  c.claim_ref,
  c.patient_id,
  c.clinician_id,
  c.payer_id,
  c.payer_name,
  c.status,

  -- Readiness gate
  (
    c.billing_npi    IS NOT NULL AND
    c.billing_tax_id IS NOT NULL AND
    c.subscriber_id  IS NOT NULL AND
    c.payer_id       IS NOT NULL AND
    c.dos_from       IS NOT NULL AND
    c.dos_to         IS NOT NULL AND
    EXISTS (SELECT 1 FROM claim_line_items cli WHERE cli.claim_id = c.id LIMIT 1) AND
    EXISTS (SELECT 1 FROM claim_diagnosis_codes cdc WHERE cdc.claim_id = c.id LIMIT 1)
  )                     AS is_oa_ready,

  -- Missing fields JSONB for UI display
  jsonb_build_array(
    CASE WHEN c.billing_npi    IS NULL THEN '"billing_npi"'    END,
    CASE WHEN c.billing_tax_id IS NULL THEN '"billing_tax_id"' END,
    CASE WHEN c.subscriber_id  IS NULL THEN '"subscriber_id"'  END,
    CASE WHEN c.payer_id       IS NULL THEN '"payer_id"'       END,
    CASE WHEN c.dos_from       IS NULL THEN '"dos_from"'       END,
    CASE WHEN c.dos_to         IS NULL THEN '"dos_to"'         END
  ) - 'null'            AS missing_required_fields,  -- remove null entries

  c.oa_batch_uuid,
  c.oa_batch_id         AS oa_batch_ref_legacy,
  c.submitted_at,
  c.timely_filing_deadline,
  (c.timely_filing_deadline - CURRENT_DATE) AS days_until_tfl

FROM claims c
WHERE c.status NOT IN ('Voided','Closed','Paid');

COMMENT ON VIEW claim_oa_readiness IS
  'Checks 837P submission readiness for claims not yet submitted. '
  'is_oa_ready=TRUE means the claim has all required fields for OA batch submission. '
  'missing_required_fields lists the CMS-1500 / 837P fields still needed. '
  'days_until_tfl alerts when timely filing deadline is approaching.';


-- ──────────────────────────────────────────────────────────
-- VIEW: insurance_ar_summary
--
-- Purpose:
--   Aggregated AR summary by payer for the admin dashboard.
--   Joins insurance_balances with live claim counts.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW insurance_ar_summary AS
SELECT
  ib.clinician_id,
  ib.payer_id,
  ib.payer_name,
  ib.plan_type,
  ib.total_billed,
  ib.total_paid,
  ib.ar_balance,
  ib.bucket_0_30,
  ib.bucket_31_60,
  ib.bucket_61_90,
  ib.bucket_91_120,
  ib.bucket_120_plus,
  ib.open_claims_count,
  ib.denied_count,
  ib.avg_days_to_payment,
  ib.denial_rate,
  ib.calculated_at,
  -- Live claim counts (may differ from last calculated snapshot)
  (SELECT COUNT(*) FROM claims c
   WHERE c.clinician_id = ib.clinician_id
     AND c.payer_id = ib.payer_id
     AND c.status NOT IN ('Paid','Voided','Closed','Denied')
  ) AS live_open_count
FROM insurance_balances ib;

COMMENT ON VIEW insurance_ar_summary IS
  'Insurance AR dashboard view. Combines insurance_balances snapshot data '
  'with a live open claim count for freshness comparison. '
  'When live_open_count differs significantly from open_claims_count, '
  'the insurance_balances row should be recalculated.';


-- ──────────────────────────────────────────────────────────
-- VIEW: payment_reconciliation_summary
--
-- Purpose:
--   Summary of unreconciled ERA payments for the billing
--   team work queue.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW payment_reconciliation_summary AS
SELECT
  pr.id,
  pr.era_id,
  pr.payer_name,
  pr.era_check_number,
  pr.era_eft_trace,
  pr.era_payment_date,
  pr.era_amount,
  pr.deposit_date,
  pr.deposit_amount,
  pr.variance,
  pr.reconciliation_status,
  pr.bank_transaction_ref,
  e.check_number    AS era_check_from_source,
  e.eft_trace       AS era_eft_from_source,
  p.amount          AS payment_record_amount,
  p.status          AS payment_status,
  pr.reconciled_by,
  pr.reconciled_at,
  pr.created_at
FROM payment_reconciliation pr
LEFT JOIN eras      e ON e.id = pr.era_id
LEFT JOIN payments  p ON p.id = pr.payment_id
WHERE pr.is_voided = FALSE
ORDER BY
  CASE pr.reconciliation_status
    WHEN 'Variance'   THEN 1
    WHEN 'Unmatched'  THEN 2
    WHEN 'Under Review' THEN 3
    ELSE 4
  END,
  pr.era_payment_date DESC;

COMMENT ON VIEW payment_reconciliation_summary IS
  'Work queue view for unreconciled ERA payments. '
  'Ordered by priority: Variance first (requires investigation), '
  'then Unmatched, then Under Review, then Matched.';


-- ============================================================
-- RELATIONSHIP MAP
-- ============================================================
--
--  office_ally_batches
--    → office_ally_batch_claims   (batch_id)
--    → functional_ack_999         (batch_id)
--    → claim_status_277           (batch_id)
--    ← claims                     (oa_batch_uuid)      [FK via ALTER]
--    ← eras                       (oa_batch_uuid)      [FK via ALTER]
--
--  claims
--    → office_ally_batch_claims   (claim_id)
--    → claim_status_277           (claim_id)
--    → payment_adjustments        (claim_id)
--    → cob_payment_sequence       (claim_id)
--    → era_match_log              (matched_claim_id / candidate_claim_id)
--    → cob_payment_sequence       (crossover_to_claim_id)
--    ← payment_postings           (claim_id)            [existing]
--    ← era_line_items             (linked_claim_id)      [existing]
--
--  eras
--    → era_match_log              (era_id)
--    → payment_reconciliation     (era_id)
--    ← era_line_items             (era_id)              [existing]
--    ← era_match_log              (era_id)
--
--  era_line_items
--    → era_match_log              (era_line_item_id)
--    → payment_adjustments        (era_line_item_id)
--
--  payment_postings
--    → payment_adjustments        (payment_posting_id)
--
--  payments
--    → payment_reconciliation     (payment_id)
--
--  patient_records
--    → cob_payment_sequence       (patient_id)
--
--  clinician_accounts
--    → office_ally_batches        (clinician_id)
--    → insurance_balances         (clinician_id)
--
-- ============================================================
