-- ══════════════════════════════════════════════════════════════════════════════
-- THERASSISTANT — Stripe Payment Collection Schema
-- Schema: public (Supabase / PostgreSQL)
-- Generated: 2026-04-06
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: STRIPE ACCOUNT CONNECTIONS
-- Each clinician (or practice) connects their own Stripe Express account.
-- The platform uses Stripe Connect to route payments.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id     TEXT NOT NULL UNIQUE,          -- acct_xxx (Express account)
  access_token          TEXT,                          -- stored encrypted, for API calls
  refresh_token         TEXT,                          -- encrypted
  token_type            TEXT DEFAULT 'bearer',
  scope                 TEXT DEFAULT 'read_write',
  livemode              BOOLEAN DEFAULT FALSE,
  charges_enabled       BOOLEAN DEFAULT FALSE,
  payouts_enabled       BOOLEAN DEFAULT FALSE,
  details_submitted     BOOLEAN DEFAULT FALSE,
  country               CHAR(2) DEFAULT 'US',
  default_currency      CHAR(3) DEFAULT 'usd',
  connected_at          TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_accounts_clinician ON stripe_accounts(clinician_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: PATIENT STRIPE CUSTOMERS
-- Each patient has a Stripe Customer object on the clinician's connected account.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_customers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT NOT NULL,                 -- cus_xxx
  stripe_account_id     TEXT NOT NULL,                 -- which connected account
  email                 TEXT,
  name                  TEXT,
  phone                 TEXT,
  auto_pay_invoices     BOOLEAN DEFAULT FALSE,
  auto_pay_plans        BOOLEAN DEFAULT FALSE,
  send_receipts         BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patient_id, clinician_id)
);

CREATE INDEX idx_stripe_customers_patient ON stripe_customers(patient_id);
CREATE INDEX idx_stripe_customers_clinician ON stripe_customers(clinician_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: SAVED PAYMENT METHODS
-- References Stripe PaymentMethod objects. No raw card data stored here.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_methods (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,       -- pm_xxx
  stripe_customer_id    TEXT NOT NULL,
  stripe_account_id     TEXT NOT NULL,
  type                  TEXT NOT NULL                  -- card | us_bank_account | link
                          CHECK (type IN ('card','us_bank_account','link','hsa_fsa')),
  card_brand            TEXT,                          -- visa | mastercard | amex | discover
  card_last4            CHAR(4),
  card_exp_month        SMALLINT,
  card_exp_year         SMALLINT,
  card_funding          TEXT,                          -- credit | debit | prepaid
  bank_name             TEXT,
  bank_account_last4    CHAR(4),
  is_default            BOOLEAN DEFAULT FALSE,
  is_expired            BOOLEAN DEFAULT FALSE,
  auto_pay_enabled      BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_patient ON payment_methods(patient_id);
CREATE INDEX idx_payment_methods_clinician ON payment_methods(clinician_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: PATIENT INVOICES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number        TEXT NOT NULL,                 -- INV-0001 (human-readable)
  patient_id            UUID NOT NULL REFERENCES auth.users(id),
  clinician_id          UUID NOT NULL REFERENCES auth.users(id),
  stripe_invoice_id     TEXT,                          -- in_xxx (if Stripe-hosted invoice)
  stripe_payment_link   TEXT,                          -- hosted payment URL
  service_date          DATE,
  due_date              DATE,
  line_items            JSONB NOT NULL DEFAULT '[]',   -- [{description, qty, unit_price, amount}]
  subtotal_cents        INTEGER NOT NULL DEFAULT 0,
  discount_cents        INTEGER DEFAULT 0,
  total_cents           INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents     INTEGER DEFAULT 0,
  amount_due_cents      INTEGER GENERATED ALWAYS AS (total_cents - amount_paid_cents) STORED,
  currency              CHAR(3) DEFAULT 'usd',
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent','partial','paid','void','overdue')),
  source                TEXT DEFAULT 'manual'
                          CHECK (source IN ('manual','agenda','billing_alert','statement','portal','auto')),
  notes_to_patient      TEXT,
  internal_notes        TEXT,
  sent_at               TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  voided_at             TIMESTAMPTZ,
  overdue_notified_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_patient ON patient_invoices(patient_id);
CREATE INDEX idx_invoices_clinician ON patient_invoices(clinician_id);
CREATE INDEX idx_invoices_status ON patient_invoices(status);
CREATE INDEX idx_invoices_due_date ON patient_invoices(due_date);

-- Auto-increment invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('invoice_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_invoice_number ON patient_invoices;
CREATE TRIGGER trg_invoice_number BEFORE INSERT ON patient_invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: PAYMENTS (TRANSACTIONS)
-- One row per Stripe PaymentIntent attempt.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                UUID NOT NULL REFERENCES auth.users(id),
  clinician_id              UUID NOT NULL REFERENCES auth.users(id),
  invoice_id                UUID REFERENCES patient_invoices(id),
  plan_id                   UUID,                      -- FK to payment_plans.id (set below)
  stripe_payment_intent_id  TEXT UNIQUE,               -- pi_xxx
  stripe_charge_id          TEXT,                      -- ch_xxx
  stripe_account_id         TEXT,
  stripe_customer_id        TEXT,
  payment_method_id         UUID REFERENCES payment_methods(id),
  payment_method_type       TEXT,
  amount_cents              INTEGER NOT NULL,
  stripe_fee_cents          INTEGER DEFAULT 0,         -- Stripe processing fee
  net_cents                 INTEGER GENERATED ALWAYS AS (amount_cents - stripe_fee_cents) STORED,
  currency                  CHAR(3) DEFAULT 'usd',
  description               TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','succeeded','failed','canceled','refunded','partially_refunded')),
  failure_code              TEXT,                      -- e.g. card_declined, insufficient_funds
  failure_message           TEXT,
  source                    TEXT DEFAULT 'manual'
                              CHECK (source IN ('manual','agenda','patient_profile','statement','billing_alert','patient_portal','auto_pay','plan_installment')),
  auto_receipt_sent         BOOLEAN DEFAULT FALSE,
  receipt_email             TEXT,
  internal_notes            TEXT,
  collected_by              UUID REFERENCES auth.users(id),  -- clinician/admin who initiated
  refunded_cents            INTEGER DEFAULT 0,
  refunded_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_patient ON payments(patient_id);
CREATE INDEX idx_payments_clinician ON payments(clinician_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: REFUNDS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_refunds (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id            UUID NOT NULL REFERENCES payments(id),
  patient_id            UUID NOT NULL REFERENCES auth.users(id),
  clinician_id          UUID NOT NULL REFERENCES auth.users(id),
  stripe_refund_id      TEXT UNIQUE,                  -- re_xxx
  stripe_charge_id      TEXT,
  amount_cents          INTEGER NOT NULL,
  currency              CHAR(3) DEFAULT 'usd',
  reason                TEXT CHECK (reason IN
                          ('duplicate','fraudulent','requested_by_customer',
                           'insurance_adjustment','service_not_rendered','other')),
  status                TEXT DEFAULT 'pending'
                          CHECK (status IN ('pending','succeeded','failed','canceled')),
  internal_notes        TEXT,
  issued_by             UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refunds_payment ON payment_refunds(payment_id);
CREATE INDEX idx_refunds_patient ON payment_refunds(patient_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: PAYMENT PLANS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL REFERENCES auth.users(id),
  clinician_id          UUID NOT NULL REFERENCES auth.users(id),
  invoice_id            UUID REFERENCES patient_invoices(id),
  payment_method_id     UUID REFERENCES payment_methods(id),
  total_cents           INTEGER NOT NULL,
  installment_count     INTEGER NOT NULL,
  installment_cents     INTEGER NOT NULL,             -- ceiling rounded, last adjusted
  frequency             TEXT NOT NULL DEFAULT 'monthly'
                          CHECK (frequency IN ('weekly','biweekly','monthly')),
  start_date            DATE NOT NULL,
  next_charge_date      DATE,
  auto_pay              BOOLEAN DEFAULT TRUE,
  notify_patient        BOOLEAN DEFAULT TRUE,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','completed','canceled','paused','failed')),
  paid_installments     INTEGER DEFAULT 0,
  paid_cents            INTEGER DEFAULT 0,
  remaining_cents       INTEGER GENERATED ALWAYS AS (total_cents - paid_cents) STORED,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plans_patient ON payment_plans(patient_id);
CREATE INDEX idx_plans_clinician ON payment_plans(clinician_id);
CREATE INDEX idx_plans_status ON payment_plans(status);
CREATE INDEX idx_plans_next_charge ON payment_plans(next_charge_date);

-- Add FK from payments to plans (after both tables exist)
ALTER TABLE payments ADD CONSTRAINT fk_payments_plan
  FOREIGN KEY (plan_id) REFERENCES payment_plans(id) ON DELETE SET NULL;

-- Plan installments log
CREATE TABLE IF NOT EXISTS payment_plan_installments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id               UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  payment_id            UUID REFERENCES payments(id),
  installment_number    INTEGER NOT NULL,
  due_date              DATE NOT NULL,
  amount_cents          INTEGER NOT NULL,
  status                TEXT DEFAULT 'pending'
                          CHECK (status IN ('pending','paid','failed','skipped')),
  attempt_count         INTEGER DEFAULT 0,
  last_attempt_at       TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_installments_plan ON payment_plan_installments(plan_id);
CREATE INDEX idx_installments_due ON payment_plan_installments(due_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: SUPERBILLS
-- Itemized clinical receipts for OON insurance reimbursement.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS superbills (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superbill_number      TEXT NOT NULL,                -- SB-0001
  patient_id            UUID NOT NULL REFERENCES auth.users(id),
  clinician_id          UUID NOT NULL REFERENCES auth.users(id),
  date_from             DATE NOT NULL,
  date_to               DATE NOT NULL,
  cpt_codes             TEXT[],                       -- ['90837','90834']
  icd10_codes           TEXT[],                       -- ['F32.1','F41.1']
  rendering_provider_npi TEXT,
  amount_paid_cents     INTEGER,
  pdf_url               TEXT,                         -- signed S3/Supabase Storage URL
  sent_to_patient_at    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS superbill_number_seq START 1;
CREATE OR REPLACE FUNCTION generate_superbill_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.superbill_number IS NULL OR NEW.superbill_number = '' THEN
    NEW.superbill_number := 'SB-' || LPAD(nextval('superbill_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_superbill_number ON superbills;
CREATE TRIGGER trg_superbill_number BEFORE INSERT ON superbills
  FOR EACH ROW EXECUTE FUNCTION generate_superbill_number();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9: STATEMENTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_statements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_number      TEXT NOT NULL,               -- STMT-0001
  patient_id            UUID NOT NULL REFERENCES auth.users(id),
  clinician_id          UUID NOT NULL REFERENCES auth.users(id),
  date_from             DATE NOT NULL,
  date_to               DATE NOT NULL,
  total_charges_cents   INTEGER DEFAULT 0,
  total_paid_cents      INTEGER DEFAULT 0,
  balance_due_cents     INTEGER GENERATED ALWAYS AS (total_charges_cents - total_paid_cents) STORED,
  stripe_payment_link   TEXT,
  pdf_url               TEXT,
  include_pay_link      BOOLEAN DEFAULT TRUE,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS statement_number_seq START 1;
CREATE OR REPLACE FUNCTION generate_statement_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.statement_number IS NULL OR NEW.statement_number = '' THEN
    NEW.statement_number := 'STMT-' || LPAD(nextval('statement_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_statement_number ON patient_statements;
CREATE TRIGGER trg_statement_number BEFORE INSERT ON patient_statements
  FOR EACH ROW EXECUTE FUNCTION generate_statement_number();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 10: RECEIPTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_receipts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number        TEXT NOT NULL,               -- REC-0001
  payment_id            UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  patient_id            UUID NOT NULL REFERENCES auth.users(id),
  clinician_id          UUID NOT NULL REFERENCES auth.users(id),
  amount_cents          INTEGER NOT NULL,
  pdf_url               TEXT,
  stripe_receipt_url    TEXT,                        -- Stripe-hosted receipt URL
  emailed_at            TIMESTAMPTZ,
  sms_sent_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := 'REC-' || LPAD(nextval('receipt_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_receipt_number ON payment_receipts;
CREATE TRIGGER trg_receipt_number BEFORE INSERT ON payment_receipts
  FOR EACH ROW EXECUTE FUNCTION generate_receipt_number();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 11: PAYMENT ALERTS
-- Failed payments, declined cards, overdue balances, disputes.
-- Feeds into the existing billing_alerts system.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL REFERENCES auth.users(id),
  clinician_id          UUID NOT NULL REFERENCES auth.users(id),
  payment_id            UUID REFERENCES payments(id),
  invoice_id            UUID REFERENCES patient_invoices(id),
  plan_id               UUID REFERENCES payment_plans(id),
  alert_type            TEXT NOT NULL
                          CHECK (alert_type IN (
                            'payment_failed','card_declined','ach_returned',
                            'auto_pay_failed','invoice_overdue','balance_overdue',
                            'dispute_opened','refund_failed','plan_failed'
                          )),
  severity              TEXT DEFAULT 'high'
                          CHECK (severity IN ('low','medium','high','critical')),
  title                 TEXT NOT NULL,
  message               TEXT,
  stripe_event_id       TEXT,                        -- evt_xxx for deduplication
  failure_code          TEXT,
  amount_cents          INTEGER,
  status                TEXT DEFAULT 'open'
                          CHECK (status IN ('open','in_progress','resolved','dismissed')),
  resolved_by           UUID REFERENCES auth.users(id),
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_alerts_patient ON payment_alerts(patient_id);
CREATE INDEX idx_payment_alerts_clinician ON payment_alerts(clinician_id);
CREATE INDEX idx_payment_alerts_status ON payment_alerts(status);
CREATE INDEX idx_payment_alerts_type ON payment_alerts(alert_type);
CREATE INDEX idx_payment_alerts_stripe_event ON payment_alerts(stripe_event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 12: STRIPE RECONCILIATION LOG
-- Maps Stripe payout/charge IDs to platform payment records.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_reconciliation (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id            UUID NOT NULL REFERENCES auth.users(id),
  stripe_account_id       TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_charge_id        TEXT,
  stripe_payout_id        TEXT,                       -- po_xxx
  platform_payment_id     UUID REFERENCES payments(id),
  stripe_amount_cents     INTEGER,
  platform_amount_cents   INTEGER,
  stripe_fee_cents        INTEGER,
  net_cents               INTEGER,
  currency                CHAR(3) DEFAULT 'usd',
  match_status            TEXT DEFAULT 'pending'
                            CHECK (match_status IN ('matched','unmatched','partial','pending','dispute','flagged')),
  mismatch_reason         TEXT,
  dispute_id              TEXT,                       -- dp_xxx
  dispute_status          TEXT,
  dispute_due_by          TIMESTAMPTZ,
  resolved_by             UUID REFERENCES auth.users(id),
  resolved_at             TIMESTAMPTZ,
  stripe_event_type       TEXT,                       -- webhook event type
  raw_stripe_event        JSONB,                      -- full Stripe event payload
  synced_at               TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recon_clinician ON stripe_reconciliation(clinician_id);
CREATE INDEX idx_recon_match ON stripe_reconciliation(match_status);
CREATE INDEX idx_recon_pi ON stripe_reconciliation(stripe_payment_intent_id);
CREATE INDEX idx_recon_payout ON stripe_reconciliation(stripe_payout_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 13: STRIPE WEBHOOK EVENTS LOG
-- Store all incoming webhooks for idempotency and audit.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id       TEXT NOT NULL UNIQUE,         -- evt_xxx
  event_type            TEXT NOT NULL,
  livemode              BOOLEAN,
  stripe_account_id     TEXT,
  payload               JSONB NOT NULL,
  processed             BOOLEAN DEFAULT FALSE,
  processed_at          TIMESTAMPTZ,
  error                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX idx_webhooks_type ON stripe_webhook_events(event_type);
CREATE INDEX idx_webhooks_processed ON stripe_webhook_events(processed);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 14: NOTIFICATION QUEUE
-- Tracks all payment-related notifications (email, SMS, in-app).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_notifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id          UUID NOT NULL REFERENCES auth.users(id),
  recipient_type        TEXT NOT NULL CHECK (recipient_type IN ('patient','clinician','admin')),
  related_payment_id    UUID REFERENCES payments(id),
  related_alert_id      UUID REFERENCES payment_alerts(id),
  related_invoice_id    UUID REFERENCES patient_invoices(id),
  related_plan_id       UUID REFERENCES payment_plans(id),
  notification_type     TEXT NOT NULL,                -- e.g. payment_failed, receipt, plan_reminder
  channel               TEXT NOT NULL CHECK (channel IN ('email','sms','in_app','push')),
  subject               TEXT,
  body                  TEXT,
  template_key          TEXT,                         -- e.g. 'receipt', 'payment_failed'
  status                TEXT DEFAULT 'queued'
                          CHECK (status IN ('queued','sent','failed','suppressed')),
  sent_at               TIMESTAMPTZ,
  failure_reason        TEXT,
  idempotency_key       TEXT UNIQUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_notif_recipient ON payment_notifications(recipient_id);
CREATE INDEX idx_payment_notif_status ON payment_notifications(status);
CREATE INDEX idx_payment_notif_type ON payment_notifications(notification_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 15: ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE stripe_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods         ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE superbills              ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_statements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_reconciliation   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_notifications   ENABLE ROW LEVEL SECURITY;

-- Admins: full access (assumes role check via JWT claim 'app_role' = 'admin')
CREATE POLICY "Admins full access" ON payments
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'app_role' = 'admin');

-- Clinicians: own patients only
CREATE POLICY "Clinician own payments" ON payments
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid());

CREATE POLICY "Clinician own invoices" ON patient_invoices
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid());

CREATE POLICY "Clinician own plans" ON payment_plans
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid());

CREATE POLICY "Clinician own alerts" ON payment_alerts
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid());

CREATE POLICY "Clinician own stripe account" ON stripe_accounts
  FOR ALL TO authenticated
  USING (clinician_id = auth.uid());

-- Patients: own records only
CREATE POLICY "Patient own payments" ON payments
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Patient own invoices" ON patient_invoices
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Patient own payment methods" ON payment_methods
  FOR ALL TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Patient own plans" ON payment_plans
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Patient own receipts" ON payment_receipts
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Patient own superbills" ON superbills
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Patient own statements" ON patient_statements
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

-- Service role only (backend API): reconciliation & webhooks
CREATE POLICY "Service role only reconciliation" ON stripe_reconciliation
  FOR ALL TO service_role USING (TRUE);

CREATE POLICY "Service role only webhooks" ON stripe_webhook_events
  FOR ALL TO service_role USING (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 16: HELPFUL VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- Patient balance summary (one row per patient per clinician)
CREATE OR REPLACE VIEW patient_balance_summary AS
SELECT
  p.patient_id,
  p.clinician_id,
  SUM(CASE WHEN p.status = 'succeeded' THEN p.amount_cents ELSE 0 END) AS total_paid_cents,
  SUM(CASE WHEN i.status IN ('sent','overdue','partial') THEN i.amount_due_cents ELSE 0 END) AS total_outstanding_cents,
  SUM(CASE WHEN i.status = 'overdue' THEN i.amount_due_cents ELSE 0 END) AS total_overdue_cents,
  COUNT(CASE WHEN pa.status = 'open' AND pa.alert_type IN ('payment_failed','card_declined') THEN 1 END) AS open_failure_alerts
FROM payments p
LEFT JOIN patient_invoices i ON i.patient_id = p.patient_id AND i.clinician_id = p.clinician_id
LEFT JOIN payment_alerts pa ON pa.patient_id = p.patient_id AND pa.clinician_id = p.clinician_id
GROUP BY p.patient_id, p.clinician_id;

-- Clinician payment summary (MTD)
CREATE OR REPLACE VIEW clinician_payment_summary_mtd AS
SELECT
  clinician_id,
  COUNT(*) FILTER (WHERE status = 'succeeded') AS payments_collected,
  SUM(amount_cents) FILTER (WHERE status = 'succeeded') AS gross_collected_cents,
  SUM(stripe_fee_cents) FILTER (WHERE status = 'succeeded') AS total_fees_cents,
  SUM(net_cents) FILTER (WHERE status = 'succeeded') AS net_collected_cents,
  COUNT(*) FILTER (WHERE status IN ('failed','canceled')) AS failed_count,
  SUM(refunded_cents) AS total_refunded_cents
FROM payments
WHERE created_at >= date_trunc('month', NOW())
GROUP BY clinician_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 17: API ROUTE REFERENCE (comments only)
-- ─────────────────────────────────────────────────────────────────────────────

/*
API ROUTES — Stripe Payment Workflow
All routes require Authorization: Bearer <supabase_jwt>
All amounts in CENTS. Stripe idempotency keys required for mutations.

── STRIPE CONNECT ────────────────────────────────────────────────────────
POST   /api/stripe/connect/initiate
       → Returns Stripe Connect OAuth URL for clinician onboarding
       Permissions: clinician, admin
       Response: { url: string }

POST   /api/stripe/connect/callback?code=xxx
       → Exchange OAuth code for access token, save to stripe_accounts
       Permissions: clinician

GET    /api/stripe/connect/status
       → Returns connected account status (charges_enabled, payouts_enabled)
       Permissions: clinician

POST   /api/stripe/dashboard-link
       → Creates Stripe Express dashboard login link
       Permissions: clinician

DELETE /api/stripe/connect/disconnect
       → Disconnects Stripe account (requires confirmation)
       Permissions: clinician, admin

── PAYMENTS ─────────────────────────────────────────────────────────────
POST   /api/payments/collect
       Body: { patient_id, amount_cents, payment_method_id, description,
               source, invoice_id?, save_method?, send_receipt? }
       → Creates Stripe PaymentIntent, confirms, saves to payments table
       Permissions: clinician, admin, patient (portal only)
       Webhooks: payment_intent.succeeded → auto-create receipt + notify

POST   /api/payments/:id/retry
       → Retries a failed PaymentIntent with same or new method
       Permissions: clinician, admin

GET    /api/payments
       Query: patient_id?, clinician_id?, status?, date_from?, date_to?, source?
       Permissions: admin (all) | clinician (own) | patient (own)

GET    /api/payments/:id
       Permissions: admin | clinician (own patient) | patient (own)

── REFUNDS ──────────────────────────────────────────────────────────────
POST   /api/payments/:id/refund
       Body: { amount_cents?, reason, notes }
       → Creates Stripe Refund, saves to payment_refunds
       Permissions: clinician, admin
       Webhooks: charge.refunded → notify patient

── PAYMENT METHODS ───────────────────────────────────────────────────────
POST   /api/payment-methods
       Body: { patient_id, stripe_payment_method_id, set_default, auto_pay }
       → Attach PaymentMethod to Stripe Customer
       Permissions: clinician, admin, patient (portal)

GET    /api/payment-methods?patient_id=xxx
       Permissions: clinician (own) | patient (own)

DELETE /api/payment-methods/:id
       → Detach from Stripe Customer
       Permissions: clinician, admin, patient (own)

PATCH  /api/payment-methods/:id/auto-pay
       Body: { enabled: boolean }
       Permissions: clinician, admin, patient (own)

── INVOICES ──────────────────────────────────────────────────────────────
POST   /api/payments/invoices
       Body: { patient_id, service_date, due_date, line_items, notes,
               send_now, include_pay_link }
       Permissions: clinician, admin

GET    /api/payments/invoices?patient_id=xxx&status=xxx
       Permissions: admin | clinician (own) | patient (own)

PATCH  /api/payments/invoices/:id
       Body: { status?, notes?, due_date? }
       Permissions: clinician, admin

POST   /api/payments/invoices/:id/send
       → Resend invoice email/SMS
       Permissions: clinician, admin

── PAYMENT PLANS ─────────────────────────────────────────────────────────
POST   /api/payments/plans
       Body: { patient_id, total_cents, installment_count, frequency,
               start_date, payment_method_id, auto_pay, notify_patient }
       → Creates plan + installment schedule
       Permissions: clinician, admin

GET    /api/payments/plans?patient_id=xxx&status=active
       Permissions: admin | clinician (own) | patient (own)

PATCH  /api/payments/plans/:id
       Body: { status?, auto_pay?, payment_method_id? }
       Permissions: clinician, admin

── SUPERBILLS ────────────────────────────────────────────────────────────
POST   /api/payments/superbills
       Body: { patient_id, date_from, date_to, cpt_codes, icd10_codes,
               rendering_provider_npi, amount_paid_cents, send_email }
       → Generates PDF, stores URL, optionally emails patient
       Permissions: clinician, admin

GET    /api/payments/superbills?patient_id=xxx
       Permissions: clinician (own) | patient (own download)

── STATEMENTS ────────────────────────────────────────────────────────────
POST   /api/payments/statements
       Body: { patient_id, date_from, date_to, include_pay_link, send }
       → Generates statement PDF with payment link if balance > 0
       Permissions: clinician, admin

── RECEIPTS ──────────────────────────────────────────────────────────────
GET    /api/payments/receipts?patient_id=xxx
       Permissions: clinician (own) | patient (own)

GET    /api/payments/receipts/:id/pdf
       → Redirects to signed PDF URL
       Permissions: clinician (own patient) | patient (own)

── RECONCILIATION (Admin only) ───────────────────────────────────────────
POST   /api/admin/stripe/sync
       → Pulls latest Stripe events for all connected accounts
       → Updates stripe_reconciliation table
       Permissions: admin only

GET    /api/admin/stripe/reconciliation
       Query: clinician_id?, match_status?, date_from?, date_to?
       Permissions: admin only

PATCH  /api/admin/stripe/reconciliation/:id/resolve
       Body: { match_status, notes }
       Permissions: admin only

GET    /api/admin/stripe/payouts
       Permissions: admin only

── WEBHOOKS ──────────────────────────────────────────────────────────────
POST   /api/webhooks/stripe
       → Stripe webhook endpoint (verify signature with STRIPE_WEBHOOK_SECRET)
       → Idempotent: check stripe_webhook_events before processing
       Handles:
         payment_intent.succeeded       → update status, create receipt, notify
         payment_intent.payment_failed  → update status, create alert, notify
         charge.refunded                → update refunded_cents, notify
         charge.dispute.created         → create dispute alert, notify admin
         charge.dispute.closed          → update dispute record
         customer.subscription.updated  → auto-pay plan changes
         payout.paid                    → update recon log, notify clinician
         payout.failed                  → create alert

── PATIENT PORTAL ────────────────────────────────────────────────────────
POST   /api/patient-portal/pay
       Body: { amount_cents, payment_method_id, source_type, source_id }
       Permissions: patient (own records only, JWT validated)

GET    /api/patient-portal/balance
       → Returns current balance, active plans, open invoices
       Permissions: patient (own)

POST   /api/patient-portal/payment-methods
       Body: { stripe_payment_method_id, set_default, auto_pay }
       Permissions: patient (own)

PATCH  /api/patient-portal/preferences
       Body: { auto_pay_invoices, auto_pay_plans, receipts_enabled }
       Permissions: patient (own)
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- END OF SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────
