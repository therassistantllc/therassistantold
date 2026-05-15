"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ClaimItem = {
  id: string;
  claimNumber: string | null;
  status: string | null;
  totalCharge: number | null;
  diagnosisCodes: string[];
  createdAt: string | null;
  submittedAt: string | null;
  appointmentId: string | null;
  encounterId: string | null;
};

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
}

function formatMoney(v: number | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function statusClass(v: string | null | undefined) {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("paid") || s.includes("accepted")) return "status status-green";
  if (s.includes("denied") || s.includes("rejected") || s.includes("error")) return "status status-red";
  if (s.includes("pending") || s.includes("submitted") || s.includes("batch")) return "status status-yellow";
  return "status";
}

export default function ClaimsPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params?.clientId ?? "";
  const searchParams = useSearchParams();
  const orgId = searchParams.get("organizationId") ?? process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "";

  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !orgId) { setLoading(false); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/patients/${clientId}/claims?organizationId=${encodeURIComponent(orgId)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ success: boolean; claims?: ClaimItem[]; error?: string }>)
      .then((json) => {
        if (!json.success) throw new Error(json.error ?? "Failed");
        setClaims(json.claims ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [clientId, orgId]);

  const orgQ = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";

  return (
    <main className="app-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Client Chart</p>
          <h2>Claims History</h2>
        </div>
        <div className="hero-actions">
          <Link className="button button-secondary" href={`/billing/claim-readiness${orgQ}`}>
            Claim Readiness
          </Link>
        </div>
      </section>

      {loading && <div className="empty-state">Loading claims…</div>}
      {error && <div className="alert-panel">{error}</div>}

      {!loading && claims.length === 0 && !error && (
        <div className="empty-state">No professional claims found for this client.</div>
      )}

      {claims.length > 0 && (
        <section className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Status</th>
                <th>Total Charge</th>
                <th>Diagnoses</th>
                <th>Created</th>
                <th>Submitted</th>
                <th>Encounter</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id}>
                  <td><strong>{claim.claimNumber ?? claim.id.slice(0, 8)}</strong></td>
                  <td><span className={statusClass(claim.status)}>{claim.status ?? "—"}</span></td>
                  <td>{formatMoney(claim.totalCharge)}</td>
                  <td>{claim.diagnosisCodes.join(", ") || "—"}</td>
                  <td>{formatDate(claim.createdAt)}</td>
                  <td>{claim.submittedAt ? formatDate(claim.submittedAt) : <span className="muted">Not submitted</span>}</td>
                  <td>
                    {claim.encounterId
                      ? <Link className="inline-link" href={`/encounters/${claim.encounterId}${orgQ}`}>Encounter</Link>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
