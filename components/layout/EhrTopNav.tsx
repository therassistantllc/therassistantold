"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./EhrTopNav.module.css";

const navItems = [
  { label: "Dashboard", href: "/", match: ["/"] },
  { label: "Schedule", href: "/clinician/agenda", match: ["/clinician/agenda", "/schedule"] },
  { label: "Clients", href: "/clients", match: ["/clients", "/patients"] },
  { label: "Biller Hub", href: "/billing/claim-readiness", match: ["/billing", "/workqueue", "/encounters"] },
  { label: "Mailroom", href: "/mailroom", match: ["/mailroom"] },
  { label: "Payments / Stripe", href: "/payments", match: ["/payments"] },
  { label: "Settings & Staff", href: "/admin/provider-credentialing", match: ["/admin", "/settings"] },
];

function isActive(pathname: string, item: { href: string; match: string[] }) {
  if (item.href === "/") return pathname === "/";
  return item.match.some((match) => pathname.startsWith(match));
}

export default function EhrTopNav() {
  const pathname = usePathname();

  return (
    <header className={styles.topNav}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">
          <span>THERASSISTANT</span>
          <small>EHR</small>
        </Link>

        <nav className={styles.links} aria-label="Primary navigation">
          {navItems.map((item) => {
            const className = isActive(pathname, item) ? `${styles.link} ${styles.active}` : styles.link;
            return (
              <Link key={item.label} className={className} href={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
