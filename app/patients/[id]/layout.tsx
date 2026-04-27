// app/patients/[id]/layout.tsx
"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

type PatientLayoutProps = {
  children: ReactNode;
};

type TabDefinition = {
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function PatientLayout({ children }: PatientLayoutProps) {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const patientId = params?.id ?? "";

  const tabs: TabDefinition[] = [
    {
      label: "Overview",
      href: `/patients/${patientId}`,
      isActive: (currentPath) => currentPath === `/patients/${patientId}`,
    },
    {
      label: "Billing",
      href: `/patients/${patientId}/patient-billing`,
      isActive: (currentPath) =>
        currentPath === `/patients/${patientId}/patient-billing` ||
        currentPath.startsWith(`/patients/${patientId}/patient-billing/`),
    },
    {
      label: "Files",
      href: `/patients/${patientId}/documents`,
      isActive: (currentPath) =>
        currentPath === `/patients/${patientId}/documents` ||
        currentPath.startsWith(`/patients/${patientId}/documents/`),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/patients" className="hover:text-slate-700">
                  Patients
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-700">Patient Chart</li>
            </ol>
          </nav>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 sm:px-6">
            <div className="flex flex-wrap gap-6">
              {tabs.map((tab) => {
                const active = tab.isActive(pathname);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium transition-colors",
                      active
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-6 sm:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}