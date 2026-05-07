"use client";

import AppShell from "@/components/layout/AppShell";

export default function BatchStatementsPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-2xl font-black text-slate-950">Batch Statements</h1>
          <p className="mt-2 text-sm text-slate-600">
            Generate statement runs for multiple patient accounts based on open patient responsibility.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            Configure statement batch criteria (date range, minimum balance, account filters), then generate statements for delivery.
          </div>
        </div>
      </main>
    </AppShell>
  );
}
