"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ORG_ID } from "@/lib/config";

type PayerCallVolumeEntry = {
  payerProfileId: string | null;
  payerName: string;
  totalAttempts: number;
  spokeWithRep: number;
  leftVoicemail: number;
  noAnswer: number;
  faxes: number;
  otherDialed: number;
};

type ReportPayload = {
  success?: boolean;
  error?: string;
  month?: string;
  claims?: {
    submitted: number;
    paid: number;
    deniedOrRejected: number;
    totalChargeSubmitted: number;
  };
  payments?: {
    count: number;
    totalAmount: number;
  };
  payerCallVolume?: {
    totalAttempts: number;
    spokeWithRep: number;
    leftVoicemail: number;
    noAnswer: number;
    faxes: number;
    voicemailRate: number;
    averageAttemptsPerClaim: number;
    breakdown: PayerCallVolumeEntry[];
  };
};

type Provider = {
  id: string;
  provider_name: string;
};

function getOrganizationId() {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_ORGANIZATION_ID || DEFAULT_ORG_ID;
  return new URLSearchParams(window.location.search).get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || DEFAULT_ORG_ID;
}

function money(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatMonth(value: string) {
  if (!value) return "Current month";
  const parsed = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function thisMonth() {
  const now = new Date();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${m}`;
}

export default function BillingReportsClient() {
  const organizationId = useMemo(() => getOrganizationId(), []);
  const [month, setMonth] = useState(thisMonth());
  const [scope, setScope] = useState<string>("practice"); // "practice" | providerId
  const [providers, setProviders] = useState<Provider[]>([]);
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [error, setError] = useState<string | null>(null);
  const missingOrgMessage = "Missing organizationId. Add ?organizationId=... or configure NEXT_PUBLIC_ORGANIZATION_ID.";

  // Providers for the scope dropdown.
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/providers?organizationId=${encodeURIComponent(organizationId)}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json?.success !== false) {
          const rows = Array.isArray(json?.providers) ? json.providers : Array.isArray(json) ? json : [];
          setProviders(
            rows.map((p: { id: string; provider_name?: string; name?: string }) => ({
              id: String(p.id),
              provider_name: String(p.provider_name ?? p.name ?? "Unnamed clinician"),
            })),
          );
        }
      } catch {
        /* providers list is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  // Report payload, refetches when month or scope changes.
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ organizationId, month });
        if (scope !== "practice") params.set("providerId", scope);
        const response = await fetch(`/api/billing/reports?${params.toString()}`, { cache: "no-store" });
        const json = (await response.json()) as ReportPayload;
        if (cancelled) return;
        if (!response.ok || !json.success) throw new Error(json.error || "Failed to load billing report");
        setPayload(json);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load billing report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, month, scope]);

  const scopeLabel =
    scope === "practice"
      ? "Practice (all clinicians)"
      : providers.find((p) => p.id === scope)?.provider_name ?? "Clinician";

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Billing Reports</p>
          <h1>Revenue-Cycle KPIs</h1>
          <p className="hero-copy">
            Headline billing metrics for {formatMonth(payload?.month || month)} ·{" "}
            <strong>{scopeLabel}</strong>.
          </p>
        </div>
      </section>

      <section className="toolbar-panel">
        <label className="field-label compact-field">
          Reporting month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className="field-label compact-field">
          View
          <select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="practice">Practice (all clinicians)</option>
            {providers.length > 0 ? <optgroup label="Clinician" /> : null}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.provider_name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!organizationId ? <div className="alert-panel">{missingOrgMessage}</div> : null}
      {error ? <div className="alert-panel">{error}</div> : null}
      {loading ? <div className="empty-state">Loading KPIs…</div> : null}

      {!loading && payload ? (
        <section className="metric-grid">
          <article className="metric-card">
            <span>Claims Submitted</span>
            <strong>{payload.claims?.submitted ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Claims Paid</span>
            <strong>{payload.claims?.paid ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Denials / Rejections</span>
            <strong>{payload.claims?.deniedOrRejected ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Total Charges Submitted</span>
            <strong>{money(payload.claims?.totalChargeSubmitted ?? 0)}</strong>
          </article>
          <article className="metric-card">
            <span>Patient Payments {scope !== "practice" ? "(practice-wide only)" : ""}</span>
            <strong>{payload.payments?.count ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Payments Posted {scope !== "practice" ? "(practice-wide only)" : ""}</span>
            <strong>{money(payload.payments?.totalAmount ?? 0)}</strong>
          </article>
        </section>
      ) : null}

      {!loading && payload?.payerCallVolume ? (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Payer call activity</h2>
          <p style={{ color: "#64748B", fontSize: 13, margin: "0 0 16px" }}>
            Structured call attempts logged from the No Response → Call payer
            panel this month{scope !== "practice" ? " (practice-wide)" : ""}.
          </p>
          <div className="metric-grid">
            <article className="metric-card">
              <span>Call attempts</span>
              <strong>{payload.payerCallVolume.totalAttempts}</strong>
            </article>
            <article className="metric-card">
              <span>Spoke with rep</span>
              <strong>{payload.payerCallVolume.spokeWithRep}</strong>
            </article>
            <article className="metric-card">
              <span>Voicemail</span>
              <strong>{payload.payerCallVolume.leftVoicemail}</strong>
            </article>
            <article className="metric-card">
              <span>No answer</span>
              <strong>{payload.payerCallVolume.noAnswer}</strong>
            </article>
            <article className="metric-card">
              <span>% voicemail</span>
              <strong>{payload.payerCallVolume.voicemailRate}%</strong>
            </article>
            <article className="metric-card">
              <span>Avg attempts / claim</span>
              <strong>{payload.payerCallVolume.averageAttemptsPerClaim}</strong>
            </article>
          </div>
          {payload.payerCallVolume.breakdown.length > 0 ? (
            <div
              style={{
                marginTop: 16,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#F8FAFC" }}>
                  <tr>
                    <th style={cellHead}>Payer</th>
                    <th style={{ ...cellHead, textAlign: "right" }}>Attempts</th>
                    <th style={{ ...cellHead, textAlign: "right" }}>Spoke w/ rep</th>
                    <th style={{ ...cellHead, textAlign: "right" }}>Voicemail</th>
                    <th style={{ ...cellHead, textAlign: "right" }}>No answer</th>
                    <th style={{ ...cellHead, textAlign: "right" }}>Faxes</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.payerCallVolume.breakdown.map((row) => (
                    <tr
                      key={row.payerProfileId ?? row.payerName}
                      style={{ borderTop: "1px solid #F1F5F9" }}
                    >
                      <td style={cellBody}>{row.payerName}</td>
                      <td style={{ ...cellBody, textAlign: "right" }}>{row.totalAttempts}</td>
                      <td style={{ ...cellBody, textAlign: "right" }}>{row.spokeWithRep}</td>
                      <td style={{ ...cellBody, textAlign: "right" }}>{row.leftVoicemail}</td>
                      <td style={{ ...cellBody, textAlign: "right" }}>{row.noAnswer}</td>
                      <td style={{ ...cellBody, textAlign: "right" }}>{row.faxes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: 12 }}>
              No payer calls logged for this period yet.
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

const cellHead: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const cellBody: React.CSSProperties = {
  padding: "8px 12px",
  color: "#0F172A",
};
