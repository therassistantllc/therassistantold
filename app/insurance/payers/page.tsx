"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface PayerRow {
  id: string;
  payer_name: string | null;
  payer_id: string | null;
  payer_type: string | null;
  phone: string | null;
  active_flag?: boolean | null;
}

interface AvailityPayer {
  payerId: string;
  payerName: string;
  aliases?: string[];
  supportedTransactions?: string[];
  states?: string[];
}

interface ConfiguredPayer {
  id: string;
  organization_id?: string | null;
  payer_id: string;
  payer_name: string;
  supported_transactions: string[];
  states: string[];
  is_active: boolean;
}

interface EligibilityPrepareResult {
  requestId: string;
  status: string;
  payerId: string | null;
  payerName: string | null;
  serviceTypeCode: string;
  serviceTypeDescription: string;
  eligibilityStatus: string | null;
  copayAmount: number | null;
  deductibleRemaining: number | null;
  effectiveDate: string | null;
  terminationDate: string | null;
  isMock: boolean;
}

export default function PayersIndexPage() {
  const [payers, setPayers] = useState<PayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  // Availity search state
  const [availitySearch, setAvailitySearch] = useState("");
  const [availityResults, setAvailityResults] = useState<AvailityPayer[]>([]);
  const [availityLoading, setAvailityLoading] = useState(false);
  const [availityError, setAvailityError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("CO");
  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(new Set());
  const [addingPayer, setAddingPayer] = useState<string | null>(null);
  
  // Configured payers state
  const [configuredPayers, setConfiguredPayers] = useState<ConfiguredPayer[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [preparingEligibilityByPayer, setPreparingEligibilityByPayer] = useState<Record<string, boolean>>({});
  const [eligibilityResultsByPayer, setEligibilityResultsByPayer] = useState<Record<string, EligibilityPrepareResult>>({});
  const [eligibilityErrorsByPayer, setEligibilityErrorsByPayer] = useState<Record<string, string>>({});

  const formatCurrency = (value: number | null) => {
    if (value === null || Number.isNaN(value)) {
      return "—";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from("insurance_payers")
        .select("id, payer_name, payer_id, payer_type, phone, active_flag")
        .order("payer_name", { ascending: true });

      if (dbError) {
        setError(dbError.message);
      } else {
        setPayers((data ?? []) as PayerRow[]);
      }
      setLoading(false);
    }
    void load();
  }, []);
  
  // Load configured payers from settings API
  useEffect(() => {
    async function loadConfigured() {
      try {
        const response = await fetch("/api/settings/payers");
        if (response.ok) {
          const data = await response.json();
          setConfiguredPayers(data.payers || []);
        }
      } catch (err) {
        console.error("Failed to load configured payers:", err);
      } finally {
        setConfigLoading(false);
      }
    }
    loadConfigured();
  }, []);
  
  // Search Availity payers
  const searchAvailityPayers = async () => {
    if (!availitySearch.trim()) {
      setAvailityResults([]);
      return;
    }
    
    setAvailityLoading(true);
    setAvailityError(null);
    
    try {
      const params = new URLSearchParams({
        mock: "true",
        payerName: availitySearch,
        ...(stateFilter && { state: stateFilter }),
      });
      
      const response = await fetch(`/api/integrations/availity/payers?${params}`);
      const data = await response.json();
      
      if (data.ok) {
        setAvailityResults((data.payers || []) as AvailityPayer[]);
      } else {
        setAvailityError(data.error || "Search failed");
      }
    } catch (err) {
      setAvailityError(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setAvailityLoading(false);
    }
  };
  
  // Add payer to configuration
  const addPayerConfig = async (payer: AvailityPayer) => {
    setAddingPayer(payer.payerId);
    try {
      const response = await fetch("/api/settings/payers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: "00000000-0000-0000-0000-000000000000", // TODO: Use actual org ID from auth context
          payer_id: payer.payerId,
          payer_name: payer.payerName,
          payer_aliases: payer.aliases || [],
          supported_transactions: payer.supportedTransactions || [],
          states: payer.states || [],
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfiguredPayers([...configuredPayers, data.payer]);
        setSelectedPayers(new Set([...selectedPayers, payer.payerId]));
        // Optionally clear search
        setAvailitySearch("");
        setAvailityResults([]);
      } else {
        const error = await response.json();
        setAvailityError(error.error || "Failed to add payer");
      }
    } catch (err) {
      setAvailityError(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setAddingPayer(null);
    }
  };

  const prepareMockEligibility = async (payer: ConfiguredPayer) => {
    setPreparingEligibilityByPayer((prev) => ({ ...prev, [payer.id]: true }));
    setEligibilityErrorsByPayer((prev) => {
      const next = { ...prev };
      delete next[payer.id];
      return next;
    });

    try {
      const response = await fetch("/api/eligibility/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: payer.organization_id || "00000000-0000-0000-0000-000000000000",
          patient_id: null,
          payer_configuration_id: payer.id,
          provider_npi: "1234567893",
          subscriber_id: "MOCK-SUB-001",
          subscriber_first_name: "Alex",
          subscriber_last_name: "Johnson",
          subscriber_dob: "1988-02-14",
          patient_first_name: "Alex",
          patient_last_name: "Johnson",
          patient_dob: "1988-02-14",
          request_mode: "mock",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.result) {
        throw new Error(data?.error || "Failed to prepare eligibility request");
      }

      setEligibilityResultsByPayer((prev) => ({
        ...prev,
        [payer.id]: data.result as EligibilityPrepareResult,
      }));
    } catch (err) {
      setEligibilityErrorsByPayer((prev) => ({
        ...prev,
        [payer.id]: err instanceof Error ? err.message : "Failed to prepare eligibility request",
      }));
    } finally {
      setPreparingEligibilityByPayer((prev) => ({ ...prev, [payer.id]: false }));
    }
  };

  const filtered = payers.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (p.payer_name ?? "").toLowerCase().includes(q) ||
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
              <p className="mt-2 text-sm text-slate-600">Payer records, search, and policy relationships. Configure Availity payers for claims and eligibility workflows.</p>
            </div>
          </div>
          
          {/* Availity Payer Search Section */}
          <div className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
            <h2 className="text-lg font-black text-indigo-950">Search & Add Availity Payers</h2>
            <p className="mt-1 text-sm text-indigo-700">Search for payers from the Availity directory and add them to your organization configuration.</p>
            
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-indigo-900">Payer Name</label>
                <input
                  type="text"
                  placeholder="e.g., Aetna, United, Cigna..."
                  value={availitySearch}
                  onChange={(e) => setAvailitySearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchAvailityPayers()}
                  className="mt-1 w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-indigo-900">State</label>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">All States</option>
                  <option value="CO">Colorado</option>
                  <option value="WY">Wyoming</option>
                  <option value="NM">New Mexico</option>
                  <option value="UT">Utah</option>
                  <option value="ID">Idaho</option>
                  <option value="MT">Montana</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={searchAvailityPayers}
                  disabled={!availitySearch.trim() || availityLoading}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                >
                  {availityLoading ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
            
            {/* Availity Search Results */}
            {availityError && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                {availityError}
              </div>
            )}
            
            {availityResults.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold text-indigo-900">Results ({availityResults.length})</h3>
                <div className="mt-3 space-y-2">
                  {availityResults.map((payer) => (
                    <div
                      key={payer.payerId}
                      className="flex items-start justify-between rounded-lg border border-white bg-white p-3 shadow-sm"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{payer.payerName}</div>
                        <div className="text-xs text-slate-600">ID: {payer.payerId}</div>
                        {payer.states && payer.states.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {payer.states.map((state) => (
                              <span
                                key={state}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"
                              >
                                {state}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => addPayerConfig(payer)}
                        disabled={addingPayer === payer.payerId || selectedPayers.has(payer.payerId)}
                        className="ml-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                      >
                        {addingPayer === payer.payerId ? "Adding..." : selectedPayers.has(payer.payerId) ? "Added" : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Configured Payers Section */}
          {!configLoading && configuredPayers.length > 0 && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
              <h2 className="text-lg font-black text-emerald-950">Configured Payers ({configuredPayers.length})</h2>
              <p className="mt-1 text-sm text-emerald-700">These payers are configured for your organization.</p>
              
              <div className="mt-4 space-y-2">
                {configuredPayers.map((payer) => (
                  <div
                    key={payer.id}
                    className="flex items-start justify-between rounded-lg border border-white bg-white p-3 shadow-sm"
                  >
                    <div className="w-full">
                      <div className="font-semibold text-slate-900">{payer.payer_name}</div>
                      <div className="text-xs text-slate-600">ID: {payer.payer_id}</div>
                      {payer.states && payer.states.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {payer.states.map((state) => (
                            <span
                              key={state}
                              className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                            >
                              {state}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => prepareMockEligibility(payer)}
                          disabled={!!preparingEligibilityByPayer[payer.id]}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                        >
                          {preparingEligibilityByPayer[payer.id]
                            ? "Preparing..."
                            : "Prepare Mock Eligibility"}
                        </button>
                        <span className="text-xs font-semibold text-emerald-700">
                          Service Type 98 Professional Services
                        </span>
                      </div>

                      {eligibilityErrorsByPayer[payer.id] && (
                        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                          {eligibilityErrorsByPayer[payer.id]}
                        </div>
                      )}

                      {eligibilityResultsByPayer[payer.id] && (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                          <div className="font-bold">Eligibility Prepared ({eligibilityResultsByPayer[payer.id].status})</div>
                          <div className="mt-1">Eligibility status: {eligibilityResultsByPayer[payer.id].eligibilityStatus ?? "—"}</div>
                          <div>Copay: {formatCurrency(eligibilityResultsByPayer[payer.id].copayAmount)}</div>
                          <div>
                            Deductible remaining: {formatCurrency(eligibilityResultsByPayer[payer.id].deductibleRemaining)}
                          </div>
                          <div>Effective date: {eligibilityResultsByPayer[payer.id].effectiveDate ?? "—"}</div>
                          <div>Termination date: {eligibilityResultsByPayer[payer.id].terminationDate ?? "—"}</div>
                          <div>
                            Service type: {eligibilityResultsByPayer[payer.id].serviceTypeCode} {" "}
                            {eligibilityResultsByPayer[payer.id].serviceTypeDescription}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <Link
                              href={`/eligibility/requests/${eligibilityResultsByPayer[payer.id].requestId}`}
                              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                            >
                              View Eligibility Report
                            </Link>
                            <Link
                              href="/eligibility/history"
                              className="text-xs font-bold text-emerald-800 underline hover:text-emerald-900"
                            >
                              View Eligibility History
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${
                        payer.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {payer.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insurance Payers Directory */}
          <div className="mt-8">
            <h2 className="text-lg font-black text-slate-950">Insurance Payers Directory</h2>
            <p className="mt-1 text-sm text-slate-600">All payer records in the system.</p>
            
            <input
              type="text"
              placeholder="Search payers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none"
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
                        <td className="px-5 py-3 font-semibold text-slate-900">{payer.payer_name ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{payer.payer_id ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-600 capitalize">{payer.payer_type ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{payer.phone ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${payer.active_flag !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {payer.active_flag !== false ? "Active" : "Inactive"}
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
