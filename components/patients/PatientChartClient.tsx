"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

export type PatientChartPatient = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  dob?: string | null;
  age?: number | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  assignedClinician?: string | null;
  status?: string | null;
};

type TabKey =
  | "info"
  | "todo"
  | "schedule"
  | "documents"
  | "billing"
  | "billing-settings"
  | "portal"
  | "messages"
  | "insights";

type ModalKey =
  | "appointment"
  | "note"
  | "upload"
  | "payment"
  | "misc-charge"
  | "refund"
  | "credit"
  | "statement"
  | "conversation"
  | "welcome-email"
  | "share-documents"
  | null;

type ActivityItem = {
  id: string;
  label: string;
  detail: string;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "info", label: "Info" },
  { key: "todo", label: "To-Do" },
  { key: "schedule", label: "Schedule" },
  { key: "documents", label: "Documents" },
  { key: "billing", label: "Billing" },
  { key: "billing-settings", label: "Billing Settings" },
  { key: "portal", label: "Portal" },
  { key: "messages", label: "Messages" },
  { key: "insights", label: "Insights" },
];

const serviceCodes = ["90837", "90834", "90832", "90839", "90791", "H0031", "H0032", "H0001", "T1017"];
const appointmentTypes = ["Intake", "Follow-up"];
const frequencies = ["One time", "Weekly", "Bi-weekly", "Monthly"];
const statementRanges = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 120 days"];
const outcomeRanges = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 120 days", "Last 365 days"];

function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(date?: string | null): string {
  if (!date) return "Not on file";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
        defaultValue={value ?? ""}
      />
    </label>
  );
}

function SelectField({ label, options, defaultValue }: { label: string; options: string[]; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      <select
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
        defaultValue={defaultValue ?? options[0]}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
}) {
  const className =
    variant === "primary"
      ? "rounded bg-[#1d74b7] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#155b91]"
      : variant === "danger"
        ? "rounded bg-rose-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-800"
        : "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#1d5f93] shadow-sm hover:bg-slate-50";

  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

export default function PatientChartClient({ patient }: { patient: PatientChartPatient }) {
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [modal, setModal] = useState<ModalKey>(null);
  const [notice, setNotice] = useState("Clean patient chart files loaded.");
  const [statementRange, setStatementRange] = useState("Last 30 days");
  const [outcomeRange, setOutcomeRange] = useState("Last 365 days");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const patientName = `${patient.firstName} ${patient.lastName}`;

  const activities = useMemo<ActivityItem[]>(
    () => [
      { id: "1", label: "Chart opened", detail: `${patientName} record loaded` },
      { id: "2", label: "Eligibility ready", detail: "Primary payer can be verified from Billing Settings" },
      { id: "3", label: "Documentation available", detail: "Documents tab has notes, plans, uploads, and outcome measures" },
    ],
    [patientName],
  );

  function closeModal(message?: string) {
    setModal(null);
    if (message) setNotice(message);
  }

  function handleFileUpload(file: File | undefined) {
    if (!file) return;
    setNotice(`Uploaded patient file: ${file.name}`);
  }

  return (
    <main className="min-h-screen bg-[#eef3f7] text-slate-900">
      <div className="border-b border-[#0f5788] bg-[#1f78b8] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-5 text-sm font-semibold">
            <Link href="/patients" className="hover:underline">
              Patient
            </Link>
            <Link href="/workqueue" className="hover:underline">
              To-Do
            </Link>
            <Link href="/scheduling" className="hover:underline">
              Scheduling
            </Link>
            <Link href="/billing" className="hover:underline">
              Billing
            </Link>
          </div>
          <div className="text-sm font-semibold">TherAssistant</div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-5">
        <div className="mb-4 rounded border border-yellow-400 bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-950">
          ACTIVE CLEAN PATIENT CHART LOADED
        </div>

        <div className="rounded border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-[#f6f8fa] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#1b4f72]">{patientName}</h1>
                <p className="mt-1 text-sm text-slate-700">
                  DOB: {formatDate(patient.dob)} {patient.age ? `(${patient.age})` : ""} · Patient ID: {patient.id}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Assigned clinician: {patient.assignedClinician ?? "Unassigned"} · Status: {patient.status ?? "Active"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton onClick={() => setModal("appointment")} variant="primary">
                  Schedule Appointment
                </ActionButton>
                <ActionButton onClick={() => setModal("note")} variant="primary">
                  Create Note
                </ActionButton>
                <ActionButton onClick={() => fileInputRef.current?.click()}>Upload Document</ActionButton>
                <ActionButton onClick={() => setActiveTab("billing")}>View Balance</ActionButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => handleFileUpload(event.target.files?.[0])}
                />
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap border-b border-slate-300 bg-[#d9e3ec]">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`border-r border-slate-300 px-4 py-2 text-sm font-semibold ${
                  activeTab === tab.key
                    ? "bg-white text-[#154e7a]"
                    : "bg-[#d9e3ec] text-slate-700 hover:bg-[#edf3f7]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="border-b border-slate-200 bg-blue-50 px-5 py-2 text-sm text-[#174f78]">{notice}</div>

          <div className="p-5">
            {activeTab === "info" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <section className="rounded border border-slate-300">
                  <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 font-bold text-[#1b4f72]">
                    Patient Information
                  </div>
                  <div className="grid gap-4 p-4 md:grid-cols-2">
                    <Field label="First Name" value={patient.firstName} />
                    <Field label="Last Name" value={patient.lastName} />
                    <Field label="Preferred Name" value={patient.preferredName} />
                    <Field label="Date of Birth" value={patient.dob ?? ""} />
                    <Field label="Phone" value={patient.phone} />
                    <Field label="Email" value={patient.email} />
                    <Field label="Address" value={patient.address} />
                    <Field label="Assigned Clinician" value={patient.assignedClinician} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-300 bg-slate-50 p-4">
                    <ActionButton onClick={() => setNotice("Patient information saved.")} variant="primary">
                      Save Changes
                    </ActionButton>
                    <ActionButton onClick={() => setNotice("New contact form opened.")}>New Contact</ActionButton>
                  </div>
                </section>

                <aside className="rounded border border-slate-300">
                  <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 font-bold text-[#1b4f72]">
                    Recent Activity
                  </div>
                  <div className="divide-y divide-slate-200">
                    {activities.map((activity) => (
                      <div key={activity.id} className="p-4">
                        <div className="font-semibold text-slate-900">{activity.label}</div>
                        <div className="text-sm text-slate-600">{activity.detail}</div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            )}

            {activeTab === "todo" && (
              <section className="rounded border border-slate-300">
                <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-2">
                  <h2 className="font-bold text-[#1b4f72]">To-Do Items</h2>
                  <ActionButton onClick={() => setNotice("New reminder created.")}>New Reminder</ActionButton>
                </div>
                <div className="p-4">
                  <Link href="/workqueue" className="font-semibold text-[#1d74b7] underline">
                    Open full To-Do Items list
                  </Link>
                  <table className="mt-4 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="border p-2">Due</th>
                        <th className="border p-2">Task</th>
                        <th className="border p-2">Owner</th>
                        <th className="border p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border p-2">Today</td>
                        <td className="border p-2">Review treatment plan update</td>
                        <td className="border p-2">{patient.assignedClinician}</td>
                        <td className="border p-2">Open</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "schedule" && (
              <section className="rounded border border-slate-300">
                <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-2">
                  <h2 className="font-bold text-[#1b4f72]">Schedule</h2>
                  <ActionButton onClick={() => setModal("appointment")} variant="primary">
                    New Appointment
                  </ActionButton>
                </div>
                <div className="p-4">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="border p-2">Date</th>
                        <th className="border p-2">Time</th>
                        <th className="border p-2">Type</th>
                        <th className="border p-2">Provider</th>
                        <th className="border p-2">Location</th>
                        <th className="border p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border p-2">2026-05-05</td>
                        <td className="border p-2">10:00 AM</td>
                        <td className="border p-2">Follow-up</td>
                        <td className="border p-2">{patient.assignedClinician}</td>
                        <td className="border p-2">Telehealth</td>
                        <td className="border p-2">Scheduled</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "documents" && (
              <section className="rounded border border-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-100 px-4 py-2">
                  <h2 className="font-bold text-[#1b4f72]">Documents</h2>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={() => fileInputRef.current?.click()}>☁ Upload Patient File</ActionButton>
                    <ActionButton onClick={() => setNotice("Outcome measure menu opened.")}>▥ Outcome Measure ▾</ActionButton>
                    <ActionButton onClick={() => setModal("note")} variant="primary">
                      Create Note
                    </ActionButton>
                  </div>
                </div>
                <div className="p-4">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="border p-2">Document</th>
                        <th className="border p-2">Date</th>
                        <th className="border p-2">Status</th>
                        <th className="border p-2">Author / Access</th>
                        <th className="border p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["Progress Note", "Intake Assessment", "Treatment Plan", "Consent Form"].map((doc, index) => (
                        <tr key={doc}>
                          <td className="border p-2">
                            <button
                              type="button"
                              className="font-semibold text-[#1d74b7] underline"
                              onClick={() => setNotice(`${doc} opened.`)}
                            >
                              {doc}
                            </button>
                          </td>
                          <td className="border p-2">2026-04-{28 - index}</td>
                          <td className="border p-2">{index === 0 ? "Draft" : "Signed"}</td>
                          <td className="border p-2">
                            <Link href="/staff" className="text-[#1d74b7] underline">
                              {patient.assignedClinician}
                            </Link>
                          </td>
                          <td className="border p-2">
                            <button
                              type="button"
                              className="text-[#1d74b7] underline"
                              onClick={() => setNotice(`${doc} downloaded as PDF.`)}
                            >
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "billing" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                <section className="rounded border border-slate-300">
                  <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 font-bold text-[#1b4f72]">
                    Patient Accounting
                  </div>
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    <ActionButton onClick={() => setModal("payment")} variant="primary">
                      Enter Patient Payment
                    </ActionButton>
                    <ActionButton onClick={() => setModal("misc-charge")}>Enter Misc Charge</ActionButton>
                    <ActionButton onClick={() => setModal("refund")}>Enter Refund</ActionButton>
                    <ActionButton onClick={() => setModal("credit")}>Miscellaneous Patient Credit</ActionButton>
                    <ActionButton onClick={() => setModal("statement")}>Create Statement</ActionButton>
                    <ActionButton onClick={() => setNotice("Patient balance refreshed.")}>Refresh Balance</ActionButton>
                  </div>
                  <div className="p-4 pt-0">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-left">
                          <th className="border p-2">Date</th>
                          <th className="border p-2">Description</th>
                          <th className="border p-2">Charge</th>
                          <th className="border p-2">Payment</th>
                          <th className="border p-2">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border p-2">2026-04-28</td>
                          <td className="border p-2">90837 Psychotherapy</td>
                          <td className="border p-2">{money(165)}</td>
                          <td className="border p-2">{money(0)}</td>
                          <td className="border p-2">{money(165)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <aside className="rounded border border-slate-300">
                  <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 font-bold text-[#1b4f72]">
                    Insurance Claims
                  </div>
                  <div className="grid gap-2 p-4 text-sm">
                    <Link className="text-[#1d74b7] underline" href="/billing/eligibility">
                      Eligibility History
                    </Link>
                    <Link className="text-[#1d74b7] underline" href="/billing/submit-claims?claimType=primary">
                      Submit Primary Claims
                    </Link>
                    <Link className="text-[#1d74b7] underline" href="/billing/submit-claims?claimType=secondary">
                      Submit Secondary Claims
                    </Link>
                    <Link className="text-[#1d74b7] underline" href="/billing/cms-1500">
                      Create CMS-1500
                    </Link>
                    <Link className="text-[#1d74b7] underline" href="/billing/superbills">
                      Create Superbill
                    </Link>
                    <Link className="text-[#1d74b7] underline" href="/billing/insurance-payment">
                      Enter Insurance Payment
                    </Link>
                    <Link className="text-[#1d74b7] underline" href="/billing/electronic-claim-history">
                      Electronic Claim History
                    </Link>
                    <Link className="text-[#1d74b7] underline" href="/billing/era">
                      ERA
                    </Link>
                  </div>
                </aside>
              </div>
            )}

            {activeTab === "billing-settings" && (
              <section className="rounded border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 font-bold text-[#1b4f72]">
                  Billing Settings
                </div>
                <div className="divide-y divide-slate-200">
                  {[
                    "Billing Comments",
                    "Insurance",
                    "Additional Claim Information",
                    "Payment Settings",
                    "Patient Cash Rates",
                  ].map((section) => (
                    <div key={section} className="flex items-center justify-between p-4">
                      <div>
                        <div className="font-semibold">{section}</div>
                        <div className="text-sm text-slate-600">Configured for {patientName}</div>
                      </div>
                      <button
                        type="button"
                        className="text-[#1d74b7] underline"
                        onClick={() => setNotice(`${section} editor opened.`)}
                      >
                        edit
                      </button>
                    </div>
                  ))}
                  <div className="p-4">
                    <ActionButton onClick={() => setNotice("Eligibility verified successfully.")} variant="primary">
                      Verify Eligibility
                    </ActionButton>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "portal" && (
              <section className="rounded border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 font-bold text-[#1b4f72]">
                  THERASSISTANT PORTAL
                </div>
                <div className="grid gap-4 p-4">
                  <ActionButton onClick={() => setModal("welcome-email")} variant="primary">
                    Send Welcome Email
                  </ActionButton>
                  <ActionButton onClick={() => setModal("share-documents")}>Share Documents</ActionButton>
                  <div className="flex flex-wrap gap-2">
                    {["All 0", "Needs Processing 0", "Waiting on Patient 0", "Custom"].map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#1d5f93]"
                        onClick={() => setNotice(`Portal filter selected: ${item}`)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeTab === "messages" && (
              <section className="rounded border border-slate-300">
                <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-2">
                  <h2 className="font-bold text-[#1b4f72]">Messages</h2>
                  <ActionButton onClick={() => setModal("conversation")} variant="primary">
                    + New Conversation
                  </ActionButton>
                </div>
                <div className="p-4 text-sm text-slate-600">No active patient conversations.</div>
              </section>
            )}

            {activeTab === "insights" && (
              <section className="rounded border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 font-bold text-[#1b4f72]">
                  Insights
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Outcome Measures</span>
                    <select
                      value={outcomeRange}
                      onChange={(event) => setOutcomeRange(event.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {outcomeRanges.map((range) => (
                        <option key={range}>{range}</option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded border border-slate-300 bg-slate-50 p-4">
                    Showing outcomes for {outcomeRange}.
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded border border-slate-400 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-300 bg-[#1f78b8] px-4 py-3 text-white">
              <h2 className="font-bold">
                {modal === "appointment" && "Create New Appointment"}
                {modal === "note" && "Create Note"}
                {modal === "upload" && "Upload Patient File"}
                {modal === "payment" && "Enter Patient Payment"}
                {modal === "misc-charge" && "Enter Misc Charge"}
                {modal === "refund" && "Enter Refund"}
                {modal === "credit" && "Miscellaneous Patient Credit"}
                {modal === "statement" && "Create Statement"}
                {modal === "conversation" && "New Conversation"}
                {modal === "welcome-email" && "Send Welcome Email"}
                {modal === "share-documents" && "Share Documents"}
              </h2>
              <button type="button" onClick={() => setModal(null)} className="font-bold">
                ×
              </button>
            </div>

            <div className="grid gap-4 p-4">
              {modal === "appointment" && (
                <>
                  <SelectField label="Appointment Type" options={appointmentTypes} defaultValue="Intake" />
                  <Field label="Patient" value={`${patientName} (${patient.id})`} />
                  <Field label="Clinician" value={patient.assignedClinician} />
                  <SelectField label="Location" options={["Telehealth", "Denver Office", "Colorado Springs Office"]} />
                  <SelectField label="Service Code" options={serviceCodes} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Scheduled Date</span>
                    <input type="date" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">At</span>
                    <input type="time" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <SelectField label="Frequency" options={frequencies} />
                  <ActionButton onClick={() => closeModal("New appointment saved.")} variant="primary">
                    Save New Appointment
                  </ActionButton>
                </>
              )}

              {modal === "payment" && (
                <>
                  <Field label="Payment Amount" value="$0.00" />
                  <SelectField label="Payment Method" options={["Cash", "Check", "Credit Card", "ACH"]} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Payment Date</span>
                    <input type="date" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <ActionButton onClick={() => closeModal("New patient payment saved.")} variant="primary">
                    Save New Payment
                  </ActionButton>
                </>
              )}

              {modal === "credit" && (
                <>
                  <Field label="Credit Amount" value="$0.00" />
                  <Field label="Reason" value="" />
                  <ActionButton onClick={() => closeModal("Miscellaneous patient credit saved.")} variant="primary">
                    Save New Credit
                  </ActionButton>
                </>
              )}

              {modal === "statement" && (
                <>
                  <SelectField
                    label="Charges From"
                    options={statementRanges}
                    defaultValue={statementRange}
                  />
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={() => setNotice(`Statement preview generated for ${statementRange}.`)}>
                      Generate Preview
                    </ActionButton>
                    <ActionButton onClick={() => closeModal("Statement saved.")} variant="primary">
                      Save Statement
                    </ActionButton>
                  </div>
                </>
              )}

              {["note", "misc-charge", "refund", "conversation", "welcome-email", "share-documents"].includes(modal) && (
                <>
                  <textarea
                    className="min-h-32 w-full rounded border border-slate-300 p-3 text-sm"
                    placeholder="Enter details..."
                  />
                  <ActionButton onClick={() => closeModal("Action completed.")} variant="primary">
                    Save
                  </ActionButton>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
