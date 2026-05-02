"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PatientChartTab =
  | "info"
  | "todo"
  | "schedule"
  | "documents"
  | "billing"
  | "billing-settings"
  | "clinicians"
  | "portal"
  | "messages"
  | "insights";

type PatientChartProps = {
  patientId: string;
  initialTab?: PatientChartTab;
};

type Toast = {
  id: number;
  message: string;
  kind: "success" | "info" | "warning";
};

const serviceCodes = ["90837", "90834", "90832", "90839", "90791", "H0031", "H0032", "H0001", "T1017"];
const appointmentTypes = ["Intake", "Follow-up"];
const frequencies = ["One time", "Weekly", "Bi-weekly", "Monthly"];
const outcomeRanges = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 120 days", "Last 365 days"];
const chargeRanges = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 120 days"];
const clinicians = ["Avery Morgan, LPC", "Krystin Butler, LCSW", "Lena Ortiz, LPC", "Sam Rivera, Billing"];
const locations = ["Main Office", "Telehealth", "Conscious Counseling PLLC", "Denver Clinic"];
const patients = ["Avery Morgan", "Krystin Marie Butler", "Primary Patient", "Test Patient"];

const tabs: Array<{ id: PatientChartTab; label: string; href: string }> = [
  { id: "info", label: "Info", href: "" },
  { id: "todo", label: "To-Do", href: "todo" },
  { id: "schedule", label: "Schedule", href: "schedule" },
  { id: "documents", label: "Documents", href: "documents" },
  { id: "billing", label: "Billing", href: "patient-billing" },
  { id: "billing-settings", label: "Billing Settings", href: "billing-settings" },
  { id: "clinicians", label: "Clinicians", href: "clinicians" },
  { id: "portal", label: "Portal", href: "portal" },
  { id: "messages", label: "Messages", href: "messages" },
  { id: "insights", label: "Insights", href: "insights" },
];

const documents = [
  { type: "Superbill for 1/6/25", service: "", date: "1/6/2025", author: "Billing", status: "PDF 50KB", path: "/documents/superbill-2025-01-06" },
  { type: "Miscellaneous Note", service: "", date: "1/6/2025", author: "Krystin Butler", status: "Signed by Author", path: "/documents/misc-note-1" },
  { type: "Treatment Plan", service: "", date: "1/6/2025", author: "Krystin Butler", status: "Signed by Author", path: "/documents/treatment-plan-1" },
  { type: "Progress Note", service: "H0031", date: "1/6/2025", author: "Krystin Butler", status: "Signed by Author", path: "/documents/progress-note-1" },
  { type: "Contact Note", service: "", date: "1/6/2025", author: "Krystin Butler", status: "Signed by Author", path: "/documents/contact-note-1" },
  { type: "Intake Note", service: "90791", date: "1/6/2025", author: "Krystin Butler", status: "Signed by Author", path: "/documents/intake-note-1" },
  { type: "Psychotherapy Note", service: "", date: "1/6/2025", author: "Krystin Butler", status: "Signed by Author", path: "/documents/psychotherapy-note-1" },
];

const openItems = [
  { date: "1/6/25", type: "Misc. Charge", detail: "from Misc. Note", clinician: "K-But", network: "Direct", primary: "Direct", secondary: "", rate: "$260.00", patientAmount: "$260.00", patientBalance: "$260.00", insuranceAmount: "—", insurancePaid: "—", insuranceStatus: "—" },
  { date: "1/6/25", type: "H0002", detail: "", clinician: "K-But", network: "Direct", primary: "Direct", secondary: "", rate: "Not set", patientAmount: "Not set", patientBalance: "—", insuranceAmount: "—", insurancePaid: "$0.00", insuranceStatus: "—" },
  { date: "1/6/25", type: "90791", detail: "", clinician: "K-But", network: "In", primary: "Colorado Access", secondary: "Not Set", rate: "Not set", patientAmount: "Not set", patientBalance: "—", insuranceAmount: "Not set", insurancePaid: "$0.00", insuranceStatus: "Submitted Claim" },
  { date: "1/6/25", type: "Missed Appt", detail: "", clinician: "K-But", network: "Direct", primary: "Direct", secondary: "", rate: "Not set", patientAmount: "Not set", patientBalance: "—", insuranceAmount: "—", insurancePaid: "—", insuranceStatus: "—" },
  { date: "4/28/26", type: "H0031", detail: "", clinician: "K-But", network: "In", primary: "Colorado Access", secondary: "Not Set", rate: "Not set", patientAmount: "Not set", patientBalance: "—", insuranceAmount: "—", insurancePaid: "—", insuranceStatus: "—" },
];

function canonicalPatientName(patientId: string) {
  if (patientId.toLowerCase().includes("avery")) return "Avery Morgan";
  if (patientId.toLowerCase().includes("krystin")) return "Krystin Marie Butler";
  if (patientId.toLowerCase().includes("primary")) return "Primary Patient";
  if (patientId.toLowerCase().includes("test")) return "Test Patient";
  return "Krystin Marie Butler";
}

function canonicalDob(patientId: string) {
  if (patientId.toLowerCase().includes("avery")) return "5/5/55";
  if (patientId.toLowerCase().includes("primary")) return "1/20/85";
  if (patientId.toLowerCase().includes("test")) return "5/5/55";
  return "6/26/1987";
}

function slugFromName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function SelectField({ label, value, options, onChange, width = 260 }: { label: string; value: string; options: string[]; onChange: (value: string) => void; width?: number }) {
  return (
    <label className="ta-field-row">
      <span>{label}</span>
      <select style={{ width }} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <span className="ta-money">
      <b>$</b>
      <input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} />
    </span>
  );
}

export default function PatientChartClassic({ patientId, initialTab = "info" }: PatientChartProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PatientChartTab>(initialTab);
  const [toast, setToast] = useState<Toast | null>(null);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [miscChargeModalOpen, setMiscChargeModalOpen] = useState(false);
  const [statementPreview, setStatementPreview] = useState(false);
  const [billingItemFilter, setBillingItemFilter] = useState<"open" | "all" | "custom">("open");
  const [statementMode, setStatementMode] = useState<"all" | "range">("all");
  const [chargeRange, setChargeRange] = useState("Last 30 days");
  const [outcomeRange, setOutcomeRange] = useState("Last 365 days");
  const [portalRequestFilter, setPortalRequestFilter] = useState<"All" | "Needs Processing" | "Waiting on Patient" | "Custom">("All");
  const [paymentMethod, setPaymentMethod] = useState<"Check" | "Cash" | "External">("Check");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [appointmentType, setAppointmentType] = useState("Intake");
  const [appointmentPatient, setAppointmentPatient] = useState(canonicalPatientName(patientId));
  const [appointmentClinician, setAppointmentClinician] = useState("Krystin Butler, LCSW");
  const [appointmentLocation, setAppointmentLocation] = useState("Main Office");
  const [serviceCode, setServiceCode] = useState("90791");
  const [appointmentDate, setAppointmentDate] = useState("2026-04-28");
  const [appointmentTime, setAppointmentTime] = useState("11:00");
  const [frequency, setFrequency] = useState("One time");
  const [legalFirstName, setLegalFirstName] = useState(canonicalPatientName(patientId).split(" ")[0] || "");
  const [legalMiddleName, setLegalMiddleName] = useState("");
  const [legalLastName, setLegalLastName] = useState(canonicalPatientName(patientId).split(" ").slice(1).join(" ") || "");
  const [preferredName, setPreferredName] = useState("");
  const [mobilePhone, setMobilePhone] = useState("(303) 943-3946");
  const [email, setEmail] = useState("therassistant@outlook.com");
  const [todos, setTodos] = useState([
    "Consider creating a Termination Note since there have been no appointments for at least 60 days.",
    "Create a new Treatment Plan since the most recent Treatment Plan is more than 90 days old.",
  ]);

  const patientName = useMemo(() => canonicalPatientName(patientId), [patientId]);
  const dob = useMemo(() => canonicalDob(patientId), [patientId]);
  const patientSlug = useMemo(() => slugFromName(patientName), [patientName]);

  function notify(message: string, kind: Toast["kind"] = "success") {
    setToast({ id: Date.now(), message, kind });
    window.setTimeout(() => setToast(null), 3600);
  }

  function goToTab(tab: PatientChartTab) {
    const config = tabs.find((item) => item.id === tab);
    setActiveTab(tab);
    const path = config?.href ? `/patients/${patientId}/${config.href}` : `/patients/${patientId}`;
    window.history.replaceState(null, "", path);
  }

  function saveChanges() {
    notify("Patient information saved to the patient record.");
  }

  function createContact() {
    notify("New contact row created and linked to this patient.");
  }

  function createReminder() {
    setTodos((current) => [`Review documentation and billing readiness for ${patientName}.`, ...current]);
    notify("New reminder added to the clinician to-do list.");
  }

  function saveAppointment() {
    notify(`${appointmentType} appointment saved for ${appointmentDate} at ${appointmentTime}; appointment anchor is ready for downstream encounter creation.`);
    setAppointmentModalOpen(false);
  }

  function savePayment() {
    notify(`${paymentMethod} patient payment saved and available for allocation.`);
  }

  function saveCredit() {
    notify(`Patient credit of $${creditAmount || "0.00"} saved.`);
  }

  function saveStatement() {
    notify("Statement saved to the patient chart and statement history.");
  }

  function verifyEligibility() {
    notify("Eligibility verification request queued for Colorado Access.");
  }

  function saveBillingSetting(label: string) {
    notify(`${label} updated.`);
  }

  function uploadPatientFile() {
    notify("Upload workflow opened. In production this routes to Supabase Storage.");
  }

  function createNote() {
    router.push(`/patients/${patientId}/notes`);
  }

  function openOutcomeMeasure() {
    notify("Outcome measure selector opened. ACE, ASRS, AUDIT, C-SSRS, CAGE-AID, CRAFFT, DAS, DES-II, and EAT forms are available.");
  }

  function sendWelcomeEmail() {
    notify("TherAssistant Portal welcome email sent.");
  }

  function shareDocuments() {
    router.push("/library");
  }

  function newConversation() {
    notify("New patient conversation started.");
  }

  function deadLinkFixed(label: string, path: string) {
    notify(`${label} opened.`);
    router.push(path);
  }

  return (
    <div className="ta-chart">
      {toast && <div className={`ta-toast ${toast.kind}`}>{toast.message}</div>}
      <header className="ta-appbar">
        <Link className="ta-logo" href="/">TherAssistant</Link>
        <nav>
          <Link href="/billing/workqueue">To-Do</Link>
          <Link href="/scheduling">Scheduling</Link>
          <Link className="active" href="/patients">Patients</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/tickets">Tickets</Link>
        </nav>
        <div className="ta-icons">💬 👤⌄ 🔍</div>
      </header>

      <section className="ta-patient-head">
        <div>
          <Link className="ta-blue-link ta-title-link" href="/patients">Patient:</Link>
          <span className="ta-patient-name"> {patientName}</span>
          <span className="ta-pronouns"> (she/her)</span>
          <span className="ta-dob">{dob}</span>
        </div>
        <div className="ta-head-right">
          <Link href="/billing/workqueue" className="ta-blue-link"><span className="ta-count">2</span> To-Do</Link>
          <span>▣ No Future Appt</span>
          <span>☎ Mobile: <a href={`tel:${mobilePhone.replace(/[^0-9]/g, "")}`}>{mobilePhone}</a> (No Messages)</span>
        </div>
      </section>

      <nav className="ta-tabs" aria-label="Patient chart tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "active" : ""} type="button" onClick={() => goToTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="ta-content">
        {activeTab === "info" && (
          <>
            <section className="ta-panel">
              <h2>Patient Comments</h2>
              <input className="ta-wide-input" placeholder="For non-clinical info such as scheduling/billing comments. All users can see this. Conveniently visible in tooltips." />
            </section>

            <section className="ta-panel">
              <h2>Patient Information</h2>
              <div className="ta-two-col">
                <div>
                  <label className="ta-field-row multi">
                    <span>Legal Name:</span>
                    <input value={legalFirstName} onChange={(event) => setLegalFirstName(event.target.value)} placeholder="first" />
                    <input value={legalMiddleName} onChange={(event) => setLegalMiddleName(event.target.value)} placeholder="middle" />
                    <input value={legalLastName} onChange={(event) => setLegalLastName(event.target.value)} placeholder="last" />
                    <input placeholder="suffix" className="short" />
                  </label>
                  <label className="ta-field-row"><span>Preferred Name:</span><input value={preferredName} onChange={(event) => setPreferredName(event.target.value)} placeholder="optional" /></label>
                  <label className="ta-field-row"><span>Pronouns:</span><input placeholder="she/her" /></label>
                  <label className="ta-field-row"><span>Date of Birth:</span><input type="date" defaultValue="1987-06-26" /></label>
                  <label className="ta-field-row"><span>Account Number:</span><input defaultValue="PAT-1000001" /></label>
                  <label className="ta-field-row"><span>Address 1:</span><input defaultValue="18622 E Water Dr" /></label>
                  <label className="ta-field-row"><span>Address 2:</span><input defaultValue="Unit D" /></label>
                  <label className="ta-field-row"><span>Zip:</span><input defaultValue="80013" /></label>
                  <label className="ta-field-row multi"><span>City/State:</span><input defaultValue="Aurora" /><select><option>CO</option><option>WY</option><option>NM</option></select></label>
                  <label className="ta-field-row"><span>Time Zone:</span><select><option>Not Set (Use practice time zone)</option><option>Mountain Time</option></select></label>
                  <label className="ta-field-row multi"><span>Mobile Phone:</span><input value={mobilePhone} onChange={(event) => setMobilePhone(event.target.value)} /><select><option>No messages</option><option>Text messages OK</option></select></label>
                  <label className="ta-field-row multi"><span>Home Phone:</span><input /><select><option>No messages</option><option>Voice OK</option></select></label>
                  <label className="ta-field-row multi"><span>Work Phone:</span><input /><select><option>No messages</option><option>Voice OK</option></select></label>
                  <label className="ta-field-row"><span>Email:</span><input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                  <label className="ta-field-row"><span>Appt Reminders:</span><select><option>Default Practice Setting (Text/Call and Email)</option><option>No reminders</option><option>Email only</option><option>SMS only</option></select></label>
                </div>
                <div>
                  <fieldset className="ta-radio-row">
                    <legend>Administrative Sex:</legend>
                    <label><input type="radio" name="sex" /> Male</label>
                    <label><input type="radio" name="sex" /> Female</label>
                    <label><input type="radio" name="sex" defaultChecked /> Unknown</label>
                  </fieldset>
                  <SelectField label="Gender Identity:" value="-- Select Gender Identity --" options={["-- Select Gender Identity --", "Woman", "Man", "Nonbinary", "Transgender", "Another identity"]} onChange={() => undefined} />
                  <SelectField label="Sexual Orientation:" value="-- Select Sexual Orientation --" options={["-- Select Sexual Orientation --", "Straight", "Gay", "Lesbian", "Bisexual", "Queer", "Another orientation"]} onChange={() => undefined} />
                  <label className="ta-field-row"><span>Race:</span><input placeholder="Add Race" /></label>
                  <label className="ta-field-row"><span>Ethnicity:</span><input placeholder="Add Ethnicity" /></label>
                  <label className="ta-field-row"><span>Languages:</span><input placeholder="Add Language" /></label>
                  <SelectField label="Smoking Status:" value="-- Select Smoking Status --" options={["-- Select Smoking Status --", "Never", "Former", "Current", "Unknown"]} onChange={() => undefined} />
                  <SelectField label="Marital Status:" value="-- Select Marital Status --" options={["-- Select Marital Status --", "Single", "Married", "Divorced", "Widowed"]} onChange={() => undefined} />
                  <SelectField label="Employment:" value="-- Select Employment --" options={["-- Select Employment --", "Employed", "Unemployed", "Student", "Retired"]} onChange={() => undefined} />
                  <label className="ta-field-row"><span>Religious Affiliation:</span><input placeholder="Add Religious Affiliation" /></label>
                  <label className="ta-check-row"><span>HIPAA:</span><input type="checkbox" /> Signed HIPAA NPP on file <b className="ta-warn">⚠</b></label>
                  <label className="ta-field-row"><span>PCP Release:</span><select><option>Not set</option><option>Signed</option><option>Declined</option></select></label>
                </div>
              </div>
              <div className="ta-actions">
                <button className="ta-green" onClick={saveChanges}>Save Changes</button>
                <Link href="/patients">Cancel</Link>
                <button className="ta-link-button danger" onClick={() => notify("Delete Patient requires admin confirmation.", "warning")}>Delete Patient</button>
              </div>
            </section>

            <section className="ta-panel">
              <h2>Contacts <button className="ta-blue small right" onClick={createContact}>+ New Contact</button></h2>
              <div className="ta-contact-grid">
                <label>Name:<input defaultValue="Group" /></label><input defaultValue="Therapy" /><input defaultValue="Participant" />
                <label>Mobile Phone:<input /></label><label>Work Phone:<input /></label><label>Home Phone:<input /></label>
                <label>Title:<input /></label><label>Company:<input /></label><label>Fax:<input /></label>
              </div>
            </section>
          </>
        )}

        {activeTab === "todo" && (
          <section className="ta-panel">
            <h2>Patient To-Do List <button className="ta-blue small right" onClick={createReminder}>+ New Reminder</button></h2>
            <h3>Notes <span className="ta-count">{todos.length}</span></h3>
            <table className="ta-table">
              <thead><tr><th>Date</th><th><Link href="/billing/workqueue">To-Do Items</Link></th><th></th></tr></thead>
              <tbody>
                {todos.map((todo, index) => (
                  <tr key={todo}>
                    <td>{index === 0 ? "4/28/26" : "4/6/25"}</td>
                    <td><button className="ta-link-button" onClick={() => deadLinkFixed("To-do item", "/billing/workqueue")}>{todo}</button></td>
                    <td><button className="ta-link-button muted" onClick={() => setTodos((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === "schedule" && (
          <section className="ta-panel">
            <h2>Schedule <button className="ta-blue small right" onClick={() => setAppointmentModalOpen(true)}>+ New Appointment</button></h2>
            <table className="ta-table">
              <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Clinician</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                <tr><td>4/28/2026</td><td>11:00 AM</td><td>Follow-up · 90837</td><td>Krystin Butler</td><td>Scheduled</td><td><button className="ta-blue small" onClick={() => setAppointmentModalOpen(true)}>Edit</button></td></tr>
                <tr><td>1/6/2025</td><td>10:00 AM</td><td>Intake · 90791</td><td>Krystin Butler</td><td>Completed</td><td><Link href={`/encounters/ENC-${patientSlug}-001`}>Open Encounter</Link></td></tr>
              </tbody>
            </table>
          </section>
        )}

        {activeTab === "documents" && (
          <section className="ta-panel">
            <div className="ta-section-head">
              <h2>Notes and Documents for this Patient</h2>
              <div>
                <button className="ta-outline" onClick={uploadPatientFile}>☁ Upload Patient File</button>
                <button className="ta-blue" onClick={openOutcomeMeasure}>▥ Outcome Measure ▾</button>
                <button className="ta-blue" onClick={createNote}>Create Note ▾</button>
              </div>
            </div>
            <div className="ta-right-tools"><button className="ta-link-button" onClick={() => notify("Showing notes/documents preference saved.")}>↗ Showing Notes and Documents</button> <button className="ta-link-button" onClick={() => notify("Column selector opened.")}>▦ Select Columns</button></div>
            <table className="ta-table docs">
              <thead><tr><th>Document</th><th>Service</th><th>Date</th><th>Author/Access</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.type}>
                    <td><button className="ta-link-button" onClick={() => deadLinkFixed(doc.type, `/patients/${patientId}/notes`)}>▧ {doc.type}</button></td>
                    <td>{doc.service}</td>
                    <td>{doc.date}</td>
                    <td>{doc.author}</td>
                    <td>{doc.status}</td>
                    <td className="ta-actions-cell"><button onClick={() => notify("Document share/export opened.")}>↗</button><button onClick={() => deadLinkFixed("Document edit", `/patients/${patientId}/notes`)}>✎</button><button onClick={() => notify("Document downloaded.")}>☁</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="ta-link-button" onClick={() => notify("Multiple selected documents downloaded.")}>Download Multiple</button>
          </section>
        )}

        {activeTab === "billing" && (
          <>
            <section className="ta-panel">
              <h2>Patient Billing</h2>
              <p className="ta-balance">Patient Balance Owed: <b>$260.00</b> <span>Unassigned Credit: <b>$0.00</b></span></p>
              <hr />
              <div className="ta-billing-links">
                <div><h3>Patient Accounting</h3>
                  <button onClick={() => router.push(`/patients/${patientId}/payment`)}>Enter Patient Payment</button>
                  <button onClick={() => setMiscChargeModalOpen(true)}>Enter Misc Charge</button>
                  <button onClick={() => notify("Refund workflow opened.")}>Enter Refund</button>
                  <button onClick={() => goToTab("billing")}>Enter Misc Credit</button>
                  <button onClick={() => setStatementPreview(false)}>Create Statement</button>
                </div>
                <div><h3>Insurance Claims</h3>
                  <button onClick={() => router.push("/billing/eligibility")}>Eligibility History <span className="ta-pill">0</span></button>
                  <button onClick={() => router.push("/billing/submit-claims?type=primary")}>Submit Primary Claims <span className="ta-pill blue">6</span></button>
                  <button onClick={() => router.push("/billing/submit-claims?type=secondary")}>Submit Secondary Claims <span className="ta-pill">0</span></button>
                  <button onClick={() => router.push("/billing/cms-1500")}>Create CMS-1500 <span className="ta-pill">0</span></button>
                  <button onClick={() => router.push(`/patients/${patientId}/superbill`)}>Create Superbill</button>
                </div>
                <div><h3>Insurance Payments</h3>
                  <button onClick={() => router.push("/billing/insurance-payment")}>Enter Insurance Payment</button>
                  <button onClick={() => router.push("/billing/claim-history")}>Electronic Claim History <span className="ta-pill">0</span></button>
                  <button onClick={() => router.push("/billing/era")}>ERA</button>
                </div>
              </div>
            </section>

            <section className="ta-panel">
              <h2>Search Billing Transactions <span className="ta-segment"><button className={billingItemFilter === "open" ? "active" : ""} onClick={() => setBillingItemFilter("open")}>Open Items</button><button className={billingItemFilter === "all" ? "active" : ""} onClick={() => setBillingItemFilter("all")}>All Items</button><button className={billingItemFilter === "custom" ? "active" : ""} onClick={() => setBillingItemFilter("custom")}>Custom</button></span></h2>
              <div className="ta-right-tools"><button className="ta-link-button" onClick={() => notify("Spreadsheet export generated.")}>▤ Export Spreadsheet</button> <button className="ta-link-button" onClick={() => notify("Column selector opened.")}>▦ Select Columns</button></div>
              <table className="ta-table billing">
                <thead><tr><th>▲ Date</th><th>Type</th><th>Clin</th><th>Network</th><th>Primary Payer</th><th>Secondary Payer</th><th>Rate</th><th>Pt Amt</th><th>Pt Bal</th><th>Ins Amt</th><th>Ins Paid</th><th>Ins Status</th></tr></thead>
                <tbody>{openItems.map((item) => <tr key={`${item.date}-${item.type}`}><td>{item.date}</td><td><button className="ta-link-button" onClick={() => deadLinkFixed(item.type, "/billing")}>{item.type}</button><small>{item.detail}</small></td><td>{item.clinician}</td><td>{item.network}</td><td>{item.primary}</td><td>{item.secondary}</td><td>{item.rate}</td><td>{item.patientAmount}</td><td>{item.patientBalance}</td><td>{item.insuranceAmount}</td><td>{item.insurancePaid}</td><td>{item.insuranceStatus}</td></tr>)}</tbody>
              </table>
            </section>

            <section className="ta-panel">
              <h2>Patient Payment</h2>
              <p className="ta-balance">Patient Balance Owed: <b>$260.00</b> <span>Unassigned Credit: <b>$0.00</b></span></p>
              <div className="ta-payment-methods">{(["Check", "Cash", "External"] as const).map((method) => <button key={method} className={paymentMethod === method ? "active" : ""} onClick={() => setPaymentMethod(method)}>✓ {method}</button>)}</div>
              <label className="ta-field-row"><span>Payment Date:</span><input type="date" defaultValue="2026-04-28" /></label>
              <label className="ta-field-row"><span>Payment Amount:</span><MoneyInput value={paymentAmount} onChange={setPaymentAmount} /></label>
              <label className="ta-field-row"><span>Check Number:</span><input placeholder="optional" /></label>
              <label className="ta-field-row"><span>Comments:</span><input placeholder="Internal memo only" /></label>
              <h3>Open Items Awaiting Payment:</h3>
              <table className="ta-table allocation"><thead><tr><th>Date</th><th>Type</th><th>Primary Payer</th><th>Rate</th><th>Pt Amt</th><th>Pt Bal</th><th>Allocation</th><th>Write-Off</th></tr></thead><tbody>{openItems.map((item) => <tr key={`${item.date}-${item.type}-allocation`}><td>{item.date}</td><td>{item.type}</td><td>{item.primary}</td><td>{item.rate}</td><td>{item.patientAmount}</td><td>{item.patientBalance}</td><td><MoneyInput value="" onChange={() => undefined} /></td><td><input type="checkbox" /> $260.00</td></tr>)}</tbody></table>
              <p className="ta-total">Total Allocated: $0.00</p>
              <div className="ta-actions"><button className="ta-green" onClick={savePayment}>Save New Payment</button><button className="ta-link-button" onClick={() => notify("Payment entry cancelled.", "info")}>Cancel</button></div>
            </section>

            <section className="ta-panel">
              <h2>Miscellaneous Patient Credit</h2>
              <label className="ta-field-row"><span>Credit Date:</span><input type="date" defaultValue="2026-04-28" /></label>
              <label className="ta-field-row"><span>Credit Amount:</span><MoneyInput value={creditAmount} onChange={setCreditAmount} /></label>
              <label className="ta-field-row"><span>Credit Reason:</span><input placeholder="optional" /></label>
              <label className="ta-field-row"><span>Comments:</span><input placeholder="Internal memo only" /></label>
              <button className="ta-green" onClick={saveCredit}>Save New Credit</button>
            </section>

            <section className="ta-panel">
              <h2>Create Statement</h2>
              <p className="ta-balance">Patient Balance Owed: <b>$260.00</b> <span>Unassigned Credit: <b>$0.00</b></span></p>
              <label className="ta-radio-line"><input type="radio" checked={statementMode === "all"} onChange={() => setStatementMode("all")} /> All open charges for the selected patient</label>
              <label className="ta-radio-line"><input type="radio" checked={statementMode === "range"} onChange={() => setStatementMode("range")} /> Charges from <select value={chargeRange} onChange={(event) => setChargeRange(event.target.value)}>{chargeRanges.map((range) => <option key={range}>{range}</option>)}</select> <input type="date" defaultValue="2026-03-29" /> to <input type="date" defaultValue="2026-04-28" /></label>
              <label>Statement Comment:<textarea placeholder="A comment to display at the end of the statement" /></label>
              <button className="ta-blue" onClick={() => { setStatementPreview(true); notify("Statement preview generated."); }}>Generate Preview</button>
              {statementPreview && <div className="ta-statement-preview"><h3>Statement Preview</h3><p>Krystin Butler<br />18622 E Water Dr<br />Aurora, CO 80013</p><table className="ta-table"><thead><tr><th>Date</th><th>Transaction</th><th>Rate</th><th>Insurance</th><th>Client</th></tr></thead><tbody>{openItems.map((item) => <tr key={`${item.date}-${item.type}-stmt`}><td>{item.date}</td><td>{item.type}</td><td>{item.rate}</td><td>Not Set</td><td>{item.patientBalance}</td></tr>)}</tbody></table><div className="ta-amount-due">Amount Due: $260.00</div><button className="ta-green" onClick={saveStatement}>Save Statement</button></div>}
            </section>
          </>
        )}

        {activeTab === "billing-settings" && (
          <>
            {["Billing Comments", "Additional Claim Information", "Payment Settings", "Patient Cash Rates"].map((section) => <section className="ta-panel compact" key={section}><h2>{section}: <span>None</span><button className="ta-link-button right" onClick={() => saveBillingSetting(section)}>✎ Edit</button></h2></section>)}
            <section className="ta-panel">
              <h2>Insurance <button className="ta-link-button right" onClick={() => saveBillingSetting("Insurance")}>✎ Edit</button></h2>
              <div className="ta-insurance-card"><h3>Colorado Access (84129): Primary</h3><dl><dt>Copay:</dt><dd>Not set</dd><dt>Member ID:</dt><dd>12346</dd><dt>Policy Holder:</dt><dd>Self</dd><dt>Eligibility:</dt><dd>Not verified</dd></dl><button className="ta-blue" onClick={verifyEligibility}>Verify Eligibility</button></div>
            </section>
          </>
        )}

        {activeTab === "clinicians" && <section className="ta-panel"><h2>Clinicians</h2><table className="ta-table"><thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead><tbody>{clinicians.slice(0,3).map((name) => <tr key={name}><td>{name}</td><td>Assigned clinician</td><td>Active</td></tr>)}</tbody></table></section>}

        {activeTab === "portal" && (
          <>
            <section className="ta-panel"><h2>TherAssistant Portal Access</h2><p>This patient does not have an account on the practice&apos;s client portal. A portal account is required to view shared documents, complete paperwork, manage appointments, and join telehealth sessions.</p><p>Email Address: {email}</p><button className="ta-green" onClick={sendWelcomeEmail}>Send Welcome Email</button></section>
            <section className="ta-panel"><h2>Document Requests <button className="ta-blue small right" onClick={shareDocuments}>Share Documents</button></h2><div className="ta-segment">{(["All", "Needs Processing", "Waiting on Patient", "Custom"] as const).map((filter) => <button key={filter} className={portalRequestFilter === filter ? "active" : ""} onClick={() => setPortalRequestFilter(filter)}>{filter}<span className="ta-pill">0</span></button>)}</div><table className="ta-table"><thead><tr><th>Document</th><th>Sent</th><th>Received</th><th>Status</th></tr></thead><tbody><tr><td colSpan={4}>There are no matching portal documents to display.</td></tr></tbody></table></section>
          </>
        )}

        {activeTab === "messages" && (
          <section className="ta-panel messages"><h2>Patient Messages <button className="ta-blue small right" onClick={newConversation}>+ New Conversation</button></h2><div className="ta-message-layout"><aside><button className="active">▣ Inbox</button><button>▣ Admin</button><button>▣ Billing</button><button>▣ Clinical</button><button>▣ Deleted</button><label><input type="radio" name="msg" /> Unread Only</label><label><input type="radio" name="msg" defaultChecked /> Unread and Read</label><label><input type="radio" name="msg" /> All Including Archived</label></aside><section><select><option>All Topics</option><option>Admin</option><option>Billing</option><option>Clinical</option></select><p>There are no messages to be displayed.</p></section><section className="ta-message-empty">Select a conversation</section></div></section>
        )}

        {activeTab === "insights" && (
          <section className="ta-panel"><h2>Outcome Measures</h2><select value={outcomeRange} onChange={(event) => setOutcomeRange(event.target.value)}>{outcomeRanges.map((range) => <option key={range}>{range}</option>)}</select> <input type="date" defaultValue="2025-04-28" /> to <input type="date" defaultValue="2026-04-28" /><p>There are no chartable results for the selected date range.</p></section>
        )}
      </main>

      {appointmentModalOpen && (
        <div className="ta-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ta-modal">
            <button className="ta-close" onClick={() => setAppointmentModalOpen(false)}>×</button>
            <h2>Create New Appointment</h2>
            <SelectField label="Appointment Type:" value={appointmentType} options={appointmentTypes} onChange={setAppointmentType} width={435} />
            <SelectField label="Patient:" value={appointmentPatient} options={patients} onChange={setAppointmentPatient} width={435} />
            <SelectField label="Clinician:" value={appointmentClinician} options={clinicians} onChange={setAppointmentClinician} width={435} />
            <SelectField label="Location:" value={appointmentLocation} options={locations} onChange={setAppointmentLocation} width={435} />
            <label className="ta-check-row"><span>Telehealth:</span><input type="checkbox" /> Use TherAssistant Telehealth</label>
            <SelectField label="Service Code:" value={serviceCode} options={serviceCodes} onChange={setServiceCode} width={435} />
            <label className="ta-field-row"><span>Scheduled Time:</span><input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} /> <b>at</b> <input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} /></label>
            <label className="ta-field-row"><span>Duration:</span><input type="number" min="15" step="15" defaultValue="60" /> minutes</label>
            <SelectField label="Frequency:" value={frequency} options={frequencies} onChange={setFrequency} width={435} />
            <label className="ta-field-row"><span>Appointment Alert:</span><textarea /></label>
            <button className="ta-green" onClick={saveAppointment}>Save New Appointment</button>
          </div>
        </div>
      )}

      {miscChargeModalOpen && (
        <div className="ta-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ta-modal small-modal">
            <button className="ta-close" onClick={() => setMiscChargeModalOpen(false)}>×</button>
            <h2>Enter Miscellaneous Charge</h2>
            <p>A miscellaneous charge lets you manually add a charge to a patient&apos;s statement.</p>
            <label className="ta-field-row"><span>Patient:</span><input value={patientName} readOnly /></label>
            <label className="ta-field-row"><span>Amount Owed:</span><MoneyInput value="" onChange={() => undefined} /></label>
            <label className="ta-field-row"><span>Date:</span><input type="date" defaultValue="2026-04-28" /></label>
            <SelectField label="Clinician:" value="Not assigned to any clinician" options={["Not assigned to any clinician", ...clinicians]} onChange={() => undefined} width={275} />
            <label className="ta-field-row"><span>Comments:</span><textarea /></label>
            <button className="ta-green" onClick={() => { notify("Miscellaneous charge saved."); setMiscChargeModalOpen(false); }}>Save New Charge</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        body { margin: 0; background: #f3f3f3; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 14px; }
        a, .ta-link-button { color: #0071bc; text-decoration: none; }
        a:hover, .ta-link-button:hover { text-decoration: underline; }
        .ta-chart { min-height: 100vh; background: #f3f3f3; }
        .ta-appbar { height: 52px; background: linear-gradient(#0484b7, #006b99); display: flex; align-items: center; color: #fff; box-shadow: 0 2px 5px #999; }
        .ta-logo { width: 185px; padding-left: 22px; color: white; font-size: 22px; font-weight: bold; }
        .ta-appbar nav { display: flex; height: 52px; }
        .ta-appbar nav a { color: white; padding: 17px 16px; font-size: 16px; }
        .ta-appbar nav a.active, .ta-appbar nav a:hover { background: rgba(0,0,0,.18); text-decoration: none; }
        .ta-icons { margin-left: auto; padding-right: 18px; font-size: 18px; display: flex; gap: 18px; }
        .ta-patient-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 26px 6px; background: #f8f8f8; }
        .ta-title-link, .ta-patient-name { font-size: 24px; }
        .ta-patient-name { color: #222; }
        .ta-pronouns { color: #999; font-size: 22px; }
        .ta-dob { margin-left: 9px; color: #666; font-size: 11px; }
        .ta-head-right { display: grid; gap: 4px; justify-items: end; color: #777; font-size: 12px; }
        .ta-count, .ta-pill { display: inline-block; border-radius: 999px; background: #0b91d0; color: white; min-width: 16px; height: 16px; line-height: 16px; text-align: center; font-size: 11px; font-weight: bold; margin-left: 4px; padding: 0 4px; }
        .ta-pill { background: #c6cbd0; color: #fff; }
        .ta-pill.blue { background: #198bd0; }
        .ta-tabs { margin: 0 18px; border-bottom: 2px solid #1e9bd7; display: flex; gap: 4px; }
        .ta-tabs button { border: 0; background: #6c6c6c; color: white; padding: 8px 12px; border-radius: 3px 3px 0 0; font-weight: bold; cursor: pointer; }
        .ta-tabs button.active { background: #1e9bd7; }
        .ta-content { padding: 10px 18px 40px; }
        .ta-panel { background: #fff; border: 1px solid #ddd; border-radius: 3px; padding: 14px; margin-bottom: 14px; }
        .ta-panel.compact { padding: 12px 14px; }
        .ta-panel h2 { margin: 0 0 16px; font-size: 18px; font-weight: normal; }
        .ta-panel h3 { font-size: 13px; margin: 14px 0 8px; }
        .ta-wide-input { width: 100%; height: 30px; border: 1px solid #ccc; border-radius: 3px; padding: 0 8px; box-sizing: border-box; }
        .ta-two-col { display: grid; grid-template-columns: minmax(440px, 1fr) minmax(440px, 1fr); gap: 40px; }
        .ta-field-row { display: flex; align-items: center; gap: 6px; margin: 6px 0; min-height: 27px; }
        .ta-field-row > span { width: 118px; text-align: right; padding-right: 6px; }
        .ta-field-row input, .ta-field-row select, .ta-field-row textarea, .ta-panel select, .ta-panel input, .ta-panel textarea { border: 1px solid #cfcfcf; border-radius: 3px; padding: 5px 8px; min-height: 26px; box-sizing: border-box; }
        .ta-field-row input { width: 195px; }
        .ta-field-row.multi input { width: 130px; }
        .ta-field-row.multi input.short { width: 50px; }
        .ta-field-row textarea { width: 435px; height: 52px; }
        .ta-radio-row { border: 0; padding: 0; margin: 5px 0 10px; display: flex; gap: 14px; align-items: center; }
        .ta-radio-row legend { width: 118px; text-align: right; float: left; padding-right: 12px; }
        .ta-check-row { display: flex; align-items: center; gap: 6px; margin: 7px 0; }
        .ta-check-row span { width: 118px; text-align: right; padding-right: 6px; }
        .ta-warn { color: #ce8d00; }
        .ta-actions { display: flex; align-items: center; gap: 14px; margin-top: 16px; }
        .ta-green, .ta-blue, .ta-outline { border: 0; border-radius: 3px; padding: 7px 12px; cursor: pointer; font-weight: bold; }
        .ta-green { background: #69b900; color: #fff; }
        .ta-blue { background: #1e9bd7; color: #fff; }
        .ta-outline { background: #fff; color: #0071bc; border: 1px solid #cbd7e4; }
        .small { padding: 5px 9px; font-size: 12px; }
        .right { float: right; }
        .danger { color: #c0392b; margin-left: auto; }
        .ta-link-button { background: transparent; border: 0; padding: 0; cursor: pointer; font: inherit; color: #0071bc; }
        .ta-link-button.muted { color: #999; }
        .ta-contact-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; max-width: 1080px; }
        .ta-contact-grid label { display: flex; gap: 8px; align-items: center; }
        .ta-contact-grid input { width: 240px; }
        .ta-table { border-collapse: collapse; width: 100%; background: #fff; font-size: 13px; }
        .ta-table th { background: #209bd3; color: white; text-align: left; padding: 8px; font-weight: bold; }
        .ta-table td { border: 1px solid #ddd; padding: 8px; vertical-align: middle; }
        .ta-table tr:nth-child(even) td { background: #f8f8f8; }
        .ta-table small { display: block; color: #777; }
        .ta-actions-cell { text-align: right; white-space: nowrap; }
        .ta-actions-cell button { border: 0; background: transparent; color: #aaa; padding: 0 6px; cursor: pointer; }
        .ta-section-head { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .ta-section-head > div { display: flex; gap: 8px; }
        .ta-right-tools { text-align: right; margin: 7px 0; font-size: 12px; }
        .ta-balance span { margin-left: 28px; }
        .ta-billing-links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 70px; max-width: 980px; }
        .ta-billing-links button { display: block; background: none; border: 0; color: #0071bc; cursor: pointer; margin: 7px 0; padding: 0; text-align: left; }
        .ta-segment { display: inline-flex; margin-left: 12px; vertical-align: middle; }
        .ta-segment button { border: 1px solid #ccc; background: #fff; padding: 6px 10px; cursor: pointer; }
        .ta-segment button.active { background: #4aaee8; color: #fff; }
        .ta-payment-methods { display: flex; gap: 6px; margin: 12px 0; }
        .ta-payment-methods button { background: white; border: 1px solid #555; border-radius: 4px; padding: 10px 18px; cursor: pointer; }
        .ta-payment-methods button.active { border-color: #168bd2; background: #eaf7ff; }
        .ta-money { display: inline-flex; align-items: center; border: 1px solid #cfcfcf; border-radius: 3px; background: white; height: 28px; }
        .ta-money b { color: #64a928; padding-left: 8px; }
        .ta-money input { width: 82px !important; border: 0 !important; outline: none; }
        .allocation td:nth-last-child(-n+2) { background: #e7f7ff !important; }
        .ta-total { text-align: center; margin: 16px 0; font-weight: bold; }
        .ta-radio-line { display: block; margin: 9px 0; }
        textarea { width: 100%; min-height: 82px; }
        .ta-statement-preview { border-top: 2px solid #1e9bd7; margin-top: 18px; padding-top: 10px; }
        .ta-amount-due { background: #e3e3e3; text-align: center; font-weight: bold; padding: 12px; margin: 10px 0; }
        .ta-insurance-card { border: 1px solid #ccc; padding: 18px; border-radius: 3px; }
        .ta-insurance-card dl { display: grid; grid-template-columns: 110px 1fr; max-width: 310px; gap: 6px; }
        .ta-insurance-card dt { text-align: right; color: #667; }
        .messages .ta-message-layout { display: grid; grid-template-columns: 130px 240px 1fr; min-height: 620px; border: 1px solid #ddd; }
        .messages aside { border-right: 1px solid #ddd; padding: 12px; display: grid; align-content: start; gap: 9px; }
        .messages aside button { background: none; border: 0; color: #333; text-align: left; cursor: pointer; padding: 5px; }
        .messages aside button.active { background: #e6f4fb; color: #0071bc; }
        .messages section { border-right: 1px solid #ddd; padding: 12px; }
        .ta-message-empty { text-align: center; color: #777; padding-top: 80px !important; }
        .ta-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.58); display: grid; place-items: start center; padding-top: 60px; z-index: 100; }
        .ta-modal { background: white; width: 570px; border-radius: 3px; box-shadow: 0 12px 40px rgba(0,0,0,.35); padding: 18px; position: relative; }
        .ta-modal.small-modal { width: 420px; }
        .ta-close { position: absolute; right: 10px; top: 7px; background: none; border: 0; font-size: 30px; color: #888; cursor: pointer; }
        .ta-toast { position: fixed; top: 62px; right: 20px; z-index: 200; padding: 12px 16px; border-radius: 4px; color: white; background: #1e9bd7; box-shadow: 0 5px 18px rgba(0,0,0,.18); }
        .ta-toast.success { background: #58a700; }
        .ta-toast.warning { background: #c17d00; }
        @media (max-width: 900px) {
          .ta-appbar nav { overflow-x: auto; }
          .ta-patient-head, .ta-two-col, .ta-billing-links, .messages .ta-message-layout { grid-template-columns: 1fr; display: grid; }
          .ta-head-right { justify-items: start; }
          .ta-tabs { overflow-x: auto; }
          .ta-section-head { align-items: flex-start; flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
