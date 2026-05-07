"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export default function PatientStatementsPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-2xl font-black text-slate-950">Patient Statements</h1>
          <p className="mt-2 text-sm text-slate-600">
            Generate statement workflows per patient account from remaining patient responsibility and open balances.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-700">
              Open a patient chart and use the patient billing area to create a statement for that account.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/patients" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Open Patients</Link>
              <Link href="/billing/batch-statements" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Batch Statements</Link>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
