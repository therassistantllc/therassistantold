// File: app/patients/[id]/layout.tsx
"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";

const tabs = [
  { href: "", label: "Patient Info / Profile" },
  { href: "/documents", label: "Documents" },
  { href: "/billing-settings", label: "Billing Settings" },
  { href: "/patient-billing", label: "Patient Billing" },
];

function normalize(path: string) {
  return path.replace(/\/$/, "");
}

export default function PatientChartLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const base = `/patients/${patientId}`;

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const href = `${base}${tab.href}`;
              const active = normalize(pathname) === normalize(href);
              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={[
                    "rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {children}
        </div>
      </main>
    </AppShell>
  );
}
