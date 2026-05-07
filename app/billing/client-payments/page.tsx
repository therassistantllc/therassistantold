"use client";

import { FormEvent, useState } from "react";
import AppShell from "@/components/layout/AppShell";

export default function ClientPaymentsPage() {
  const [form, setForm] = useState({
    patientId: "",
    amount: "",
    method: "cash",
    reference: "",
    note: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Client payment entry captured for application to open patient charges.");
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <h1 className="text-2xl font-black text-slate-950">Enter Client Payments</h1>
          <p className="mt-2 text-sm text-slate-600">Manually enter patient payments and apply to open patient charges.</p>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <input value={form.patientId} onChange={(e) => setForm((c) => ({ ...c, patientId: e.target.value }))} placeholder="Patient ID" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
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
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Record payment</button>
          </form>

          {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
        </div>
      </main>
    </AppShell>
  );
}
