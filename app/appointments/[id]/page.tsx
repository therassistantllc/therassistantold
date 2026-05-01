import AppShell from "@/components/layout/AppShell";
import StartEncounterButton from "@/components/appointments/StartEncounterButton";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import type { AppointmentRecord } from "@/lib/types";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const supabase = createServerSupabaseAdminClient();

  if (!supabase) {
    return (
      <AppShell>
        <main className="min-h-screen bg-slate-50 px-6 py-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            Database connection unavailable
          </div>
        </main>
      </AppShell>
    );
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", resolvedParams.id)
    .single();

  const { data: encounter } = await supabase
    .from("encounters")
    .select("id, encounter_status, documentation_status, billing_status")
    .eq("appointment_id", resolvedParams.id)
    .maybeSingle();

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <a href="/scheduling" className="text-sm font-semibold text-slate-600 hover:text-slate-950">
              ← Back to scheduling
            </a>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Appointment</h1>
            <p className="mt-2 text-sm text-slate-600">
              Appointment is the scheduling source. Start or open the encounter from here.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error.message}</div>
          ) : (
            <AppointmentContent appointment={appointment as AppointmentRecord} encounter={encounter} />
          )}
        </div>
      </main>
    </AppShell>
  );
}

function AppointmentContent({
  appointment,
  encounter,
}: {
  appointment: AppointmentRecord;
  encounter: { id: string; encounter_status?: string | null; documentation_status?: string | null; billing_status?: string | null } | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
              {appointment.status ?? "scheduled"}
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-950">
              {appointment.appointment_type ?? "Clinical appointment"}
            </h2>
            <p className="mt-2 text-slate-600">{appointment.reason_for_visit ?? "No reason recorded."}</p>
          </div>

          {encounter?.id ? (
            <a
              href={`/encounters/${encounter.id}`}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Open Encounter
            </a>
          ) : (
            <StartEncounterButton appointmentId={appointment.id} organizationId={appointment.organization_id} />
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Info label="Start" value={formatDateTime(appointment.scheduled_start)} />
          <Info label="End" value={formatDateTime(appointment.scheduled_end)} />
          <Info label="Patient / client ID" value={appointment.patient_id ?? appointment.client_id ?? "—"} />
          <Info label="Clinician ID" value={appointment.clinician_id ?? appointment.provider_id ?? "—"} />
          <Info label="Insurance policy" value={appointment.insurance_policy_id ?? "—"} />
          <Info label="Eligibility check" value={appointment.eligibility_check_id ?? "—"} />
        </div>
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">Workflow</h3>
        <ol className="mt-4 space-y-3 text-sm">
          <Step done label="Appointment scheduled" />
          <Step done={Boolean(encounter?.id)} label="Encounter created from appointment" />
          <Step done={encounter?.documentation_status === "signed"} label="Clinical note signed" />
          <Step done={encounter?.encounter_status === "ready_to_bill"} label="Auto-routed to billing queue" />
          <Step done={encounter?.billing_status === "claim_created"} label="Claim created after scrub" />
        </ol>
      </aside>
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

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={
          done
            ? "grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700"
            : "grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-500"
        }
      >
        {done ? "✓" : "•"}
      </span>
      <span className={done ? "font-semibold text-slate-900" : "text-slate-600"}>{label}</span>
    </li>
  );
}
