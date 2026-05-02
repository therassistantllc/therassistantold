"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AppointmentStatus = "scheduled" | "checked_in" | "completed" | "cancelled" | "no_show";
type EncounterStatus = "not_started" | "active" | "completed";
type NoteStatus = "draft" | "signed";
type ChargeStatus = "not_created" | "ready_to_bill" | "claim_created";
type ClaimStatus = "not_created" | "draft" | "submitted" | "accepted" | "rejected" | "paid";

type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name?: string | null;
  dob?: string | null;
  mrn?: string | null;
  phone?: string | null;
  email?: string | null;
  assigned_clinician?: string | null;
};

type Appointment = {
  id: string;
  patient_id: string;
  provider_id?: string | null;
  provider_name: string;
  location_name: string;
  appointment_type: "Intake" | "Follow-up";
  service_code: string;
  start_date: string;
  start_time: string;
  duration_minutes: number;
  frequency: "One time" | "Weekly" | "Bi-weekly" | "Monthly";
  telehealth: boolean;
  status: AppointmentStatus;
  internal_notes?: string;
};

type Encounter = {
  id: string;
  patient_id: string;
  appointment_id: string;
  status: EncounterStatus;
  created_at: string;
  completed_at?: string | null;
};

type ClinicalNote = {
  id: string;
  encounter_id: string;
  status: NoteStatus;
  note_type: string;
  signed_at?: string | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  risk: string;
};

type Charge = {
  id: string;
  encounter_id: string;
  patient_id: string;
  service_code: string;
  amount_cents: number;
  status: ChargeStatus;
  created_at: string;
};

type Claim = {
  id: string;
  encounter_id: string;
  patient_id: string;
  charge_id: string;
  status: ClaimStatus;
  payer: string;
  created_at: string;
};

type WorkqueueItem = {
  id: string;
  patient_id: string;
  encounter_id?: string;
  appointment_id?: string;
  type: "documentation_hold" | "ready_to_bill" | "billing_review" | "claim_submission";
  priority: "low" | "normal" | "high";
  status: "open" | "resolved";
  message: string;
  created_at: string;
};

type AppState = {
  patient: Patient;
  appointments: Appointment[];
  encounters: Encounter[];
  notes: ClinicalNote[];
  charges: Charge[];
  claims: Claim[];
  workqueue: WorkqueueItem[];
};

type ModalName =
  | null
  | "appointment"
  | "routeToBiller"
  | "uploadDocument"
  | "createNote"
  | "createPolicy"
  | "claimQueue";

const todayIso = "2026-04-28";

const serviceCodes = ["90834", "90832", "90837", "90839", "90791", "H0031", "H0032", "H0001", "T1017"];
const appointmentTypes = ["Intake", "Follow-up"] as const;
const frequencies = ["One time", "Weekly", "Bi-weekly", "Monthly"] as const;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getInitialState(patientId: string): AppState {
  const patient: Patient = {
    id: patientId,
    first_name: "Krystin",
    last_name: "Butler",
    preferred_name: "Krystin",
    dob: "1987-06-28",
    mrn: "MRN-001",
    phone: "(303) 943-3946",
    email: "admin@therassistant.com",
    assigned_clinician: "Krystin Butler",
  };

  const appointmentId = "appt_initial_intake_20260428";
  const encounterId = "enc_initial_20260428";
  const noteId = "note_initial_20260428";

  return {
    patient,
    appointments: [
      {
        id: appointmentId,
        patient_id: patientId,
        provider_name: "Krystin Butler",
        location_name: "Conscious Counseling PLLC",
        appointment_type: "Intake",
        service_code: "90791",
        start_date: todayIso,
        start_time: "11:44",
        duration_minutes: 60,
        frequency: "One time",
        telehealth: false,
        status: "completed",
        internal_notes: "Initial intake appointment.",
      },
      {
        id: "appt_followup_20260505",
        patient_id: patientId,
        provider_name: "Krystin Butler",
        location_name: "Conscious Counseling PLLC",
        appointment_type: "Follow-up",
        service_code: "90837",
        start_date: "2026-05-05",
        start_time: "10:00",
        duration_minutes: 60,
        frequency: "Weekly",
        telehealth: true,
        status: "scheduled",
        internal_notes: "Weekly therapy follow-up.",
      },
    ],
    encounters: [
      {
        id: encounterId,
        patient_id: patientId,
        appointment_id: appointmentId,
        status: "active",
        created_at: "2026-04-28T11:45:00.000Z",
      },
    ],
    notes: [
      {
        id: noteId,
        encounter_id: encounterId,
        status: "draft",
        note_type: "Psychotherapy Intake Note",
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        risk: "None reported.",
      },
    ],
    charges: [],
    claims: [],
    workqueue: [],
  };
}

function persistKey(patientId: string) {
  return `therassistant.workflow.patient.${patientId}.v2`;
}

async function apiPost(path: string, body: unknown) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default function PatientWorkflowSpineClient({ patientId }: { patientId: string }) {
  const [state, setState] = useState<AppState>(() => getInitialState(patientId));
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [modal, setModal] = useState<ModalName>(null);
  const [toast, setToast] = useState("ACTIVE PATIENT CHART OVERRIDE LOADED · This is the active /patients/[id] route.");
  const [billerMessage, setBillerMessage] = useState("");
  const [appointmentForm, setAppointmentForm] = useState<Appointment>({
    id: "",
    patient_id: patientId,
    provider_name: "Krystin Butler",
    location_name: "Conscious Counseling PLLC",
    appointment_type: "Follow-up",
    service_code: "90837",
    start_date: todayIso,
    start_time: "10:00",
    duration_minutes: 60,
    frequency: "One time",
    telehealth: false,
    status: "scheduled",
    internal_notes: "",
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(persistKey(patientId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppState;
        setState(parsed);
        setSelectedAppointmentId(parsed.appointments[0]?.id ?? "");
        return;
      } catch {
        window.localStorage.removeItem(persistKey(patientId));
      }
    }
    const initial = getInitialState(patientId);
    setState(initial);
    setSelectedAppointmentId(initial.appointments[0]?.id ?? "");
  }, [patientId]);

  useEffect(() => {
    window.localStorage.setItem(persistKey(patientId), JSON.stringify(state));
  }, [patientId, state]);

  const selectedAppointment = useMemo(
    () => state.appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? state.appointments[0],
    [selectedAppointmentId, state.appointments],
  );

  const activeEncounter = useMemo(
    () => state.encounters.find((encounter) => encounter.appointment_id === selectedAppointment?.id),
    [selectedAppointment?.id, state.encounters],
  );

  const activeNote = useMemo(
    () => state.notes.find((note) => note.encounter_id === activeEncounter?.id),
    [activeEncounter?.id, state.notes],
  );

  const activeCharge = useMemo(
    () => state.charges.find((charge) => charge.encounter_id === activeEncounter?.id),
    [activeEncounter?.id, state.charges],
  );

  const activeClaim = useMemo(
    () => state.claims.find((claim) => claim.encounter_id === activeEncounter?.id),
    [activeEncounter?.id, state.claims],
  );

  const readyToBillCount = state.workqueue.filter((item) => item.type === "ready_to_bill" && item.status === "open").length;
  const openTickets = state.workqueue.filter((item) => item.status === "open").length;
  const patientName = `${state.patient.first_name} ${state.patient.last_name}`;

  function show(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 5000);
  }

  function updateNote(field: keyof Pick<ClinicalNote, "subjective" | "objective" | "assessment" | "plan" | "risk">, value: string) {
    if (!activeNote) return;
    setState((current) => ({
      ...current,
      notes: current.notes.map((note) => (note.id === activeNote.id ? { ...note, [field]: value } : note)),
    }));
  }

  async function createAppointment() {
    const appointment: Appointment = {
      ...appointmentForm,
      id: uid("appt"),
      patient_id: patientId,
      duration_minutes: Number(appointmentForm.duration_minutes || 60),
    };
    await apiPost("/api/appointments", appointment);
    setState((current) => ({ ...current, appointments: [appointment, ...current.appointments] }));
    setSelectedAppointmentId(appointment.id);
    setModal(null);
    show("Appointment saved and linked to patient chart.");
  }

  async function createEncounter() {
    if (!selectedAppointment) return;
    const existing = state.encounters.find((encounter) => encounter.appointment_id === selectedAppointment.id);
    if (existing) {
      show("Encounter already exists for this appointment.");
      return;
    }

    const encounter: Encounter = {
      id: uid("enc"),
      patient_id: patientId,
      appointment_id: selectedAppointment.id,
      status: "active",
      created_at: new Date().toISOString(),
    };

    const note: ClinicalNote = {
      id: uid("note"),
      encounter_id: encounter.id,
      status: "draft",
      note_type: selectedAppointment.appointment_type === "Intake" ? "Psychotherapy Intake Note" : "Psychotherapy Progress Note",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      risk: "None reported.",
    };

    await apiPost("/api/encounters", encounter);
    setState((current) => ({
      ...current,
      encounters: [encounter, ...current.encounters],
      notes: [note, ...current.notes],
    }));
    show("Encounter created from appointment. Draft note opened.");
  }

  async function signNote() {
    if (!activeEncounter || !activeNote) return;
    const signedNote: ClinicalNote = {
      ...activeNote,
      status: "signed",
      signed_at: new Date().toISOString(),
    };
    const completedEncounter: Encounter = {
      ...activeEncounter,
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    const readyItem: WorkqueueItem = {
      id: uid("wq"),
      patient_id: patientId,
      encounter_id: activeEncounter.id,
      appointment_id: activeEncounter.appointment_id,
      type: "ready_to_bill",
      priority: "normal",
      status: "open",
      message: "Signed documentation is ready for billing scrub.",
      created_at: new Date().toISOString(),
    };

    await apiPost(`/api/encounters/${activeEncounter.id}/notes/sign`, signedNote);
    setState((current) => ({
      ...current,
      notes: current.notes.map((note) => (note.id === activeNote.id ? signedNote : note)),
      encounters: current.encounters.map((encounter) => (encounter.id === activeEncounter.id ? completedEncounter : encounter)),
      workqueue: [readyItem, ...current.workqueue],
    }));
    show("Note signed. Encounter completed and automatically routed to billing workqueue.");
  }

  async function generateCharge() {
    if (!activeEncounter || !selectedAppointment || !activeNote || activeNote.status !== "signed") {
      show("Sign the note before generating a charge.");
      return;
    }
    if (activeCharge) {
      show("Charge already exists for this encounter.");
      return;
    }

    const amountByCode: Record<string, number> = {
      "90832": 9000,
      "90834": 12500,
      "90837": 16500,
      "90839": 19000,
      "90791": 17500,
      H0031: 16000,
      H0032: 14500,
      H0001: 15000,
      T1017: 9500,
    };

    const charge: Charge = {
      id: uid("chg"),
      encounter_id: activeEncounter.id,
      patient_id: patientId,
      service_code: selectedAppointment.service_code,
      amount_cents: amountByCode[selectedAppointment.service_code] ?? 15000,
      status: "ready_to_bill",
      created_at: new Date().toISOString(),
    };

    await apiPost("/api/claims/charges", charge);
    setState((current) => ({ ...current, charges: [charge, ...current.charges] }));
    show("Charge generated from signed note and service code.");
  }

  async function createClaim() {
    if (!activeEncounter || !activeCharge) {
      show("Generate a charge before creating a claim.");
      return;
    }
    if (activeClaim) {
      show("Claim already exists for this encounter.");
      return;
    }

    const claim: Claim = {
      id: uid("clm"),
      encounter_id: activeEncounter.id,
      patient_id: patientId,
      charge_id: activeCharge.id,
      status: "draft",
      payer: "Colorado Access",
      created_at: new Date().toISOString(),
    };

    await apiPost("/api/claims", claim);
    setState((current) => ({
      ...current,
      claims: [claim, ...current.claims],
      charges: current.charges.map((charge) => (charge.id === activeCharge.id ? { ...charge, status: "claim_created" } : charge)),
    }));
    show("Draft claim created from charge.");
  }

  function routeToBiller() {
    if (!selectedAppointment) return;
    const item: WorkqueueItem = {
      id: uid("wq"),
      patient_id: patientId,
      encounter_id: activeEncounter?.id,
      appointment_id: selectedAppointment.id,
      type: "billing_review",
      priority: "high",
      status: "open",
      message: billerMessage.trim() || "Clinician requested billing review for this patient chart.",
      created_at: new Date().toISOString(),
    };
    setState((current) => ({ ...current, workqueue: [item, ...current.workqueue] }));
    setBillerMessage("");
    setModal(null);
    show("Billing review ticket created and linked to this chart.");
  }

  function uploadDocument() {
    setModal(null);
    show("Document uploaded to patient chart repository.");
  }

  function createPolicy() {
    setModal(null);
    show("Insurance policy added to Billing Settings.");
  }

  function resetDemo() {
    const initial = getInitialState(patientId);
    setState(initial);
    setSelectedAppointmentId(initial.appointments[0]?.id ?? "");
    window.localStorage.setItem(persistKey(patientId), JSON.stringify(initial));
    show("Demo patient workflow reset.");
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[13px] text-black">
      <div className="border-b border-slate-300 bg-[#087aa3] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-2">
          <Link href="/" className="text-lg font-bold">
            Therassistant
          </Link>
          <div className="flex items-center gap-1">
            {["To-Do", "Scheduling", "Patients", "Staff", "Billing", "Payers", "Library"].map((label) => (
              <Link
                key={label}
                href={label === "Patients" ? "/patients" : `/${label.toLowerCase().replaceAll(" ", "-")}`}
                className={`px-4 py-3 text-sm font-semibold hover:bg-[#056184] ${label === "Patients" ? "bg-[#055a78]" : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1500px] px-6 py-4">
        {toast ? (
          <div className="mb-3 border border-yellow-500 bg-yellow-200 px-3 py-2 font-bold text-yellow-950">{toast}</div>
        ) : null}

        <section className="mb-2 flex items-start justify-between border-b-2 border-[#1e9bd7] pb-2">
          <div>
            <h1 className="text-[28px] font-light text-[#1a8fc5]">
              Patient: <span className="text-black">{patientName}</span>{" "}
              <span className="text-xl text-slate-400">(she/her)</span>{" "}
              <span className="ml-2 text-xs text-slate-500">6/28/1987</span>
            </h1>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>
              <Link href="/to-do" className="font-bold text-[#0070b8]">
                3 To-Do
              </Link>{" "}
              · No Future Appt
            </div>
            <div>☎ Mobile: {state.patient.phone} (No Messages)</div>
          </div>
        </section>

        <nav className="mb-3 flex flex-wrap gap-[3px]">
          {[
            ["Info", "#info"],
            ["To-Do", "#todo"],
            ["Schedule", "#schedule"],
            ["Documents", "#documents"],
            ["Billing", "#billing"],
            ["Billing Settings", "#billing-settings"],
            ["Clinicians", "/staff"],
            ["Portal", "#portal"],
            ["Messages", "#messages"],
            ["Insights", "#insights"],
          ].map(([label, href], index) => (
            <a
              key={label}
              href={href}
              className={`rounded-t px-3 py-2 text-xs font-bold text-white ${index === 0 ? "bg-[#1b9bd0]" : "bg-[#666]"}`}
            >
              {label}
            </a>
          ))}
        </nav>

        <section id="info" className="mb-4 rounded border border-slate-300 bg-white p-4">
          <div className="flex justify-between gap-4">
            <div>
              <h2 className="text-xl">Patient Information</h2>
              <div className="mt-3 grid grid-cols-[120px_220px_120px_220px] gap-2">
                <label>Legal Name:</label>
                <input className="classic-input" defaultValue={state.patient.first_name} />
                <label>Last:</label>
                <input className="classic-input" defaultValue={state.patient.last_name} />
                <label>Date of Birth:</label>
                <input type="date" className="classic-input" defaultValue={state.patient.dob ?? ""} />
                <label>MRN:</label>
                <input className="classic-input" defaultValue={state.patient.mrn ?? ""} />
                <label>Mobile Phone:</label>
                <input className="classic-input" defaultValue={state.patient.phone ?? ""} />
                <label>Email:</label>
                <input className="classic-input" defaultValue={state.patient.email ?? ""} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button className="classic-green" onClick={() => show("Patient profile changes saved.")}>
                Save Changes
              </button>
              <button className="classic-blue" onClick={() => show("New contact form opened.")}>
                + New Contact
              </button>
              <button className="classic-button" onClick={resetDemo}>
                Reset Demo State
              </button>
            </div>
          </div>
        </section>

        <section id="schedule" className="mb-4 rounded border border-slate-300 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl">Schedule</h2>
            <button className="classic-blue" onClick={() => setModal("appointment")}>
              + New Appointment
            </button>
          </div>
          <div className="mb-4">
            <label className="mb-1 block font-bold">Select appointment</label>
            <select className="classic-input w-full" value={selectedAppointment?.id ?? ""} onChange={(event) => setSelectedAppointmentId(event.target.value)}>
              {state.appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.start_date} at {appointment.start_time} · {appointment.appointment_type} · {appointment.service_code} · {appointment.status}
                </option>
              ))}
            </select>
          </div>
          <ClassicTable
            headers={["Date", "Time", "Type", "Service", "Clinician", "Location", "Frequency", "Status"]}
            rows={state.appointments.map((appointment) => [
              appointment.start_date,
              appointment.start_time,
              appointment.appointment_type,
              appointment.service_code,
              appointment.provider_name,
              appointment.location_name,
              appointment.frequency,
              appointment.status,
            ])}
          />
        </section>

        <section className="mb-4 grid grid-cols-[1fr_360px] gap-4">
          <div className="rounded border border-slate-300 bg-white p-4">
            <h2 className="text-xl font-semibold">1. Appointment → Encounter → Note → Charge → Claim</h2>
            <p className="mt-1 text-slate-600">One dependency chain, centered on the selected appointment.</p>

            <div className="mt-4 grid grid-cols-5 gap-3">
              <button className="classic-button" disabled={!selectedAppointment || Boolean(activeEncounter)} onClick={createEncounter}>
                Create Encounter
              </button>
              <button className="classic-button" disabled={!activeEncounter || activeNote?.status === "signed"} onClick={signNote}>
                Sign Note
              </button>
              <button className="classic-button" disabled={!activeEncounter || activeNote?.status !== "signed" || Boolean(activeCharge)} onClick={generateCharge}>
                Generate Charge
              </button>
              <button className="classic-button" disabled={!activeCharge || Boolean(activeClaim)} onClick={createClaim}>
                Create Claim
              </button>
              <button className="classic-button" onClick={() => setModal("claimQueue")}>
                Claim Queue
              </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3">
              <StatusCard title="Appointment" value={selectedAppointment ? `${selectedAppointment.start_date} ${selectedAppointment.start_time}` : "None"} />
              <StatusCard title="Encounter" value={activeEncounter ? activeEncounter.status : "Not created"} />
              <StatusCard title="Note" value={activeNote ? activeNote.status : "Not created"} />
              <StatusCard title="Claim" value={activeClaim ? activeClaim.status : "Not created"} />
            </div>

            <div className="mt-4 flex gap-2">
              <button className="classic-blue" onClick={() => setModal("routeToBiller")}>
                Route to Biller
              </button>
              <button className="classic-blue" onClick={() => setModal("uploadDocument")}>
                Upload Patient File
              </button>
              <button className="classic-blue" onClick={() => setModal("createNote")}>
                Create Note
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded border border-slate-300 bg-white p-4">
              <h3 className="text-lg font-semibold">Insurance Snapshot</h3>
              <p className="mt-2">Policy number: POLICY-001</p>
              <p>Plan: Colorado Access</p>
              <p>Priority: primary</p>
              <button className="classic-blue mt-3" onClick={() => setModal("createPolicy")}>
                New Policy
              </button>
            </div>
            <div className="rounded border border-slate-300 bg-white p-4">
              <h3 className="text-lg font-semibold">Workflow Status</h3>
              <p>Appointments: {state.appointments.length}</p>
              <p>Encounters: {state.encounters.length}</p>
              <p>Ready to bill: {readyToBillCount}</p>
              <p>Claims: {state.claims.length}</p>
              <p>Open tickets: {openTickets}</p>
            </div>
          </aside>
        </section>

        <section id="documents" className="mb-4 rounded border border-slate-300 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl">Notes and Documents for this Patient</h2>
            <div className="flex gap-2">
              <select className="classic-input">
                <option>Outcome Measure</option>
                <option>ACE: Adverse Childhood Experiences Questionnaire</option>
                <option>ASRS-v1.1: Adult ADHD Self-Report Scale</option>
                <option>AUDIT: Alcohol Use Disorders Identification Test</option>
                <option>C-SSRS: Columbia-Suicide Severity Rating Scale</option>
              </select>
              <button className="classic-blue" onClick={() => setModal("createNote")}>
                Create Note
              </button>
              <button className="classic-blue" onClick={() => setModal("uploadDocument")}>
                ☁ Upload Patient File
              </button>
            </div>
          </div>
          <ClassicTable
            headers={["Document", "Service", "Date", "Author/Access", "Status"]}
            rows={[
              ["Psychotherapy Intake Note", "90791", todayIso, state.patient.assigned_clinician ?? "Clinician", activeNote?.status ?? "Draft"],
              ["Treatment Plan", "H0032", todayIso, state.patient.assigned_clinician ?? "Clinician", "Signed by Author"],
              ["Superbill", activeCharge?.service_code ?? "—", todayIso, "Billing", activeClaim ? "Claim Created" : "Not created"],
            ]}
          />
        </section>

        <section id="billing" className="mb-4 rounded border border-slate-300 bg-white p-4">
          <h2 className="text-xl">Patient Billing</h2>
          <div className="mt-2 border-b border-[#1e9bd7] pb-3">
            Patient Balance Owed: <strong>{money(state.charges.reduce((sum, charge) => sum + charge.amount_cents, 0))}</strong>{" "}
            <span className="ml-6">Unassigned Credit: <strong>$0.00</strong></span>
          </div>
          <div className="grid grid-cols-3 gap-10 py-4">
            <LinkList title="Patient Accounting" links={["Enter Patient Payment", "Enter Misc Charge", "Enter Refund", "Enter Misc Credit", "Create Statement"]} />
            <LinkList title="Insurance Claims" links={["Eligibility History", "Submit Primary Claims", "Submit Secondary Claims", "Create CMS-1500", "Create Superbill"]} />
            <LinkList title="Insurance Payments" links={["Enter Insurance Payment", "Electronic Claim History", "ERA"]} />
          </div>
          <ClassicTable
            headers={["Date", "Type", "Clin", "Primary Payer", "Rate", "Pt Amt", "Pt Bal", "Ins Status"]}
            rows={state.charges.length ? state.charges.map((charge) => [charge.created_at.slice(0, 10), charge.service_code, "K-But", "Colorado Access", money(charge.amount_cents), "$0.00", "$0.00", charge.status]) : [["—", "No charges yet", "—", "—", "—", "—", "—", "—"]]}
          />
        </section>

        <section id="billing-settings" className="mb-4 rounded border border-slate-300 bg-white p-4">
          <div className="mb-3 flex justify-between">
            <h2 className="text-xl">Billing Settings</h2>
            <button className="classic-link" onClick={() => show("Billing settings edit mode opened.")}>✎ Edit</button>
          </div>
          <div className="rounded border border-slate-300 p-4">
            <h3 className="text-lg text-[#006eb6]">Colorado Access (84129): Primary</h3>
            <p className="mt-3">Copay: <strong>Not set</strong></p>
            <p>Member ID: <strong>12346</strong></p>
            <p>Policy Holder: <strong>Self</strong></p>
            <p>Eligibility: <strong>Not verified</strong></p>
            <button className="classic-blue mt-3" onClick={() => show("Eligibility verified and recorded.")}>
              Verify Eligibility
            </button>
          </div>
        </section>

        <section id="portal" className="mb-4 rounded border border-slate-300 bg-white p-4">
          <h2 className="text-xl">THERASSISTANT PORTAL Access</h2>
          <p className="mt-3">
            This patient does not have an account on the practice client portal. A portal account is required to view shared documents,
            complete paperwork, manage appointments, and join telehealth sessions.
          </p>
          <button className="classic-green mt-3" onClick={() => show("Welcome email sent to patient.")}>
            Send Welcome Email
          </button>
        </section>

        <section id="messages" className="mb-4 rounded border border-slate-300 bg-white p-4">
          <div className="mb-3 flex justify-between">
            <h2 className="text-xl">Patient Messages</h2>
            <button className="classic-blue" onClick={() => show("New patient conversation opened.")}>
              + New Conversation
            </button>
          </div>
          <div className="grid min-h-[240px] grid-cols-[180px_260px_1fr] border">
            <div className="border-r p-3">Inbox<br />Admin<br />Billing<br />Clinical<br />Deleted</div>
            <div className="border-r p-3">There are no messages to be displayed.</div>
            <div className="grid place-items-center text-slate-500">Select a conversation</div>
          </div>
        </section>

        <section id="insights" className="mb-20 rounded border border-slate-300 bg-white p-4">
          <h2 className="text-xl">Outcome Measures</h2>
          <select className="classic-input mt-3">
            <option>Last 30 days</option>
            <option>Last 60 days</option>
            <option>Last 90 days</option>
            <option>Last 120 days</option>
            <option>Last 365 days</option>
          </select>
          <p className="mt-3">There are no chartable results for the selected date range.</p>
        </section>
      </main>

      {modal === "appointment" && (
        <Modal title="Create New Appointment" onClose={() => setModal(null)}>
          <div className="grid grid-cols-[130px_1fr] gap-2">
            <label>Appointment Type:</label>
            <select className="classic-input" value={appointmentForm.appointment_type} onChange={(e) => setAppointmentForm((f) => ({ ...f, appointment_type: e.target.value as Appointment["appointment_type"] }))}>
              {appointmentTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
            <label>Patient:</label>
            <Link href={`/patients/${patientId}`} className="classic-input text-[#006eb6]">{patientName}</Link>
            <label>Clinician:</label>
            <span className="classic-input text-[#1d74b7]">{appointmentForm.provider_name}</span>
            <label>Location:</label>
            <span className="classic-input text-[#1d74b7]">{appointmentForm.location_name}</span>
            <label>Telehealth:</label>
            <input type="checkbox" checked={appointmentForm.telehealth} onChange={(e) => setAppointmentForm((f) => ({ ...f, telehealth: e.target.checked }))} />
            <label>Service Code:</label>
            <select className="classic-input" value={appointmentForm.service_code} onChange={(e) => setAppointmentForm((f) => ({ ...f, service_code: e.target.value }))}>
              {serviceCodes.map((code) => <option key={code}>{code}</option>)}
            </select>
            <label>Scheduled Time:</label>
            <div className="flex gap-2"><input type="date" className="classic-input" value={appointmentForm.start_date} onChange={(e) => setAppointmentForm((f) => ({ ...f, start_date: e.target.value }))} /><input type="time" className="classic-input" value={appointmentForm.start_time} onChange={(e) => setAppointmentForm((f) => ({ ...f, start_time: e.target.value }))} /></div>
            <label>Duration:</label>
            <input type="number" className="classic-input" value={appointmentForm.duration_minutes} onChange={(e) => setAppointmentForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))} />
            <label>Frequency:</label>
            <select className="classic-input" value={appointmentForm.frequency} onChange={(e) => setAppointmentForm((f) => ({ ...f, frequency: e.target.value as Appointment["frequency"] }))}>
              {frequencies.map((frequency) => <option key={frequency}>{frequency}</option>)}
            </select>
            <label>Appointment Alert:</label>
            <textarea className="classic-input min-h-[70px]" value={appointmentForm.internal_notes} onChange={(e) => setAppointmentForm((f) => ({ ...f, internal_notes: e.target.value }))} />
          </div>
          <button className="classic-green mt-4" onClick={createAppointment}>Save New Appointment</button>
        </Modal>
      )}

      {modal === "routeToBiller" && (
        <Modal title="Route to Biller" onClose={() => setModal(null)}>
          <textarea className="classic-input min-h-[120px] w-full" placeholder="Message to billing..." value={billerMessage} onChange={(event) => setBillerMessage(event.target.value)} />
          <button className="classic-green mt-4" onClick={routeToBiller}>Create Workqueue Ticket</button>
        </Modal>
      )}

      {modal === "uploadDocument" && (
        <Modal title="Upload Patient File" onClose={() => setModal(null)}>
          <input type="file" className="classic-input w-full" />
          <button className="classic-green mt-4" onClick={uploadDocument}>Upload Patient File</button>
        </Modal>
      )}

      {modal === "createNote" && (
        <Modal title="Create Note" onClose={() => setModal(null)}>
          <select className="classic-input w-full">
            <option>Psychotherapy Progress Note</option>
            <option>Psychotherapy Intake Note</option>
            <option>Treatment Plan</option>
            <option>Contact Note</option>
            <option>Miscellaneous Note</option>
          </select>
          <button className="classic-green mt-4" onClick={() => { void createEncounter(); setModal(null); }}>Create Note</button>
        </Modal>
      )}

      {modal === "createPolicy" && (
        <Modal title="New Insurance Policy" onClose={() => setModal(null)}>
          <input className="classic-input mb-2 w-full" placeholder="Payer name" defaultValue="Colorado Access" />
          <input className="classic-input mb-2 w-full" placeholder="Member ID" />
          <button className="classic-green" onClick={createPolicy}>Save Policy</button>
        </Modal>
      )}

      {modal === "claimQueue" && (
        <Modal title="Claim Queue" onClose={() => setModal(null)}>
          <ClassicTable headers={["Claim", "Payer", "Status", "Created"]} rows={state.claims.length ? state.claims.map((claim) => [claim.id, claim.payer, claim.status, claim.created_at.slice(0, 10)]) : [["—", "No claims yet", "—", "—"]]} />
        </Modal>
      )}

      <style jsx global>{`
        .classic-input {
          border: 1px solid #cfd6dd;
          border-radius: 4px;
          padding: 6px 8px;
          min-height: 30px;
          background: white;
        }
        .classic-button {
          border: 1px solid #c8d0d8;
          border-radius: 8px;
          background: white;
          padding: 10px 12px;
          font-weight: 600;
        }
        .classic-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          background: #f1f1f1;
        }
        .classic-blue {
          border-radius: 4px;
          background: #1b9bd0;
          color: white;
          padding: 7px 12px;
          font-weight: 700;
        }
        .classic-green {
          border-radius: 4px;
          background: #74bd00;
          color: white;
          padding: 7px 12px;
          font-weight: 700;
        }
        .classic-link {
          color: #0070b8;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}

function StatusCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="text-[#006eb6]">{title}</div>
      <div className="mt-2 font-semibold">{value}</div>
    </div>
  );
}

function LinkList({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="mb-2 font-bold text-slate-600">{title}</h3>
      <div className="grid gap-2">
        {links.map((link) => (
          <button key={link} className="text-left text-[#006eb6] hover:underline" onClick={() => alert(`${link} opened.`)}>
            {link}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClassicTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead>
        <tr className="bg-[#2099d0] text-white">
          {headers.map((header) => (
            <th key={header} className="border border-[#2099d0] px-3 py-2">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white" : "bg-[#f2f2f2]"}>
            {row.map((cell, cellIndex) => (
              <td key={`${rowIndex}-${cellIndex}`} className="border border-slate-300 px-3 py-2">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-20">
      <div className="w-[620px] rounded border border-slate-500 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1e9bd7] px-4 py-2">
          <h2 className="text-lg">{title}</h2>
          <button className="text-3xl leading-none text-slate-500" onClick={onClose}>×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
