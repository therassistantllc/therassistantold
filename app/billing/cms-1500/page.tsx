"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

type ClaimRow = {
  id: string;
  claim_number: string | null;
  claim_status: string | null;
  created_at: string | null;
  date_of_service_from: string | null;
};

export default function Cms1500Page() {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("claims")
        .select("id, claim_number, claim_status, created_at, date_of_service_from")
        .is("archived_at", null)
        .in("claim_status", ["ready_to_submit", "draft", "pending"])
        .order("created_at", { ascending: false })
        .limit(200);

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as ClaimRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-2xl font-black text-slate-950">Create CMS-1500 Claims</h1>
          <p className="mt-2 text-sm text-slate-600">Select eligible claims and continue into paper-claim generation workflow.</p>

          {loading ? <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">Loading...</div> : null}
          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

          {!loading && !error ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Claim</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">DOS</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.claim_number ?? row.id}</td>
                      <td className="px-4 py-3">{row.claim_status ?? "—"}</td>
                      <td className="px-4 py-3">{row.date_of_service_from ?? "—"}</td>
                      <td className="px-4 py-3">{row.created_at ?? "—"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No claims currently eligible for CMS-1500 generation.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
