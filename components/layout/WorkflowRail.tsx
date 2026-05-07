"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useActiveContext } from "@/lib/store/activeContext";

type WorkflowStep = {
  key: string;
  label: string;
  href: string;
};

function normalizePath(href: string) {
  return href.split("?")[0];
}

function getUniqueSteps(steps: WorkflowStep[]) {
  const seen = new Set<string>();

  return steps.filter((step) => {
    const key = normalizePath(step.href);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function WorkflowRail() {
  const { patientId, appointmentId, encounterId } = useActiveContext();

  const steps = useMemo(() => {
    const baseSteps: WorkflowStep[] = [
      { key: "calendar", label: "Calendar", href: "/scheduling" },
      ...(appointmentId
        ? [{ key: "appointment", label: "Appointment", href: `/appointments/${appointmentId}` }]
        : []),
      { key: "note", label: "Note", href: encounterId ? `/encounters/${encounterId}` : "/encounters" },
      { key: "charge", label: "Charge", href: encounterId ? `/claims/create?encounterId=${encounterId}` : "/claims/create" },
      { key: "claim", label: "Claim", href: "/claims" },
      { key: "payment", label: "Payment", href: "/billing/payment-postings" },
      {
        key: "balance",
        label: "Balance / Statement",
        href: patientId ? `/patients/${patientId}/patient-billing` : "/billing/ar",
      },
    ];

    return getUniqueSteps(baseSteps);
  }, [appointmentId, encounterId, patientId]);

  return (
    <div className="border-b border-slate-200 bg-slate-100/70">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2 lg:px-6">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Workflow</p>
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {step.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
