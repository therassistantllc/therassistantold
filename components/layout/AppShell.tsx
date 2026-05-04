"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match?: string[];
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: "🏠",
    match: ["/"],
  },
  {
    href: "/scheduling",
    label: "Scheduling",
    icon: "📅",
    match: ["/scheduling", "/appointments"],
  },
  {
    href: "/patients",
    label: "Patients",
    icon: "👥",
    match: ["/patients", "/clients"],
  },
  {
    href: "/encounters",
    label: "Encounters",
    icon: "📝",
    match: ["/encounters"],
  },
  {
    href: "/claims",
    label: "Claims",
    icon: "📋",
    match: ["/claims"],
  },
  {
    href: "/billing/workqueue",
    label: "Workqueue",
    icon: "📮",
    match: ["/billing/workqueue"],
  },
  {
    href: "/billing/workqueue?work_type=mailroom_review",
    label: "Gmail Mailroom",
    icon: "📬",
    match: ["/billing/workqueue?work_type=mailroom_review"],
  },
  {
    href: "/billing/payment-imports",
    label: "835 Imports",
    icon: "💵",
    match: ["/billing/payment-imports"],
  },
  {
    href: "/insurance/eligibility",
    label: "Eligibility",
    icon: "✅",
    match: ["/insurance/eligibility"],
  },
  {
    href: "/clearinghouse/transactions",
    label: "Clearinghouse",
    icon: "🔁",
    match: ["/clearinghouse"],
  },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/") {
    return pathname === "/";
  }

  return item.match?.some((path) => {
    const cleanPath = path.split("?")[0];
    return pathname === cleanPath || pathname.startsWith(`${cleanPath}/`);
  });
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <Link href="/" className="block">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
                TherAssistant
              </p>
              <h1 className="mt-1 text-xl font-black text-slate-950">
                EHR Command
              </h1>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const active = isActive(pathname, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm"
                      : "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Launch tools
              </p>
              <div className="mt-3 grid gap-2">
                <Link
                  href="/billing/workqueue?work_type=mailroom_review"
                  className="text-sm font-bold text-indigo-700 hover:text-indigo-900"
                >
                  View Gmail AI queue
                </Link>
                <Link
                  href="/billing/payment-imports"
                  className="text-sm font-bold text-emerald-700 hover:text-emerald-900"
                >
                  View 835 imports
                </Link>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/" className="font-black text-slate-950">
                TherAssistant
              </Link>

              <select
                value={pathname}
                onChange={(event) => {
                  window.location.href = event.target.value;
                }}
                className="max-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
              >
                {navItems.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.icon} {item.label}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}