# THERASSISTANT — Phased Product Roadmap
**Document version:** 1.0  
**Date:** April 6, 2026  
**Status:** Implementation-ready planning document

---

## Table of Contents
1. [Phase 1 — Core RCM & Billing Operations](#phase-1)
2. [Phase 2 — Scheduling, Eligibility & Claims Submission](#phase-2)
3. [Phase 3 — Patient Portal & Clinical Documentation](#phase-3)
4. [Phase 4 — Credentialing, Compliance & Enterprise Scale](#phase-4)
5. [Cross-Phase Dependencies](#cross-phase-dependencies)
6. [Global Risks & Mitigations](#global-risks)

---

## Phase 1 — Core RCM & Billing Operations <a id="phase-1"></a>

**Goal:** Establish the operational backbone. Every downstream phase depends on the data  
models, role system, and integrations defined here.

**Target completion:** Q2 2026

---

### 1.1 Core Deliverables

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Admin Dashboard** | KPI widgets: Revenue MTD/YTD, AR, Claims Submitted/Denied/Paid, ERA Import Status, Unmatched Payments, Active Users |
| 2 | **Clinician Dashboard** | Per-clinician: open notes, billing alerts, recent claim status, schedule snapshot |
| 3 | **Coding Engine** | CPT/ICD-10 suggestion engine driven by service type, session notes, and payer rules |
| 4 | **Coding Reports** | Exportable per-clinician and per-payer code frequency, denial rates by code |
| 5 | **Documentation Guidance** | In-app prompts, required field checkers, medical necessity flags per CPT code |
| 6 | **Billing Alerts** | Configurable rule engine: missing auth, expired eligibility, approaching auth limit, claim age thresholds |
| 7 | **Support Tickets** | Multi-priority ticketing with category routing, clinician/admin/billing views, SLA tracking |
| 8 | **Live Chat** | Real-time chat widget: clinician→support and admin→billing specialist |
| 9 | **Patient Database** | Core patient demographics, insurance, payer, contact info, linked clinician |
| 10 | **Claim Tracker** | Per-patient, per-payer, per-clinician claim list with status, DOS, billed/paid amounts |
| 11 | **Claim Detail / History View** | Full claim lifecycle: submission → adjudication → payment/denial history with audit trail |
| 12 | **CARC/RARC Work Queues** | Grouped denial work queues by CARC/RARC code with bulk action support |
| 13 | **Aging Work Queues** | 0–30, 31–60, 61–90, 91–120, 120+ day buckets with click-through to claim detail |
| 14 | **Smart Phrase Notes** | Reusable macro text snippets per clinician and org-wide; supports documentation templates |
| 15 | **ERA Imports** | File upload + SFTP pull for 835 ERA files; auto-matching to claims; exception queue |
| 16 | **CSV Imports** | Bulk patient and claim data import with validation, field mapping, and error reporting |
| 17 | **SimplePractice Imports** | Scheduled or manual sync of patient records and session data from SimplePractice API |
| 18 | **Revenue Dashboard** | Practice-level revenue analytics: collections rate, payer mix, denial rate trends, top CPTs |
| 19 | **Stripe Payment Collection** | Copay/balance collection via Stripe; card-on-file, one-time charges, receipts |
| 20 | **Route to Biller Workflow** | One-click escalation from clinician view → billing specialist queue with note and context |

---

### 1.2 Required Integrations

| Integration | Purpose | Auth Method | Notes |
|-------------|---------|-------------|-------|
| Supabase | Primary database, auth, real-time | Service role key + RLS | Existing |
| Stripe | Payment collection, invoicing | Stripe API keys + webhooks | PCI scope: SAQ A |
| SimplePractice API | Patient/session import | OAuth 2.0 | Rate-limit aware sync |
| 835 ERA Parser | ERA file ingestion | File upload / SFTP | ANSI X12 835 |
| CSV Importer | Bulk data load | File upload | Validation library needed |
| SendGrid / Resend | Billing alert and ticket notifications | API key | Transactional only |
| OpenAI / LLM | Coding engine suggestions, documentation guidance | API key | Prompt injection risk — sanitize all inputs |

---

### 1.3 Database Changes

```sql
-- Patients / clients
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  dob             DATE,
  mrn             TEXT UNIQUE,
  primary_payer_id UUID REFERENCES payers(id),
  secondary_payer_id UUID REFERENCES payers(id),
  clinician_id    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Claims
CREATE TABLE claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  clinician_id    UUID NOT NULL REFERENCES users(id),
  payer_id        UUID NOT NULL REFERENCES payers(id),
  dos             DATE NOT NULL,
  cpt_code        TEXT NOT NULL,
  icd10_codes     TEXT[],
  billed_amt      NUMERIC(10,2),
  allowed_amt     NUMERIC(10,2),
  paid_amt        NUMERIC(10,2),
  status          TEXT NOT NULL DEFAULT 'draft',
  submitted_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  denied_at       TIMESTAMPTZ,
  denial_reason_id UUID REFERENCES denial_reasons(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ERA / remittance
CREATE TABLE era_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  filename        TEXT,
  imported_at     TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending',
  matched_count   INT DEFAULT 0,
  unmatched_count INT DEFAULT 0,
  raw_content     TEXT
);

CREATE TABLE era_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  era_file_id     UUID REFERENCES era_files(id),
  claim_id        UUID REFERENCES claims(id),
  carc_codes      TEXT[],
  rarc_codes      TEXT[],
  paid_amt        NUMERIC(10,2),
  adj_amt         NUMERIC(10,2),
  status          TEXT DEFAULT 'unmatched'
);

-- Billing alerts
CREATE TABLE billing_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  patient_id      UUID REFERENCES patients(id),
  type            TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'medium',
  status          TEXT NOT NULL DEFAULT 'open',
  assigned_to     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- Support tickets
CREATE TABLE support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  raised_by       UUID REFERENCES users(id),
  assigned_to     UUID REFERENCES users(id),
  category        TEXT,
  priority        TEXT DEFAULT 'normal',
  status          TEXT DEFAULT 'open',
  subject         TEXT,
  body            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- Smart phrases
CREATE TABLE smart_phrases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  created_by      UUID REFERENCES users(id),
  scope           TEXT DEFAULT 'personal',   -- 'personal' | 'org'
  trigger_text    TEXT NOT NULL,
  expansion       TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe payments
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  claim_id        UUID REFERENCES claims(id),
  stripe_payment_intent_id TEXT UNIQUE,
  amount          NUMERIC(10,2),
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Route to biller
CREATE TABLE biller_escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID REFERENCES claims(id),
  initiated_by    UUID REFERENCES users(id),
  assigned_to     UUID REFERENCES users(id),
  note            TEXT,
  status          TEXT DEFAULT 'open',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 1.4 Role Permissions Changes

| Permission | Admin | Billing Specialist | Clinician | Front Desk | Read-Only |
|-----------|-------|--------------------|-----------|------------|-----------|
| View all patients | ✓ | ✓ | own only | ✓ | ✓ |
| Edit patients | ✓ | ✓ | own only | ✓ | — |
| View all claims | ✓ | ✓ | own only | — | ✓ |
| Submit claims | ✓ | ✓ | — | — | — |
| Post ERA payments | ✓ | ✓ | — | — | — |
| Manage billing alerts | ✓ | ✓ | view only | — | — |
| Route to biller | ✓ | ✓ | ✓ | — | — |
| Manage support tickets | ✓ | — | create only | create only | — |
| Access revenue dashboard | ✓ | ✓ | — | — | — |
| Manage smart phrases (org) | ✓ | — | — | — | — |
| Import ERA / CSV | ✓ | ✓ | — | — | — |
| Manage Stripe payments | ✓ | ✓ | — | ✓ | — |
| Access coding engine | ✓ | ✓ | ✓ | — | — |

**New roles to introduce in Phase 1:**
- `admin` — full access
- `billing_specialist` — RCM operations
- `clinician` — scoped to own patients and claims
- `front_desk` — patient intake, scheduling (read), payment collection
- `read_only` — reporting view

---

### 1.5 Major UI Changes

- **Global navigation sidebar** (see THERASSISTANT-SIDEBAR-NAV.md)
- **Claim detail drawer** — full timeline, ERA match, CARC/RARC explanation panel
- **Aging work queue table** — filterable, bulk-actionable, export to CSV
- **CARC/RARC work queue table** — grouped by code, collapsible payer sub-rows
- **Billing alert banner** — persistent top-of-page alert strip per role
- **Route to biller modal** — clinician-facing one-click escalation form
- **ERA import wizard** — step: upload → auto-match preview → exceptions → confirm
- **SimplePractice import panel** — connection status, last sync timestamp, re-sync button
- **Revenue dashboard** — chart-based: monthly trend, payer mix donut, denial rate line

---

### 1.6 Dependencies

- Supabase project provisioned with RLS policies per role
- Stripe account in live mode; webhook endpoint deployed
- SimplePractice API credentials obtained from each practice
- 835 parser library selected (e.g., `x12-parser` npm package or equivalent)
- SendGrid/Resend account for transactional email
- LLM provider API key for coding engine

---

### 1.7 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| SimplePractice API instability / rate limits | High | Queue-based sync with retry; cache last-good import |
| 835 ERA format variations across payers | High | Extensive payer-specific test files; graceful exception queue |
| Stripe PCI compliance scope | Medium | Use Stripe.js / hosted fields; never handle raw card data server-side |
| LLM prompt injection via clinical notes | High | Strict input sanitization; output validation; no PII in prompts |
| HIPAA exposure in chat/ticket logs | High | Encrypt at rest; restrict access by role; audit log all access |
| Data mapping errors on CSV/SimplePractice import | Medium | Dry-run mode with diff preview before commit |

---

### 1.8 Business Value

- Replaces manual billing workflows → reduces billing staff time per claim
- Consolidated coding engine reduces undercoding and improves clean claim rate
- Billing alerts prevent revenue leakage from missed authorizations and expired eligibility
- ERA auto-matching reduces manual payment posting time
- Route to biller removes friction for clinicians; keeps them in documentation workflow
- Revenue dashboard gives practice owners instant financial visibility

---

### 1.9 Recommended Release Order Within Phase 1

```
Sprint 1  → Patient database, role/permission system, global navigation
Sprint 2  → Claim tracker, claim detail/history view
Sprint 3  → Coding engine, coding reports, documentation guidance
Sprint 4  → Billing alerts, aging work queues, CARC/RARC work queues
Sprint 5  → ERA imports (file upload + auto-match)
Sprint 6  → CSV imports, SimplePractice imports
Sprint 7  → Smart phrase notes
Sprint 8  → Support tickets, live chat
Sprint 9  → Stripe payment collection, Route to biller workflow
Sprint 10 → Revenue dashboard, admin dashboard finalization, UAT
```

---

---

## Phase 2 — Scheduling, Eligibility & Claims Submission <a id="phase-2"></a>

**Goal:** Close the pre-billing loop. Verify coverage before appointments, submit clean claims  
directly, and post payments with automated matching.

**Target completion:** Q3 2026  
**Dependency:** Phase 1 complete (patient DB, claims model, role system)

---

### 2.1 Core Deliverables

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Scheduling** | Appointment creation/edit/cancel; clinician availability blocks; recurring rules |
| 2 | **Appointment Calendar** | Week/month/day views per clinician or org-wide; color-coded by status |
| 3 | **Recurring Appointments** | RRULE-based recurrence (weekly, biweekly, custom intervals); bulk edit / exception handling |
| 4 | **Eligibility Verification** | Real-time 270/271 eligibility check per patient + payer; result stored and linked to appointment |
| 5 | **Batch Eligibility Checks** | Nightly automated batch run against upcoming appointments (configurable days-ahead window) |
| 6 | **Clinician Agenda View** | Day-at-a-glance: appointment list, eligibility status badges, outstanding notes indicator |
| 7 | **Insurance Verification Reports** | Eligibility results by payer, failure rate, coverage detail summary reports |
| 8 | **Payment Posting Queue** | ERA-driven and manual payment posting; match to claim; flag exceptions |
| 9 | **Claim Submission** | Direct submission pipeline: draft → scrub → submit → track; batch and individual |
| 10 | **Claim Scrubbing** | Pre-submission validation: NPI, taxonomy, ICD-10 primary dx, modifier rules, payer-specific edits |
| 11 | **Office Ally Integration** | Clearinghouse connection for claim transmission and 277 status retrieval |
| 12 | **Patient Balances** | Patient responsibility ledger: copay, deductible, coinsurance, prior balance tracking |
| 13 | **Statements** | Monthly patient statement generation (PDF); email delivery; portal delivery (Phase 3 prep) |
| 14 | **Auto-Pay** | Card-on-file recurring charges for patient balances; configurable thresholds; failure handling |
| 15 | **Refunds and Adjustments** | Credit memo, write-off, refund workflows with Stripe reverse charge; approval workflow for admins |

---

### 2.2 Required Integrations

| Integration | Purpose | Auth Method | Notes |
|-------------|---------|-------------|-------|
| Availity / Change Healthcare / Waystar | 270/271 eligibility, 837 submission, 277 status | EDI API or clearinghouse API | Payer enrollment required |
| Office Ally | Clearinghouse claim submission and status | SFTP + REST API | Credentialing setup per NPI |
| Stripe | Auto-pay, refunds, card-on-file | Stripe API + webhooks | Expand existing Phase 1 integration |
| SendGrid / Resend | Statement delivery, eligibility failure alerts | Existing | Extend Phase 1 |
| RRULE engine | Recurring appointment logic | npm `rrule` library | Client-side + server-side |

---

### 2.3 Database Changes

```sql
-- Scheduling
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  clinician_id    UUID NOT NULL REFERENCES users(id),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  status          TEXT DEFAULT 'scheduled',   -- scheduled | completed | cancelled | no_show
  appointment_type TEXT,
  location        TEXT,
  recurrence_rule TEXT,   -- RFC 5545 RRULE string
  parent_appointment_id UUID REFERENCES appointments(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Eligibility
CREATE TABLE eligibility_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  payer_id        UUID REFERENCES payers(id),
  appointment_id  UUID REFERENCES appointments(id),
  checked_at      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL,   -- active | inactive | failed
  coverage_start  DATE,
  coverage_end    DATE,
  copay           NUMERIC(6,2),
  deductible      NUMERIC(10,2),
  deductible_met  NUMERIC(10,2),
  oop_max         NUMERIC(10,2),
  oop_met         NUMERIC(10,2),
  raw_271         TEXT,
  failure_reason  TEXT
);

-- Claim submission tracking
ALTER TABLE claims ADD COLUMN clearinghouse_claim_id TEXT;
ALTER TABLE claims ADD COLUMN submission_method TEXT;   -- 'office_ally' | 'manual'
ALTER TABLE claims ADD COLUMN scrub_status TEXT;        -- 'pass' | 'fail' | 'warning'
ALTER TABLE claims ADD COLUMN scrub_errors JSONB;

CREATE TABLE claim_scrub_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID REFERENCES claims(id),
  rule_code       TEXT,
  severity        TEXT,   -- 'error' | 'warning'
  message         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Patient balances
CREATE TABLE patient_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  claim_id        UUID REFERENCES claims(id),
  charge_type     TEXT,   -- 'copay' | 'deductible' | 'coinsurance' | 'noncovered'
  billed_amt      NUMERIC(10,2),
  paid_amt        NUMERIC(10,2),
  balance_amt     NUMERIC(10,2),
  statement_id    UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Statements
CREATE TABLE statements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  period_start    DATE,
  period_end      DATE,
  total_balance   NUMERIC(10,2),
  pdf_url         TEXT,
  delivered_at    TIMESTAMPTZ,
  delivery_method TEXT   -- 'email' | 'portal' | 'mail'
);

-- Refunds / adjustments
CREATE TABLE payment_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID REFERENCES payments(id),
  claim_id        UUID REFERENCES claims(id),
  type            TEXT,   -- 'refund' | 'writeoff' | 'adjustment'
  amount          NUMERIC(10,2),
  reason          TEXT,
  approved_by     UUID REFERENCES users(id),
  stripe_refund_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.4 Role Permissions Changes

| Permission | Admin | Billing Specialist | Clinician | Front Desk |
|-----------|-------|--------------------|-----------|------------|
| Create/edit appointments | ✓ | — | own only | ✓ |
| View all appointments | ✓ | ✓ | own only | ✓ |
| Run eligibility checks | ✓ | ✓ | — | ✓ |
| View eligibility results | ✓ | ✓ | own patients | ✓ |
| Submit claims | ✓ | ✓ | — | — |
| Run claim scrubber | ✓ | ✓ | — | — |
| Post ERA payments | ✓ | ✓ | — | — |
| View patient balances | ✓ | ✓ | — | ✓ |
| Generate statements | ✓ | ✓ | — | — |
| Process auto-pay | ✓ | ✓ | — | — |
| Approve refunds > $X | ✓ | — | — | — |
| Issue refunds/adjustments | ✓ | ✓ | — | — |

**New roles introduced in Phase 2:** None. Extends Phase 1 role set.

---

### 2.5 Major UI Changes

- **Appointment calendar** — FullCalendar-based or custom; drag-resize support; eligibility badge overlay
- **Clinician agenda view** — daily strip with eligibility status, outstanding note flag, check-in button
- **Batch eligibility results panel** — bulk pass/fail list with failure reason drill-down
- **Claim submission queue** — draft → scrub → submit pipeline with status badges
- **Claim scrub results panel** — inline error list per claim; fix-and-resubmit action
- **Payment posting queue** — ERA-driven match list; manual post form; exception flagging
- **Statement preview modal** — PDF preview before send; delivery method selector
- **Patient balance ledger** — per-patient charge/payment history table with running balance
- **Auto-pay settings panel** — per-patient card-on-file manager; charge threshold controls
- **Refund/adjustment form** — amount, reason, approval routing for large refunds

---

### 2.6 Dependencies

- Phase 1 patient database and claim model
- Phase 1 role/permission system
- Clearinghouse (Office Ally) enrollment completed per NPI/TIN
- Payer enrollment for EDI submission
- 270/271 API credentials from clearinghouse or Availity
- 835 parser from Phase 1 extended for payment posting
- RRULE library for recurring appointments

---

### 2.7 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Clearinghouse payer enrollment delays | High | Begin enrollment process during Phase 1; parallel track |
| EDI 270 payer response inconsistencies | High | Payer-specific mapping table; graceful unknown-field handling |
| Office Ally SFTP/API format changes | Medium | Versioned parser; monitoring alerts on parse errors |
| Recurring appointment edge cases (DST, exceptions) | Medium | RFC 5545 RRULE library; timezone-aware storage (UTC) |
| Auto-pay failures and chargeback exposure | Medium | Retry logic; failure notification; dispute workflow |
| HIPAA: statement delivery via email | High | Encrypted PDF; secure link with expiry; audit log |

---

### 2.8 Business Value

- Batch eligibility prevents claim denials due to inactive coverage
- Clean claim submission via Office Ally reduces rejection rate and days-in-AR
- Clinician agenda view keeps providers schedule-aware without leaving THERASSISTANT
- Auto-pay reduces A/R for patient balances with minimal staff effort
- Refund/adjustment workflow provides audit trail and approval controls

---

### 2.9 Recommended Release Order Within Phase 2

```
Sprint 1  → Appointment data model, scheduling UI, clinician calendar
Sprint 2  → Recurring appointments, clinician agenda view
Sprint 3  → Real-time eligibility checks (per patient)
Sprint 4  → Batch eligibility (nightly job), insurance verification reports
Sprint 5  → Claim scrubbing rules engine
Sprint 6  → Office Ally integration, claim submission pipeline
Sprint 7  → Payment posting queue (ERA-driven + manual)
Sprint 8  → Patient balances ledger
Sprint 9  → Statement generation and delivery
Sprint 10 → Auto-pay, refunds and adjustments, UAT
```

---

---

## Phase 3 — Patient Portal & Clinical Documentation <a id="phase-3"></a>

**Goal:** Extend THERASSISTANT to the patient-facing surface and full clinical documentation  
suite, enabling HIPAA-compliant digital intake, secure messaging, telehealth, and  
clinically complete progress notes with supervision workflows.

**Target completion:** Q4 2026  
**Dependency:** Phase 1 (patient DB, roles), Phase 2 (appointments, eligibility)

---

### 3.1 Core Deliverables

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Patient Portal** | Authenticated patient-facing web app: appointments, documents, messages, balance, statements |
| 2 | **Intake Forms** | Configurable digital intake forms (demographics, history, consent); assigned pre-appointment |
| 3 | **Electronic Signatures** | ESIGN/UETA-compliant e-signature collection; signature audit trail; PDF output |
| 4 | **Secure Patient Messaging** | HIPAA-compliant encrypted message threads between patient and clinician/front desk |
| 5 | **Patient Document Upload** | Patient-side file upload: insurance cards, IDs, records requests; admin review queue |
| 6 | **Appointment Requests** | Patient-initiated appointment requests; clinician/front desk approval workflow |
| 7 | **Telehealth** | Embedded HIPAA-compliant video session; link sent by SMS/email; session recording opt-in |
| 8 | **Progress Notes** | Structured note builder: SOAP/DAP/BIRP formats; CPT code linkage; auto-populate smart phrases |
| 9 | **Treatment Plans** | Goal-based treatment planning; review dates; clinician and supervisor sign-off |
| 10 | **Assessments** | Standard validated tools: PHQ-9, GAD-7, AUDIT-C, DAST, Columbia Scale; scored and stored |
| 11 | **Screening Tools** | Brief symptom screeners assignable to patients pre-session; results linked to note |
| 12 | **Supervisor Signature Workflows** | Intern/supervisee notes routed to supervisor for co-signature; status tracking |
| 13 | **Locked Notes** | Finalized note lock on co-sign or timeout; locked notes are read-only with addendum option |
| 14 | **Addendums** | Signed addendum appended to locked note; preserves original; audit-logged |

---

### 3.2 Required Integrations

| Integration | Purpose | Auth Method | Notes |
|-------------|---------|-------------|-------|
| Twilio / SendGrid | Telehealth link delivery (SMS + email), secure message notifications | API key | HIPAA BAA required |
| Daily.co / Whereby / Zoom for Healthcare | HIPAA-compliant video sessions | API key + room tokens | HIPAA BAA required |
| DocuSign / HelloSign / in-house | Electronic signatures | OAuth 2.0 or custom | Must meet ESIGN/UETA |
| Supabase Storage | Patient document storage | Signed URLs + RLS | Encrypted, access-controlled |
| PDF generation | Progress notes, treatment plans, assessments | Puppeteer / pdfkit | Server-side only |
| PHQ/GAD scoring library | Assessment auto-scoring | npm package or in-house | Validated instruments |

---

### 3.3 Database Changes

```sql
-- Patient portal users (extends auth.users)
CREATE TABLE patient_portal_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID UNIQUE REFERENCES patients(id),
  auth_user_id    UUID REFERENCES auth.users(id),
  portal_enabled  BOOLEAN DEFAULT FALSE,
  invited_at      TIMESTAMPTZ,
  last_login      TIMESTAMPTZ
);

-- Intake forms
CREATE TABLE intake_form_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  name            TEXT NOT NULL,
  fields          JSONB NOT NULL,
  version         INT DEFAULT 1,
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE intake_form_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID REFERENCES intake_form_templates(id),
  patient_id      UUID REFERENCES patients(id),
  appointment_id  UUID REFERENCES appointments(id),
  responses       JSONB,
  completed_at    TIMESTAMPTZ,
  signature_id    UUID
);

-- Electronic signatures
CREATE TABLE signatures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signed_by       UUID REFERENCES auth.users(id),
  document_type   TEXT,   -- 'intake_form' | 'treatment_plan' | 'progress_note' | 'consent'
  document_id     UUID,
  ip_address      TEXT,
  user_agent      TEXT,
  signed_at       TIMESTAMPTZ DEFAULT NOW(),
  signature_data  TEXT    -- base64 or token ref
);

-- Secure messaging
CREATE TABLE message_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  org_id          UUID REFERENCES organizations(id),
  subject         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID REFERENCES message_threads(id),
  author_id       UUID REFERENCES auth.users(id),
  body_encrypted  TEXT NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

-- Progress notes
CREATE TABLE progress_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  clinician_id    UUID REFERENCES users(id),
  appointment_id  UUID REFERENCES appointments(id),
  format          TEXT NOT NULL,   -- 'soap' | 'dap' | 'birp'
  content         JSONB NOT NULL,
  cpt_code        TEXT,
  status          TEXT DEFAULT 'draft',   -- 'draft' | 'pending_cosign' | 'locked'
  locked_at       TIMESTAMPTZ,
  supervisor_id   UUID REFERENCES users(id),
  cosigned_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE note_addendums (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id         UUID REFERENCES progress_notes(id),
  author_id       UUID REFERENCES users(id),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Treatment plans
CREATE TABLE treatment_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  clinician_id    UUID REFERENCES users(id),
  goals           JSONB,
  review_date     DATE,
  status          TEXT DEFAULT 'active',
  supervisor_id   UUID REFERENCES users(id),
  cosigned_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Assessments
CREATE TABLE assessment_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  clinician_id    UUID REFERENCES users(id),
  tool_code       TEXT NOT NULL,   -- 'phq9' | 'gad7' | 'audit_c' | etc.
  responses       JSONB,
  score           NUMERIC(6,2),
  severity        TEXT,
  completed_at    TIMESTAMPTZ,
  appointment_id  UUID REFERENCES appointments(id)
);

-- Telehealth sessions
CREATE TABLE telehealth_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID REFERENCES appointments(id),
  room_url        TEXT,
  provider_join_at TIMESTAMPTZ,
  patient_join_at  TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_min     INT,
  recording_url    TEXT
);
```

---

### 3.4 Role Permissions Changes

**New role introduced in Phase 3:** `supervisor`, `patient_portal`

| Permission | Admin | Supervisor | Clinician | Billing Specialist | Patient Portal |
|-----------|-------|-----------|-----------|-------------------|----------------|
| Send secure messages | ✓ | ✓ | ✓ | — | ✓ (own only) |
| Create progress notes | ✓ | ✓ | ✓ | — | — |
| Lock/co-sign notes | ✓ | ✓ | — | — | — |
| Create treatment plans | ✓ | ✓ | ✓ | — | — |
| Administer assessments | ✓ | ✓ | ✓ | — | — |
| View own documents | — | — | — | — | ✓ |
| Upload documents | — | — | — | — | ✓ |
| Request appointments | — | — | — | — | ✓ |
| Join telehealth | ✓ | ✓ | ✓ | — | ✓ (own only) |
| View portal as patient | ✓ | — | — | — | — |
| Manage intake form templates | ✓ | — | — | — | — |

---

### 3.5 Major UI Changes

- **Patient portal app** — separate authenticated route (`/portal`); mobile-responsive; distinct branding
- **Telehealth waiting room** — pre-call device check (camera/mic); waiting state; host join control
- **Progress note builder** — format selector, section tabs (SOAP/DAP/BIRP), smart phrase autocomplete
- **Supervisor co-sign queue** — list of pending notes, inline review and countersign
- **Locked note view** — read-only banner, addendum button, full signature audit trail
- **Assessment runner** — step-by-step question UI, auto-score display, trend chart across sessions
- **Intake form builder** — drag-and-drop field editor for admins; question types, conditional logic
- **Patient appointment request flow** — available slot picker, reason field, pending approval state
- **Secure message inbox** — thread list, encryption indicator, file attachment support

---

### 3.6 Dependencies

- Phase 1 patient database and role system
- Phase 2 appointment model and scheduling
- HIPAA BAA executed with: video provider, SMS/email provider, cloud storage
- ESIGN/UETA legal review for e-signature implementation
- Validated assessment instrument licenses (PHQ-9, GAD-7 are free; confirm others)
- Supervisor/supervisee relationships configured in org settings (Phase 1 admin panel)

---

### 3.7 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| HIPAA: patient data in portal via misconfigured RLS | Critical | Full RLS audit; penetration test before launch; separate portal schema |
| Telehealth vendor HIPAA BAA gaps | High | Verify BAA scope; prefer Daily.co or Zoom for Healthcare |
| E-signature legal validity by state | High | Legal review; include IP, timestamp, user agent in audit trail |
| PHI in secure messages — breach via XSS | High | Strict CSP; encrypt message body at rest; no PII in URLs |
| Mandatory note locking compliance (various states) | Medium | Configurable lock rules per org; default to 24-hour lock |
| Assessment instrument copyright | Medium | PHQ-9 / GAD-7 are free; audit all others before embedding |
| Patient portal account takeover | High | MFA required for portal; strong password policy; session expiry |

---

### 3.8 Business Value

- Patient portal reduces front desk intake calls and increases patient satisfaction
- Electronic intake and consent eliminates paper scanning workflow
- Telehealth expands clinician reach without additional overhead
- Locked notes and supervisor workflows support compliance for group practices and training programs
- Integrated progress notes with coding engine linkage reduces documentation time and improves claim accuracy

---

### 3.9 Recommended Release Order Within Phase 3

```
Sprint 1  → Patient portal auth, portal shell, demographics view
Sprint 2  → Secure patient messaging
Sprint 3  → Intake form builder (admin); intake form assignment flow
Sprint 4  → Electronic signatures; consent form delivery
Sprint 5  → Patient document upload; admin review queue
Sprint 6  → Appointment requests; front desk approval workflow
Sprint 7  → Telehealth integration (room creation, waiting room, join)
Sprint 8  → Progress note builder (SOAP/DAP/BIRP), smart phrase integration
Sprint 9  → Supervisor co-sign queue, locked notes, addendums
Sprint 10 → Treatment plans, assessments and screening tools, UAT
```

---

---

## Phase 4 — Credentialing, Compliance & Enterprise Scale <a id="phase-4"></a>

**Goal:** Support enterprise practices: full credentialing lifecycle, compliance dashboards,  
multi-tenancy, white-label, and advanced reporting.

**Target completion:** Q1–Q2 2027  
**Dependency:** Phases 1–3 complete; stable multi-org data model

---

### 4.1 Core Deliverables

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Credentialing Tracking** | Provider credentialing applications with status tracking per payer; document storage |
| 2 | **Provider Enrollment Tracking** | EDI enrollment status per payer; NPI, TIN, taxonomy tracking |
| 3 | **CAQH Integration** | Automated data pull from CAQH ProView; change detection alerts; re-attestation reminders |
| 4 | **License Expiration Tracking** | Professional license tracking per provider; configurable reminder thresholds (90/60/30 days) |
| 5 | **DEA Tracking** | DEA registration number, expiration, schedule tracking; renewal reminders |
| 6 | **Contract Tracking** | Payer contract terms storage; effective dates, fee schedule, re-negotiation reminders |
| 7 | **Recredentialing Reminders** | Configurable automated reminders for recredentialing windows; workflow initiation |
| 8 | **Compliance Dashboards** | Auditable compliance metrics: note completion rates, co-sign timeliness, auth compliance |
| 9 | **Audit Logs** | Immutable access and change logs for all PHI and financial data; exportable for audits |
| 10 | **Reporting Dashboards** | Advanced analytics: custom date ranges, multi-payer, multi-clinician, export to Excel/PDF |
| 11 | **Multi-Location Support** | Location-level data segmentation; per-location billing and reporting |
| 12 | **Multi-State Payer Support** | Payer configurations per state; state-specific rule sets; taxonomy mapping |
| 13 | **White-Label Support** | Custom domain, logo, color theme per tenant; suppressed THERASSISTANT branding |

---

### 4.2 Required Integrations

| Integration | Purpose | Auth Method | Notes |
|-------------|---------|-------------|-------|
| CAQH ProView API | Provider profile sync | OAuth or credential-based | CAQH API access requires enrollment |
| State license verification APIs | License status checks | Per-state (NURSYS, FSMB, others) | Varies by state and license type |
| DEA E-Commerce / NPI Registry | NPI and DEA lookup | Public REST APIs | |
| NPPES NPI Registry | NPI validation | Public REST API | |
| Payer contract database | Contract term storage | Manual import + structured CRUD | No public API standard |
| Advanced analytics engine | Reporting dashboards | Internal (Supabase views + PostgREST) or external BI tool | Consider Metabase embed |
| White-label CDN | Per-tenant asset delivery | S3-compatible + signed URLs | |

---

### 4.3 Database Changes

```sql
-- Multi-location
CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  name            TEXT NOT NULL,
  address         TEXT,
  npi             TEXT,
  tin             TEXT,
  is_active       BOOLEAN DEFAULT TRUE
);

ALTER TABLE appointments ADD COLUMN location_id UUID REFERENCES locations(id);
ALTER TABLE claims      ADD COLUMN location_id UUID REFERENCES locations(id);

-- Credentialing
CREATE TABLE provider_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id    UUID REFERENCES users(id),
  payer_id        UUID REFERENCES payers(id),
  application_date DATE,
  effective_date  DATE,
  status          TEXT,   -- 'pending' | 'active' | 'expired' | 'terminated'
  credentialing_type TEXT, -- 'initial' | 'recredential'
  next_review_date DATE,
  caqh_provider_id TEXT,
  documents       JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Licenses
CREATE TABLE provider_licenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id    UUID REFERENCES users(id),
  license_type    TEXT NOT NULL,   -- 'LCSW' | 'LPC' | 'LMFT' | 'MD' | etc.
  license_number  TEXT NOT NULL,
  state           TEXT NOT NULL,
  issued_date     DATE,
  expiration_date DATE NOT NULL,
  status          TEXT DEFAULT 'active',
  reminder_sent_at JSONB   -- {90: timestamp, 60: timestamp, 30: timestamp}
);

-- DEA registrations
CREATE TABLE dea_registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id    UUID REFERENCES users(id),
  dea_number      TEXT NOT NULL,
  schedule        TEXT[],
  state           TEXT,
  expiration_date DATE NOT NULL,
  status          TEXT DEFAULT 'active'
);

-- Payer contracts
CREATE TABLE payer_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  payer_id        UUID REFERENCES payers(id),
  contract_name   TEXT,
  effective_date  DATE,
  termination_date DATE,
  fee_schedule    JSONB,
  renewal_reminder_days INT DEFAULT 90,
  notes           TEXT
);

-- White-label / tenant theming
CREATE TABLE org_branding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID UNIQUE REFERENCES organizations(id),
  custom_domain   TEXT,
  logo_url        TEXT,
  primary_color   TEXT,
  secondary_color TEXT,
  favicon_url     TEXT,
  suppress_platform_branding BOOLEAN DEFAULT FALSE
);

-- Immutable audit log (append-only, no UPDATE/DELETE via RLS)
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  actor_id        UUID REFERENCES auth.users(id),
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     UUID,
  diff            JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: INSERT only via service role; no UPDATE or DELETE ever
```

---

### 4.4 Role Permissions Changes

**New roles introduced in Phase 4:** `credentialing_specialist`, `compliance_officer`, `location_manager`

| Permission | Admin | Credentialing Specialist | Compliance Officer | Location Manager | Clinician |
|-----------|-------|--------------------------|-------------------|-----------------|-----------|
| View/edit own credentials | ✓ | ✓ | view | — | view own |
| View all provider credentials | ✓ | ✓ | ✓ | — | — |
| Manage CAQH sync | ✓ | ✓ | — | — | — |
| View/edit contracts | ✓ | ✓ | view | — | — |
| View compliance dashboards | ✓ | — | ✓ | — | — |
| Export audit logs | ✓ | — | ✓ | — | — |
| Manage location settings | ✓ | — | — | ✓ | — |
| Access reporting dashboards | ✓ | — | ✓ | ✓ | limited |
| Manage white-label settings | ✓ (super-admin) | — | — | — | — |
| Manage org branding | ✓ | — | — | — | — |

---

### 4.5 Major UI Changes

- **Credentialing hub** — per-provider credentialing pipeline board (Kanban-style) with payer columns
- **License/DEA expiration dashboard** — org-wide expiration timeline, color-coded urgency
- **Contract manager** — payer contract list with expiration indicators and fee schedule viewer
- **Compliance dashboard** — note completion rate, co-sign timeliness, auth hit rate, regulatory KPIs
- **Audit log viewer** — filterable, searchable, exportable log table with diff viewer
- **Multi-location selector** — global location switcher in header; per-location dashboard filter
- **White-label admin panel** — domain, logo, color upload, preview panel
- **Advanced reporting builder** — date range picker, dimension selectors, chart type chooser, export controls

---

### 4.6 Dependencies

- Phases 1–3 stable and in production
- CAQH ProView API access approved
- State-specific license verification API research and enrollment
- Legal review of audit log retention requirements per state
- Multi-tenancy org isolation verified in Supabase RLS (critical before white-label launch)
- Custom domain DNS management infrastructure (Vercel / CF / Nginx routing per tenant)

---

### 4.7 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Multi-tenant data isolation failures (white-label) | Critical | Full RLS audit per table; automated cross-tenant data leak tests |
| CAQH API availability and data freshness | High | Cache CAQH data; alert if sync older than 30 days; manual override |
| Audit log tampering | Critical | Append-only RLS; write to separate immutable store (S3 + hash chain) |
| License verification API inconsistencies by state | High | Manual override flow; admin review queue for unmatched state responses |
| Custom domain TLS provisioning failures | Medium | Automate via Let's Encrypt / Vercel; fallback to platform subdomain |
| Compliance dashboard metric accuracy (note completion %) | Medium | Define and document metric formulas; build validation test suite |

---

### 4.8 Business Value

- Credentialing tracking eliminates missed recredentialing and payer disenrollment risk
- CAQH integration reduces manual data re-entry across payer applications
- Compliance dashboards enable proactive risk management for group practices
- Immutable audit logs satisfy HIPAA and state audit requirements
- Multi-location/white-label unlocks enterprise and DSO-style group practice market
- Multi-state payer support enables geographically distributed practices

---

### 4.9 Recommended Release Order Within Phase 4

```
Sprint 1  → Audit log infrastructure (append-only, all tables)
Sprint 2  → License and DEA tracking, expiration reminders
Sprint 3  → Credentialing tracking (per payer, status board)
Sprint 4  → CAQH ProView integration (sync + change alerts)
Sprint 5  → Provider enrollment tracking
Sprint 6  → Payer contract tracking, recredentialing reminders
Sprint 7  → Compliance dashboards (note completion, auth compliance)
Sprint 8  → Multi-location support (location model, global switcher)
Sprint 9  → Advanced reporting dashboards (custom ranges, export)
Sprint 10 → Multi-state payer support, white-label (domain, branding), UAT
```

---

---

## Cross-Phase Dependencies <a id="cross-phase-dependencies"></a>

```
Phase 1 ──► Phase 2: Patient DB, claims model, role system, payer table
Phase 1 ──► Phase 3: Patient DB, role system, appointment model seeds
Phase 2 ──► Phase 3: Appointment model, scheduling, eligibility
Phase 1 ──► Phase 4: User/org model, billing alerts, reporting foundation
Phase 3 ──► Phase 4: Progress notes, supervisor workflows, compliance metrics
Phase 2 ──► Phase 4: Claim submission, ERA, multi-location billing

Key shared tables (must be stable before dependent phases build on them):
  patients, organizations, users, claims, payers, appointments
```

---

## Global Risks & Mitigations <a id="global-risks"></a>

| Risk | Phase | Mitigation |
|------|-------|------------|
| HIPAA breach via unsecured PHI | All | Encryption at rest + in transit; RLS; audit logs; BAAs with all vendors |
| Prompt injection through clinical notes into LLM | 1, 3 | Sanitize all user input; never pass raw PHI to LLM; output validation |
| Vendor lock-in (Office Ally, Daily.co, Stripe) | 2, 3 | Abstraction layer per integration; alternative providers documented |
| Scope creep delaying Phase 1 launch | 1 | Strict phase acceptance criteria; defer any Phase 2+ feature requests |
| Supabase RLS misconfiguration causing cross-org data exposure | All | Automated RLS test suite per table; CI/CD gate on RLS policy changes |
| HIPAA BAA not in place before Go-Live | 2, 3 | BAA checklist as launch gate; legal sign-off required |
| State-specific behavioral health billing rules | 2, 4 | Payer rule configuration table; state-level override capability |
