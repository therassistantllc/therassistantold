"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type Tab =
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

type Modal =
  | null
  | "appointment"
  | "note"
  | "upload"
  | "payment"
  | "charge"
  | "credit"
  | "refund"
  | "statement"
  | "conversation"
  | "reminder"
  | "contact"
  | "billing-comments"
  | "insurance"
  | "claim-info"
  | "payment-settings"
  | "cash-rates"
  | "outcome";

type ActivePatientChartProps = {
  patientId: string;
};

const tabs: { id: Tab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "todo", label: "To-Do" },
  { id: "schedule", label: "Schedule" },
  { id: "documents", label: "Documents" },
  { id: "billing", label: "Billing" },
  { id: "billing-settings", label: "Billing Settings" },
  { id: "clinicians", label: "Clinicians" },
  { id: "portal", label: "Portal" },
  { id: "messages", label: "Messages" },
  { id: "insights", label: "Insights" },
];

const serviceCodes = ["90837", "90834", "90832", "90839", "90791", "H0031", "H0032", "H0001", "T1017"];
const appointmentTypes = ["Intake", "Follow-up"];
const frequencies = ["One time", "Weekly", "Bi-weekly", "Monthly"];
const outcomeRanges = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 120 days", "Last 365 days"];
const statementRanges = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 120 days"];

const documents = [
  ["📄", "Superbill for 1/6/25", "PDF 50KB", "", "1/6/2025", "Billing", ""],
  ["📋", "Miscellaneous Note", "", "", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["🧾", "Treatment Plan", "", "", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["📋", "Miscellaneous Note", "", "", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["📘", "Progress Note", "", "H0031", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["✉️", "Contact Note", "Email with Patient", "", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["🧾", "Treatment Plan", "", "", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["🚫", "Missed Appointment Note", "", "", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["📑", "Intake Note", "", "90791", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["🔍", "Consultation Note", "", "H0002", "1/6/2025", "Krystin Butler", "Signed by Author"],
  ["📝", "Psychotherapy Note", "", "", "1/6/2025", "Krystin Butler", "Signed by Author"],
];

const transactions = [
  ["1/6/25", "Misc. Charge", "from Misc. Note", "K-But", "Direct", "Direct", "", "$260.00", "$260.00", "$260.00", "—", "—", "—"],
  ["1/6/25", "H0002", "", "K-But", "Direct", "Direct", "", "Not set", "Not set", "—", "—", "$0.00", "—"],
  ["1/6/25", "90791", "", "K-But", "In", "Colorado Access", "Not Set", "Not set", "Not set", "—", "Not set", "$0.00", "Submitted Claim"],
  ["1/6/25", "Missed Appt", "", "K-But", "Direct", "Direct", "", "Not set", "Not set", "—", "—", "—", "—"],
  ["1/6/25", "H0031", "", "K-But", "Direct", "Direct", "", "Not set", "Not set", "—", "—", "—", "—"],
];

function go(path: string) {
  window.location.href = path;
}

export function ActivePatientChart({ patientId }: ActivePatientChartProps) {
  const [tab, setTab] = useState<Tab>("info");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Check");
  const [statementMode, setStatementMode] = useState("all");
  const [statementPreview, setStatementPreview] = useState(false);
  const [portalFilter, setPortalFilter] = useState("All");
  const [messageFilter, setMessageFilter] = useState("Unread and Read");
  const [insightRange, setInsightRange] = useState("Last 365 days");
  const [appointmentLog, setAppointmentLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const patient = useMemo(
    () => ({
      id: patientId,
      first: "Krystin",
      middle: "Marie",
      last: "Butler",
      display: "Krystin Marie Butler",
      pronouns: "she/her",
      dob: "6/26/1987",
      age: "38",
      phone: "(303) 943-3946",
      email: "admin@therassistant.com",
      address: "683 East Clarion Drive",
      city: "Pueblo",
      state: "CO",
      zip: "81007",
      clinician: "Krystin Butler",
      balance: "$260.00",
      credit: "$0.00",
    }),
    [patientId],
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function saveAppointment() {
    setAppointmentLog((items) => [`Appointment saved for ${patient.display}`, ...items]);
    setModal(null);
    notify("Appointment saved and linked to patient record.");
  }

  function saveGeneric(message: string) {
    setModal(null);
    notify(message);
  }

  function uploadFile(file?: File) {
    if (!file) return;
    notify(`Uploaded ${file.name} to patient documents.`);
  }

  return (
    <main className="ta-page">
      <style jsx global>{`
        body {
          margin: 0;
          background: #f3f3f3;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
        }
        .ta-page {
          min-height: 100vh;
          background: #f3f3f3;
        }
        .ta-topbar {
          height: 48px;
          background: #087ca6;
          color: white;
          display: flex;
          align-items: stretch;
          padding: 0 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, .18);
        }
        .ta-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          min-width: 210px;
        }
        .ta-logo {
          width: 34px;
          height: 40px;
          border: 1px solid #fff;
          background: #f8fafc;
          color: #087ca6;
          font-size: 9px;
          display: grid;
          place-items: center;
          line-height: 1.1;
          text-align: center;
        }
        .ta-mainnav {
          display: flex;
          align-items: stretch;
        }
        .ta-mainnav a {
          color: white;
          text-decoration: none;
          padding: 15px 18px;
          font-size: 15px;
        }
        .ta-mainnav a.active,
        .ta-mainnav a:hover {
          background: #056285;
        }
        .ta-icons {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 18px;
          font-size: 18px;
        }
        .qa-banner {
          background: #fff3a3;
          border-bottom: 2px solid #eab308;
          padding: 8px 24px;
          font-weight: 800;
          color: #111827;
        }
        .patient-shell {
          padding: 12px 18px 28px;
        }
        .patient-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 2px solid #1f9bd1;
          padding-bottom: 8px;
        }
        .patient-title {
          display: flex;
          align-items: baseline;
          gap: 8px;
          color: #333;
          font-size: 23px;
          font-weight: 400;
        }
        .patient-title .blue {
          color: #1885be;
        }
        .patient-title .muted {
          color: #999;
          font-size: 20px;
        }
        .patient-title .dob {
          color: #555;
          font-size: 11px;
        }
        .patient-meta {
          text-align: right;
          color: #666;
          font-size: 12px;
          line-height: 1.5;
        }
        .bubble {
          display: inline-flex;
          min-width: 18px;
          height: 18px;
          background: #0c8dc9;
          color: white;
          border-radius: 999px;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          padding: 0 5px;
        }
        .tabs {
          display: flex;
          gap: 4px;
          margin-top: 10px;
          padding-left: 8px;
          border-bottom: 2px solid #189bd3;
        }
        .tab {
          border: 0;
          border-radius: 4px 4px 0 0;
          background: #666;
          color: white;
          font-weight: 700;
          font-size: 12px;
          padding: 8px 11px;
          cursor: pointer;
        }
        .tab.active {
          background: #159bd3;
        }
        .panel {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin: 12px 0;
          padding: 14px;
        }
        .panel.flush {
          padding: 0;
        }
        .section-title {
          font-size: 18px;
          font-weight: 400;
          margin: 0 0 14px;
        }
        .sub-title {
          font-size: 15px;
          font-weight: 400;
          margin: 0 0 12px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px 70px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 125px 1fr;
          align-items: center;
          gap: 8px;
          margin: 5px 0;
        }
        .form-row label {
          font-size: 12px;
        }
        input,
        select,
        textarea {
          border: 1px solid #cfcfcf;
          border-radius: 3px;
          height: 27px;
          padding: 4px 8px;
          font-size: 12px;
          background: white;
        }
        textarea {
          min-height: 70px;
          height: auto;
          resize: vertical;
        }
        .input-sm { width: 82px; }
        .input-md { width: 160px; }
        .input-lg { width: 280px; }
        .money {
          color: #73b72b;
          font-weight: 700;
        }
        .actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .right-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-bottom: 8px;
        }
        .btn {
          border: 1px solid #bfc6cc;
          background: #f7f7f7;
          color: #006eb6;
          border-radius: 4px;
          padding: 7px 10px;
          cursor: pointer;
          font-size: 12px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 28px;
        }
        .btn:hover {
          background: #eef7fc;
        }
        .btn.blue {
          background: #159bd3;
          color: white;
          border-color: #159bd3;
        }
        .btn.green {
          background: #72b800;
          color: white;
          border-color: #72b800;
          font-weight: 700;
        }
        .btn.gray {
          background: #666;
          color: white;
          border-color: #666;
        }
        .link {
          color: #006eb6;
          text-decoration: none;
          cursor: pointer;
          background: none;
          border: 0;
          padding: 0;
          font-size: inherit;
        }
        .link:hover {
          text-decoration: underline;
        }
        .classic-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .classic-table th {
          background: #229bd1;
          color: white;
          padding: 8px 10px;
          text-align: left;
          font-weight: 700;
        }
        .classic-table td {
          border: 1px solid #d4d4d4;
          padding: 8px 10px;
          vertical-align: middle;
        }
        .classic-table tr:nth-child(even) td {
          background: #f7f7f7;
        }
        .classic-table .bluecell {
          background: #e5f7ff;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #c9c9c9;
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 0 5px;
        }
        .billing-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 50px;
          border-top: 1px solid #1f9bd1;
          padding-top: 14px;
        }
        .billing-actions h4 {
          margin: 0 0 8px;
          color: #666;
          font-size: 13px;
        }
        .billing-actions .link {
          display: block;
          margin: 7px 0;
        }
        .note-layout {
          display: grid;
          gap: 12px;
        }
        .note-header {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 20px;
          border-bottom: 1px solid #159bd3;
          padding-bottom: 12px;
        }
        .note-section {
          border-bottom: 1px solid #e0e0e0;
          padding: 10px 0;
        }
        .note-section h3 {
          margin: 0 0 8px;
          font-size: 16px;
        }
        .mental-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 30px;
        }
        .mental-row {
          display: grid;
          grid-template-columns: 145px 1fr;
          align-items: center;
          gap: 8px;
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, .55);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 80px;
          z-index: 1000;
        }
        .modal {
          background: white;
          border-radius: 4px;
          width: min(640px, calc(100vw - 24px));
          box-shadow: 0 20px 70px rgba(0,0,0,.35);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 2px solid #159bd3;
          font-size: 18px;
        }
        .modal-body {
          padding: 14px;
        }
        .close {
          border: 0;
          background: transparent;
          font-size: 30px;
          color: #999;
          cursor: pointer;
          line-height: 1;
        }
        .toast {
          position: fixed;
          right: 18px;
          bottom: 18px;
          background: #111827;
          color: white;
          border-radius: 6px;
          padding: 10px 14px;
          z-index: 1100;
          box-shadow: 0 10px 40px rgba(0,0,0,.3);
        }
        .message-shell {
          display: grid;
          grid-template-columns: 130px 240px 1fr;
          min-height: 650px;
          border: 1px solid #ddd;
        }
        .message-sidebar {
          padding: 12px;
          border-right: 1px solid #ddd;
        }
        .message-list {
          padding: 12px;
          border-right: 1px solid #ddd;
        }
        .portal-request-tabs {
          display: flex;
          gap: 0;
          margin: 14px 0 44px;
        }
        .portal-request-tabs button {
          border: 1px solid #cfcfcf;
          background: white;
          padding: 6px 10px;
          cursor: pointer;
        }
        .portal-request-tabs button.active {
          background: #35a7dc;
          color: white;
          border-color: #35a7dc;
        }
        @media (max-width: 900px) {
          .ta-topbar { flex-wrap: wrap; height: auto; }
          .ta-mainnav { flex-wrap: wrap; }
          .patient-header,
          .form-grid,
          .note-header,
          .billing-actions,
          .mental-grid,
          .message-shell {
            grid-template-columns: 1fr;
            display: grid;
          }
          .patient-meta { text-align: left; }
        }
      `}</style>

      <header className="ta-topbar">
        <div className="ta-brand">
          <div className="ta-logo">Therapy<br />Notes</div>
          Therassistant
        </div>
        <nav className="ta-mainnav">
          <Link href="/workqueue">To-Do</Link>
          <Link href="/scheduling">Scheduling</Link>
          <Link href="/patients" className="active">Patients</Link>
          <Link href="/staff">Staff</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/payers">Payers</Link>
          <Link href="/library">Library</Link>
        </nav>
        <div className="ta-icons">👤 🔍</div>
      </header>

      <div className="qa-banner">
        ACTIVE PATIENT CHART OVERRIDE LOADED · route /patients/{patientId} · buttons wired · dropdowns updated
      </div>

      <section className="patient-shell">
        <header className="patient-header">
          <div>
            <div className="patient-title">
              <span className="blue">Patient:</span>
              <span>{patient.display}</span>
              <span className="muted">({patient.pronouns})</span>
              <span className="dob">{patient.dob}</span>
            </div>
          </div>
          <div className="patient-meta">
            <span className="bubble">3</span> <button className="link" onClick={() => setTab("todo")}>To-Do</button>
            &nbsp;&nbsp; 📅 No Future Appt<br />
            ☎ Mobile: <button className="link" onClick={() => notify("Opening phone/contact record.")}>{patient.phone}</button> (No Messages)
          </div>
        </header>

        <nav className="tabs">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "info" && (
          <>
            <section className="panel">
              <h2 className="section-title">Patient Comments</h2>
              <input className="input-lg" style={{ width: "100%" }} placeholder="For non-clinical info such as scheduling/billing comments. All users can see this. Conveniently visible in tooltips." />
            </section>

            <section className="panel">
              <h2 className="section-title">Patient Information</h2>
              <div className="form-grid">
                <div>
                  <div className="form-row"><label>Legal Name:</label><div className="actions"><input className="input-md" value={patient.first} onChange={() => {}} /><input className="input-sm" value={patient.middle} onChange={() => {}} /><input className="input-md" value={patient.last} onChange={() => {}} /><input className="input-sm" placeholder="suffix" /></div></div>
                  <div className="form-row"><label>Preferred Name:</label><input className="input-md" placeholder="optional" /></div>
                  <div className="form-row"><label>Pronouns:</label><input className="input-sm" value={patient.pronouns} onChange={() => {}} /></div>
                  <div className="form-row"><label>Date of Birth:</label><input className="input-sm" type="date" defaultValue="1987-06-26" /></div>
                  <div className="form-row"><label>Account Number:</label><input className="input-sm" value={patient.id.slice(0, 8)} onChange={() => {}} /></div>
                  <div className="form-row"><label>Address 1:</label><input className="input-lg" value={patient.address} onChange={() => {}} /></div>
                  <div className="form-row"><label>Address 2:</label><input className="input-lg" placeholder="Apt 2" /></div>
                  <div className="form-row"><label>Zip:</label><input className="input-sm" value={patient.zip} onChange={() => {}} /></div>
                  <div className="form-row"><label>City/State:</label><div className="actions"><input className="input-md" value={patient.city} onChange={() => {}} /><select><option>CO</option></select></div></div>
                  <div className="form-row"><label>Time Zone:</label><select className="input-lg"><option>Mountain Time</option><option>Not Set (Use practice time zone)</option></select></div>
                  <div className="form-row"><label>Mobile Phone:</label><div className="actions"><input className="input-md" value={patient.phone} onChange={() => {}} /><select><option>No messages</option><option>Text messages OK</option></select></div></div>
                  <div className="form-row"><label>Email:</label><input className="input-lg" value={patient.email} onChange={() => {}} /></div>
                  <div className="form-row"><label>Appt Reminders:</label><select className="input-lg"><option>Default Practice Setting (Text/Call and Email)</option><option>No Reminders</option></select></div>
                  <div className="form-row"><label></label><div className="actions"><button className="btn green" onClick={() => notify("Patient changes saved.")}>Save Changes</button><button className="link">Cancel</button></div></div>
                </div>
                <div>
                  <div className="form-row"><label>Administrative Sex:</label><div className="actions"><label><input type="radio" name="sex" /> Male</label><label><input type="radio" name="sex" defaultChecked /> Female</label><label><input type="radio" name="sex" /> Unknown</label></div></div>
                  <div className="form-row"><label>Gender Identity:</label><select className="input-lg"><option>-- Select Gender Identity --</option><option>Woman</option><option>Man</option><option>Nonbinary</option></select></div>
                  <div className="form-row"><label>Sexual Orientation:</label><select className="input-lg"><option>-- Select Sexual Orientation --</option></select></div>
                  <div className="form-row"><label>Race:</label><input className="input-lg" placeholder="Add Race" /></div>
                  <div className="form-row"><label>Ethnicity:</label><input className="input-lg" placeholder="Add Ethnicity" /></div>
                  <div className="form-row"><label>Languages:</label><input className="input-lg" placeholder="Add Language" /></div>
                  <div className="form-row"><label>Smoking Status:</label><select className="input-lg"><option>-- Select Smoking Status --</option></select></div>
                  <div className="form-row"><label>Marital Status:</label><select className="input-lg"><option>-- Select Marital Status --</option></select></div>
                  <div className="form-row"><label>Employment:</label><select className="input-lg"><option>-- Select Employment --</option></select></div>
                  <div className="form-row"><label>HIPAA:</label><label><input type="checkbox" /> Signed HIPAA NPP on file ⚠</label></div>
                  <div className="form-row"><label>PCP Release:</label><select className="input-lg"><option>Not set</option><option>On file</option><option>Declined</option></select></div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <h2 className="section-title">Contacts</h2>
                <button className="btn blue" onClick={() => setModal("contact")}>+ New Contact</button>
              </div>
              <div className="form-grid">
                <div>
                  <div className="form-row"><label>Name:</label><div className="actions"><input className="input-md" value="Group" onChange={() => {}} /><input className="input-md" value="Therapy" onChange={() => {}} /></div></div>
                  <div className="form-row"><label>Title:</label><input className="input-md" /></div>
                  <div className="form-row"><label>Company:</label><input className="input-lg" /></div>
                </div>
                <div>
                  <div className="form-row"><label>Mobile Phone:</label><input className="input-md" /></div>
                  <div className="form-row"><label>Work Phone:</label><input className="input-md" /></div>
                  <div className="form-row"><label>Home Phone:</label><input className="input-md" /></div>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "todo" && (
          <section className="panel">
            <div className="actions" style={{ justifyContent: "space-between" }}>
              <h2 className="section-title">Patient To-Do List</h2>
              <button className="btn blue" onClick={() => setModal("reminder")}>+ New Reminder</button>
            </div>
            <h4>Notes <span className="bubble">2</span></h4>
            <table className="classic-table">
              <thead><tr><th>Date</th><th><button className="link" onClick={() => go("/workqueue")}>To-Do Items</button></th><th></th></tr></thead>
              <tbody>
                <tr><td>3/7/25</td><td><button className="link" onClick={() => setModal("note")}>Consider creating a Termination Note since there have been no appointments for at least 60 days.</button></td><td>×</td></tr>
                <tr><td>4/6/25</td><td><button className="link" onClick={() => setModal("note")}>Create a new Treatment Plan since the most recent Treatment Plan is more than 90 days old.</button></td><td>×</td></tr>
              </tbody>
            </table>
          </section>
        )}

        {tab === "schedule" && (
          <section className="panel">
            <div className="actions" style={{ justifyContent: "space-between" }}>
              <h2 className="section-title">Schedule</h2>
              <button className="btn blue" onClick={() => setModal("appointment")}>+ New Appointment</button>
            </div>
            <table className="classic-table">
              <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Clinician</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                <tr><td>4/28/2026</td><td>10:00 AM</td><td>Follow-up</td><td><Link href="/staff">Krystin Butler</Link></td><td>Scheduled</td><td><button className="link" onClick={() => notify("Encounter started from appointment.")}>Start Encounter</button></td></tr>
                {appointmentLog.map((item, index) => <tr key={index}><td>Saved</td><td>—</td><td colSpan={4}>{item}</td></tr>)}
              </tbody>
            </table>
          </section>
        )}

        {tab === "documents" && (
          <section className="panel">
            <div className="actions" style={{ justifyContent: "space-between" }}>
              <h2 className="section-title">Notes and Documents for this Patient</h2>
              <div className="actions">
                <button className="btn" onClick={() => setModal("note")}>Create Note ▾</button>
                <button className="btn" onClick={() => setModal("outcome")}>▥ Outcome Measure ▾</button>
                <button className="btn blue" onClick={() => fileInputRef.current?.click()}>☁ Upload Patient File</button>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={(event) => uploadFile(event.target.files?.[0])} />
              </div>
            </div>
            <div className="right-actions"><button className="link">Showing Notes and Documents</button><button className="link" onClick={() => notify("Column selector opened.")}>▦ Select Columns</button></div>
            <table className="classic-table">
              <thead><tr><th>Document</th><th>Service</th><th>▾ Date</th><th>Author/Access</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {documents.map((doc, index) => (
                  <tr key={index}>
                    <td>{doc[0]} <button className="link" onClick={() => setModal("note")}>{doc[1]}</button> <span style={{ color: "#aaa", fontSize: 10 }}>{doc[2]}</span></td>
                    <td>{doc[3]}</td>
                    <td>{doc[4]}</td>
                    <td><Link href="/staff">{doc[5]}</Link></td>
                    <td>{doc[6]}</td>
                    <td>↗ ✎ ☁</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p><button className="link" onClick={() => notify("Multiple documents prepared for download.")}>Download Multiple</button></p>
          </section>
        )}

        {tab === "billing" && (
          <>
            <section className="panel">
              <h2 className="section-title">Patient Billing</h2>
              <p>Patient Balance Owed: <strong>{patient.balance}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Unassigned Credit: <strong>{patient.credit}</strong></p>
              <div className="billing-actions">
                <div>
                  <h4>Patient Accounting</h4>
                  <button className="link" onClick={() => setModal("payment")}>Enter Patient Payment</button>
                  <button className="link" onClick={() => setModal("charge")}>Enter Misc Charge</button>
                  <button className="link" onClick={() => setModal("refund")}>Enter Refund</button>
                  <button className="link" onClick={() => setModal("credit")}>Enter Misc Credit</button>
                  <button className="link" onClick={() => setModal("statement")}>Create Statement</button>
                </div>
                <div>
                  <h4>Insurance Claims</h4>
                  <button className="link" onClick={() => go("/billing/eligibility")}>Eligibility History <span className="status-pill">0</span></button>
                  <button className="link" onClick={() => go("/billing/submit-claims?type=primary")}>Submit Primary Claims <span className="status-pill">0</span></button>
                  <button className="link" onClick={() => go("/billing/submit-claims?type=secondary")}>Submit Secondary Claims <span className="status-pill">0</span></button>
                  <button className="link" onClick={() => go("/billing/cms-1500")}>Create CMS-1500 <span className="status-pill">0</span></button>
                  <button className="link" onClick={() => notify("Superbill created for selected patient.")}>Create Superbill</button>
                </div>
                <div>
                  <h4>Insurance Payments</h4>
                  <button className="link" onClick={() => go("/billing/insurance-payment")}>Enter Insurance Payment</button>
                  <button className="link" onClick={() => go("/billing/electronic-claim-history")}>Electronic Claim History <span className="status-pill">0</span></button>
                  <button className="link" onClick={() => go("/billing/era")}>ERA</button>
                </div>
              </div>
            </section>

            <section className="panel">
              <h2 className="section-title">Search Billing Transactions</h2>
              <div className="actions"><button className="btn blue">Open Items</button><button className="btn">All Items</button><button className="btn">Custom</button></div>
              <div className="right-actions"><button className="link">Export Spreadsheet</button><button className="link">▦ Select Columns</button></div>
              <table className="classic-table">
                <thead><tr><th>▴ Date</th><th>Type</th><th>Clin</th><th>Network</th><th>Primary Payer</th><th>Secondary Payer</th><th>Rate</th><th>Pt Amt</th><th>Pt Bal</th><th>Ins Amt</th><th>Ins Paid</th><th>Ins Status</th></tr></thead>
                <tbody>
                  {transactions.map((row, index) => <tr key={index}>{row.slice(0, 1).concat(row.slice(1, 2)).map((cell, i) => <td key={`${index}-${i}`}>{cell}</td>)}<td>{row[3]}</td><td>{row[4]}</td><td>{row[5]}</td><td>{row[6]}</td><td>{row[7]}</td><td>{row[8]}</td><td>{row[9]}</td><td>{row[10]}</td><td>{row[11]}</td><td>{row[12]}</td></tr>)}
                </tbody>
              </table>
            </section>
          </>
        )}

        {tab === "billing-settings" && (
          <>
            <section className="panel"><div className="actions" style={{ justifyContent: "space-between" }}><h2 className="section-title">Billing Comments: <span style={{ color: "#888" }}>None</span></h2><button className="link" onClick={() => setModal("billing-comments")}>✎ Edit</button></div></section>
            <section className="panel">
              <div className="actions" style={{ justifyContent: "space-between" }}><h2 className="section-title">Insurance</h2><button className="link" onClick={() => setModal("insurance")}>✎ Edit</button></div>
              <div className="panel" style={{ margin: 0 }}>
                <p><button className="link" onClick={() => go("/payers")}>Colorado Access (84129)</button>: Primary</p>
                <div style={{ paddingLeft: 40 }}>
                  <p><strong>Policy Information</strong></p>
                  <p>Copay: <strong>Not set</strong></p>
                  <p>Member ID: <strong>12346</strong></p>
                  <p>Policy Holder: <strong>Self</strong></p>
                  <p>Eligibility: <strong>Not verified</strong></p>
                  <button className="btn blue" onClick={() => notify("Eligibility verification queued.")}>Verify Eligibility</button>
                </div>
              </div>
            </section>
            <section className="panel"><div className="actions" style={{ justifyContent: "space-between" }}><h2 className="section-title">Additional Claim Information: <span style={{ color: "#888" }}>None</span></h2><button className="link" onClick={() => setModal("claim-info")}>✎ Edit</button></div></section>
            <section className="panel"><div className="actions" style={{ justifyContent: "space-between" }}><h2 className="section-title">Payment Settings</h2><button className="link" onClick={() => setModal("payment-settings")}>✎ Edit</button></div><p>Responsible Party for Billing: <strong>The Patient</strong></p></section>
            <section className="panel"><div className="actions" style={{ justifyContent: "space-between" }}><h2 className="section-title">Patient Cash Rates: <span style={{ color: "#888" }}>None</span></h2><button className="link" onClick={() => setModal("cash-rates")}>✎ Edit</button></div></section>
          </>
        )}

        {tab === "clinicians" && (
          <section className="panel">
            <h2 className="section-title">Clinicians</h2>
            <table className="classic-table">
              <thead><tr><th>Clinician</th><th>Role</th><th>Assigned</th></tr></thead>
              <tbody><tr><td><Link href="/staff">Krystin Butler</Link></td><td>Primary clinician</td><td>Yes</td></tr></tbody>
            </table>
          </section>
        )}

        {tab === "portal" && (
          <>
            <section className="panel">
              <h2 className="section-title">✤ THERASSISTANT PORTAL Access</h2>
              <p>This patient does not have an account on the practice&apos;s client portal. A portal account is required to view shared documents, complete paperwork, manage appointments, and join telehealth sessions.</p>
              <p>Email Address: {patient.email}</p>
              <button className="btn green" onClick={() => notify("Welcome email sent to patient.")}>Send Welcome Email</button>
            </section>
            <section className="panel">
              <div className="actions" style={{ justifyContent: "space-between" }}><h2 className="section-title">Document Requests</h2><button className="btn blue" onClick={() => go("/library")}>Share Documents</button></div>
              <div className="portal-request-tabs">
                {["All", "Needs Processing", "Waiting on Patient", "Custom"].map((item) => <button key={item} className={portalFilter === item ? "active" : ""} onClick={() => setPortalFilter(item)}>{item} <span className="status-pill">0</span></button>)}
              </div>
              <table className="classic-table"><thead><tr><th>Document</th><th>Sent</th><th>Received</th><th>Status</th></tr></thead><tbody><tr><td colSpan={4} style={{ textAlign: "center" }}>There are no matching portal documents to display.</td></tr></tbody></table>
            </section>
          </>
        )}

        {tab === "messages" && (
          <section className="panel">
            <div className="actions" style={{ justifyContent: "space-between" }}><h2 className="section-title">Patient Messages</h2><button className="btn blue" onClick={() => setModal("conversation")}>+ New Conversation</button></div>
            <div className="message-shell">
              <div className="message-sidebar">
                {["📥 Inbox", "🗃️ Admin", "💵 Billing", "☑ Clinical", "🗑 Deleted"].map((item) => <p key={item}><button className="link">{item}</button></p>)}
                <div style={{ marginTop: 420 }}>
                  {["Unread Only", "Unread and Read", "All Including Archived"].map((item) => <p key={item}><label><input type="radio" checked={messageFilter === item} onChange={() => setMessageFilter(item)} /> {item}</label></p>)}
                  <button className="link" onClick={() => notify("Message settings opened.")}>Messages Settings</button>
                </div>
              </div>
              <div className="message-list">
                <select style={{ width: "100%" }}><option>All Topics</option><option>Admin</option><option>Billing</option><option>Clinical</option></select>
                <div className="actions" style={{ justifyContent: "space-between", marginTop: 12 }}><button className="link">Select</button><select><option>Newest</option><option>Oldest</option></select></div>
                <p style={{ color: "#777", textAlign: "center", marginTop: 24 }}>There are no messages to be displayed.</p>
              </div>
              <div style={{ display: "grid", placeItems: "center", color: "#666" }}>Select a conversation</div>
            </div>
          </section>
        )}

        {tab === "insights" && (
          <section className="panel">
            <h2 className="section-title">Outcome Measures</h2>
            <div className="actions">
              <select value={insightRange} onChange={(event) => setInsightRange(event.target.value)}>{outcomeRanges.map((range) => <option key={range}>{range}</option>)}</select>
              <input type="date" defaultValue="2025-04-28" /> to <input type="date" defaultValue="2026-04-28" />
            </div>
            <p>There are no chartable results for the selected date range.</p>
          </section>
        )}

        {modal && (
          <ModalFrame title={modalTitle(modal)} onClose={() => setModal(null)}>
            {modal === "appointment" && (
              <>
                <div className="form-row"><label>Appointment Type:</label><select>{appointmentTypes.map((item) => <option key={item}>{item}</option>)}</select></div>
                <div className="form-row"><label>Patient:</label><button className="link" onClick={() => go(`/patients/${patient.id}`)}>{patient.display} {patient.dob}</button></div>
                <div className="form-row"><label>Clinician:</label><select><option>{patient.clinician}</option><option>Assigned clinician database...</option></select></div>
                <div className="form-row"><label>Location:</label><select><option>Conscious Counseling PLLC</option><option>Telehealth</option><option>Location database...</option></select></div>
                <div className="form-row"><label>Telehealth:</label><label><input type="checkbox" /> Use Therassistant Telehealth</label></div>
                <div className="form-row"><label>Service Code:</label><select>{serviceCodes.map((code) => <option key={code}>{code}</option>)}</select></div>
                <div className="form-row"><label>Scheduled Time:</label><div className="actions"><input type="date" /> at <input type="time" /></div></div>
                <div className="form-row"><label>Duration:</label><div className="actions"><input className="input-sm" type="number" defaultValue={60} /> minutes</div></div>
                <div className="form-row"><label>Frequency:</label><select>{frequencies.map((item) => <option key={item}>{item}</option>)}</select></div>
                <div className="form-row"><label>Appointment Alert:</label><textarea /></div>
                <button className="btn green" onClick={saveAppointment}>Save New Appointment</button>
              </>
            )}

            {modal === "note" && <NoteEditor onSave={() => saveGeneric("Clinical note saved as draft.")} />}
            {modal === "upload" && <p>Use the Upload Patient File button to choose a document.</p>}
            {modal === "outcome" && <OutcomeMeasureMenu onSelect={(name) => saveGeneric(`${name} queued for administration.`)} />}
            {modal === "payment" && <PaymentForm paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} onSave={() => saveGeneric("Patient payment saved and applied to ledger.")} />}
            {modal === "charge" && <SimpleMoneyForm label="Amount Owed:" button="Save New Charge" onSave={() => saveGeneric("Miscellaneous charge saved.")} />}
            {modal === "credit" && <SimpleMoneyForm label="Credit Amount:" button="Save New Credit" onSave={() => saveGeneric("Miscellaneous credit saved.")} />}
            {modal === "refund" && <SimpleMoneyForm label="Refund Amount:" button="Save New Refund" onSave={() => saveGeneric("Refund saved.")} />}
            {modal === "statement" && <StatementForm statementMode={statementMode} setStatementMode={setStatementMode} statementPreview={statementPreview} setStatementPreview={setStatementPreview} onSave={() => saveGeneric("Statement saved.")} />}
            {modal === "conversation" && <TextForm label="Message" button="Create Conversation" onSave={() => saveGeneric("Conversation created.")} />}
            {modal === "reminder" && <TextForm label="Reminder" button="Save Reminder" onSave={() => saveGeneric("Reminder saved.")} />}
            {modal === "contact" && <TextForm label="Contact Details" button="Save Contact" onSave={() => saveGeneric("Contact saved.")} />}
            {["billing-comments", "insurance", "claim-info", "payment-settings", "cash-rates"].includes(modal) && <TextForm label="Update" button="Save Changes" onSave={() => saveGeneric("Billing settings updated.")} />}
          </ModalFrame>
        )}

        {toast && <div className="toast">{toast}</div>}
      </section>
    </main>
  );
}

function modalTitle(modal: Modal) {
  const titles: Record<Exclude<Modal, null>, string> = {
    appointment: "Create New Appointment",
    note: "Create New Note",
    upload: "Upload Patient File",
    payment: "Patient Payment",
    charge: "Enter Miscellaneous Charge",
    credit: "Miscellaneous Patient Credit",
    refund: "Enter Refund",
    statement: "Create Statement",
    conversation: "New Conversation",
    reminder: "New Reminder",
    contact: "New Contact",
    "billing-comments": "Edit Billing Comments",
    insurance: "Edit Insurance",
    "claim-info": "Edit Additional Claim Information",
    "payment-settings": "Edit Payment Settings",
    "cash-rates": "Edit Patient Cash Rates",
    outcome: "Outcome Measure",
  };
  return modal ? titles[modal] : "";
}

function ModalFrame({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <span>{title}</span>
          <button className="close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function OutcomeMeasureMenu({ onSelect }: { onSelect: (name: string) => void }) {
  const measures = [
    "ACE: Adverse Childhood Experiences Questionnaire",
    "ASRS-v1.1: Adult ADHD Self-Report Scale",
    "AUDIT: Alcohol Use Disorders Identification Test",
    "BBGS: Brief Biosocial Gambling Screen",
    "C-SSRS: Columbia-Suicide Severity Rating Scale",
    "CAGE-AID: CAGE Adapted to Include Drugs",
    "CRAFFT 2.1+N: CRAFFT+N Questionnaire",
    "DAS: Dyadic Adjustment Scale",
    "DES II: Dissociative Experiences Scale II",
    "EAT-26: Eating Attitudes Test",
  ];

  return (
    <div>
      <p>Choose a questionnaire to administer now:</p>
      <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid #ddd" }}>
        {measures.map((measure) => (
          <button key={measure} className="link" style={{ display: "block", width: "100%", textAlign: "left", padding: 8 }} onClick={() => onSelect(measure)}>
            {measure}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaymentForm({ paymentMethod, setPaymentMethod, onSave }: { paymentMethod: string; setPaymentMethod: (method: string) => void; onSave: () => void }) {
  return (
    <div>
      <p>Patient Balance Owed: <strong>$260.00</strong> &nbsp;&nbsp; Unassigned Credit: <strong>$0.00</strong></p>
      <div className="form-row"><label>Payment Method:</label><div className="actions">{["Check", "Cash", "External"].map((method) => <button key={method} className={`btn ${paymentMethod === method ? "blue" : ""}`} onClick={() => setPaymentMethod(method)}>✓ {method}</button>)}</div></div>
      <div className="form-row"><label>Payment Date:</label><input type="date" defaultValue="2026-04-28" /></div>
      <div className="form-row"><label>Payment Amount:</label><div className="actions"><span className="money">$</span><input className="input-sm" type="number" step="0.01" /></div></div>
      <div className="form-row"><label>Check Number:</label><input className="input-lg" placeholder="optional" /></div>
      <div className="form-row"><label>Comments:</label><textarea placeholder="Internal memo only" /></div>
      <button className="btn green" onClick={onSave}>Save New Payment</button>
    </div>
  );
}

function SimpleMoneyForm({ label, button, onSave }: { label: string; button: string; onSave: () => void }) {
  return (
    <div>
      <div className="form-row"><label>Patient:</label><span>Krystin Marie Butler 6/26/1987</span></div>
      <div className="form-row"><label>{label}</label><div className="actions"><span className="money">$</span><input className="input-sm" type="number" step="0.01" /></div></div>
      <div className="form-row"><label>Date:</label><input type="date" defaultValue="2026-04-28" /></div>
      <div className="form-row"><label>Clinician:</label><select><option>Not assigned to any clinician</option><option>Krystin Butler</option></select></div>
      <div className="form-row"><label>Comments:</label><textarea /></div>
      <button className="btn green" onClick={onSave}>{button}</button>
    </div>
  );
}

function StatementForm({ statementMode, setStatementMode, statementPreview, setStatementPreview, onSave }: { statementMode: string; setStatementMode: (value: string) => void; statementPreview: boolean; setStatementPreview: (value: boolean) => void; onSave: () => void }) {
  return (
    <div>
      <p>Patient Balance Owed: <strong>$260.00</strong> &nbsp;&nbsp; Unassigned Credit: <strong>$0.00</strong></p>
      <p><label><input type="radio" checked={statementMode === "all"} onChange={() => setStatementMode("all")} /> All open charges for the selected patient</label></p>
      <p><label><input type="radio" checked={statementMode === "range"} onChange={() => setStatementMode("range")} /> Charges from </label><select>{statementRanges.map((range) => <option key={range}>{range}</option>)}</select> <input type="date" defaultValue="2026-03-29" /> to <input type="date" defaultValue="2026-04-28" /></p>
      <p>Statement Comment:</p>
      <textarea style={{ width: "100%" }} placeholder="A comment to display at the end of the statement" />
      <p><button className="btn blue" onClick={() => setStatementPreview(true)}>Generate Preview</button></p>
      {statementPreview && (
        <div className="panel">
          <h3>Statement Preview</h3>
          <table className="classic-table">
            <thead><tr><th>Date</th><th>Transaction</th><th>Rate</th><th>Insurance</th><th>Client</th></tr></thead>
            <tbody>
              <tr><td>1/6/2025</td><td>Misc. Charge (from Misc. Note)</td><td>$260.00</td><td>Not Set</td><td>$260.00</td></tr>
              <tr><td>1/6/2025</td><td>90791 Commercial Intake</td><td>Not Set</td><td>Not Set</td><td>Not Set</td></tr>
            </tbody>
          </table>
          <h3 style={{ textAlign: "center", background: "#e5e5e5", padding: 10 }}>Amount Due: $260.00</h3>
          <button className="btn green" onClick={onSave}>Save Statement</button>
        </div>
      )}
    </div>
  );
}

function TextForm({ label, button, onSave }: { label: string; button: string; onSave: () => void }) {
  return (
    <div>
      <label>{label}<textarea style={{ width: "100%" }} /></label>
      <p><button className="btn green" onClick={onSave}>{button}</button></p>
    </div>
  );
}

function NoteEditor({ onSave }: { onSave: () => void }) {
  return (
    <div className="note-layout">
      <div className="note-header">
        <div>
          <span style={{ background: "#d7f36a", padding: "4px 8px" }}>Creating New Note</span>
          <h2>Psychotherapy Intake Note</h2>
          <p><strong>Clinician:</strong> Krystin Butler</p>
          <p><strong>Patient:</strong> Krystin Marie Butler, DOB 6/26/1987</p>
          <p><strong>Primary Insurance:</strong> Colorado Access, 12346</p>
        </div>
        <div>
          <p><strong>Date and Time:</strong> <input type="date" defaultValue="2026-04-28" /> <input type="time" defaultValue="10:00" /></p>
          <p><strong>Duration:</strong> <input className="input-sm" type="number" defaultValue={90} /> minutes</p>
          <p><strong>Service Code:</strong> <select>{serviceCodes.map((code) => <option key={code}>{code}</option>)}</select></p>
          <p><strong>Location:</strong> Main Office</p>
        </div>
      </div>
      <div className="note-section"><h3>Presenting Problem</h3><textarea style={{ width: "100%" }} /></div>
      <div className="note-section">
        <h3>Current Mental Status <button className="link" style={{ float: "right" }}>All Normal &nbsp; All Not Assessed</button></h3>
        <div className="mental-grid">
          {["General Appearance", "Dress", "Motor Activity", "Insight", "Judgment", "Affect", "Mood", "Orientation", "Memory", "Attention/Concentration", "Thought Content", "Perception", "Flow of Thought", "Interview Behavior", "Speech"].map((label) => (
            <div className="mental-row" key={label}><label>{label}:</label><input /></div>
          ))}
        </div>
      </div>
      <div className="note-section"><h3>Safety Issues</h3><label><input type="checkbox" /> None</label> or <label><input type="checkbox" /> Suicidal Ideation</label> <label><input type="checkbox" /> Homicidal Ideation</label> Other: <input className="input-lg" placeholder="other safety issue" /></div>
      <div className="note-section"><h3>Background Information</h3>{["Identification", "History of Present Problem", "Past Psychiatric History", "Trauma History", "Family Psychiatric History", "Medical Conditions / History", "Substance Use", "Social History", "Spiritual/Cultural Factors", "Educational/Vocational History", "Legal History"].map((label) => <div className="mental-row" key={label}><label>{label}:</label><input /></div>)}</div>
      <div className="note-section"><h3>Diagnosis</h3><input className="input-sm" defaultValue="F41.1" /> <input className="input-lg" defaultValue="Generalized anxiety disorder" /></div>
      <button className="btn green" onClick={onSave}>Save Draft</button>
    </div>
  );
}
