// File: components/layout/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const topNavigation = [
  { href: "/scheduling", label: "Scheduling" },
  { href: "/patients", label: "Patients" },
  { href: "/billing", label: "Billing" },
  { href: "/work-schedule", label: "Work Schedule" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/patient-portal", label: "Patient Portal" },
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link href="/scheduling" className="text-xl font-bold">
                Therassistant
              </Link>
              <div className="mt-1 text-sm text-gray-500">
                Practice-style mental health EHR / PM
              </div>
            </div>

            <nav className="flex flex-wrap gap-2">
              {topNavigation.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "rounded-xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-gray-900 text-white"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <div>{children}</div>
    </div>
  );
}
