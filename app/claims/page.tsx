// File: app/claims/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord } from "@/lib/types";

type ClaimStatusFilter = "all" | "draft" | "ready" | "submitted" | "paid" | "denied";

function matchesStatus(claim: ClaimRecord, filter: ClaimStatusFilter) {
  if (filter === "all") return true;
  return (claim.claim_status ?? "").toLowerCase() === filter;
}

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

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatusFilter>("all");

  useEffect(() => {
    let active = true;

    async function loadClaims() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("claims")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setClaims([]);
        setLoading(false);
        return;
      }

      setClaims((data ?? []) as ClaimRecord[]);
      setLoading(false);
    }

    void loadClaims();

    return () => {
      active = false;
    };
  }, []);

  const filteredClaims = useMemo(() => {
    const query = search.trim().toLowerCase();

    return claims.filter((claim) => {
      const matchesQuery =
        query.length === 0 ||
        claim.id.toLowerCase().includes(query) ||
        (claim.client_id ?? "").toLowerCase().includes(query) ||
        (claim.encounter_id ?? "").toLowerCase().includes(query) ||
        (claim.insurance_policy_id ?? "").toLowerCase().includes(query) ||
        (claim.claim_status ?? "").toLowerCase().includes(query) ||
        (claim.claim_number ?? "").toLowerCase().includes(query);

      return matchesQuery && matchesStatus(claim, statusFilter);
    });
  }, [claims, search, statusFilter]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Claims</h1>
              <p className="mt-2 text-sm text-gray-600">
                Claims created from billable encounters, diagnoses, and service lines.
              </p>
            </div>

            <Link
              href="/claims/create"
              className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Create Draft Claim
            </Link>
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div>
              <div className="text-sm text-gray-500">Total loaded</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{claims.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Filtered</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{filteredClaims.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Submitted</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {claims.filter((item) => (item.claim_status ?? "").toLowerCase() === "submitted").length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Paid</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {claims.filter((item) => (item.claim_status ?? "").toLowerCase() === "paid").length}
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by claim id, claim number, client, encounter, policy, or status"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ClaimStatusFilter)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="submitted">Submitted</option>
              <option value="paid">Paid</option>
              <option value="denied">Denied</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading claims...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Could not load claims: {error}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Claim number</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Encounter</th>
                      <th className="px-4 py-3">Policy</th>
                      <th className="px-4 py-3">Total charge</th>
                      <th className="px-4 py-3">Links</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredClaims.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                          No claims found.
                        </td>
                      </tr>
                    ) : (
                      filteredClaims.map((claim) => (
                        <tr key={claim.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(claim.created_at)}</td>
                          <td className="px-4 py-3">
                            <Link href={`/claims/${claim.id}`} className="font-medium text-blue-700 hover:underline">
                              {claim.claim_number ?? claim.id}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {claim.claim_status ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{claim.client_id ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{claim.encounter_id ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{claim.insurance_policy_id ?? "—"}</td>
                          <td className="px-4 py-3">{claim.total_charge_amount ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link href={`/claims/${claim.id}`} className="text-blue-700 hover:underline">
                                Detail
                              </Link>
                              <Link href="/claims/submissions" className="text-blue-700 hover:underline">
                                Submissions
                              </Link>
                              <Link href="/claims/status" className="text-blue-700 hover:underline">
                                Status
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
