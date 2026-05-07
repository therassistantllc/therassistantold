import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

const helpLinks = [
  { label: "Scheduling and calendar workflow", href: "/scheduling" },
  { label: "Patient chart and document workflow", href: "/patients" },
  { label: "Billing command center", href: "/billing" },
  { label: "Work schedule configuration", href: "/work-schedule" },
  { label: "Clearinghouse settings", href: "/settings/clearinghouse" },
  { label: "Contact support", href: "/contact-us" },
];

export default function HelpPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-black text-slate-950">Help</h1>
          <p className="mt-2 text-sm text-slate-600">Guided links for common THERASSISTANT workflows and operational support.</p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Operational Workflow</h2>
            <p className="mt-2 text-sm text-slate-600">Calendar → Appointment → Note → Charge → Claim → Payment → Balance / Statement</p>
          </div>

          <div className="mt-6 grid gap-3">
            {helpLinks.map((item) => (
              <Link key={item.label} href={item.href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
