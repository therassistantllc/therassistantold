import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

const portalFeatures = [
  "Intake forms",
  "Appointment requests",
  "Self-scheduling",
  "Document signatures",
  "Statements and payments",
  "Reminders and communication preferences",
];

export default function PatientPortalPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-3xl font-black text-slate-950">Patient Portal</h1>
          <p className="mt-2 text-sm text-slate-600">Client-facing capabilities depend on practice-level configuration and patient permissions.</p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Enabled Feature Groups</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {portalFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Administrative Controls</h2>
              <div className="mt-3 grid gap-2">
                <Link href="/settings" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
                  Open portal settings
                </Link>
                <Link href="/scheduling/new" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
                  Configure reminder defaults
                </Link>
                <Link href="/patients" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
                  Manage patient communication preferences
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
