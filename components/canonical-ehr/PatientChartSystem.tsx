"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type ChartDocument,
  type PatientChartRecord,
  type PatientChartTab,
  formatMoney,
  getInsuranceBalance,
  getPatientBalance,
  getPatientChartRecord,
  getPatientResponsibility
} from "./patientChartData";
import styles from "./PatientChartSystem.module.css";

interface PatientChartSystemProps {
  patientId: string;
  initialTab?: PatientChartTab;
}

const tabLabels: Array<{ id: PatientChartTab; label: string; description: string }> = [
  { id: "profile", label: "Profile / Patient Info", description: "Demographic and administrative foundation" },
  { id: "documents", label: "Documents", description: "Legal clinical record and uploaded files" },
  { id: "billing-settings", label: "Billing Settings", description: "Insurance, authorizations, rates, and billing notes" },
  { id: "patient-billing", label: "Patient Billing", description: "Patient-level A/R ledger, statements, and payments" },
  { id: "authorizations", label: "Authorizations", description: "Visit limits, date ranges, and utilization" },
  { id: "cards", label: "Credit Cards", description: "Stored payment methods" },
  { id: "portal", label: "Portal", description: "Patient-facing access and shared documents" }
];

function classNames(...items: Array<string | false | undefined>): string {
  return items.filter(Boolean).join(" ");
}

function badgeTone(status: string): string {
  const normalized = status.toLowerCase();
  if (["signed", "active", "current", "paid", "uploaded"].includes(normalized)) return styles.green;
  if (["draft", "expiring", "sent", "invited"].includes(normalized)) return styles.amber;
  if (["expired", "inactive", "void", "disabled"].includes(normalized)) return styles.red;
  return styles.purple;
}

function fullName(record: PatientChartRecord): string {
  return [record.identity.firstName, record.identity.middleName, record.identity.lastName].filter(Boolean).join(" ");
}

function initials(record: PatientChartRecord): string {
  return `${record.identity.firstName[0] ?? ""}${record.identity.lastName[0] ?? ""}`.toUpperCase();
}

function InfoBox({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={classNames(styles.infoBox, wide && styles.infoBoxWide)}>
      <p className={styles.infoLabel}>{label}</p>
      <p className={styles.infoValue}>{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={classNames(styles.badge, tone)}>{children}</span>;
}

export default function PatientChartSystem({ patientId, initialTab = "profile" }: PatientChartSystemProps) {
  const baseRecord = useMemo(() => getPatientChartRecord(patientId), [patientId]);
  const [record, setRecord] = useState<PatientChartRecord>(baseRecord);
  const [activeTab, setActiveTab] = useState<PatientChartTab>(initialTab);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [newNoteSummary, setNewNoteSummary] = useState("");
  const [newPaymentAmount, setNewPaymentAmount] = useState("40");

  const patientBalance = getPatientBalance(record);
  const insuranceBalance = getInsuranceBalance(record);
  const patientResponsibility = getPatientResponsibility(record);
  const draftDocuments = record.documents.filter((document) => document.status === "draft").length;
  const signedDocuments = record.documents.filter((document) => document.status === "signed").length;

  function createDraftNote() {
    const nextDocument: ChartDocument = {
      id: `doc_${Date.now()}`,
      type: "Progress Note",
      dateOfService: new Date().toISOString().slice(0, 10),
      status: "draft",
      author: record.identity.assignedClinician,
      title: "New Progress Note",
      summary:
        newNoteSummary.trim() ||
        "Draft clinical note created from patient chart. Complete clinical content, risk assessment, progress toward goals, and plan before signing.",
      locked: false,
      source: "clinical_note"
    };

    setRecord((current) => ({ ...current, documents: [nextDocument, ...current.documents] }));
    setNewNoteSummary("");
    setShowNoteComposer(false);
    setActiveTab("documents");
  }

  function signDocument(documentId: string) {
    setRecord((current) => ({
      ...current,
      documents: current.documents.map((document) =>
        document.id === documentId
          ? { ...document, status: "signed", locked: true, summary: `${document.summary} Signed and locked for audit protection.` }
          : document
      )
    }));
  }

  function uploadDocument() {
    const uploaded: ChartDocument = {
      id: `upload_${Date.now()}`,
      type: "Uploaded File",
      dateOfService: new Date().toISOString().slice(0, 10),
      status: "uploaded",
      author: "Front Desk",
      title: "External Document Upload",
      summary: "Uploaded file placeholder. In production, this action stores the file and metadata.",
      locked: true,
      source: "uploaded_file"
    };

    setRecord((current) => ({ ...current, documents: [uploaded, ...current.documents] }));
    setShowDocumentUpload(false);
    setActiveTab("documents");
  }

  function postPatientPayment() {
    const amount = Number(newPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const nextBalance = Math.max(getPatientBalance(record) - amount, 0);
    setRecord((current) => ({
      ...current,
      transactions: [
        ...current.transactions,
        {
          id: `txn_${Date.now()}`,
          type: "patient_payment",
          date: new Date().toISOString().slice(0, 10),
          description: "Manual patient payment",
          amount: -amount,
          insurancePortion: 0,
          patientPortion: -amount,
          balanceAfter: nextBalance
        }
      ]
    }));

    setShowPaymentPanel(false);
    setActiveTab("patient-billing");
  }

  function generateStatement() {
    const balance = getPatientBalance(record);
    setRecord((current) => ({
      ...current,
      statements: [{ id: `stmt_${Date.now()}`, date: new Date().toISOString().slice(0, 10), amount: balance, status: "draft" }, ...current.statements]
    }));
    setActiveTab("patient-billing");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.patientIdentity}>
              <div className={styles.avatar}>{initials(record)}</div>
              <div>
                <div className={styles.kicker}>
                  <Badge tone={styles.green}>{record.identity.status}</Badge>
                  <Badge tone={styles.blue}>{record.identity.internalId}</Badge>
                  <Badge tone={styles.purple}>{record.identity.assignedClinician}</Badge>
                </div>
                <h1 className={styles.patientName}>
                  {record.identity.preferredName} {record.identity.lastName}
                </h1>
                <p className={styles.meta}>
                  Legal: {fullName(record)} · DOB {record.identity.dob} · Age {record.identity.age} · {record.identity.pronouns} · {record.identity.location}
                </p>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={classNames(styles.button, styles.primaryButton)} onClick={() => setShowNoteComposer((value) => !value)}>Create Note</button>
              <button className={styles.button} onClick={() => setShowSchedulePanel((value) => !value)}>Schedule Appointment</button>
              <button className={styles.button} onClick={() => setShowDocumentUpload((value) => !value)}>Upload Document</button>
              <button className={classNames(styles.button, styles.successButton)} onClick={() => setShowPaymentPanel((value) => !value)}>Post Payment</button>
              <Link className={classNames(styles.button, styles.warningButton)} href="/billing/workqueue">Billing Actions</Link>
            </div>
          </div>

          <div className={styles.headerStats}>
            <div className={styles.stat}><p className={styles.label}>Patient Balance</p><p className={styles.value}>{formatMoney(patientBalance)}</p></div>
            <div className={styles.stat}><p className={styles.label}>Insurance A/R</p><p className={styles.value}>{formatMoney(insuranceBalance)}</p></div>
            <div className={styles.stat}><p className={styles.label}>Draft / Signed Docs</p><p className={styles.value}>{draftDocuments} draft · {signedDocuments} signed</p></div>
            <div className={styles.stat}><p className={styles.label}>Primary Payer</p><p className={styles.value}>{record.billingSettings.policies[0]?.payerName ?? "No active policy"}</p></div>
          </div>
        </section>

        {(showNoteComposer || showSchedulePanel || showDocumentUpload || showPaymentPanel) && (
          <section className={styles.drawer}>
            {showNoteComposer && (
              <div className={styles.formPanel}>
                <h2 className={styles.cardTitle}>Create Clinical Note</h2>
                <p className={styles.cardSubtitle}>Draft notes are editable. Signed notes lock into the legal medical record.</p>
                <label className={styles.field}>Clinical summary
                  <textarea className={styles.textarea} value={newNoteSummary} onChange={(event) => setNewNoteSummary(event.target.value)} placeholder="Presentation, interventions, response, risk, goals, plan..." />
                </label>
                <div className={styles.actions}><button className={classNames(styles.button, styles.primaryButton)} onClick={createDraftNote}>Create Draft Note</button><button className={styles.button} onClick={() => setShowNoteComposer(false)}>Cancel</button></div>
              </div>
            )}
            {showSchedulePanel && (
              <div className={styles.formPanel}>
                <h2 className={styles.cardTitle}>Schedule Appointment</h2>
                <p className={styles.cardSubtitle}>Creates a calendar appointment tied to patient_id. Completed appointments create encounters.</p>
                <div className={styles.sectionGrid}><InfoBox label="Patient" value={`${record.identity.preferredName} ${record.identity.lastName}`} /><InfoBox label="Clinician" value={record.identity.assignedClinician} /></div>
                <div className={styles.actions}><Link className={classNames(styles.button, styles.primaryButton)} href="/scheduling">Open Scheduling</Link><button className={styles.button} onClick={() => setShowSchedulePanel(false)}>Close</button></div>
              </div>
            )}
            {showDocumentUpload && (
              <div className={styles.formPanel}>
                <h2 className={styles.cardTitle}>Upload Document</h2>
                <p className={styles.cardSubtitle}>Production stores a file object and document metadata. This demo creates the chart document row.</p>
                <div className={styles.actions}><button className={classNames(styles.button, styles.primaryButton)} onClick={uploadDocument}>Add Uploaded Document</button><button className={styles.button} onClick={() => setShowDocumentUpload(false)}>Cancel</button></div>
              </div>
            )}
            {showPaymentPanel && (
              <div className={styles.formPanel}>
                <h2 className={styles.cardTitle}>Post Manual Payment</h2>
                <label className={styles.field}>Payment amount<input className={styles.input} value={newPaymentAmount} onChange={(event) => setNewPaymentAmount(event.target.value)} /></label>
                <div className={styles.actions}><button className={classNames(styles.button, styles.successButton)} onClick={postPatientPayment}>Apply Payment</button><button className={styles.button} onClick={() => setShowPaymentPanel(false)}>Cancel</button></div>
              </div>
            )}
          </section>
        )}

        <nav className={styles.tabs} aria-label="Patient chart tabs">
          {tabLabels.map((tab) => (
            <button key={tab.id} type="button" className={classNames(styles.tab, activeTab === tab.id && styles.activeTab)} onClick={() => setActiveTab(tab.id)} title={tab.description}>{tab.label}</button>
          ))}
        </nav>

        <section className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            {activeTab === "profile" && <ProfileTab record={record} />}
            {activeTab === "documents" && <DocumentsTab documents={record.documents} onSign={signDocument} />}
            {activeTab === "billing-settings" && <BillingSettingsTab record={record} />}
            {activeTab === "patient-billing" && <PatientBillingTab record={record} onGenerateStatement={generateStatement} onPostPayment={() => setShowPaymentPanel(true)} />}
            {activeTab === "authorizations" && <AuthorizationsTab record={record} />}
            {activeTab === "cards" && <CardsTab record={record} />}
            {activeTab === "portal" && <PortalTab record={record} />}
          </div>

          <aside className={styles.sideColumn}>
            <ChartIntegrityPanel record={record} />
            <DownstreamImpactPanel />
            <QuickTimelinePanel record={record} />
          </aside>
        </section>
      </div>
    </main>
  );
}

function ProfileTab({ record }: { record: PatientChartRecord }) {
  return (
    <section className={styles.card}><div className={styles.cardBody}>
      <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Profile / Patient Info</h2><p className={styles.cardSubtitle}>Demographic and administrative foundation. Errors here propagate into claims, statements, and portal access.</p></div><Badge tone={styles.blue}>System of record</Badge></div>
      <div className={styles.sectionGrid}>
        <InfoBox label="Legal Name" value={fullName(record)} /><InfoBox label="Preferred Name" value={record.identity.preferredName} /><InfoBox label="DOB / Age" value={`${record.identity.dob} · ${record.identity.age}`} /><InfoBox label="Gender / Pronouns" value={`${record.identity.genderIdentity} · ${record.identity.pronouns}`} /><InfoBox label="Sex at Birth" value={record.identity.sexAtBirth} /><InfoBox label="SSN Last 4" value={record.identity.ssnLast4 ?? "Not recorded"} /><InfoBox label="Phone" value={record.contact.phone} /><InfoBox label="Email" value={record.contact.email} /><InfoBox label="Address" value={`${record.contact.addressLine1}${record.contact.addressLine2 ? `, ${record.contact.addressLine2}` : ""}, ${record.contact.city}, ${record.contact.state} ${record.contact.zip}`} wide /><InfoBox label="Emergency Contact" value={`${record.contact.emergencyContactName} · ${record.contact.emergencyContactPhone}`} /><InfoBox label="Guarantor" value={`${record.contact.guarantorName} · ${record.contact.guarantorRelationship} · ${record.contact.guarantorPhone}`} /><InfoBox label="Assigned Clinician" value={record.identity.assignedClinician} /><InfoBox label="Location" value={record.identity.location} /><InfoBox label="Referral Source" value={record.identity.referralSource} />
      </div>
    </div></section>
  );
}

function DocumentsTab({ documents, onSign }: { documents: ChartDocument[]; onSign: (documentId: string) => void }) {
  return <section className={styles.card}><div className={styles.cardBody}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Documents</h2><p className={styles.cardSubtitle}>Clinical notes, intake assessments, treatment plans, uploaded files, and signed forms. Newest first.</p></div><Badge tone={styles.green}>Legal medical record</Badge></div><div className={styles.documentList}>{documents.map((document) => <article key={document.id} className={styles.documentCard}><div className={styles.documentTop}><div><h3 className={styles.documentTitle}>{document.title}</h3><p className={styles.documentMeta}>{document.type} · DOS {document.dateOfService} · {document.author}</p></div><Badge tone={badgeTone(document.status)}>{document.locked ? `${document.status} · locked` : `${document.status} · editable`}</Badge></div><p className={styles.documentSummary}>{document.summary}</p><div className={styles.documentActions}>{!document.locked && <button className={classNames(styles.button, styles.smallButton)} type="button">Edit Draft</button>}{!document.locked && <button className={classNames(styles.button, styles.smallButton, styles.successButton)} type="button" onClick={() => onSign(document.id)}>Sign + Lock</button>}{document.locked && <button className={classNames(styles.button, styles.smallButton)} type="button">Add Addendum</button>}<button className={classNames(styles.button, styles.smallButton)} type="button" onClick={() => window.print()}>Download PDF</button></div></article>)}</div></div></section>;
}

function BillingSettingsTab({ record }: { record: PatientChartRecord }) {
  return <section className={styles.card}><div className={styles.cardBody}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Billing Settings</h2><p className={styles.cardSubtitle}>Insurance, subscriber data, financial settings, authorizations, and internal billing notes.</p></div><Badge tone={styles.amber}>Feeds claims + eligibility</Badge></div><div className={styles.list}>{record.billingSettings.policies.map((policy) => <article className={styles.policyCard} key={policy.id}><div className={styles.rowTop}><div><h3 className={styles.rowTitle}>{policy.priority}: {policy.payerName}</h3><p className={styles.rowMeta}>{policy.payerType} · Member {policy.memberId} · Group {policy.groupNumber}</p></div><Badge tone={badgeTone(policy.status)}>{policy.status}</Badge></div><div className={styles.policyGrid}><InfoBox label="Subscriber" value={policy.subscriberName} /><InfoBox label="Relationship" value={policy.subscriberRelationship} /><InfoBox label="Effective" value={`${policy.effectiveDate} → ${policy.terminationDate ?? "Current"}`} /></div></article>)}<div className={styles.policyCard}><h3 className={styles.rowTitle}>Financial Settings</h3><div className={styles.moneyGrid}><InfoBox label="Copay Reference" value={formatMoney(record.billingSettings.copayReference)} /><InfoBox label="Private Pay Rate" value={formatMoney(record.billingSettings.privatePayRate)} /><InfoBox label="Sliding Scale Adjustment" value={formatMoney(record.billingSettings.slidingScaleAdjustment)} /></div></div><div className={styles.policyCard}><h3 className={styles.rowTitle}>Billing Notes</h3><div className={styles.list}>{record.billingSettings.billingNotes.map((note) => <div className={classNames(styles.callout, styles.blue)} key={note}>{note}</div>)}</div></div></div></div></section>;
}

function PatientBillingTab({ record, onGenerateStatement, onPostPayment }: { record: PatientChartRecord; onGenerateStatement: () => void; onPostPayment: () => void }) {
  return <section className={styles.card}><div className={styles.cardBody}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Patient Billing</h2><p className={styles.cardSubtitle}>Patient-level A/R ledger. Claim-level detail remains in Billing.</p></div><div className={styles.actions}><button className={classNames(styles.button, styles.successButton)} onClick={onPostPayment}>Enter Payment</button><button className={classNames(styles.button, styles.primaryButton)} onClick={onGenerateStatement}>Generate Statement</button></div></div><div className={styles.moneyGrid}><InfoBox label="Total Balance" value={formatMoney(getPatientBalance(record))} /><InfoBox label="Insurance Balance" value={formatMoney(getInsuranceBalance(record))} /><InfoBox label="Patient Responsibility" value={formatMoney(getPatientResponsibility(record))} /></div><div className={styles.list} style={{ marginTop: 16 }}>{record.transactions.map((transaction) => <article className={styles.transactionCard} key={transaction.id}><div className={styles.rowTop}><div><h3 className={styles.rowTitle}>{transaction.description}</h3><p className={styles.rowMeta}>{transaction.date} · {transaction.type.replaceAll("_", " ")}{transaction.linkedDateOfService ? ` · DOS ${transaction.linkedDateOfService}` : ""}{transaction.linkedClaimNumber ? ` · ${transaction.linkedClaimNumber}` : ""}</p></div><span className={classNames(styles.transactionAmount, transaction.amount < 0 ? styles.negativeAmount : styles.positiveAmount)}>{formatMoney(transaction.amount)}</span></div><p className={styles.rowText}>Balance after transaction: {formatMoney(transaction.balanceAfter)}</p></article>)}</div><div className={styles.cardBody}><h3 className={styles.cardTitle}>Statements</h3><div className={styles.list}>{record.statements.map((statement) => <article className={styles.statementCard} key={statement.id}><div className={styles.rowTop}><div><h4 className={styles.rowTitle}>{statement.id}</h4><p className={styles.rowMeta}>{statement.date}</p></div><Badge tone={badgeTone(statement.status)}>{statement.status}</Badge></div><p className={styles.rowText}>Statement amount: {formatMoney(statement.amount)}</p></article>)}</div></div></div></section>;
}

function AuthorizationsTab({ record }: { record: PatientChartRecord }) {
  const authorizations = record.billingSettings.authorizations;
  return <section className={styles.card}><div className={styles.cardBody}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Authorizations</h2><p className={styles.cardSubtitle}>Units authorized, utilization, date ranges, and visit limits.</p></div></div>{authorizations.length === 0 ? <div className={styles.empty}>No authorizations configured for this patient.</div> : <div className={styles.list}>{authorizations.map((authorization) => <article className={styles.policyCard} key={authorization.id}><div className={styles.rowTop}><div><h3 className={styles.rowTitle}>{authorization.authorizationNumber}</h3><p className={styles.rowMeta}>{authorization.payerName} · {authorization.serviceCodes.join(", ")}</p></div><Badge tone={badgeTone(authorization.status)}>{authorization.status}</Badge></div><div className={styles.policyGrid}><InfoBox label="Date Range" value={`${authorization.startDate} → ${authorization.endDate}`} /><InfoBox label="Units" value={`${authorization.unitsUsed} used / ${authorization.unitsAuthorized} authorized`} /><InfoBox label="Remaining" value={`${authorization.unitsAuthorized - authorization.unitsUsed}`} /></div></article>)}</div>}</div></section>;
}

function CardsTab({ record }: { record: PatientChartRecord }) {
  return <section className={styles.card}><div className={styles.cardBody}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Credit Cards / Payment Methods</h2><p className={styles.cardSubtitle}>Stored payment methods for copays, balances, and autopay workflows.</p></div><button className={styles.button}>Add Card</button></div>{record.paymentMethods.length === 0 ? <div className={styles.empty}>No payment methods stored.</div> : <div className={styles.list}>{record.paymentMethods.map((method) => <article className={styles.policyCard} key={method.id}><div className={styles.rowTop}><div><h3 className={styles.rowTitle}>{method.brand} ending {method.last4}</h3><p className={styles.rowMeta}>Expires {method.expiration}</p></div><Badge tone={badgeTone(method.status)}>{method.autopay ? "autopay" : method.status}</Badge></div></article>)}</div>}</div></section>;
}

function PortalTab({ record }: { record: PatientChartRecord }) {
  return <section className={styles.card}><div className={styles.cardBody}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Portal</h2><p className={styles.cardSubtitle}>Patient-facing access, messaging, shared forms, and shared documents.</p></div><Badge tone={record.portal.enabled ? styles.green : styles.red}>{record.portal.enabled ? "enabled" : "disabled"}</Badge></div><div className={styles.sectionGrid}><InfoBox label="Invite Status" value={record.portal.inviteStatus} /><InfoBox label="Last Login" value={record.portal.lastLogin ?? "No login recorded"} /><InfoBox label="Messaging" value={record.portal.messagingEnabled ? "Enabled" : "Disabled"} /><InfoBox label="Shared Documents" value={record.portal.sharedDocuments.join(", ") || "None"} wide /></div></div></section>;
}

function ChartIntegrityPanel({ record }: { record: PatientChartRecord }) {
  const issues: string[] = [];
  if (!record.billingSettings.policies.some((policy) => policy.status === "active")) issues.push("No active insurance policy.");
  if (!record.contact.email) issues.push("Missing email for portal/statements.");
  if (record.documents.some((document) => document.status === "draft")) issues.push("Draft clinical document exists.");
  if (!record.contact.guarantorName) issues.push("Missing guarantor.");

  return <section className={styles.card}><div className={styles.cardBody}><h2 className={styles.cardTitle}>Chart Integrity</h2><p className={styles.cardSubtitle}>Data quality checks that prevent downstream billing and documentation errors.</p><div className={styles.list} style={{ marginTop: 14 }}>{issues.length === 0 ? <div className={classNames(styles.callout, styles.green)}>No major chart integrity issues detected.</div> : issues.map((issue) => <div className={classNames(styles.callout, issue.includes("Draft") ? styles.amber : styles.red)} key={issue}>{issue}</div>)}</div></div></section>;
}

function DownstreamImpactPanel() {
  return <section className={styles.card}><div className={styles.cardBody}><h2 className={styles.cardTitle}>Downstream Impact</h2><div className={styles.list} style={{ marginTop: 14 }}><div className={classNames(styles.callout, styles.blue)}>Profile feeds claims, statements, and portal access.</div><div className={classNames(styles.callout, styles.green)}>Documents are the legal medical record.</div><div className={classNames(styles.callout, styles.amber)}>Billing Settings feed eligibility and claim creation.</div><div className={classNames(styles.callout, styles.purple)}>Patient Billing is the patient-level A/R ledger.</div></div></div></section>;
}

function QuickTimelinePanel({ record }: { record: PatientChartRecord }) {
  const timeline = [...record.documents.slice(0, 3).map((document) => ({ title: document.title, meta: `${document.dateOfService} · ${document.type} · ${document.status}` })), ...record.transactions.slice(-2).map((transaction) => ({ title: transaction.description, meta: `${transaction.date} · ${formatMoney(transaction.amount)}` }))];
  return <section className={styles.card}><div className={styles.cardBody}><h2 className={styles.cardTitle}>Recent Chart Activity</h2><div className={styles.timeline} style={{ marginTop: 14 }}>{timeline.map((item) => <div className={styles.timelineItem} key={`${item.title}-${item.meta}`}><strong>{item.title}</strong><p className={styles.rowMeta}>{item.meta}</p></div>)}</div></div></section>;
}
