// File: components/layout/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/scheduling", label: "Scheduling", icon: "📅" },
  { href: "/patients", label: "Patients", icon: "👤" },
  { href: "/encounters", label: "Encounters", icon: "📝" },
  { href: "/claims", label: "Claims", icon: "📋" },
  { href: "/billing", label: "Billing", icon: "💰" },
  { href: "/payments", label: "Payments", icon: "💳" },
  { href: "/billing/workqueue", label: "Workqueues", icon: "📮" },
  { href: "/credentialing", label: "Credentialing", icon: "🎓" },
  { href: "/settings/clearinghouse", label: "Clearinghouse", icon: "⚙️" },
];

interface AppShellProps {
  children: ReactNode;
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[var(--neutral-50)]">
      {/* Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-[var(--brand-midnight)] border-r border-[var(--brand-navy)]">
        <div className="flex h-full flex-col">
          {/* Logo/Brand */}
          <div className="border-b border-[var(--brand-navy)] px-6 py-5">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-green)] text-white font-bold text-lg">
                T
              </div>
              <div>
                <div className="text-lg font-bold text-white">THERASSISTANT</div>
                <div className="text-xs text-[var(--sidebar-text)] opacity-75">Healthcare Operations</div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                    ${
                      active
                        ? "bg-[var(--brand-navy)] text-white shadow-md"
                        : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
                    }
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="border-t border-[var(--brand-navy)] px-3 py-4">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-green)] text-xs font-bold text-white">
                DU
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">Demo User</div>
                <div className="text-xs text-[var(--sidebar-text)] opacity-75">Admin</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-[var(--header-border)] shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <input
                  type="search"
                  placeholder="Search patients, claims, appointments..."
                  className="w-96 rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm focus:border-[var(--brand-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-opacity-20"
                />
              </div>
              <div className="flex items-center gap-3">
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-600)] hover:bg-[var(--neutral-50)] transition-colors">
                  🔔
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--neutral-300)] bg-white text-[var(--neutral-600)] hover:bg-[var(--neutral-50)] transition-colors">
                  ❓
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-73px)]">{children}</main>
      </div>
    </div>
  );
}
