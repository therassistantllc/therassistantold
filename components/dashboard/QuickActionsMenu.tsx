// File: components/dashboard/QuickActionsMenu.tsx
"use client";

import Link from "next/link";

const actions = [
  { href: "/scheduling/new", label: "Add appointment" },
  { href: "/clients/new", label: "Add patient" },
  { href: "/scheduling?run=eligibility", label: "Run eligibility" },
  { href: "/claims/create", label: "Create claim" },
  { href: "/tickets", label: "Add ticket" },
  { href: "/payments", label: "Upload ERA" },
  { href: "/settings", label: "Add provider" },
];

export default function QuickActionsMenu() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
