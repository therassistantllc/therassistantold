// File: app/claims/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimServiceLineRecord } from "@/lib/types";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numeric);
}

export default function ClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const claimId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [claim, setClaim] = useState<ClaimRecord | null>(null);
  const [serviceLines, setServiceLines] = useState<ClaimServiceLineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!claimId) return;

    let active = true;

    async function loadClaimDetail() {
      setLoading(true);
      setError(null);

      const [{ data: claimData, error: claimError }, { data: serviceLineData, error: serviceLineError }] =
        await Promise.all([
          supabase
            .from("claims")
            .select("*")
            .eq("id", claimId)
            .is("archived_at", null)
            .single(),
          supabase
            .from("claim_service_lines")
            .select("*")
            .eq("claim_id", claimId)
            .is("archived_at", null)
            .order("sequence_number", { ascending: true }),
        ]);

      if (!active) return;

      if (claimError) {
        setError(claimError.message);
        setClaim(null);
        setServiceLines([]);
        setLoading(false);
        return;
      }

      if (serviceLineError) {
        setError(serviceLineError.message);
        setClaim(claimData as ClaimRecord);
        setServiceLines([]);
        setLoading(false);
        return;
      }

      setClaim(claimData as ClaimRecord);
      setServiceLines((serviceLineData ?? []) as ClaimServiceLineRecord[]);
      setLoading(false);
    }

    void loadClaimDetail();

    return () => {
      active = false;
    };
  }, [claimId]);

  const totals = useMemo(() => {
    const totalCharge = serviceLines.reduce((sum, line) => {
      const value = Number.parseFloat(String(line.charge_amount ?? "0"));
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const totalAllowed = serviceLines.reduce((sum, line) => {
      const value = Number.parseFloat(String(line.allowed_amount ?? "0"));
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const totalPaid = serviceLines.reduce((sum, line) => {
      const value = Number.parseFloat(String(line.paid_amount ?? "0"));
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    return {
      totalCharge,
      totalAllowed,
      totalPaid,
    };
  }, [serviceLines]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Claim Detail</h1>
            <p className="mt-2 text-sm text-gray-600">
              Claim summary and claim service lines for the revenue-cycle workflow.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading claim detail...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Could not load claim detail: {error}
            </div>
          ) : !claim ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Claim not found.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Claim ID</div>
                    <div className="mt-1 break-all font-mono text-sm text-gray-900">{claim.id}</div>
                    <div className="mt-4 text-sm text-gray-500">Claim number</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">{claim.claim_number ?? "—"}</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-sm text-gray-500">Status</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">{claim.claim_status ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Created</div>
                      <div className="mt-1 text-sm text-gray-900">{formatDateTime(claim.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Client</div>
                      <div className="mt-1 break-all font-mono text-xs text-gray-900">{claim.client_id ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Encounter</div>
                      <div className="mt-1 break-all font-mono text-xs text-gray-900">{claim.encounter_id ?? "—"}</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Total charge</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {claim.total_charge_amount ? formatMoney(claim.total_charge_amount) : formatMoney(totals.totalCharge)}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Allowed</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(totals.totalAllowed)}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Paid</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(totals.totalPaid)}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Service lines</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">{serviceLines.length}</div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-900">Claim Service Lines</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Seq</th>
                        <th className="px-4 py-3">Service date</th>
                        <th className="px-4 py-3">CPT/HCPCS</th>
                        <th className="px-4 py-3">Units</th>
                        <th className="px-4 py-3">Charge</th>
                        <th className="px-4 py-3">Allowed</th>
                        <th className="px-4 py-3">Paid</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">POS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {serviceLines.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                            No claim service lines found.
                          </td>
                        </tr>
                      ) : (
                        serviceLines.map((line) => (
                          <tr key={line.id} className="text-sm text-gray-700">
                            <td className="px-4 py-3">{line.sequence_number ?? "—"}</td>
                            <td className="px-4 py-3">{line.service_date ?? "—"}</td>
                            <td className="px-4 py-3">{line.cpt_hcpcs_code ?? "—"}</td>
                            <td className="px-4 py-3">{line.units ?? "—"}</td>
                            <td className="px-4 py-3">{formatMoney(line.charge_amount)}</td>
                            <td className="px-4 py-3">{formatMoney(line.allowed_amount)}</td>
                            <td className="px-4 py-3">{formatMoney(line.paid_amount)}</td>
                            <td className="px-4 py-3">{line.claim_line_status ?? "—"}</td>
                            <td className="px-4 py-3">{line.place_of_service_code ?? "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
