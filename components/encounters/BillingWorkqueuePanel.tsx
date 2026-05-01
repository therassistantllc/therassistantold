"use client";

import { useState } from "react";
import type { EncounterRecord, WorkqueueItemRecord } from "@/lib/types/appointmentFirstWorkflow";
import type { EncounterReadinessResult } from "@/lib/workqueue/model";
import EncounterReadinessPanel from "@/components/encounters/EncounterReadinessPanel";

interface BillingWorkqueuePanelProps {
  encounter: EncounterRecord;
  readiness: EncounterReadinessResult;
  workqueueItems: WorkqueueItemRecord[];
}

export default function BillingWorkqueuePanel({ encounter, readiness, workqueueItems }: BillingWorkqueuePanelProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const readyToBillItem = workqueueItems.find((item) => item.queue_type === "ready_to_bill" && item.status !== "closed");
  const clinicianTickets = workqueueItems.filter((item) => item.metadata?.source === "clinician_route_to_biller" || item.clinician_message);
  const canScrub = Boolean(readyToBillItem || readiness.passed);
  const scrubPassed = encounter.billing_status === "scrub_passed" || encounter.billing_status === "claim_created";

  async function scrubEncounter() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/encounters/${encounter.id}/scrub`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to scrub encounter");
      }

      setMessage("Scrub passed. Claim can now be created from this encounter.");
      window.location.reload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to scrub encounter");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <EncounterReadinessPanel readiness={readiness} />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Billing Workqueue</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ready-to-bill means the encounter is queued for billing review. Claim creation happens after scrub.
        </p>

        <div className="mt-5 grid gap-3">
          <Info label="Ready-to-bill item" value={readyToBillItem ? "Open" : "Not open"} />
          <Info label="Billing status" value={encounter.billing_status ?? "hold"} />
          <Info label="Scrub status" value={scrubPassed ? "Passed" : "Pending"} />
          <Info label="Claim creation" value={scrubPassed ? "Allowed" : "Blocked until scrub passes"} />
        </div>

        {message ? <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">{message}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canScrub || loading || scrubPassed}
            onClick={scrubEncounter}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Scrubbing..." : scrubPassed ? "Scrub Passed" : "Scrub Encounter"}
          </button>

          <a
            href={scrubPassed ? `/claims/create?encounterId=${encounter.id}` : "#"}
            className={
              scrubPassed
                ? "rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                : "pointer-events-none rounded-xl bg-slate-300 px-4 py-2 text-sm font-bold text-white"
            }
          >
            Create Claim
          </a>
        </div>
      </section>

      <section className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">Clinician-routed Tickets</h3>
        <div className="mt-4 grid gap-3">
          {clinicianTickets.length ? (
            clinicianTickets.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <p className="font-bold text-slate-950">{item.title}</p>
                  <span className="text-sm font-bold text-slate-600">{item.priority}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.clinician_message ?? item.description}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {item.queue_type} · {item.ticket_category} · {item.status}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No clinician-routed billing tickets for this encounter.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
