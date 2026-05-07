"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface PayerRow {
  id: string;
  name: string | null;
  payer_id: string | null;
  payer_type: string | null;
  phone: string | null;
  is_active?: boolean | null;
}

export default function PayersIndexPage() {
  const [payers, setPayers] = useState<PayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from("payers")
        .select("id, name, payer_id, payer_type, phone, is_active")
        .order("name", { ascending: true });

      if (dbError) {
        setError(dbError.message);
      } else {
        setPayers((data ?? []) as PayerRow[]);
      }
      setLoading(false);
    }
    void load();
  }, []);

  const filtered = payers.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.payer_id ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link href="/settings" className="hover:text-slate-700">Settings</Link>
            <span>/</span>
            <span className="font-semibold text-slate-700">Payers</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-950">Payers</h1>
              <p className="mt-2 text-sm text-slate-600">Payer records, search, and policy relationships.</p>
            </div>
          </div>

          <div className="mt-6">
            <input
              type="text"
              placeholder="Search payers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                Loading payers…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                {search ? "No payers match your search." : "No payers found."}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Payer Name</th>
                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Payer ID</th>
                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Type</th>
                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Phone</th>
                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((payer) => (
                      <tr key={payer.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-900">{payer.name ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{payer.payer_id ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-600 capitalize">{payer.payer_type ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{payer.phone ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${payer.is_active !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {payer.is_active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/insurance/payers/${payer.id}`}
                            className="text-xs font-bold text-indigo-700 hover:text-indigo-900"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
