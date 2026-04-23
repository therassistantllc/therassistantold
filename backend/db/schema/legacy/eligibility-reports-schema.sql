-- ============================================================
-- ELIGIBILITY REPORTS SCHEMA
-- THERASSISTANT — Colorado Medicaid Behavioral Health Platform
-- ============================================================
--
-- CONTEXT:
--   Three related tables already exist in other schema files:
--     eligibility_batches   → operations-schema.sql      (batch job runs)
--     eligibility_checks    → coding-billing-engine-schema.sql (per-patient 270/271 results)
--     eligibility_history   → admin-clients-schema.sql   (per-patient history log)
--     prior_authorizations  → coding-billing-engine-schema.sql
--     referrals             → coding-billing-engine-schema.sql
--
--   This file adds the compiled report artifact layer that sits
--   above a batch run: the human-readable output billing staff
--   view, act on, and export.
--
-- TABLES IN THIS FILE:
--   1.  eligibility_reports       Compiled batch report artifact
--   2.  eligibility_report_items  Per-patient action-line within a report
-- ============================================================


-- ============================================================
-- TABLE 1: eligibility_reports
-- ============================================================
--
-- Purpose:
--   A compiled eligibility verification report associated with
--   one eligibility_batches run. Represents the output document
--   reviewed by billing staff or the clinician — distinct from
--   the raw batch job (eligibility_batches) and the raw check
--   records (eligibility_checks). One batch may produce one
--   report; ad-hoc reports may not be batch-tied.
--
-- Key Fields:
--   report_number       Human-readable ID: ELR-YYYY-####
--   batch_id            → eligibility_batches(id)  (nullable for ad-hoc)
--   client_id           Clinician whose roster was checked
--   payer               Payer this report covers
--   report_type         Scheduled | Ad-hoc | Pre-Visit | Monthly | Annual
--   report_format       Screen | PDF | CSV | Excel
--   status              Generating | Ready | Viewed | Exported | Archived
--   total_checked       Patients in the batch at report generation time
--   active_count        Patients with Active coverage
--   inactive_count      Patients with Inactive coverage
--   pending_count       Patients with Pending / ambiguous coverage
--   error_count         Patients where the check failed
--   not_found_count     Patients where no coverage found
--   action_required_count  Patients flagged for follow-up
--   pa_required_count   Patients needing prior authorization
--   referral_required_count  Patients needing referral
--   generated_at        When the report was compiled
--   viewed_at           First time a user opened the report
--   exported_at         When the report was last exported
--   generated_by        Staff who triggered generation
--   export_url          Storage path for PDF/CSV export
--   notes               Billing staff notes on this report
--
-- Foreign Keys:
--   batch_id       → eligibility_batches(id)   (soft, nullable)
--   generated_by   → auth.users(id)
--
-- Relationships:
--   1-to-many → eligibility_report_items (this file)
--   many-to-1 → eligibility_batches (batch_id)
--
-- Recommended Indexes:
--   (client_id, generated_at DESC)    — per-clinician report history
--   (status)                          — active report monitor
--   (payer, generated_at DESC)        — payer-specific reporting
--   (batch_id)                        — batch → report navigation
-- ============================================================

CREATE TABLE IF NOT EXISTS eligibility_reports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number           TEXT NOT NULL UNIQUE,  -- ELR-YYYY-####

  -- Linkage
  batch_id                UUID,                  -- soft FK → eligibility_batches(id)
  client_id               TEXT NOT NULL,         -- soft FK → clinician_accounts(id)
  generated_by            UUID REFERENCES auth.users(id),

  -- Scope
  payer                   TEXT NOT NULL,
  report_type             TEXT NOT NULL DEFAULT 'Ad-hoc'
                            CHECK (report_type IN (
                              'Scheduled',
                              'Ad-hoc',
                              'Pre-Visit',
                              'Monthly',
                              'Annual'
                            )),
  report_format           TEXT NOT NULL DEFAULT 'Screen'
                            CHECK (report_format IN (
                              'Screen', 'PDF', 'CSV', 'Excel'
                            )),
  date_range_start        DATE,  -- DOS range this report covers (if applicable)
  date_range_end          DATE,

  -- Summary counts (snapshot at generation time)
  total_checked           INTEGER NOT NULL DEFAULT 0,
  active_count            INTEGER NOT NULL DEFAULT 0,
  inactive_count          INTEGER NOT NULL DEFAULT 0,
  pending_count           INTEGER NOT NULL DEFAULT 0,
  error_count             INTEGER NOT NULL DEFAULT 0,
  not_found_count         INTEGER NOT NULL DEFAULT 0,
  action_required_count   INTEGER NOT NULL DEFAULT 0,
  pa_required_count       INTEGER NOT NULL DEFAULT 0,
  referral_required_count INTEGER NOT NULL DEFAULT 0,

  -- Lifecycle
  status                  TEXT NOT NULL DEFAULT 'Generating'
                            CHECK (status IN (
                              'Generating',
                              'Ready',
                              'Viewed',
                              'Exported',
                              'Archived'
                            )),
  generated_at            TIMESTAMPTZ DEFAULT now(),
  viewed_at               TIMESTAMPTZ,
  exported_at             TIMESTAMPTZ,
  archived_at             TIMESTAMPTZ,

  -- Export
  export_url              TEXT,  -- Storage path/URL for file download

  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),

  -- Integrity: date range must be ordered
  CONSTRAINT chk_er_date_range CHECK (
    date_range_start IS NULL OR date_range_end IS NULL
    OR date_range_start <= date_range_end
  ),
  -- Counts must be non-negative
  CONSTRAINT chk_er_counts_nonneg CHECK (
    total_checked >= 0 AND active_count >= 0 AND inactive_count >= 0
    AND pending_count >= 0 AND error_count >= 0 AND not_found_count >= 0
    AND action_required_count >= 0
  )
);

CREATE INDEX idx_er_client_date   ON eligibility_reports(client_id, generated_at DESC);
CREATE INDEX idx_er_status        ON eligibility_reports(status);
CREATE INDEX idx_er_payer_date    ON eligibility_reports(payer, generated_at DESC);
CREATE INDEX idx_er_batch         ON eligibility_reports(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_er_generated_by  ON eligibility_reports(generated_by);
CREATE INDEX idx_er_action_req    ON eligibility_reports(action_required_count)
  WHERE action_required_count > 0;

CREATE TRIGGER trg_er_updated
  BEFORE UPDATE ON eligibility_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE eligibility_reports ENABLE ROW LEVEL SECURITY;

-- Billing staff and admin have full access; clinicians see their own reports
CREATE POLICY "er_role_access" ON eligibility_reports
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin','billing_staff','billing_specialist','super_admin')
    OR client_id = (
      SELECT id FROM clinician_accounts
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin','billing_staff','billing_specialist','super_admin')
    OR client_id = (
      SELECT id FROM clinician_accounts
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );

COMMENT ON TABLE eligibility_reports IS
  'Compiled eligibility verification report artifact. One report '
  'corresponds to one eligibility_batches run (batch_id) or an ad-hoc '
  'check. Per-patient action items are stored in eligibility_report_items. '
  'Summary counts are snapshotted at generation time for fast display.';


-- ============================================================
-- TABLE 2: eligibility_report_items
-- ============================================================
--
-- Purpose:
--   Per-patient line items within an eligibility report. Each row
--   represents one patient's coverage result as it appeared in the
--   compiled report, along with any action flag and resolution
--   tracking. Items are generated from eligibility_checks at report
--   build time and remain stable even if the underlying check is
--   updated later.
--
-- Key Fields:
--   report_id           → eligibility_reports(id)
--   patient_id          → patient_records(id)
--   eligibility_check_id  → eligibility_checks(id)  (source record)
--   eligibility_status  Active | Inactive | Pending | Error | Not Found
--   payer               Payer name (snapshotted for export)
--   member_id           Member ID at time of check
--   copay               Copay from the check
--   deductible_remaining  Computed: deductible_individual – deductible_met
--   prior_auth_required  Copied flag from eligibility_check
--   referral_required   Copied flag from eligibility_check
--   appointment_date    Upcoming DOS if this item was pre-visit
--   action_required     True when the patient needs follow-up
--   action_type         Category of required action
--   action_notes        Staff notes on the required action
--   resolved            True when the action has been completed
--   resolved_at / resolved_by  Resolution audit fields
--   sort_order          Display order within the report
--
-- Foreign Keys:
--   report_id              → eligibility_reports(id)  ON DELETE CASCADE
--   patient_id             → patient_records(id)
--   eligibility_check_id   → eligibility_checks(id)   (soft, nullable)
--   resolved_by            → auth.users(id)
--
-- Recommended Indexes:
--   (report_id, sort_order)          — ordered display
--   (report_id, action_required)     — action items filter
--   (patient_id, report_id)          — patient report history
--   (report_id, resolved)            — open items queue
--   (eligibility_status, report_id)  — status breakdown
-- ============================================================

CREATE TABLE IF NOT EXISTS eligibility_report_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  report_id               UUID NOT NULL
                            REFERENCES eligibility_reports(id) ON DELETE CASCADE,
  patient_id              TEXT NOT NULL REFERENCES patient_records(id),
  eligibility_check_id    UUID,  -- soft FK → eligibility_checks(id)

  -- Snapshotted coverage data (stable for report history)
  eligibility_status      TEXT NOT NULL DEFAULT 'Active'
                            CHECK (eligibility_status IN (
                              'Active', 'Inactive', 'Pending', 'Error', 'Not Found'
                            )),
  payer                   TEXT,
  member_id               TEXT,
  copay                   NUMERIC(12,2),
  deductible_individual   NUMERIC(12,2),
  deductible_met          NUMERIC(12,2),
  deductible_remaining    NUMERIC(12,2)
                            GENERATED ALWAYS AS (
                              GREATEST(
                                0,
                                COALESCE(deductible_individual, 0)
                                - COALESCE(deductible_met, 0)
                              )
                            ) STORED,
  coinsurance_pct         NUMERIC(5,2),
  eligibility_begin       DATE,
  eligibility_end         DATE,
  coverage_notes          TEXT,

  -- Auth / referral flags (snapshotted)
  prior_auth_required     BOOLEAN DEFAULT FALSE,
  referral_required       BOOLEAN DEFAULT FALSE,
  network_status          TEXT DEFAULT 'Unknown'
                            CHECK (network_status IN (
                              'In Network', 'Out of Network', 'Unknown'
                            )),

  -- Appointment context (pre-visit reports)
  appointment_date        DATE,
  appointment_id          UUID,  -- soft FK → appointments(id)

  -- Action tracking
  action_required         BOOLEAN NOT NULL DEFAULT FALSE,
  action_type             TEXT
                            CHECK (action_type IS NULL OR action_type IN (
                              'Verify Eligibility',
                              'Update Member ID',
                              'Contact Patient',
                              'Obtain Prior Auth',
                              'Obtain Referral',
                              'Update Insurance',
                              'Collect Outstanding Balance',
                              'Reschedule Appointment',
                              'Write Off',
                              'Other'
                            )),
  action_notes            TEXT,
  action_priority         TEXT DEFAULT 'Normal'
                            CHECK (action_priority IN ('Low','Normal','High','Urgent')),

  -- Resolution
  resolved                BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at             TIMESTAMPTZ,
  resolved_by             UUID REFERENCES auth.users(id),
  resolution_notes        TEXT,

  -- Display
  sort_order              INTEGER,
  error_message           TEXT,  -- if eligibility_status = 'Error'

  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),

  -- A patient can appear once per report
  CONSTRAINT uq_eri_report_patient UNIQUE (report_id, patient_id),

  -- Resolution requires timestamp and resolving user
  CONSTRAINT chk_eri_resolution_audit CHECK (
    (resolved = FALSE)
    OR (resolved = TRUE AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
  ),

  -- action_type required when action_required = true
  CONSTRAINT chk_eri_action_type CHECK (
    action_required = FALSE OR action_type IS NOT NULL
  )
);

CREATE INDEX idx_eri_report_order   ON eligibility_report_items(report_id, sort_order);
CREATE INDEX idx_eri_report_action  ON eligibility_report_items(report_id, action_required)
  WHERE action_required = TRUE;
CREATE INDEX idx_eri_patient        ON eligibility_report_items(patient_id, report_id);
CREATE INDEX idx_eri_open_items     ON eligibility_report_items(report_id, resolved)
  WHERE resolved = FALSE AND action_required = TRUE;
CREATE INDEX idx_eri_status         ON eligibility_report_items(eligibility_status, report_id);
CREATE INDEX idx_eri_check_ref      ON eligibility_report_items(eligibility_check_id)
  WHERE eligibility_check_id IS NOT NULL;

CREATE TRIGGER trg_eri_updated
  BEFORE UPDATE ON eligibility_report_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE eligibility_report_items ENABLE ROW LEVEL SECURITY;

-- Inherits access rules from the parent report
CREATE POLICY "eri_role_access" ON eligibility_report_items
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin','billing_staff','billing_specialist','super_admin')
    OR EXISTS (
      SELECT 1 FROM eligibility_reports er
      JOIN clinician_accounts ca ON ca.id = er.client_id
      WHERE er.id = report_id
        AND ca.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin','billing_staff','billing_specialist','super_admin')
    OR EXISTS (
      SELECT 1 FROM eligibility_reports er
      JOIN clinician_accounts ca ON ca.id = er.client_id
      WHERE er.id = report_id
        AND ca.auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE eligibility_report_items IS
  'Per-patient line items within an eligibility report. '
  'deductible_remaining is a computed column. '
  'action_type is required when action_required = TRUE (enforced by CHECK). '
  'resolved requires resolved_at + resolved_by (resolution audit). '
  'Rows are cascade-deleted when the parent report is deleted.';


-- ============================================================
-- CROSS-FILE NOTES
-- ============================================================
--
-- Table dependency map for eligibility / auth / referral layer:
--
--   eligibility_batches        (operations-schema.sql)
--       └── 1:many → eligibility_history   (admin-clients-schema.sql)
--       └── 1:1    → eligibility_reports   (THIS FILE)
--                       └── 1:many → eligibility_report_items (THIS FILE)
--
--   eligibility_checks         (coding-billing-engine-schema.sql)
--       └── referenced by eligibility_report_items.eligibility_check_id
--       └── drives prior_authorizations creation (via prior_auth_required flag)
--
--   prior_authorizations       (coding-billing-engine-schema.sql)
--       └── referenced by claims.prior_auth_id
--
--   referrals                  (coding-billing-engine-schema.sql)
--       └── referenced by claims.referral_id
--
-- Run order (CREATE sequence):
--   1. auth-schema.sql
--   2. admin-clients-schema.sql          (patient_records, clinician_accounts,
--                                         eligibility_history)
--   3. coding-billing-engine-schema.sql  (claims, prior_authorizations,
--                                         referrals, eligibility_checks)
--   4. operations-schema.sql             (eligibility_batches, workqueue_items)
--   5. eligibility-reports-schema.sql    (THIS FILE — eligibility_reports,
--                                         eligibility_report_items)
-- ============================================================
