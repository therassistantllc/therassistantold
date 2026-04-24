"use client";

import Link from "next/link";

const quickLinks = [
  {
    title: "Claim Center",
    description: "Review claim status, alerts, and follow-up work.",
    href: "/billing/claims",
    cta: "Open claims",
  },
  {
    title: "Payment Center",
    description: "Post and reconcile payments from one workspace.",
    href: "/billing/payment-posting",
    cta: "Open payments",
  },
  {
    title: "All Payments",
    description: "Browse payment records and posting history.",
    href: "/billing/payments",
    cta: "View payments",
  },
  {
    title: "Schedule Worklist",
    description: "Create claims from daily encounters and route to billers.",
    href: "/scheduling",
    cta: "Go to scheduling",
  },
  {
    title: "Provider Credentialing",
    description: "Check provider enrollment status before submission.",
    href: "/credentialing/providers",
    cta: "Open providers",
  },
];

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
          <p className="mt-1 text-sm text-gray-600">
            Choose a billing workflow to continue.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border bg-white p-5 hover:border-gray-300"
            >
              <div className="text-lg font-semibold text-gray-900">{link.title}</div>
              <div className="mt-2 text-sm text-gray-600">{link.description}</div>
              <div className="mt-4 text-sm font-semibold text-blue-600">{link.cta}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
