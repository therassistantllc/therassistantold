// File: app/billing/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimStatusCheck, ClearinghouseResponseEvent } from "@/types/clearinghouse";

type QueueKey =
  | "ready_to_submit"
  | "no_response"
  | "rejected"
  | "denied"
  | "pending_payer"
  | "needs_claim_status_check"
  | "paid_closed"
  | "era_not_posted";

interface ClaimRecord {
  id: string;
  client_id?: string | null;
  provider_id?: string | null;
  claim_number?: string | null;
  claim_status?: string | null;
  total_charge_amount?: number | string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  date_of_service_from?: string | null;
  insurance_policy_id?: string | null;
  encounter_id?: string | null;
}

interface ClientRecord {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface QueueRow {
  claim: ClaimRecord;
  patientName: string;
  queue: QueueKey;
  latestStatus: ClaimStatusCheck | null;
  latestEvent: ClearinghouseResponseEvent | null;
}

const queueLabels: Record<QueueKey, string> = {
  ready_to_submit: "Ready to Submit",
  no_response: "No Response",
  rejected: "Rejected",
  denied: "Denied",
  pending_payer: "Pending Payer",
  needs_claim_status_check: "Needs Claim Status Check",
  paid_closed: "Paid / Closed",
  era_not_posted: "ERA Not Posted",
};

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

function fullName(patient?: ClientRecord | null) {
  if (!patient) return "Unknown Patient";
  return [patient.first_name, patient.last_name].filter(Boolean).join(" ") || patient.id;
}

export default function BillingPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [patients, setPatients] = useState<ClientRecord[]>([]);
  const [statusChecks, setStatusChecks] = useState<ClaimStatusCheck[]>([]);
  const [events, setEvents] = useState<ClearinghouseResponseEvent[]>([]);
  const [activeQueue, setActiveQueue] = useState<QueueKey>("needs_claim_status_check");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const [claimResp, patientResp, eventsResp] = await Promise.all([
      supabase.from("claims").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(500),
      supabase.from("clients").select("id, first_name, last_name").is("archived_at", null).limit(500),
      fetch("/api/clearinghouse/events?unresolved_only=false"),
    ]);

    if (claimResp.error || patientResp.error) {
      setError(claimResp.error?.message || patientResp.error?.message || "Could not load billing workspace.");
      setLoading(false);
      return;
    }

    setClaims((claimResp.data ?? []) as ClaimRecord[]);
    setPatients((patientResp.data ?? []) as ClientRecord[]);

    const allStatuses = await Promise.all(
      ((claimResp.data ?? []) as ClaimRecord[]).map(async (claim) => {
        const response = await fetch(`/api/claims/${claim.id}/status-history`);
        if (!response.ok) return { checks: [] as ClaimStatusCheck[], events: [] as ClearinghouseResponseEvent[] };
        return (await response.json()) as { checks: ClaimStatusCheck[]; events: ClearinghouseResponseEvent[] };
      })
    );

    setStatusChecks(allStatuses.flatMap((item) => item.checks ?? []));
    setEvents(eventsResp.ok ? ((await eventsResp.json()).rows ?? []) as ClearinghouseResponseEvent[] : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const patientById = useMemo(() => new Map(patients.map((item) => [item.id, item])), [patients]);

  const rows = useMemo<QueueRow[]>(() => {
    const latestStatusByClaim = new Map<string, ClaimStatusCheck>();
    for (const item of statusChecks) {
      if (!latestStatusByClaim.has(item.claim_id)) latestStatusByClaim.set(item.claim_id, item);
    }

    const latestEventByClaim = new Map<string, ClearinghouseResponseEvent>();
    for (const item of events) {
      if (item.claim_id && !latestEventByClaim.has(item.claim_id)) latestEventByClaim.set(item.claim_id, item);
    }

    return claims.map((claim) => {
      const latestStatus = latestStatusByClaim.get(claim.id) ?? null;
      const latestEvent = latestEventByClaim.get(claim.id) ?? null;
      const submittedDays = daysSince(claim.submitted_at ?? claim.created_at ?? null);
      const queue: QueueKey =
        !claim.submitted_at
          ? "ready_to_submit"
          : latestEvent?.event_type === "rejection"
          ? "rejected"
          : latestEvent?.event_type === "denial" || latestStatus?.status === "denied"
          ? "denied"
          : latestStatus?.status === "pending"
          ? "pending_payer"
          : latestStatus?.status === "paid"
          ? "paid_closed"
          : latestEvent?.event_type === "payment"
          ? "era_not_posted"
          : submittedDays !== null && submittedDays >= 14 && !latestStatus
          ? "needs_claim_status_check"
          : !latestEvent && Boolean(claim.submitted_at)
          ? "no_response"
          : "pending_payer";

      return {
        claim,
        patientName: fullName(claim.client_id ? patientById.get(claim.client_id) : null),
        queue,
        latestStatus,
        latestEvent,
      };
    });
  }, [claims, events, patientById, statusChecks]);

  const filteredRows = rows.filter((row) => row.queue === activeQueue);

  const summary = useMemo(() => {
    const totalAr = claims.reduce((sum, claim) => sum + Number.parseFloat(String(claim.total_charge_amount ?? "0") || "0"), 0);
    const deniedCount = rows.filter((row) => row.queue === "denied").length;
    const noResponseCount = rows.filter((row) => row.queue === "no_response").length;
    const eraNotPostedCount = rows.filter((row) => row.queue === "era_not_posted").length;
    const highBalancesCount = rows.filter((row) => Number.parseFloat(String(row.claim.total_charge_amount ?? "0") || "0") >= 100).length;
    return {
      totalAr,
      deniedCount,
      noResponseCount,
      eraNotPostedCount,
      highBalancesCount,
    };
  }, [claims, rows]);

  const kpis = [
    { label: "Total A/R", value: formatMoney(summary.totalAr), queue: "pending_payer" as QueueKey },
    { label: "Denied Claims", value: String(summary.deniedCount), queue: "denied" as QueueKey },
    { label: "No Response", value: String(summary.noResponseCount), queue: "no_response" as QueueKey },
    { label: "ERA Not Posted", value: String(summary.eraNotPostedCount), queue: "era_not_posted" as QueueKey },
    { label: "Balances >$100", value: String(summary.highBalancesCount), queue: "pending_payer" as QueueKey },
  ];

  return (
    <AppShell>
      <main className="min-h-screen" style={{ background: "var(--neutral-50)" }}>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "var(--brand-navy)" }}>Billing Workqueue</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--neutral-600)" }}>
              Unified billing workspace with clearinghouse-driven routing.
            </p>
          </div>

          <section className="card mb-6">
            <div className="grid gap-4 md:grid-cols-5">
              {kpis.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveQueue(item.queue)}
                  className="metric-card text-left"
                  style={{ background: "var(--neutral-50)", borderColor: "var(--neutral-200)" }}
                >
                  <div className="text-sm" style={{ color: "var(--neutral-500)" }}>{item.label}</div>
                  <div className="mt-2 text-xl font-semibold" style={{ color: "var(--brand-navy)" }}>{item.value}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="card mb-6">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(queueLabels) as QueueKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveQueue(key)}
                  className={activeQueue === key ? "btn-primary" : "btn-secondary"}
                >
                  {queueLabels[key]}
                </button>
              ))}
            </div>
          </section>

          {loading ? (
            <div className="card">
              <p className="text-sm" style={{ color: "var(--neutral-600)" }}>Loading billing workqueue...</p>
            </div>
          ) : error ? (
            <div className="card" style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-text)" }}>
              {error}
            </div>
          ) : (
            <section className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y" style={{ borderColor: "var(--neutral-200)" }}>
                  <thead style={{ background: "var(--table-header)" }}>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neutral-700)" }}>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">DOS</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Payer</th>
                      <th className="px-4 py-3">Billed</th>
                      <th className="px-4 py-3">Latest Clearinghouse Status</th>
                      <th className="px-4 py-3">Latest Payer Status</th>
                      <th className="px-4 py-3">Last Action</th>
                      <th className="px-4 py-3">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map((row) => (
                      <tr key={row.claim.id} className="text-sm text-gray-700">
                        <td className="px-4 py-3">{row.patientName}</td>
                        <td className="px-4 py-3">{row.claim.date_of_service_from ?? "—"}</td>
                        <td className="px-4 py-3">{row.claim.provider_id ?? "—"}</td>
                        <td className="px-4 py-3">{row.claim.insurance_policy_id ?? "—"}</td>
                        <td className="px-4 py-3">{formatMoney(row.claim.total_charge_amount)}</td>
                        <td className="px-4 py-3">{row.latestEvent?.event_type ?? "—"}</td>
                        <td className="px-4 py-3">{row.latestStatus?.status ?? row.claim.claim_status ?? "—"}</td>
                        <td className="px-4 py-3">{row.latestEvent?.created_at ?? row.claim.created_at ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/billing/claims/${row.claim.id}`} className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50">
                              Open Claim
                            </Link>
                            <Link href={`/billing/claims/${row.claim.id}`} className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50">
                              Check Claim Status
                            </Link>
                            <button type="button" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50">
                              Defer
                            </button>
                            <button type="button" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50">
                              Add Note
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-600">
                          No claims currently route into this queue.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
