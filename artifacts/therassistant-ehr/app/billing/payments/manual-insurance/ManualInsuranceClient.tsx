"use client";

/**
 * Manual insurance posting workspace (PP-3, Task #109).
 *
 * Lets a biller key in a paper EOB / VCC / payer-portal payment, optionally
 * link a Mailroom item (or attach one inline), preview the balance check,
 * then commit through the PP-1 posting engine.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

interface ClaimRow {
  id: string;
  claim_number: string | null;
  patient_account_number: string | null;
  patient_id: string | null;
  payer_profile_id: string | null;
  claim_status: string | null;
  total_charge_amount: number | null;
  date_of_service_from: string | null;
}

interface MailroomItem {
  id: string;
  fileName: string;
  documentType: string;
  status: string;
}

interface PostResult {
  ok: boolean;
  blocked?: boolean;
  validation?: { blocking: Array<{ code: string; message: string }>; warning: Array<{ code: string; message: string }> };
  errors?: Array<{ field: string; message: string }>;
  result?: { effects: unknown[]; auditLogIds: string[]; patientInvoiceCreated: boolean };
  mailroomItemId?: string | null;
  error?: string;
}

function money(n: number | null | undefined) {
  return `$${(Number(n ?? 0)).toFixed(2)}`;
}

export default function ManualInsuranceClient() {
  const orgId = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "";

  const [search, setSearch] = useState("");
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRow | null>(null);

  const [mailroom, setMailroom] = useState<MailroomItem[]>([]);
  const [mailroomItemId, setMailroomItemId] = useState<string>("");

  const [eobReference, setEobReference] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paid, setPaid] = useState("");
  const [adj, setAdj] = useState("");
  const [pr, setPr] = useState("");
  const [note, setNote] = useState("");

  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);

  const loadClaims = useCallback(async () => {
    setLoadingClaims(true);
    try {
      const url = new URL("/api/billing/payments/claim-search", window.location.origin);
      url.searchParams.set("organizationId", orgId);
      if (search) url.searchParams.set("q", search);
      const r = await fetch(url.toString());
      const j = await r.json();
      setClaims(j.claims ?? []);
    } finally {
      setLoadingClaims(false);
    }
  }, [orgId, search]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/mailroom/items?organizationId=${encodeURIComponent(orgId)}&status=active&limit=50`);
      const j = await r.json();
      setMailroom(j.items ?? []);
    })();
  }, [orgId]);

  const variance = useMemo(() => {
    const charge = Number(selectedClaim?.total_charge_amount ?? 0);
    const total = Number(paid || 0) + Number(adj || 0) + Number(pr || 0);
    return Math.round((total - charge) * 100) / 100;
  }, [paid, adj, pr, selectedClaim]);

  const canPost = selectedClaim && Number(paid || 0) + Number(adj || 0) + Number(pr || 0) > 0 && !posting;

  async function submit(dryRun: boolean) {
    if (!selectedClaim) return;
    setPosting(true);
    setResult(null);
    try {
      const r = await fetch("/api/billing/payments/manual-insurance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          professionalClaimId: selectedClaim.id,
          clientId: selectedClaim.patient_id,
          payerPaymentAmount: Number(paid || 0),
          contractualAdjustmentAmount: Number(adj || 0),
          patientResponsibilityAmount: Number(pr || 0),
          totalChargeAmount: selectedClaim.total_charge_amount,
          checkOrEftNumber: checkNumber || null,
          paymentDate,
          eobReference: eobReference || null,
          mailroomItemId: mailroomItemId || null,
          payerProfileId: selectedClaim.payer_profile_id,
          note: note || null,
          dryRun,
        }),
      });
      const j: PostResult = await r.json();
      setResult(j);
      if (!dryRun && j.ok) {
        setPaid("");
        setAdj("");
        setPr("");
        setEobReference("");
        setCheckNumber("");
        setNote("");
        setMailroomItemId("");
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-800">
      <header className="flex h-12 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <a href="/billing/payments" className="text-[12px] font-medium text-slate-500 hover:text-slate-800">
          ← Payments
        </a>
        <span className="text-[13px] font-semibold tracking-tight text-slate-900">Manual insurance posting</span>
        <span className="text-[11px] text-slate-400">Paper EOB / VCC / payer portal</span>
      </header>

      <div className="grid flex-1 grid-cols-[2fr_3fr] gap-0 overflow-hidden">
        {/* LEFT: claim search */}
        <div className="flex h-full flex-col overflow-hidden border-r border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-7 w-full rounded border border-slate-300 bg-white pl-8 pr-2 text-[12px]"
                placeholder="Search claim # or patient acct"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadClaims();
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void loadClaims()}
              className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-300 bg-white px-2 text-[11px] hover:bg-slate-50"
            >
              <RefreshCw className={`h-3 w-3 ${loadingClaims ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 text-left">Claim</th>
                  <th className="px-3 py-1.5 text-left">Status</th>
                  <th className="px-3 py-1.5 text-right">Charge</th>
                  <th className="px-3 py-1.5 text-left">DOS</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedClaim(c)}
                    className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                      selectedClaim?.id === c.id ? "bg-indigo-50" : ""
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-[11px]">{c.claim_number ?? c.id.slice(0, 8)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{c.claim_status}</td>
                    <td className="px-3 py-1.5 text-right">{money(c.total_charge_amount)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{c.date_of_service_from ?? "—"}</td>
                  </tr>
                ))}
                {claims.length === 0 && !loadingClaims ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[11px] text-slate-400">
                      No claims found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: posting form */}
        <div className="flex h-full flex-col overflow-auto bg-white p-5">
          {!selectedClaim ? (
            <div className="m-auto text-[12px] text-slate-400">Select a claim from the left to begin posting.</div>
          ) : (
            <>
              <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-[12px]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{selectedClaim.claim_number ?? selectedClaim.id}</div>
                    <div className="text-[11px] text-slate-500">
                      Charge {money(selectedClaim.total_charge_amount)} · DOS {selectedClaim.date_of_service_from ?? "—"}
                    </div>
                  </div>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] uppercase">{selectedClaim.claim_status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Check / EFT #">
                  <input className="input" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
                </Field>
                <Field label="Payment date">
                  <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </Field>
                <Field label="EOB reference">
                  <input className="input" value={eobReference} onChange={(e) => setEobReference(e.target.value)} />
                </Field>
                <Field label="Mailroom item (optional)">
                  <select className="input" value={mailroomItemId} onChange={(e) => setMailroomItemId(e.target.value)}>
                    <option value="">— None —</option>
                    {mailroom.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fileName} · {m.documentType}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Insurance paid">
                  <input type="number" step="0.01" className="input" value={paid} onChange={(e) => setPaid(e.target.value)} />
                </Field>
                <Field label="Contractual adjustment">
                  <input type="number" step="0.01" className="input" value={adj} onChange={(e) => setAdj(e.target.value)} />
                </Field>
                <Field label="Patient responsibility">
                  <input type="number" step="0.01" className="input" value={pr} onChange={(e) => setPr(e.target.value)} />
                </Field>
                <Field label="Note">
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              </div>

              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
                Total entered = {money(Number(paid || 0) + Number(adj || 0) + Number(pr || 0))} · Charge ={" "}
                {money(selectedClaim.total_charge_amount)} · Variance ={" "}
                <span className={Math.abs(variance) > 0.01 ? "font-bold text-rose-600" : "text-emerald-700"}>
                  {money(variance)}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={!canPost}
                  onClick={() => submit(true)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-[12px] hover:bg-slate-50 disabled:opacity-50"
                >
                  Preview (dry run)
                </button>
                <button
                  type="button"
                  disabled={!canPost}
                  onClick={() => submit(false)}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {posting ? "Posting…" : "Post payment"}
                </button>
              </div>

              {result ? (
                <div
                  className={`mt-4 rounded border p-3 text-[12px] ${
                    result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 font-semibold">
                    {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {result.ok ? "Posting succeeded" : result.blocked ? "Blocked by validation" : "Posting failed"}
                  </div>
                  {result.validation?.blocking?.length ? (
                    <ul className="ml-4 list-disc">
                      {result.validation.blocking.map((b) => (
                        <li key={b.code}>{b.message}</li>
                      ))}
                    </ul>
                  ) : null}
                  {result.validation?.warning?.length ? (
                    <div className="mt-1 text-amber-800">
                      Warnings:
                      <ul className="ml-4 list-disc">
                        {result.validation.warning.map((w) => (
                          <li key={w.code}>{w.message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.errors?.length ? (
                    <ul className="ml-4 list-disc">
                      {result.errors.map((e, i) => (
                        <li key={i}>{e.message}</li>
                      ))}
                    </ul>
                  ) : null}
                  {result.result?.auditLogIds?.length ? (
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-700">
                      <FileText className="h-3 w-3" /> Audit ids: {result.result.auditLogIds.join(", ")}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
      <style jsx>{`
        .input {
          height: 28px;
          width: 100%;
          padding: 0 8px;
          border: 1px solid rgb(203 213 225);
          border-radius: 4px;
          background: white;
          font-size: 12px;
          color: rgb(15 23 42);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-slate-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
