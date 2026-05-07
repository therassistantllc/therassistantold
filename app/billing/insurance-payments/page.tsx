"use client";

import { FormEvent, useState } from "react";
import AppShell from "@/components/layout/AppShell";

export default function InsurancePaymentsPage() {
  const [form, setForm] = useState({
    claimId: "",
    allowedAmount: "",
    paidAmount: "",
    adjustmentAmount: "",
    patientResponsibility: "",
    eobReference: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/payments/insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: form.claimId,
          allowedAmount: Number(form.allowedAmount || 0),
          paidAmount: Number(form.paidAmount || 0),
          adjustmentAmount: Number(form.adjustmentAmount || 0),
          patientResponsibility: Number(form.patientResponsibility || 0),
          eobReference: form.eobReference || null,
          note: form.note || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to post insurance payment");
      }

      setMessage(
        `Insurance payment posted. Applied ${payload.appliedAmount ?? 0}. Remaining payer balance ${payload.remainingPayerBalance ?? 0}.`,
      );
      setForm({
        claimId: "",
        allowedAmount: "",
        paidAmount: "",
        adjustmentAmount: "",
        patientResponsibility: "",
        eobReference: "",
        note: "",
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to post insurance payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <h1 className="text-2xl font-black text-slate-950">Enter Insurance Payments</h1>
          <p className="mt-2 text-sm text-slate-600">Post EOB-based allowed amounts, paid amounts, adjustments, and patient responsibility.</p>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <input value={form.claimId} onChange={(e) => setForm((c) => ({ ...c, claimId: e.target.value }))} placeholder="Claim ID" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <input value={form.allowedAmount} onChange={(e) => setForm((c) => ({ ...c, allowedAmount: e.target.value }))} placeholder="Allowed amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <input value={form.paidAmount} onChange={(e) => setForm((c) => ({ ...c, paidAmount: e.target.value }))} placeholder="Paid amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <input value={form.adjustmentAmount} onChange={(e) => setForm((c) => ({ ...c, adjustmentAmount: e.target.value }))} placeholder="Adjustment amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={form.patientResponsibility} onChange={(e) => setForm((c) => ({ ...c, patientResponsibility: e.target.value }))} placeholder="Patient responsibility" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={form.eobReference} onChange={(e) => setForm((c) => ({ ...c, eobReference: e.target.value }))} placeholder="EOB reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} placeholder="Posting notes" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} />
            <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Posting..." : "Post insurance payment"}</button>
          </form>

          {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
        </div>
      </main>
    </AppShell>
  );
}
