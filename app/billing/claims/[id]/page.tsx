// File: app/billing/claims/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ClaimStatusPanel from "@/components/clearinghouse/ClaimStatusPanel";
import EdiTransactionLog from "@/components/clearinghouse/EdiTransactionLog";
import ClearinghouseEventsPanel from "@/components/clearinghouse/ClearinghouseEventsPanel";
import type { ClaimStatusCheck, ClearinghouseResponseEvent, EdiTransaction } from "@/types/clearinghouse";
import { supabase } from "@/lib/supabase/client";

interface ClaimRecord {
  id: string;
  client_id?: string | null;
  encounter_id?: string | null;
  insurance_policy_id?: string | null;
  claim_number?: string | null;
  claim_status?: string | null;
  total_charge_amount?: number | string | null;
  created_at?: string | null;
}

interface ClaimStatusHistoryPayload {
  checks: ClaimStatusCheck[];
  transactions: EdiTransaction[];
  events: ClearinghouseResponseEvent[];
}

function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

export default function ClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const claimId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [claim, setClaim] = useState<ClaimRecord | null>(null);
  const [history, setHistory] = useState<ClaimStatusHistoryPayload>({
    checks: [],
    transactions: [],
    events: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!claimId) {
      setError("Claim ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const claimResp = await supabase.from("claims").select("*").eq("id", claimId).maybeSingle();
    if (claimResp.error || !claimResp.data) {
      setError(claimResp.error?.message ?? "Claim not found.");
      setLoading(false);
      return;
    }

    setClaim(claimResp.data as ClaimRecord);

    const historyResp = await fetch(`/api/claims/${claimId}/status-history`);
    const historyPayload = await historyResp.json();
    if (!historyResp.ok) {
      setError(historyPayload.error ?? "Could not load claim history.");
      setLoading(false);
      return;
    }

    setHistory({
      checks: (historyPayload.checks ?? []) as ClaimStatusCheck[],
      transactions: (historyPayload.transactions ?? []) as EdiTransaction[],
      events: (historyPayload.events ?? []) as ClearinghouseResponseEvent[],
    });
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [claimId]);

  const latestStatus = useMemo(() => history.checks[0] ?? null, [history.checks]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Claim Detail</h1>
              <p className="mt-2 text-sm text-gray-600">
                Claim detail now exposes real-time 276/277 status and clearinghouse timeline data.
              </p>
            </div>
            <Link href="/billing" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
              Back to Billing
            </Link>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading claim detail...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : !claim ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
              Claim not found.
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900">Claim Summary</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-4 text-sm text-gray-700">
                    <div><span className="font-medium">Claim:</span> {claim.claim_number ?? claim.id}</div>
                    <div><span className="font-medium">Encounter:</span> {claim.encounter_id ?? "—"}</div>
                    <div><span className="font-medium">Status:</span> {claim.claim_status ?? "—"}</div>
                    <div><span className="font-medium">Charge:</span> {formatMoney(claim.total_charge_amount)}</div>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900">Clearinghouse Timeline</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {history.transactions.map((transaction) => (
                      <div key={transaction.id} className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                        <div className="font-medium text-gray-900">
                          {transaction.transaction_type} • {transaction.direction}
                        </div>
                        <div className="mt-1">{transaction.status}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {transaction.sent_at ?? transaction.created_at ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">API-Level Transaction Log</h2>
                  <EdiTransactionLog rows={history.transactions} />
                </section>

                <section className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Clearinghouse Events</h2>
                  <ClearinghouseEventsPanel rows={history.events} />
                </section>
              </div>

              <div className="space-y-6">
                <ClaimStatusPanel claimId={claim.id} latest={latestStatus} onComplete={load} />

                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900">Latest Payer Status</h2>
                  {latestStatus ? (
                    <div className="mt-4 space-y-3 text-sm text-gray-700">
                      <div><span className="font-medium">Status:</span> {latestStatus.status}</div>
                      <div><span className="font-medium">Category Code:</span> {latestStatus.status_category_code ?? "—"}</div>
                      <div><span className="font-medium">Status Code:</span> {latestStatus.status_code ?? "—"}</div>
                      <div><span className="font-medium">Entity Code:</span> {latestStatus.entity_code ?? "—"}</div>
                      <div><span className="font-medium">Paid Amount:</span> {formatMoney(latestStatus.paid_amount)}</div>
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-gray-600">No 277 claim status check yet.</div>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
