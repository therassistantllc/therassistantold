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
    icon: "📊",
    items: [
      { label: "Overview", href: "/dashboard" }
    ]
  },
  {
    id: "scheduling",
    label: "Scheduling",
    icon: "📅",
    items: [
      { label: "Calendar", href: "/scheduling" },
      { label: "Day View", href: "/scheduling/day" },
      { label: "Week View", href: "/scheduling/week" },
      { label: "Month View", href: "/scheduling/month" },
      { label: "Provider View", href: "/scheduling/provider" },
      { label: "Waitlist", href: "/scheduling/waitlist" },
      { label: "No Shows", href: "/scheduling/no-shows" },
      { label: "Recurring Appointments", href: "/scheduling/recurring" }
    ]
  },
  {
    id: "patients",
    label: "Patients",
    icon: "👥",
    items: [
      { label: "Patient Directory", href: "/patients" },
      { label: "Insurance", href: "/patients/insurance" },
      { label: "Eligibility", href: "/patients/eligibility" },
      { label: "Authorizations", href: "/patients/authorizations" },
      { label: "Documents", href: "/patients/documents" },
      { label: "Communications", href: "/patients/communications" },
      { label: "Balances", href: "/patients/balances" }
    ]
  },
  {
    id: "clinical",
    label: "Clinical",
    icon: "📋",
    items: [
      { label: "Progress Notes", href: "/clinical/notes" },
      { label: "Treatment Plans", href: "/clinical/treatment-plans" },
      { label: "Assessments", href: "/clinical/assessments" },
      { label: "Intake Forms", href: "/clinical/intake" },
      { label: "Outcome Measures", href: "/clinical/outcomes" },
      { label: "Diagnosis History", href: "/clinical/diagnoses" },
      { label: "Medication List", href: "/clinical/medications" },
      { label: "Document Templates", href: "/clinical/templates" }
    ]
  },
  {
    id: "billing",
    label: "Billing",
    icon: "💰",
    items: [
      { label: "Claim Center", href: "/billing/claims" },
      { label: "Ready to Submit", href: "/billing/ready-to-submit" },
      { label: "Submitted Claims", href: "/billing/submitted" },
      { label: "Rejections", href: "/billing/rejections" },
      { label: "Denials", href: "/billing/denials" },
      { label: "Appeals", href: "/billing/appeals" },
      { label: "Aging", href: "/billing/aging" },
      { label: "Payment Posting", href: "/billing/payment-posting" },
      { label: "Unposted Payments", href: "/billing/unposted-payments" },
      { label: "ERA Imports", href: "/billing/era-imports" },
      { label: "Patient Balances", href: "/billing/patient-balances" },
      { label: "Insurance Balances", href: "/billing/insurance-balances" },
      { label: "Refunds", href: "/billing/refunds" },
      { label: "Overpayments", href: "/billing/overpayments" },
      { label: "Recoupments", href: "/billing/recoupments" },
      { label: "Reports", href: "/billing/reports" }
    ]
  },
  {
    id: "credentialing",
    label: "Credentialing",
    icon: "🎓",
    items: [
      { label: "Providers", href: "/credentialing/providers" },
      { label: "CAQH", href: "/credentialing/caqh" },
      { label: "Payers", href: "/credentialing/payers" },
      { label: "Contracts", href: "/credentialing/contracts" },
      { label: "Recredentialing", href: "/credentialing/recredentialing" },
      { label: "Enrollment Tasks", href: "/credentialing/enrollment" },
      { label: "Directory Monitoring", href: "/credentialing/directory" }
    ]
  },
  {
    id: "operations",
    label: "Operations",
    icon: "⚙️",
    items: [
      { label: "Tickets", href: "/operations/tickets" },
      { label: "Tasks", href: "/operations/tasks" },
      { label: "Internal Notes", href: "/operations/notes" },
      { label: "Client Onboarding", href: "/operations/onboarding" },
      { label: "Work Queues", href: "/operations/queues" },
      { label: "Smart Phrases", href: "/operations/smart-phrases" },
      { label: "Templates", href: "/operations/templates" },
      { label: "Audit Logs", href: "/operations/audit" }
    ]
  },
  {
    id: "communications",
    label: "Communications",
    icon: "💬",
    items: [
      { label: "Internal Chat", href: "/communications/chat" },
      { label: "Patient Messages", href: "/communications/patient-messages" },
      { label: "Email Templates", href: "/communications/email-templates" },
      { label: "Letters", href: "/communications/letters" },
      { label: "Document History", href: "/communications/history" }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    icon: "🔧",
    items: [
      { label: "User Management", href: "/admin/users" },
      { label: "Roles & Permissions", href: "/admin/roles" },
      { label: "Practice Settings", href: "/admin/practice" },
      { label: "Billing Settings", href: "/admin/billing-settings" },
      { label: "Claim Rules", href: "/admin/claim-rules" },
      { label: "Fee Schedules", href: "/admin/fee-schedules" },
      { label: "Stripe", href: "/admin/stripe" },
      { label: "Clearinghouse", href: "/admin/clearinghouse" },
      { label: "Integrations", href: "/admin/integrations" },
      { label: "Branding", href: "/admin/branding" }
    ]
  }
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [expandedSection, setExpandedSection] = useState<string | null>("billing");

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 fixed left-0 top-16 bottom-0 overflow-y-auto">
      <nav className="p-3 space-y-1">
        {navigationSections.map((section) => {
          const isExpanded = expandedSection === section.id;
          const isActive = pathname?.startsWith(section.items[0]?.href.split('/')[1] || '');

          return (
            <div key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{section.icon}</span>
                  <span>{section.label}</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
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
                <div className="mt-1 ml-9 space-y-1">
                  {section.items.map((item) => {
                    const isItemActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-3 py-2 text-sm rounded-lg ${
                          isItemActive
                            ? "bg-blue-50 text-blue-700 font-medium"
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

      {/* Recently Viewed */}
      <div className="p-3 border-t border-gray-200 mt-4">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Recently Viewed
        </h3>
        <div className="space-y-1">
          <Link
            href="/claims/CLM-2024-0042"
            className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            CLM-2024-0042
          </Link>
          <Link
            href="/patients/PAT-001"
            className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Sarah Johnson
          </Link>
          <Link
            href="/billing/unposted-payments"
            className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Unposted Payments
          </Link>
        </div>
      </div>
    </div>
  );
}
