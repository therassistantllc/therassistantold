"use client";

import AppShell from "@/components/layout/AppShell";

export default function BillingTransactionsPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-2xl font-black text-slate-950">Billing Transactions</h1>
          <p className="mt-2 text-sm text-slate-600">Search and review claim, payment, and statement-related transaction activity.</p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            Use this area for transaction-oriented audit review and historical lookup.
          </div>
        </div>
      </main>
    </AppShell>
  );
}
