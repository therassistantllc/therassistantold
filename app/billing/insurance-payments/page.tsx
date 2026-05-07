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
  });
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Insurance payment entry captured for claim and charge reconciliation.");
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
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Post insurance payment</button>
          </form>

          {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
        </div>
      </main>
    </AppShell>
  );
}
