"use client";

import { useMemo, useState } from "react";
import type {
  AppointmentRecord,
  EncounterRecord,
  EncounterDiagnosisRecord,
  EncounterServiceLineRecord,
  WorkqueueItemRecord,
} from "@/lib/types";
import { calculateEncounterReadiness, getEncounterDisplayStatus, getEncounterStatusTone } from "@/lib/encounters/status";
import ClinicalDocumentationPanel from "@/components/encounters/ClinicalDocumentationPanel";
import EncounterReadinessPanel from "@/components/encounters/EncounterReadinessPanel";
import BillingWorkqueuePanel from "@/components/encounters/BillingWorkqueuePanel";
import RouteToBillerPanel from "@/components/encounters/RouteToBillerPanel";

interface AppointmentFirstEncounterWorkspaceProps {
  encounter: EncounterRecord;
  appointment: AppointmentRecord | null;
  notes: ClinicalNoteRecord[];
  diagnoses: EncounterDiagnosisRecord[];
  serviceLines: EncounterServiceLineRecord[];
  workqueueItems: WorkqueueItemRecord[];
  hasActiveEligibility?: boolean;
}

const tabs = [
  "Overview",
  "Clinical Documentation",
  "Diagnoses",
  "Service Lines",
  "Treatment Plan",
  "Billing Workqueue",
  "Audit",
] as const;

type Tab = (typeof tabs)[number];

function toneClasses(tone: string) {
  if (tone === "green") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (tone === "blue") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (tone === "amber") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AppointmentFirstEncounterWorkspace({
  encounter,
  appointment,
  notes,
  diagnoses,
  serviceLines,
  workqueueItems,
  hasActiveEligibility = false,
}: AppointmentFirstEncounterWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const readiness = useMemo(
    () =>
      calculateEncounterReadiness({
        encounter,
        notes,
        diagnoses,
        serviceLines,
        hasActiveEligibility,
        hasInsurancePolicy: Boolean(appointment?.insurance_policy_id),
      }),
    [appointment?.insurance_policy_id, diagnoses, encounter, hasActiveEligibility, notes, serviceLines],
  );

  const displayStatus = getEncounterDisplayStatus(encounter);
  const tone = getEncounterStatusTone(encounter);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <a href={appointment?.id ? `/appointments/${appointment.id}` : "/encounters"} className="text-sm font-semibold text-slate-600 hover:text-slate-950">
              ← Back to {appointment?.id ? "appointment" : "encounters"}
            </a>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${toneClasses(tone)}`}>{displayStatus}</span>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-purple-200">
                Appointment-first
              </span>
              {appointment?.id ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                  Linked appointment
                </span>
              ) : (
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
                  No appointment link
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Encounter Workspace</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Encounter is the clinical and billing source of truth. Appointment remains the scheduling source.
            </p>
          </div>

          <RouteToBillerPanel encounter={encounter} />
        </div>

        <section className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
          <Metric label="Appointment" value={appointment?.id ? "Linked" : "Missing"} />
          <Metric label="Documentation" value={encounter.documentation_status ?? "not_started"} />
          <Metric label="Billing" value={encounter.billing_status ?? "hold"} />
          <Metric label="Readiness" value={readiness.passed ? "Passed" : `${readiness.missingBlockingItems.length} blockers`} />
        </section>

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                activeTab === tab
                  ? "whitespace-nowrap rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                  : "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              }
            >
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === "Overview" ? (
          <Overview encounter={encounter} appointment={appointment} readiness={readiness} />
        ) : null}

        {activeTab === "Clinical Documentation" ? (
          <ClinicalDocumentationPanel encounter={encounter} notes={notes} readiness={readiness} />
        ) : null}

        {activeTab === "Diagnoses" ? <DiagnosesPanel diagnoses={diagnoses} /> : null}

        {activeTab === "Service Lines" ? <ServiceLinesPanel serviceLines={serviceLines} /> : null}

        {activeTab === "Treatment Plan" ? <TreatmentPlanPanel /> : null}

        {activeTab === "Billing Workqueue" ? (
          <BillingWorkqueuePanel encounter={encounter} readiness={readiness} workqueueItems={workqueueItems} />
        ) : null}

        {activeTab === "Audit" ? <AuditPanel workqueueItems={workqueueItems} notes={notes} /> : null}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Overview({
  encounter,
  appointment,
  readiness,
}: {
  encounter: EncounterRecord;
  appointment: AppointmentRecord | null;
  readiness: ReturnType<typeof calculateEncounterReadiness>;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Appointment → Encounter Spine</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info label="Appointment ID" value={appointment?.id ?? "Missing"} />
          <Info label="Encounter ID" value={encounter.id} />
          <Info label="Date of service" value={encounter.date_of_service ?? encounter.service_date ?? "—"} />
          <Info label="Start time" value={formatDate(encounter.start_time)} />
          <Info label="End time" value={formatDate(encounter.end_time)} />
          <Info label="Duration" value={encounter.duration_minutes ? `${encounter.duration_minutes} minutes` : "—"} />
          <Info label="Place of service" value={encounter.place_of_service_code ?? "—"} />
          <Info label="Service location" value={encounter.service_location ?? "—"} />
        </div>
      </section>

      <EncounterReadinessPanel readiness={readiness} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DiagnosesPanel({ diagnoses }: { diagnoses: EncounterDiagnosisRecord[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Encounter Diagnoses</h2>
      <div className="mt-4 grid gap-3">
        {diagnoses.length ? (
          diagnoses.map((diagnosis) => (
            <div key={diagnosis.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex justify-between gap-3">
                <p className="font-bold text-slate-950">{diagnosis.diagnosis_code}</p>
                {diagnosis.is_primary ? <span className="text-sm font-bold text-emerald-700">Primary</span> : null}
              </div>
              <p className="mt-1 text-sm text-slate-600">{diagnosis.diagnosis_description ?? "No description"}</p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            No encounter diagnoses yet.
          </p>
        )}
      </div>
    </section>
  );
}

function ServiceLinesPanel({ serviceLines }: { serviceLines: EncounterServiceLineRecord[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Encounter Service Lines</h2>
      <div className="mt-4 grid gap-3">
        {serviceLines.length ? (
          serviceLines.map((line) => (
            <div key={line.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <p className="font-bold text-slate-950">{line.procedure_code}</p>
                <span className="text-sm font-bold text-slate-600">{line.billing_status ?? "hold"}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Units {line.units ?? "—"} · Minutes {line.minutes ?? "—"} · Charge ${Number(line.charge_amount ?? 0).toFixed(2)} · Dx{" "}
                {line.diagnosis_pointer ?? "—"}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            No service lines yet.
          </p>
        )}
      </div>
    </section>
  );
}

function TreatmentPlanPanel() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Treatment Plan Links</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add encounter_treatment_plan_links here once treatment plan tables are wired. Each signed note should show which goal was addressed.
      </p>
    </section>
  );
}

function AuditPanel({ workqueueItems, notes }: { workqueueItems: WorkqueueItemRecord[]; notes: ClinicalNoteRecord[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Activity</h2>
      <div className="mt-4 grid gap-3">
        {notes.map((note) => (
          <div key={note.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-bold text-slate-950">{note.locked ? "Signed note" : "Draft note"}</p>
            <p className="text-sm text-slate-600">{note.note_type} · {note.created_at ?? "—"}</p>
          </div>
        ))}
        {workqueueItems.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-bold text-slate-950">{item.title}</p>
            <p className="text-sm text-slate-600">{item.queue_type} · {item.status} · {item.created_at ?? "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
