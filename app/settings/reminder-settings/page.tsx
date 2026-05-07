import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export default function ReminderSettingsPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link href="/settings" className="hover:text-slate-700">Settings</Link>
            <span>/</span>
            <span className="font-semibold text-slate-700">Reminder Settings</span>
          </div>
          <h1 className="text-3xl font-black text-slate-950">Reminder Settings</h1>
          <p className="mt-2 text-sm text-slate-600">Email, SMS, and portal reminder lead-time controls.</p>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-green-50 p-3 text-2xl">🔔</div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Not yet implemented</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Reminder configuration — including email/SMS lead times, portal notification defaults, and opt-out rules — will be available in a future release.
                </p>
                <Link
                  href="/settings"
                  className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Back to Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
