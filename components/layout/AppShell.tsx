// File: components/layout/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import WorkflowRail from "@/components/layout/WorkflowRail";
import { canAccessModule, roleLabel, type AppRole } from "@/lib/navigation/roles";
import { useUserRole } from "@/lib/store/userRole";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match?: string[];
  module: "scheduling" | "patients" | "billing" | "work_schedule" | "profile" | "settings" | "help" | "contact" | "patient_portal";
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: "🏠",
    module: "scheduling",
    match: ["/"],
  },
  {
    href: "/scheduling",
    label: "Scheduling",
    icon: "📅",
    module: "scheduling",
    match: ["/scheduling", "/appointments"],
  },
  {
    href: "/work-schedule",
    label: "Work schedule",
    icon: "🗓️",
    module: "work_schedule",
    match: ["/work-schedule"],
  },
  {
    href: "/patients",
    label: "Patients",
    icon: "👥",
    module: "patients",
    match: ["/patients"],
  },
  {
    href: "/encounters",
    label: "Encounters",
    icon: "📝",
    module: "patients",
    match: ["/encounters"],
  },
  {
    href: "/billing",
    label: "Billing",
    icon: "📋",
    module: "billing",
    match: ["/billing", "/claims", "/payments"],
  },
  {
    href: "/billing/workqueue",
    label: "Workqueue",
    icon: "📮",
    module: "billing",
    match: ["/billing/workqueue"],
  },
  {
    href: "/insurance/eligibility",
    label: "Eligibility",
    icon: "✅",
    module: "billing",
    match: ["/insurance/eligibility", "/billing/eligibility"],
  },
  {
    href: "/clearinghouse/transactions",
    label: "Clearinghouse",
    icon: "🔁",
    module: "settings",
    match: ["/clearinghouse", "/settings/clearinghouse"],
  },
  {
    href: "/profile",
    label: "Profile",
    icon: "🙍",
    module: "profile",
    match: ["/profile"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "⚙️",
    module: "settings",
    match: ["/settings"],
  },
  {
    href: "/patient-portal",
    label: "Patient Portal",
    icon: "🧾",
    module: "patient_portal",
    match: ["/patient-portal"],
  },
  {
    href: "/help",
    label: "Help",
    icon: "❓",
    module: "help",
    match: ["/help"],
  },
  {
    href: "/contact-us",
    label: "Contact Us",
    icon: "☎️",
    module: "contact",
    match: ["/contact-us"],
  },
];

const launchTools: NavItem[] = [
  {
    href: "/billing/workqueue?work_type=mailroom_review",
    label: "Gmail AI queue",
    icon: "📬",
  },
  {
    href: "/billing/payment-postings",
    label: "Payment posting",
    icon: "🧾",
  },
  {
    href: "/billing/payment-imports",
    label: "835 imports",
    icon: "💵",
  },
  {
    href: "/billing/denials",
    label: "Denials",
    icon: "⛔",
  },
  {
    href: "/billing/rejections",
    label: "Rejections",
    icon: "⚠️",
  },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/") {
    return pathname === "/";
  }

  return item.match?.some((path) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

function getMobileValue(pathname: string) {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.href;

  const matched = navItems.find((item) => isActive(pathname, item));
  return matched?.href ?? "/";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useUserRole((state) => state.role) as AppRole;
  const visibleNavItems = navItems.filter((item) => canAccessModule(role, item.module));

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
            <p className="mt-2 text-xs font-semibold text-slate-500">{roleLabel(role)}</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {visibleNavItems.map((item) => {
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
                {launchTools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="text-sm font-bold text-indigo-700 hover:text-indigo-900"
                  >
                    <span className="mr-2">{tool.icon}</span>
                    {tool.label}
                  </Link>
                ))}
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
                value={getMobileValue(pathname)}
                onChange={(event) => {
                  router.push(event.target.value);
                }}
                className="max-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
              >
                {visibleNavItems.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.icon} {item.label}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <WorkflowRail />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}