"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EncounterSummary = {
  success: boolean;
  error?: string;
  patient?: {
    id: string;
    name: string;
    preferredName?: string | null;
    dateOfBirth?: string | null;
    pronouns?: string | null;
  } | null;
  encounter?: {
    id: string;
    encounter_status?: string | null;
    service_date?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
  };
  appointment?: {
    id: string;
    scheduled_start_at?: string | null;
    scheduled_end_at?: string | null;
    appointment_type?: string | null;
    service_location?: string | null;
    telehealth_url?: string | null;
  } | null;
  diagnoses?: Array<{ id: string; diagnosis_code?: string | null; diagnosis_description?: string | null; is_primary?: boolean | null }>;
  serviceLines?: Array<{ id: string; cpt_hcpcs_code?: string | null; units?: string | number | null; charge_amount?: string | number | null }>;
};

function getOrganizationId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not listed";
  const date = new Date(`${value}`.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not listed";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function statusClass(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("signed") || normalized.includes("complete")) return "status status-green";
  if (normalized.includes("draft")) return "status status-yellow";
  if (normalized.includes("void") || normalized.includes("blocked")) return "status status-red";
  return "status";
}

export default function EncounterNoteClient({ encounterId }: { encounterId: string }) {
  const [summary, setSummary] = useState<EncounterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const organizationId = useMemo(getOrganizationId, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEncounter() {
      if (!organizationId) {
        setError("Missing organizationId. Add ?organizationId=... to the URL or configure NEXT_PUBLIC_ORGANIZATION_ID.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/encounters/${encounterId}/summary?organizationId=${encodeURIComponent(organizationId)}`, {
          cache: "no-store",
        });
        const json = (await response.json()) as EncounterSummary;
        if (cancelled) return;
        if (!response.ok || !json.success) throw new Error(json.error ?? "Failed to load encounter");
        setSummary(json);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load encounter");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEncounter();
    return () => {
      cancelled = true;
    };
  }, [encounterId, organizationId]);

  if (loading) return <div className="empty-state">Loading encounter…</div>;
  if (error) return <div className="alert-panel">{error}</div>;
  if (!summary?.encounter) return <div className="alert-panel">Encounter not found.</div>;

  const patient = summary.patient;
  const encounter = summary.encounter;
  const appointment = summary.appointment;
  const diagnoses = summary.diagnoses ?? [];

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Encounter Documentation</p>
          <h1>{patient?.name ?? "Encounter"}</h1>
          <p className="hero-copy">
            Service date: {formatDate(encounter.service_date)} · Status: {encounter.encounter_status ?? "not set"}
          </p>
        </div>
        <div className="hero-actions">
          {patient?.id ? <Link className="button button-secondary" href={`/patients/${patient.id}`}>Patient Chart</Link> : null}
          <Link className="button button-secondary" href="/clinician/agenda">Agenda</Link>
          <button className="button" type="button">Sign Note</button>
        </div>
      </section>

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
          <p className="muted">Free documentation area. Billing review runs after signature and does not interrupt the clinical note.</p>
          <div className="note-editor-shell">
            <label>
              Subjective / Session Narrative
              <textarea placeholder="Document the session freely..." />
            </label>
            <label>
              Interventions / Clinical Work
              <textarea placeholder="Enter interventions, client response, and clinical observations..." />
            </label>
            <label>
              Plan
              <textarea placeholder="Enter plan, follow-up, referrals, or homework..." />
            </label>
          </div>
        </article>
      </section>
    </>
  );
}
