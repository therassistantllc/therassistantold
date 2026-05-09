// File: components/layout/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { canAccessModule, roleLabel, type AppRole } from "@/lib/navigation/roles";
import { useUserRole } from "@/lib/store/userRole";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match?: string[];
  module: "scheduling" | "patients" | "billing" | "settings";
};

const navItems: NavItem[] = [
  {
    href: "/scheduling",
    label: "Calendar",
    icon: "📅",
    module: "scheduling",
    match: ["/scheduling", "/appointments"],
  },
  {
    href: "/patients",
    label: "Clients",
    icon: "👥",
    module: "patients",
    match: ["/patients", "/clients"],
  },
  {
    href: "/billing",
    label: "Billing",
    icon: "📋",
    module: "billing",
    match: ["/billing", "/claims"],
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
    href: "/settings",
    label: "Settings",
    icon: "⚙️",
    module: "settings",
    match: ["/settings"],
  },
  {
    href: "/claims",
    label: "Claims",
    icon: "🧾",
    module: "billing",
    match: ["/claims"],
  },
  {
    href: "/payments",
    label: "Payments",
    icon: "💳",
    module: "billing",
    match: ["/payments"],
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: "🎫",
    module: "settings",
    match: ["/tickets"],
  },
];

function normalizePath(href: string) {
  return href.split("?")[0];
}

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
  return matched?.href ?? "/scheduling";
}

function getUniqueNavItems(items: NavItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normalizePath(item.href);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useUserRole((state) => state.role) as AppRole;
  const visibleNavItems = getUniqueNavItems(navItems.filter((item) => canAccessModule(role, item.module)));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <Link href="/scheduling" className="block">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
                TherAssistant
              </p>
              <h1 className="mt-1 text-xl font-black text-slate-950">
                EHR
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
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/scheduling" className="font-black text-slate-950">
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

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
