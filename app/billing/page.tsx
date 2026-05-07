"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

type BillingAction = {
  label: string;
  href: string;
  description: string;
};

type BillingSection = {
  title: string;
  subtitle: string;
  actions: BillingAction[];
};

const sections: BillingSection[] = [
  {
    title: "Insurance Billing",
    subtitle: "Payer-facing billing workflows.",
    actions: [
      {
        label: "Submit Claims",
        href: "/billing/scrub",
        description: "Open ready-to-submit and scrub workflows before transmission.",
      },
      {
        label: "Create CMS-1500",
        href: "/billing/cms-1500",
        description: "Generate and review paper professional claim forms.",
      },
      {
        label: "Electronic Claim History",
        href: "/billing/claim-history",
        description: "View transmission and response history log.",
      },
      {
        label: "Rejected Claims",
        href: "/billing/rejections",
        description: "Review and correct rejected submissions for resubmission.",
      },
    ],
  },
  {
    title: "Patient Billing",
    subtitle: "Patient responsibility and statement workflows.",
    actions: [
      {
        label: "Patient Balances",
        href: "/billing/ar",
        description: "Review patient responsibility balances and account-level collection tasks.",
      },
      {
        label: "Patient Statements",
        href: "/billing/patient-statements",
        description: "Generate individual patient statements from open balances.",
      },
      {
        label: "Batch Statements",
        href: "/billing/batch-statements",
        description: "Generate statements for multiple patient accounts in one run.",
      },
      {
        label: "Open Patient Accounts",
        href: "/patients",
        description: "Open chart billing tabs for patient-specific account activity.",
      },
    ],
  },
  {
    title: "Payments",
    subtitle: "Manual and electronic payment posting workflows.",
    actions: [
      {
        label: "Enter Client Payments",
        href: "/billing/client-payments",
        description: "Post patient payments and apply to open balances.",
      },
      {
        label: "Enter Insurance Payments",
        href: "/billing/insurance-payments",
        description: "Post EOB data: allowed, paid, adjustments, and patient responsibility.",
      },
      {
        label: "ERA Imports (835)",
        href: "/billing/payment-imports",
        description: "Import electronic remittance files and review matched/unmatched items.",
      },
      {
        label: "ERA Posting",
        href: "/billing/payment-postings",
        description: "Post matched ERA items to claims and resolve payment posting tasks.",
      },
    ],
  },
  {
    title: "Reports & Tools",
    subtitle: "Static outputs for billing, payment, and transaction review.",
    actions: [
      {
        label: "A/R Aging Reports",
        href: "/billing/ar",
        description: "Review aging buckets and unresolved balances.",
      },
      {
        label: "Claim Exceptions",
        href: "/billing/payment-exceptions",
        description: "Review exceptions and manual follow-up items.",
      },
      {
        label: "Denials",
        href: "/billing/denials",
        description: "Inspect denial records and route corrective actions.",
      },
      {
        label: "Transactions",
        href: "/billing/transactions",
        description: "Search transaction-oriented billing activity.",
      },
    ],
  },
];

export default function BillingPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <h1 className="text-2xl font-black text-slate-950">Billing</h1>
            <p className="mt-2 text-sm text-slate-700">
              Task-routing hub for billing workflows. Choose the function you need to perform; each action opens its own dedicated workflow page.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Workflow chain: Signed Note to Charge to Claim to Payment to Balance / Statement
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">{section.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{section.subtitle}</p>

                <div className="mt-4 space-y-3">
                  {section.actions.map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-100"
                    >
                      <p className="text-sm font-bold text-slate-900">{action.label}</p>
                      <p className="mt-1 text-xs text-slate-600">{action.description}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This page intentionally routes by function and does not act as a unified claim lifecycle dashboard or centralized denial workqueue.
          </div>
        </div>
      </main>
    </AppShell>
  );
}
