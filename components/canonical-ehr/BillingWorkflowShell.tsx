"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type BillingView =
  | "hub"
  | "submitClaims"
  | "paperClaims"
  | "claimHistory"
  | "rejectedClaims"
  | "patientStatements"
  | "patientBalances"
  | "clientPayments"
  | "insurancePayments"
  | "eraPosting"
  | "reports"
  | "billingWorkqueue";

type Severity = "ready" | "warning" | "danger" | "info" | "neutral";

type ClaimCharge = {
  id: string;
  patientName: string;
  patientId: string;
  dateOfService: string;
  provider: string;
  cpt: string;
  payer: string;
  amount: number;
  status: "ready_to_submit" | "submitted" | "accepted" | "rejected" | "processed";
  issue?: string;
  clearinghouseTraceId?: string;
};

type PatientBalance = {
  patientName: string;
  patientId: string;
  insuranceBalance: number;
  patientBalance: number;
  lastStatement: string;
  statementStatus: "not_sent" | "sent" | "due" | "overdue";
};

type PaymentRow = {
  id: string;
  source: "patient" | "insurance" | "era";
  payerOrPatient: string;
  amount: number;
  method: string;
  receivedDate: string;
  appliedStatus: "unapplied" | "partially_applied" | "applied";
};

const readyCharges: ClaimCharge[] = [
  {
    id: "CHG-1001",
    patientName: "Avery Morgan",
    patientId: "CO-BH-1042",
    dateOfService: "2026-04-28",
    provider: "Lena Ortiz, LPC",
    cpt: "90837",
    payer: "Colorado Medicaid / RAE 3",
    amount: 165,
    status: "ready_to_submit",
  },
  {
    id: "CHG-1002",
    patientName: "Sofia Martinez",
    patientId: "CO-BH-1043",
    dateOfService: "2026-04-29",
    provider: "Noah Kim, LCSW",
    cpt: "90834",
    payer: "Anthem Colorado",
    amount: 145,
    status: "ready_to_submit",
    issue: "Guardian subscriber relationship should be verified before submission.",
  },
];

const claimHistory: ClaimCharge[] = [
  {
    id: "CLM-2401",
    patientName: "Avery Morgan",
    patientId: "CO-BH-1042",
    dateOfService: "2026-04-14",
    provider: "Lena Ortiz, LPC",
    cpt: "90837",
    payer: "Colorado Medicaid / RAE 3",
    amount: 165,
    status: "accepted",
    clearinghouseTraceId: "OA-277CA-775192",
  },
  {
    id: "CLM-2402",
    patientName: "Marcus Thompson",
    patientId: "CO-BH-1044",
    dateOfService: "2026-04-21",
    provider: "Priya Shah, PsyD",
    cpt: "90791",
    payer: "Self Pay",
    amount: 220,
    status: "processed",
    clearinghouseTraceId: "MANUAL-SELF-PAY",
  },
];

const rejectedClaims: ClaimCharge[] = [
  {
    id: "REJ-8821",
    patientName: "Sofia Martinez",
    patientId: "CO-BH-1043",
    dateOfService: "2026-04-17",
    provider: "Noah Kim, LCSW",
    cpt: "90837",
    payer: "Anthem Colorado",
    amount: 165,
    status: "rejected",
    issue: "Subscriber date of birth mismatch. Update billing settings, rebuild claim, and resubmit.",
    clearinghouseTraceId: "OA-999-112481",
  },
];

const balances: PatientBalance[] = [
  {
    patientName: "Avery Morgan",
    patientId: "CO-BH-1042",
    insuranceBalance: 330,
    patientBalance: 25,
    lastStatement: "2026-04-01",
    statementStatus: "sent",
  },
  {
    patientName: "Sofia Martinez",
    patientId: "CO-BH-1043",
    insuranceBalance: 165,
    patientBalance: 0,
    lastStatement: "Not sent",
    statementStatus: "not_sent",
  },
  {
    patientName: "Marcus Thompson",
    patientId: "CO-BH-1044",
    insuranceBalance: 0,
    patientBalance: 220,
    lastStatement: "2026-04-15",
    statementStatus: "due",
  },
];

const payments: PaymentRow[] = [
  {
    id: "PAY-9001",
    source: "patient",
    payerOrPatient: "Marcus Thompson",
    amount: 110,
    method: "Card",
    receivedDate: "2026-04-25",
    appliedStatus: "partially_applied",
  },
  {
    id: "PAY-9002",
    source: "insurance",
    payerOrPatient: "Colorado Medicaid / RAE 3",
    amount: 121.44,
    method: "EOB",
    receivedDate: "2026-04-26",
    appliedStatus: "unapplied",
  },
  {
    id: "ERA-4041",
    source: "era",
    payerOrPatient: "Anthem Colorado",
    amount: 98.72,
    method: "835 ERA",
    receivedDate: "2026-04-27",
    appliedStatus: "unapplied",
  },
];

const sections = [
  {
    title: "Insurance Billing",
    description: "Payer-facing claim submission and claim repair workflows.",
    items: [
      { label: "Submit Electronic Claims", href: "/billing/scrub", count: "2 ready", tone: "ready" as Severity },
      { label: "Create CMS-1500 Forms", href: "/billing/cms-1500", count: "Paper", tone: "info" as Severity },
      { label: "Electronic Claim History", href: "/claims/submissions", count: "2 recent", tone: "neutral" as Severity },
      { label: "Rejected Claims", href: "/billing/rejections", count: "1 open", tone: "danger" as Severity },
    ],
  },
  {
    title: "Patient Billing",
    description: "Patient responsibility, balances, statements, and chart-linked billing accounts.",
    items: [
      { label: "Generate Patient Statements", href: "/billing/statements", count: "Batch", tone: "info" as Severity },
      { label: "View Patient Balances", href: "/billing/ar", count: "$245 due", tone: "warning" as Severity },
      { label: "Open Patient Billing Accounts", href: "/patients", count: "Charts", tone: "neutral" as Severity },
    ],
  },
  {
    title: "Payments",
    description: "Post client payments, insurance EOBs, and electronic remittance files.",
    items: [
      { label: "Enter Client Payments", href: "/payments?mode=client", count: "Manual", tone: "neutral" as Severity },
      { label: "Enter Insurance Payments", href: "/payments?mode=insurance", count: "EOB", tone: "neutral" as Severity },
      { label: "ERA Posting", href: "/payments?mode=era", count: "835", tone: "ready" as Severity },
    ],
  },
  {
    title: "Reports & Tools",
    description: "Static reports and operational utilities. Reports summarize work; they do not replace workflows.",
    items: [
      { label: "A/R Reports", href: "/billing/reports", count: "Aging", tone: "info" as Severity },
      { label: "Insurance Aging", href: "/billing/reports?report=insurance-aging", count: "Aging", tone: "warning" as Severity },
      { label: "Payment Reports", href: "/billing/reports?report=payments", count: "Payments", tone: "neutral" as Severity },
      { label: "Advanced Workqueue", href: "/billing/workqueue", count: "Optional", tone: "purple" as Severity },
    ],
  },
];

function currency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Severity | "purple" }) {
  return <span className={`billing-badge billing-badge-${tone}`}>{children}</span>;
}

const billingStyles = `
.billing-page {
  width: min(1240px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 48px;
  color: #0f172a;
}

.billing-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 28px;
  border: 1px solid #dbe3ee;
  border-radius: 28px;
  background: linear-gradient(135deg, #ffffff, #f8fbff);
  box-shadow: 0 18px 55px rgba(15, 23, 42, 0.08);
}

.billing-hero h1 {
  margin: 6px 0 8px;
  font-size: clamp(32px, 5vw, 56px);
  line-height: 0.95;
  letter-spacing: -0.06em;
}

.billing-hero p {
  max-width: 760px;
  color: #53627a;
  font-size: 15px;
  line-height: 1.6;
}

.billing-eyebrow {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2563eb;
}

.billing-actions,
.billing-action-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.billing-action-panel {
  margin: 18px 0;
  padding: 16px;
  border: 1px solid #dbe3ee;
  border-radius: 22px;
  background: #ffffff;
}

.billing-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 9px 13px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
  text-decoration: none;
  cursor: pointer;
}

.billing-button.primary {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.billing-button.danger {
  border-color: #e11d48;
  background: #fff1f2;
  color: #be123c;
}

.billing-stat-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}

.billing-stat-strip > div {
  padding: 18px;
  border: 1px solid #dbe3ee;
  border-radius: 22px;
  background: #ffffff;
}

.billing-stat-strip span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.billing-stat-strip strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
  letter-spacing: -0.04em;
}

.billing-section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.billing-section-card,
.billing-insight-card {
  padding: 22px;
  border: 1px solid #dbe3ee;
  border-radius: 26px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.billing-section-card h2,
.billing-insight-card h2 {
  margin: 0;
  font-size: 21px;
  letter-spacing: -0.03em;
}

.billing-section-card p,
.billing-insight-card p {
  margin: 8px 0 0;
  color: #53627a;
  font-size: 14px;
  line-height: 1.55;
}

.billing-link-list {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.billing-workflow-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #f8fafc;
  color: #0f172a;
  font-weight: 850;
  text-decoration: none;
}

.billing-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  border-radius: 999px;
  padding: 5px 9px;
  border: 1px solid #dbe3ee;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.billing-badge-ready {
  border-color: #a7f3d0;
  background: #ecfdf5;
  color: #047857;
}

.billing-badge-warning {
  border-color: #fde68a;
  background: #fffbeb;
  color: #b45309;
}

.billing-badge-danger {
  border-color: #fecdd3;
  background: #fff1f2;
  color: #be123c;
}

.billing-badge-info {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.billing-badge-purple {
  border-color: #ddd6fe;
  background: #f5f3ff;
  color: #6d28d9;
}

.billing-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.billing-flow span {
  padding: 10px 12px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 850;
}

.billing-callout {
  margin: 18px 0;
  padding: 16px;
  border-radius: 20px;
  font-weight: 800;
  line-height: 1.5;
}

.billing-callout.warning {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.billing-callout.danger {
  border: 1px solid #fecdd3;
  background: #fff1f2;
  color: #9f1239;
}

.billing-table-wrap {
  margin-top: 18px;
  overflow-x: auto;
  border: 1px solid #dbe3ee;
  border-radius: 22px;
  background: #ffffff;
}

.billing-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

.billing-table th,
.billing-table td {
  padding: 14px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: top;
  font-size: 14px;
}

.billing-table th {
  color: #64748b;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: #f8fafc;
}

.billing-table td small {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.billing-warning {
  margin: 8px 0 0;
  max-width: 280px;
  color: #b45309;
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 900px) {
  .billing-hero {
    flex-direction: column;
  }

  .billing-stat-strip,
  .billing-section-grid {
    grid-template-columns: 1fr;
  }

  .billing-actions,
  .billing-action-panel,
  .billing-button {
    width: 100%;
  }
}
`;

function PageShell({ title, eyebrow, description, children, actions }: {
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <>
    <style jsx global>{billingStyles}</style>
    <main className="billing-page">
      <section className="billing-hero">
        <div>
          <div className="billing-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="billing-actions">{actions}</div>
      </section>
      {children}
    </main>
    </>
  );
}

function StatStrip() {
  return (
    <section className="billing-stat-strip">
      <div>
        <span>Ready to submit</span>
        <strong>{readyCharges.length}</strong>
      </div>
      <div>
        <span>Rejected claims</span>
        <strong>{rejectedClaims.length}</strong>
      </div>
      <div>
        <span>Patient A/R</span>
        <strong>{currency(balances.reduce((sum, item) => sum + item.patientBalance, 0))}</strong>
      </div>
      <div>
        <span>Unapplied payments</span>
        <strong>{payments.filter((payment) => payment.appliedStatus !== "applied").length}</strong>
      </div>
    </section>
  );
}

function ChargeTable({ rows, mode }: { rows: ClaimCharge[]; mode: "ready" | "history" | "rejected" | "paper" }) {
  return (
    <div className="billing-table-wrap">
      <table className="billing-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>DOS</th>
            <th>Provider</th>
            <th>Service</th>
            <th>Payer</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.patientName}</strong>
                <small>{row.patientId}</small>
              </td>
              <td>{row.dateOfService}</td>
              <td>{row.provider}</td>
              <td>{row.cpt}</td>
              <td>{row.payer}</td>
              <td>{currency(row.amount)}</td>
              <td>
                <Badge tone={row.status === "rejected" ? "danger" : row.status === "ready_to_submit" ? "ready" : "info"}>
                  {titleCase(row.status)}
                </Badge>
                {row.issue ? <p className="billing-warning">{row.issue}</p> : null}
                {row.clearinghouseTraceId ? <small>{row.clearinghouseTraceId}</small> : null}
              </td>
              <td>
                {mode === "ready" ? <button className="billing-button primary">Submit Claim</button> : null}
                {mode === "rejected" ? <button className="billing-button danger">Fix & Resubmit</button> : null}
                {mode === "history" ? <button className="billing-button">View History</button> : null}
                {mode === "paper" ? <button className="billing-button">Generate CMS-1500</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceTable() {
  return (
    <div className="billing-table-wrap">
      <table className="billing-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Insurance Balance</th>
            <th>Patient Balance</th>
            <th>Last Statement</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((row) => (
            <tr key={row.patientId}>
              <td>
                <strong>{row.patientName}</strong>
                <small>{row.patientId}</small>
              </td>
              <td>{currency(row.insuranceBalance)}</td>
              <td>{currency(row.patientBalance)}</td>
              <td>{row.lastStatement}</td>
              <td><Badge tone={row.statementStatus === "overdue" ? "danger" : row.statementStatus === "due" ? "warning" : "info"}>{titleCase(row.statementStatus)}</Badge></td>
              <td><Link className="billing-button" href={`/patients/${row.patientId}/patient-billing`}>Open Billing</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentTable({ filter }: { filter?: PaymentRow["source"] }) {
  const rows = filter ? payments.filter((payment) => payment.source === filter) : payments;
  return (
    <div className="billing-table-wrap">
      <table className="billing-table">
        <thead>
          <tr>
            <th>Payment</th>
            <th>Source</th>
            <th>Payer / Patient</th>
            <th>Method</th>
            <th>Received</th>
            <th>Amount</th>
            <th>Apply</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((payment) => (
            <tr key={payment.id}>
              <td><strong>{payment.id}</strong></td>
              <td><Badge tone={payment.source === "era" ? "ready" : "info"}>{payment.source.toUpperCase()}</Badge></td>
              <td>{payment.payerOrPatient}</td>
              <td>{payment.method}</td>
              <td>{payment.receivedDate}</td>
              <td>{currency(payment.amount)}</td>
              <td>
                <Badge tone={payment.appliedStatus === "applied" ? "ready" : "warning"}>{titleCase(payment.appliedStatus)}</Badge>
                <button className="billing-button">Apply</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillingHub() {
  return (
    <PageShell
      eyebrow="Billing task routing"
      title="Billing"
      description="Choose the billing function you need. This page is a routing hub, not a single operational queue. Claim work, patient billing, payments, ERA, and reports each open dedicated workflows."
      actions={
        <>
          <Link className="billing-button primary" href="/billing/scrub">Submit Claims</Link>
          <Link className="billing-button" href="/billing/rejections">Rejected Claims</Link>
          <Link className="billing-button" href="/payments">Post Payments</Link>
        </>
      }
    >
      <StatStrip />
      <section className="billing-section-grid">
        {sections.map((section) => (
          <article className="billing-section-card" key={section.title}>
            <div>
              <h2>{section.title}</h2>
              <p>{section.description}</p>
            </div>
            <div className="billing-link-list">
              {section.items.map((item) => (
                <Link className="billing-workflow-link" href={item.href} key={item.label}>
                  <span>{item.label}</span>
                  <Badge tone={item.tone}>{item.count}</Badge>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="billing-insight-card">
        <h2>How billing flows through the system</h2>
        <div className="billing-flow">
          <span>Signed Note</span>
          <span>Charge</span>
          <span>Ready to Submit</span>
          <span>Claim</span>
          <span>History / Rejection</span>
          <span>ERA / Payment</span>
          <span>Patient Statement</span>
        </div>
        <p>
          Billing is built on top of appointment, encounter, documentation, charge, claim, and payment objects.
          The hub separates tasks so billers do not have to work from a cluttered universal dashboard.
        </p>
      </section>
    </PageShell>
  );
}

function SubmitClaims() {
  return (
    <PageShell
      eyebrow="Insurance Billing"
      title="Submit Electronic Claims"
      description="Signed notes generate charges. Ready charges appear here for final review and electronic submission. Scheduling and documentation do not create claims directly."
      actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}
    >
      <div className="billing-callout warning">
        Review payer, subscriber, diagnosis pointer, service code, modifier, place of service, and charge before submission.
      </div>
      <ChargeTable rows={readyCharges} mode="ready" />
    </PageShell>
  );
}

function PaperClaims() {
  return (
    <PageShell
      eyebrow="Insurance Billing"
      title="Create CMS-1500 Forms"
      description="Generate paper claim forms from ready charges when electronic submission is unavailable or payer policy requires paper."
      actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}
    >
      <ChargeTable rows={readyCharges} mode="paper" />
    </PageShell>
  );
}

function ClaimHistory() {
  return (
    <PageShell
      eyebrow="Claims & Submission"
      title="Electronic Claim History"
      description="Submitted claims and clearinghouse responses live here. This is a tracking log, not the primary place to fix claims."
      actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}
    >
      <ChargeTable rows={claimHistory} mode="history" />
    </PageShell>
  );
}

function RejectedClaims() {
  return (
    <PageShell
      eyebrow="Insurance Billing"
      title="Rejected Claims"
      description="Fix claim validation or payer rejection issues and resubmit. Rejections are separate from denials after adjudication."
      actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}
    >
      <div className="billing-callout danger">
        Rejected claims usually failed before adjudication. Correct demographics, subscriber, payer ID, NPI, diagnosis pointer, or procedure details before resubmitting.
      </div>
      <ChargeTable rows={rejectedClaims} mode="rejected" />
    </PageShell>
  );
}

function PatientStatements() {
  return (
    <PageShell
      eyebrow="Patient Billing"
      title="Generate Patient Statements"
      description="Create patient statements individually or in batches from patient responsibility balances."
      actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}
    >
      <div className="billing-action-panel">
        <button className="billing-button primary">Generate Batch Statements</button>
        <button className="billing-button">Preview Statement Run</button>
        <button className="billing-button">Export Statement CSV</button>
      </div>
      <BalanceTable />
    </PageShell>
  );
}

function PatientBalances() {
  return (
    <PageShell
      eyebrow="Patient Billing"
      title="Patient Balances"
      description="Review patient responsibility without exposing the full claim lifecycle. Detailed per-patient A/R remains anchored in the chart."
      actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}
    >
      <BalanceTable />
    </PageShell>
  );
}

function Payments({ mode }: { mode?: "client" | "insurance" | "era" }) {
  const title = mode === "client" ? "Enter Client Payments" : mode === "insurance" ? "Enter Insurance Payments" : mode === "era" ? "ERA Posting" : "Payments";
  const description = mode === "era"
    ? "Import and auto-post 835 remittance files, then review unmatched or partially matched payments."
    : mode === "insurance"
      ? "Manually post insurance EOB data including allowed amount, adjustments, paid amount, and patient responsibility."
      : mode === "client"
        ? "Record cash, check, card, and portal payments and apply them to open patient balances."
        : "Post patient payments, insurance payments, and ERA files.";

  const filter = mode === "client" ? "patient" : mode === "insurance" ? "insurance" : mode === "era" ? "era" : undefined;

  return (
    <PageShell eyebrow="Payments" title={title} description={description} actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}>
      <div className="billing-action-panel">
        <button className="billing-button primary">{mode === "era" ? "Import 835 ERA" : "Enter Payment"}</button>
        <button className="billing-button">Find Open Charges</button>
        <button className="billing-button">Unapplied Payments</button>
      </div>
      <PaymentTable filter={filter as PaymentRow["source"] | undefined} />
    </PageShell>
  );
}

function Reports() {
  const reportCards = [
    ["A/R Aging", "Patient and insurance balances by age bucket."],
    ["Insurance Aging", "Claims by payer, date submitted, and expected follow-up."],
    ["Payment Report", "Payments entered, applied, unapplied, and ERA totals."],
    ["Transaction Report", "Charges, payments, write-offs, and adjustments."],
  ];

  return (
    <PageShell eyebrow="Reports & Tools" title="Reports" description="Reports summarize billing activity. They are not workqueues; use workflows to fix issues." actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}>
      <section className="billing-section-grid">
        {reportCards.map(([title, description]) => (
          <article className="billing-section-card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <button className="billing-button">Run Report</button>
          </article>
        ))}
      </section>
    </PageShell>
  );
}

function BillingWorkqueue() {
  return (
    <PageShell
      eyebrow="Advanced Billing"
      title="Optional Advanced Workqueue"
      description="Your canonical system can support a true workqueue, but this billing landing page remains a task-routing hub. Use this screen only for escalations and exceptions."
      actions={<Link className="billing-button" href="/billing">Back to Billing</Link>}
    >
      <section className="billing-section-grid">
        <article className="billing-section-card">
          <h2>Documentation Holds</h2>
          <p>Encounters signed incorrectly, missing treatment goal links, or needing addenda.</p>
          <Badge tone="warning">2 items</Badge>
        </article>
        <article className="billing-section-card">
          <h2>Billing Review Tickets</h2>
          <p>Clinician-created messages routed to billers from the chart or encounter.</p>
          <Badge tone="purple">1 item</Badge>
        </article>
        <article className="billing-section-card">
          <h2>ERA Exceptions</h2>
          <p>Unmatched payments, partial matches, and payer adjustments needing review.</p>
          <Badge tone="danger">1 item</Badge>
        </article>
      </section>
    </PageShell>
  );
}

export function BillingWorkflowShell({ view }: { view: BillingView }) {
  const [queryMode] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("mode") ?? "";
  });

  const resolvedPaymentMode = useMemo(() => {
    if (queryMode === "client") return "client";
    if (queryMode === "insurance") return "insurance";
    if (queryMode === "era") return "era";
    return undefined;
  }, [queryMode]);

  if (view === "hub") return <BillingHub />;
  if (view === "submitClaims") return <SubmitClaims />;
  if (view === "paperClaims") return <PaperClaims />;
  if (view === "claimHistory") return <ClaimHistory />;
  if (view === "rejectedClaims") return <RejectedClaims />;
  if (view === "patientStatements") return <PatientStatements />;
  if (view === "patientBalances") return <PatientBalances />;
  if (view === "clientPayments") return <Payments mode="client" />;
  if (view === "insurancePayments") return <Payments mode="insurance" />;
  if (view === "eraPosting") return <Payments mode="era" />;
  if (view === "reports") return <Reports />;
  if (view === "billingWorkqueue") return <BillingWorkqueue />;

  return <Payments mode={resolvedPaymentMode as "client" | "insurance" | "era" | undefined} />;
}
