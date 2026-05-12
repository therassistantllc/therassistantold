"use client";

import { useEffect, useMemo, useState } from "react";

type AgendaItem = {
  appointmentId: string;
  clientId: string;
  clientName: string;
  dateOfBirth: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string | null;
  type: string | null;
  serviceLocation: string | null;
  telehealthUrl: string | null;
  encounter: { id: string; status: string | null } | null;
  checkIn: { status: string; checkedInAt: string | null } | null;
  eligibility: {
    id: string;
    status: string;
    rawStatus: string | null;
    checkedAt: string | null;
    copayAmount: string | number | null;
    deductibleRemaining: string | number | null;
    coverageStartDate: string | null;
    coverageEndDate: string | null;
    responseSummary: string | null;
  } | null;
  patientBalance: number;
};

type CommandCenterPayload = {
  success: boolean;
  error?: string;
  organizationId?: string;
  clinicianId?: string | null;
  date?: string;
  metrics?: {
    appointmentsToday: number;
    checkedIn: number;
    eligibilityMissingOrStale: number;
    eligibilityInactive: number;
    balancesToReview: number;
  };
  agenda?: AgendaItem[];
};

function getOrganizationId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
}

function formatTime(value: string | null) {
  if (!value) return "Time not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not set";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDob(value: string | null) {
  if (!value) return "DOB not listed";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function eligibilityLabel(item: AgendaItem) {
  if (!item.eligibility) return "Eligibility not checked";
  if (item.eligibility.status === "stale") return "Eligibility stale";
  return `Eligibility ${item.eligibility.rawStatus ?? item.eligibility.status}`;
}

function checkInLabel(item: AgendaItem) {
  return item.checkIn ? "Checked in" : "Check-in not submitted";
}

function statusClass(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("active") && !normalized.includes("inactive")) return "status status-green";
  if (normalized.includes("checked in")) return "status status-green";
  if (normalized.includes("inactive") || normalized.includes("stale") || normalized.includes("not checked")) return "status status-red";
  if (normalized.includes("not submitted")) return "status status-yellow";
  return "status";
}

function emptyMetrics() {
  return {
    appointmentsToday: 0,
    checkedIn: 0,
    eligibilityMissingOrStale: 0,
    eligibilityInactive: 0,
    balancesToReview: 0,
  };
}

export default function ClinicianAgendaClient() {
  const [payload, setPayload] = useState<CommandCenterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const organizationId = useMemo(() => getOrganizationId(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadAgenda() {
      if (!organizationId) {
        setError("Missing organizationId. Add ?organizationId=... to the URL or configure NEXT_PUBLIC_ORGANIZATION_ID.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/clinician/command-center?organizationId=${encodeURIComponent(organizationId)}`, {
          cache: "no-store",
        });
        const json = (await response.json()) as CommandCenterPayload;
        if (cancelled) return;
        if (!response.ok || !json.success) throw new Error(json.error ?? "Failed to load clinician agenda");
        setPayload(json);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load clinician agenda");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAgenda();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const metrics = payload?.metrics ?? emptyMetrics();
  const agenda = payload?.agenda ?? [];

  return (
    <>
      {error ? <div className="alert-panel">{error}</div> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Appointments</span>
          <strong>{loading ? "—" : metrics.appointmentsToday}</strong>
        </article>
        <article className="metric-card">
          <span>Checked In</span>
          <strong>{loading ? "—" : metrics.checkedIn}</strong>
        </article>
        <article className="metric-card">
          <span>Eligibility Issues</span>
          <strong>{loading ? "—" : metrics.eligibilityMissingOrStale + metrics.eligibilityInactive}</strong>
        </article>
        <article className="metric-card">
          <span>Balances to Review</span>
          <strong>{loading ? "—" : metrics.balancesToReview}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Appointment List</h2>
            <p>Practical visit context only. No coding prompts or documentation interruptions.</p>
          </div>
        </div>

        {loading ? <div className="empty-state">Loading agenda…</div> : null}
        {!loading && agenda.length === 0 ? <div className="empty-state">No appointments found for today.</div> : null}

        <div className="agenda-list">
          {agenda.map((item) => {
            const eligibility = eligibilityLabel(item);
            const checkIn = checkInLabel(item);
            return (
              <article className="agenda-card" key={item.appointmentId}>
                <div className="agenda-time">
                  <strong>{formatTime(item.startTime)}</strong>
                  <span>{item.type ?? "Visit"}</span>
                </div>

                <div className="agenda-main">
                  <h3>{item.clientName}</h3>
                  <p>DOB: {formatDob(item.dateOfBirth)}</p>
                  <p>{item.serviceLocation ?? (item.telehealthUrl ? "Telehealth" : "Location not set")}</p>
                  <div className="status-row">
                    <span className={statusClass(checkIn)}>{checkIn}</span>
                    <span className={statusClass(eligibility)}>{eligibility}</span>
                    <span className="status">Balance {formatMoney(item.patientBalance)}</span>
                    {item.eligibility?.copayAmount ? <span className="status">Copay {formatMoney(item.eligibility.copayAmount)}</span> : null}
                  </div>
                </div>

                <div className="agenda-actions">
                  <a className="button button-secondary" href={`/patients/${item.clientId}`}>Open Chart</a>
                  <a className="button button-secondary" href={item.encounter?.id ? `/encounters/${item.encounter.id}` : `/encounters/new?appointmentId=${item.appointmentId}`}>Open Note</a>
                  <a className="button button-secondary" href={`/patients/${item.clientId}/balance`}>Collect</a>
                  <a className="button" href={`/workqueue/new?clientId=${item.clientId}&appointmentId=${item.appointmentId}`}>Route to Biller</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
