"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EncounterSummary = {
  success: boolean;
  error?: string;
  patient?: { id: string; name: string; dateOfBirth?: string | null } | null;
  encounter?: { id: string; encounter_status?: string | null; service_date?: string | null; started_at?: string | null; ended_at?: string | null };
  appointment?: { appointment_type?: string | null; scheduled_start_at?: string | null; scheduled_end_at?: string | null; service_location?: string | null; telehealth_url?: string | null } | null;
  diagnoses?: Array<{ id: string; diagnosis_code?: string | null; diagnosis_description?: string | null; is_primary?: boolean | null }>;
  clinicalNote?: { id: string; note_status?: string | null; subjective?: string | null; interventions?: string | null; plan?: string | null; signed_at?: string | null } | null;
};

function getOrganizationId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not listed";
  const date = new Date(`${value}`.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Not listed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not listed" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function statusClass(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("signed") || normalized.includes("complete")) return "status status-green";
  if (normalized.includes("draft")) return "status status-yellow";
  if (normalized.includes("void") || normalized.includes("blocked")) return "status status-red";
  return "status";
}

export default function EncounterNoteClient({ encounterId }: { encounterId: string }) {
  const organizationId = useMemo(() => getOrganizationId(), []);
  const [summary, setSummary] = useState<EncounterSummary | null>(null);
  const [subjective, setSubjective] = useState("");
  const [interventions, setInterventions] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadEncounter() {
    if (!organizationId) {
      setError("Missing organizationId. Add ?organizationId=... to the URL or configure NEXT_PUBLIC_ORGANIZATION_ID.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/encounters/${encounterId}/summary?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const json = (await response.json()) as EncounterSummary;
      if (!response.ok || !json.success) throw new Error(json.error ?? "Failed to load encounter");
      setSummary(json);
      setSubjective(json.clinicalNote?.subjective ?? "");
      setInterventions(json.clinicalNote?.interventions ?? "");
      setPlan(json.clinicalNote?.plan ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load encounter");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEncounter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, organizationId]);

  async function submitNote(action: "save" | "sign") {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/encounters/${encounterId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, action, subjective, interventions, plan }),
      });
      const json = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !json.success) throw new Error(json.error ?? "Note action failed");
      setMessage(action === "sign" ? "Note finalized." : "Draft saved.");
      await loadEncounter();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Note action failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-state">Loading encounter…</div>;
  if (error && !summary) return <div className="alert-panel">{error}</div>;
  if (!summary?.encounter) return <div className="alert-panel">Encounter not found.</div>;

  const patient = summary.patient;
  const encounter = summary.encounter;
  const appointment = summary.appointment;
  const diagnoses = summary.diagnoses ?? [];
  const finalized = encounter.encounter_status === "signed" || summary.clinicalNote?.note_status === "signed";

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Encounter Documentation</p>
          <h1>{patient?.name ?? "Encounter"}</h1>
          <p className="hero-copy">Service date: {formatDate(encounter.service_date)} · Status: {encounter.encounter_status ?? "not set"}</p>
        </div>
        <div className="hero-actions">
          {patient?.id ? <Link className="button button-secondary" href={`/patients/${patient.id}`}>Patient Chart</Link> : null}
          <Link className="button button-secondary" href={`/encounters/${encounterId}/billing`}>Billing Details</Link>
          <Link className="button button-secondary" href="/clinician/agenda">Agenda</Link>
          <button className="button button-secondary" type="button" onClick={() => submitNote("save")} disabled={saving || finalized}>Save Draft</button>
          <button className="button" type="button" onClick={() => submitNote("sign")} disabled={saving || finalized}>Finalize Note</button>
        </div>
      </section>

      {message ? <div className="empty-state success-panel">{message}</div> : null}
      {error ? <div className="alert-panel">{error}</div> : null}

      <section className="chart-grid">
        <article className="panel">
          <h2>Visit Context</h2>
          <div className="detail-list">
            <p><strong>Patient DOB:</strong> {formatDate(patient?.dateOfBirth)}</p>
            <p><strong>Appointment type:</strong> {appointment?.appointment_type ?? "Not listed"}</p>
            <p><strong>Start:</strong> {formatTime(encounter.started_at ?? appointment?.scheduled_start_at)}</p>
            <p><strong>End:</strong> {formatTime(encounter.ended_at ?? appointment?.scheduled_end_at)}</p>
            <p><strong>Location:</strong> {appointment?.service_location ?? (appointment?.telehealth_url ? "Telehealth" : "Not listed")}</p>
            <p><strong>Status:</strong> <span className={statusClass(encounter.encounter_status)}>{encounter.encounter_status ?? "not set"}</span></p>
          </div>
        </article>

        <article className="panel">
          <h2>Clinical Reference</h2>
          {diagnoses.length === 0 ? <p className="muted">No diagnoses attached to this encounter.</p> : null}
          <div className="stack-list">
            {diagnoses.map((diagnosis) => (
              <div className="stack-item" key={diagnosis.id}>
                <strong>{diagnosis.diagnosis_code ?? "Diagnosis"}</strong>
                <span>{diagnosis.diagnosis_description ?? "No description"}</span>
                {diagnosis.is_primary ? <span className="status status-green">Primary</span> : null}
              </div>
            ))}
          </div>
        </article>

        <article className="panel wide-panel">
          <h2>Documentation</h2>
          <p className="muted">Free documentation area. Billing review runs after finalization and does not interrupt the clinical note.</p>
          <div className="note-editor-shell">
            <label>Subjective / Session Narrative<textarea value={subjective} onChange={(event) => setSubjective(event.target.value)} placeholder="Document the session freely..." disabled={finalized} /></label>
            <label>Interventions / Clinical Work<textarea value={interventions} onChange={(event) => setInterventions(event.target.value)} placeholder="Enter interventions, client response, and clinical observations..." disabled={finalized} /></label>
            <label>Plan<textarea value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="Enter plan, follow-up, referrals, or homework..." disabled={finalized} /></label>
          </div>
        </article>
      </section>
    </>
  );
}
