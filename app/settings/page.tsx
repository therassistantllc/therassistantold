import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

const settingCards = [
  { title: "Practice setup", description: "Organization profile, operational defaults, and account-level controls.", href: "/settings/clearinghouse" },
  { title: "Billing setup", description: "Payers, service codes, claim behavior, and payment posting defaults.", href: "/billing" },
  { title: "Payers", description: "Payer records, search, and policy relationships.", href: "/insurance/payers" },
  { title: "Documentation templates", description: "Encounter notes, defaults, and signing workflow controls.", href: "/encounters/new" },
  { title: "Users and staff", description: "Role and permission assignment by staff function.", href: "/staff" },
  { title: "Patient portal settings", description: "Portal permissions, reminders, and client-facing capabilities.", href: "/patient-portal" },
  { title: "Appointment types", description: "Visit classifications, telehealth defaults, and recurrence behavior.", href: "/scheduling/new" },
  { title: "Reminder settings", description: "Email, SMS, and portal reminder lead-time controls.", href: "/scheduling/new" },
  { title: "Work schedule rules", description: "Provider availability, blocks, and enforcement constraints.", href: "/work-schedule" },
];

export default function SettingsRootPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="text-3xl font-black text-slate-950">Settings</h1>
          <p className="mt-2 text-sm text-slate-600">Administrative configuration that affects scheduling, documentation, billing, and portal workflows.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {settingCards.map((card) => (
              <Link key={card.title} href={card.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
                <p className="text-base font-black text-slate-900">{card.title}</p>
                <p className="mt-2 text-sm text-slate-600">{card.description}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-indigo-700">Open</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
