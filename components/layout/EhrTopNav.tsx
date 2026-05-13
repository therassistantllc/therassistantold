"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/", match: ["/"] },
  { label: "Schedule", href: "/clinician/agenda", match: ["/clinician/agenda", "/schedule"] },
  { label: "Clients", href: "/patients", match: ["/patients"] },
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
    <header className="ehr-top-nav">
      <div className="ehr-top-nav-inner">
        <Link className="ehr-brand" href="/">
          <span>THERASSISTANT</span>
          <small>EHR</small>
        </Link>

        <nav className="ehr-nav-links" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.label}
              className={isActive(pathname, item) ? "ehr-nav-link ehr-nav-link-active" : "ehr-nav-link"}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
