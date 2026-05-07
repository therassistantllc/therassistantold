"use client";

import { FormEvent, useState } from "react";
import AppShell from "@/components/layout/AppShell";

export default function ClientPaymentsPage() {
  const [form, setForm] = useState({
    patientId: "",
    claimId: "",
    amount: "",
    method: "cash",
    reference: "",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/payments/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.patientId,
          claimId: form.claimId || null,
          amount: Number(form.amount),
          method: form.method,
          reference: form.reference || null,
          note: form.note || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to post client payment");
      }

      setMessage(
        `Client payment posted. Applied ${payload.appliedAmount ?? 0} and left ${payload.unappliedAmount ?? 0} unapplied.`,
      );
      setForm({ patientId: "", claimId: "", amount: "", method: "cash", reference: "", note: "" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to post client payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <h1 className="text-2xl font-black text-slate-950">Enter Client Payments</h1>
          <p className="mt-2 text-sm text-slate-600">Manually enter patient payments and apply to open patient charges.</p>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <input value={form.patientId} onChange={(e) => setForm((c) => ({ ...c, patientId: e.target.value }))} placeholder="Patient ID" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <input value={form.claimId} onChange={(e) => setForm((c) => ({ ...c, claimId: e.target.value }))} placeholder="Claim ID (optional for direct application)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} placeholder="Amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <select value={form.method} onChange={(e) => setForm((c) => ({ ...c, method: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="other">Other</option>
            </select>
            <input value={form.reference} onChange={(e) => setForm((c) => ({ ...c, reference: e.target.value }))} placeholder="Reference / check number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} placeholder="Notes" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} />
            <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Posting..." : "Record payment"}</button>
          </form>

          {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
        </div>
      </main>
    </AppShell>
  );
}
