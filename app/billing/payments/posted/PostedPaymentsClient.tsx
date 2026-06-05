"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PostedPayment = {
  id: string;
  type: string;
  amount: number;
  description?: string | null;
  postedAt?: string | null;
  patientName: string;
  professionalClaimId?: string | null;
  claimNumber?: string | null;
  claimStatus?: string | null;
  sourceTable?: string | null;
};

type Payload = {
  success?: boolean;
  error?: string;
  payments?: PostedPayment[];
  totals?: Record<string, number>;
};

function getOrganizationId() {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
  return new URLSearchParams(window.location.search).get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
}

function money(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not posted";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function label(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PostedPaymentsClient() {
  const organizationId = useMemo(() => getOrganizationId(), []);
  const orgQuery = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/billing/payments/posted?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
        const json = (await response.json()) as Payload;
        if (cancelled) return;
        if (!response.ok || !json.success) throw new Error(json.error || "Failed to load posted payments");
        setPayload(json);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load posted payments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (!organizationId) {
    return (
      <main className="page-shell">
        <section className="card"><h1>Posted Payments</h1><p className="error-text">Missing organizationId. Add ?organizationId=... or configure NEXT_PUBLIC_ORGANIZATION_ID.</p></section>
      </main>
    );
  }

  const payments = payload?.payments ?? [];
  const totals = payload?.totals ?? {};

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Billing / Payments</p>
        <h1>Posted Payments</h1>
        <p className="muted">Canonical payment history from ERA insurance postings, contractual adjustments, patient-responsibility transfers, and posted patient payments.</p>
        <div className="actions-row">
          <Link className="button button-secondary" href={`/billing${orgQuery}`}>Billing Home</Link>
          <Link className="button button-secondary" href={`/billing/reports${orgQuery}`}>Reports</Link>
          <Link className="button" href={`/billing/workqueue${orgQuery}`}>Workqueue</Link>
        </div>
      </section>

      <section className="grid-4">
        <div className="metric-card"><span>Insurance Payments</span><strong>{money(totals.insurancePayments)}</strong></div>
        <div className="metric-card"><span>Contractual Adjustments</span><strong>{money(totals.contractualAdjustments)}</strong></div>
        <div className="metric-card"><span>Patient Responsibility</span><strong>{money(totals.patientResponsibilityTransfers)}</strong></div>
        <div className="metric-card"><span>Patient Payments</span><strong>{money(totals.patientPayments)}</strong></div>
      </section>

      <section className="card">
        <h2>Payment History</h2>
        {loading ? <p className="muted">Loading posted payments…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {!loading && !error && payments.length === 0 ? <p className="muted">No posted payments found yet.</p> : null}
        {payments.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Posted</th><th>Type</th><th>Patient</th><th>Claim</th><th>Status</th><th>Amount</th><th>Source</th></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={`${payment.sourceTable}-${payment.id}`}>
                    <td>{formatDate(payment.postedAt)}</td>
                    <td>{label(payment.type)}</td>
                    <td>{payment.patientName}</td>
                    <td>{payment.claimNumber || payment.professionalClaimId || "—"}</td>
                    <td>{payment.claimStatus || "—"}</td>
                    <td>{money(payment.amount)}</td>
                    <td>{payment.sourceTable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
