"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InsurancePolicySummary = {
  id: string;
  plan_name?: string | null;
  policy_number?: string | null;
  priority?: string | null;
  active_flag?: boolean | null;
};

type EligibilitySummary = {
  id?: string;
  eligibility_status?: string | null;
  checked_at?: string | null;
  copay_amount?: string | number | null;
  deductible_remaining?: string | number | null;
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;
  response_summary?: string | null;
};

type InvoiceSummary = {
  id: string;
  invoice_number?: string | null;
  invoice_status?: string | null;
  balance_amount?: string | number | null;
  patient_responsibility_amount?: string | number | null;
  created_at?: string | null;
};

type EncounterSummary = {
  id: string;
  appointment_id?: string | null;
  encounter_status?: string | null;
  service_date?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

type WorkqueueSummary = {
  id: string;
  title?: string | null;
  work_type?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
};

type PatientSummary = {
  success: boolean;
  error?: string;
  organizationId?: string;
  patient?: {
    id: string;
    name: string;
    preferredName?: string | null;
    dateOfBirth?: string | null;
    email?: string | null;
    phone?: string | null;
    pronouns?: string | null;
  };
  insurance?: {
    policies: InsurancePolicySummary[];
    latestEligibility: EligibilitySummary | null;
  };
  balance?: {
    total: number;
    invoices: InvoiceSummary[];
  };
  encounters?: EncounterSummary[];
  workqueueItems?: WorkqueueSummary[];
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

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function eligibilityLabel(latestEligibility: EligibilitySummary | null | undefined) {
  if (!latestEligibility) return "No recent eligibility check";
  const status = latestEligibility.eligibility_status ?? "unknown";
  return `Eligibility ${status}`;
}

function statusClass(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("active") && !normalized.includes("inactive")) return "status status-green";
  if (normalized.includes("paid")) return "status status-green";
  if (normalized.includes("inactive") || normalized.includes("blocked") || normalized.includes("collections")) return "status status-red";
  if (normalized.includes("open") || normalized.includes("sent") || normalized.includes("draft")) return "status status-yellow";
  return "status";
}

export default function PatientChartClient({ clientId }: { clientId: string }) {
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const organizationId = useMemo(() => getOrganizationId(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadPatient() {
      if (!organizationId) {
        setError("Missing organizationId. Add ?organizationId=... to the URL or configure NEXT_PUBLIC_ORGANIZATION_ID.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/patients/${clientId}/summary?organizationId=${encodeURIComponent(organizationId)}`, {
          cache: "no-store",
        });
        const json = (await response.json()) as PatientSummary;
        if (cancelled) return;
        if (!response.ok || !json.success) throw new Error(json.error ?? "Failed to load patient chart");
        setSummary(json);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load patient chart");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPatient();
    return () => {
      cancelled = true;
    };
  }, [clientId, organizationId]);

  const patient = summary?.patient;
  const latestEligibility = summary?.insurance?.latestEligibility ?? null;
  const policies = summary?.insurance?.policies ?? [];
  const invoices = summary?.balance?.invoices ?? [];
  const encounters = summary?.encounters ?? [];
  const workqueueItems = summary?.workqueueItems ?? [];

  if (loading) return <div className="empty-state">Loading patient chart…</div>;
  if (error) return <div className="alert-panel">{error}</div>;
  if (!patient) return <div className="alert-panel">Patient record not found.</div>;

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Patient Chart</p>
          <h1>{patient.name}</h1>
          <p className="hero-copy">
            DOB: {formatDate(patient.dateOfBirth)}{patient.pronouns ? ` · Pronouns: ${patient.pronouns}` : ""}
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button button-secondary" href="/clinician/agenda">Agenda</Link>
          <Link className="button" href={`/workqueue/new?clientId=${patient.id}`}>Route to Biller</Link>
        </div>
      </section>

      <section className="toolbar-panel" style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "12px 0" }}>
        <Link className="button button-secondary" href={`/encounters/new?clientId=${patient.id}&organizationId=${organizationId}`}>Create Encounter</Link>
        <Link className="button button-secondary" href={`/workqueue/new?clientId=${patient.id}${organizationId ? `&organizationId=${organizationId}` : ""}`}>Route to Biller</Link>
        <Link className="button button-secondary" href={`/clients/${patient.id}/eligibility?organizationId=${organizationId}`}>Check Eligibility</Link>
        <Link className="button button-secondary" href={`/clients/${patient.id}/claims?organizationId=${organizationId}`}>Claims</Link>
        <Link className="button button-secondary" href={`/clients/${patient.id}/balance?organizationId=${organizationId}`}>Billing</Link>
        <span className="button button-secondary" aria-disabled="true" style={{ opacity: 0.5, cursor: "not-allowed" }}>Upload Document</span>
        <span className="button button-secondary" aria-disabled="true" style={{ opacity: 0.5, cursor: "not-allowed" }}>Collect Payment</span>
        <span className="button button-secondary" aria-disabled="true" style={{ opacity: 0.5, cursor: "not-allowed" }}>Schedule Appointment</span>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Balance</span>
          <strong>{formatMoney(summary?.balance?.total ?? 0)}</strong>
        </article>
        <article className="metric-card">
          <span>Eligibility</span>
          <strong className="metric-text">{latestEligibility?.eligibility_status ?? "None"}</strong>
        </article>
        <article className="metric-card">
          <span>Encounters</span>
          <strong>{encounters.length}</strong>
        </article>
        <article className="metric-card">
          <span>Open Issues</span>
          <strong>{workqueueItems.length}</strong>
        </article>
      </section>

      <section className="chart-grid">
        <article className="panel">
          <h2>Overview</h2>
          <div className="detail-list">
            <p><strong>Preferred name:</strong> {patient.preferredName ?? "Not listed"}</p>
            <p><strong>Email:</strong> {patient.email ?? "Not listed"}</p>
            <p><strong>Phone:</strong> {patient.phone ?? "Not listed"}</p>
          </div>
        </article>

        <article className="panel">
          <h2>Eligibility Snapshot</h2>
          <div className="detail-list">
            <p><strong>Status:</strong> <span className={statusClass(latestEligibility?.eligibility_status)}>{eligibilityLabel(latestEligibility)}</span></p>
            <p><strong>Last checked:</strong> {formatDate(latestEligibility?.checked_at)}</p>
            <p><strong>Copay:</strong> {formatMoney(latestEligibility?.copay_amount)}</p>
            <p><strong>Deductible remaining:</strong> {formatMoney(latestEligibility?.deductible_remaining)}</p>
          </div>
        </article>

        <article className="panel">
          <h2>Insurance</h2>
          {policies.length === 0 ? <p className="muted">No active insurance policies found.</p> : null}
          <div className="stack-list">
            {policies.map((policy) => (
              <div className="stack-item" key={policy.id}>
                <strong>{policy.plan_name ?? "Insurance policy"}</strong>
                <span>{policy.priority ?? "priority not set"} · {policy.active_flag ? "active" : "inactive"}</span>
                <span>Policy: {policy.policy_number ?? "not listed"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Patient Balance</h2>
          {invoices.length === 0 ? <p className="muted">No open patient invoices.</p> : null}
          <div className="stack-list">
            {invoices.map((invoice) => (
              <div className="stack-item" key={invoice.id}>
                <strong>{invoice.invoice_number ?? "Invoice"}</strong>
                <span className={statusClass(invoice.invoice_status)}>{invoice.invoice_status ?? "status not set"}</span>
                <span>Balance: {formatMoney(invoice.balance_amount)}</span>
              </div>
            ))}
          </div>
          <div className="section-actions">
            <Link className="button button-secondary" href={`/clients/${patient.id}/balance`}>Open Balance</Link>
          </div>
        </article>

        <article className="panel wide-panel">
          <h2>Recent Encounters</h2>
          {encounters.length === 0 ? <p className="muted">No encounters found.</p> : null}
          <div className="stack-list">
            {encounters.map((encounter) => (
              <div className="stack-item stack-row" key={encounter.id}>
                <div>
                  <strong>{formatDate(encounter.service_date)}</strong>
                  <span className={statusClass(encounter.encounter_status)}>{encounter.encounter_status ?? "status not set"}</span>
                </div>
                <Link className="button button-secondary" href={`/encounters/${encounter.id}`}>Open Note</Link>
              </div>
            ))}
          </div>
        </article>

        <article className="panel wide-panel">
          <h2>Open Routed Items</h2>
          {workqueueItems.length === 0 ? <p className="muted">No open routed items.</p> : null}
          <div className="stack-list">
            {workqueueItems.map((item) => (
              <div className="stack-item" key={item.id}>
                <strong>{item.title ?? "Routed item"}</strong>
                <span>{item.work_type ?? "work item"} · {item.priority ?? "priority not set"}</span>
                <span className={statusClass(item.status)}>{item.status ?? "status not set"}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
