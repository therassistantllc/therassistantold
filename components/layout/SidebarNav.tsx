"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface NavSection {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "D",
    items: [{ label: "Overview", href: "/dashboard" }],
  },
  {
    id: "scheduling",
    label: "Scheduling",
    icon: "S",
    items: [{ label: "Calendar", href: "/scheduling" }],
  },
  {
    id: "patients",
    label: "Patients",
    icon: "P",
    items: [{ label: "Patient Directory", href: "/patients" }],
  },
  {
    id: "billing",
    label: "Billing",
    icon: "B",
    items: [
      { label: "Claim Center", href: "/billing/claims" },
      { label: "Payment Center", href: "/billing/payment-posting" },
      { label: "Payments", href: "/billing/payments" },
    ],
  },
  {
    id: "credentialing",
    label: "Credentialing",
    icon: "C",
    items: [{ label: "Providers", href: "/credentialing/providers" }],
  },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [expandedSection, setExpandedSection] = useState<string | null>("billing");

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <div className="fixed bottom-0 left-0 top-16 w-64 overflow-y-auto border-r border-gray-200 bg-white">
      <nav className="space-y-1 p-3">
        {navigationSections.map((section) => {
          const isExpanded = expandedSection === section.id;
          const sectionPrefix = `/${section.items[0]?.href.split("/")[1] || ""}`;
          const isActive = pathname?.startsWith(sectionPrefix);

          return (
            <div key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                } flex items-center justify-between`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{section.icon}</span>
                  <span>{section.label}</span>
                </div>
                <svg
                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {isExpanded && (
                <div className="ml-9 mt-1 space-y-1">
                  {section.items.map((item) => {
                    const isItemActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block rounded-lg px-3 py-2 text-sm ${
                          isItemActive
                            ? "bg-blue-50 font-medium text-blue-700"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-gray-200 p-3">
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Recently Viewed
        </h3>
        <div className="space-y-1">
          <Link
            href="/claims/11111111-1111-1111-1111-111111111111"
            className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            CLM-2024-0042
          </Link>
          <Link
            href="/patients"
            className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Sarah Johnson
          </Link>
          <Link
            href="/billing/payment-posting"
            className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Payment Center
          </Link>
        </div>
      </div>
    </div>
  );
}
