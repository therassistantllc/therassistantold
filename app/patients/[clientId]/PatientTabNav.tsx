"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "@/components/layout/AppShell.module.css";

const PATIENT_TABS = [
  { label: "Summary",      slug: "" },
  { label: "Insurance",    slug: "eligibility" },
  { label: "Billing",      slug: "balance" },
  { label: "Appointments", slug: null },
  { label: "Notes",        slug: null },
  { label: "Claims",       slug: null },
  { label: "Documents",    slug: null },
  { label: "Mail Room",    slug: null },
] as const;

export default function PatientTabNav({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgId = searchParams.get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";

  return (
    <div className={styles.patientTabs} role="navigation" aria-label="Patient chart tabs">
      {PATIENT_TABS.map(({ label, slug }) => {
        if (slug === null) {
          return (
            <span key={label} className={`${styles.patientTab} ${styles.patientTabDisabled}`} aria-disabled="true">
              {label}
            </span>
          );
        }
        const base = `/patients/${clientId}${slug ? `/${slug}` : ""}`;
        const href = orgId ? `${base}?organizationId=${encodeURIComponent(orgId)}` : base;
        const active = slug === ""
          ? pathname === `/patients/${clientId}`
          : pathname.startsWith(`/patients/${clientId}/${slug}`);
        return (
          <Link
            key={label}
            href={href}
            className={active ? `${styles.patientTab} ${styles.patientTabActive}` : styles.patientTab}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
