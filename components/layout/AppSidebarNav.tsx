"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";

type NavItem =
  | { label: string; href: string; exact?: boolean; disabled?: false }
  | { label: string; href?: undefined; disabled: true };

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", exact: true },
  { label: "Agenda", href: "/clinician/agenda" },
  { label: "Patients", href: "/patients" },
  { label: "Encounters", href: "/encounters" },
  { label: "Workqueue", href: "/workqueue" },
  { label: "Claims", href: "/billing/claim-readiness" },
  { label: "Payments", href: "/payments" },
  { label: "Mail Room", href: "/mailroom" },
  { label: "Reports", disabled: true },
  { label: "Settings", href: "/admin/provider-credentialing" },
];

export default function AppSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        if (item.disabled) {
          return (
            <span key={item.label} className={`${styles.navItem} ${styles.navItemDisabled}`} aria-disabled="true">
              {item.label}
            </span>
          );
        }
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
