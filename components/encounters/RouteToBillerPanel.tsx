"use client";

import { useState } from "react";
import type { EncounterRecord } from "@/lib/types";

type EncounterLike = EncounterRecord & {
  id: string;
};

type RouteToBillerCategory =
  | "general_billing_review"
  | "claims_denial"
  | "authorization"
  | "eligibility"
  | "payment_posting"
  | "coding_question"
  | "urgent_response";

type WorkqueuePriority = "low" | "normal" | "high" | "urgent";

const ROUTE_TO_BILLER_CATEGORIES: Array<{ value: RouteToBillerCategory; label: string }> = [
  { value: "general_billing_review", label: "General billing review" },
  { value: "claims_denial", label: "Claims denial" },
  { value: "authorization", label: "Authorization" },
  { value: "eligibility", label: "Eligibility" },
  { value: "payment_posting", label: "Payment posting" },
  { value: "coding_question", label: "Coding question" },
  { value: "urgent_response", label: "Urgent response" },
];

export default function RouteToBillerPanel({ encounter }: { encounter: EncounterLike }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<RouteToBillerCategory>("general_billing_review");
  const [priority, setPriority] = useState<WorkqueuePriority>("normal");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submitTicket() {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/encounters/${encounter.id}/route-to-biller`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, priority, message }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to route to biller");
      }

      setStatus("Workqueue ticket created and linked to this encounter.");
      setMessage("");
      setOpen(false);
      window.location.reload();
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Unable to route to biller");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:min-w-[360px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">Need billing help?</p>
          <p className="text-xs text-slate-600">Create a linked workqueue ticket.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Route to Biller
        </button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Ticket type
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as RouteToBillerCategory)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-sm font-semibold normal-case tracking-normal text-slate-950"
            >
              {ROUTE_TO_BILLER_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as WorkqueuePriority)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-sm font-semibold normal-case tracking-normal text-slate-950"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Message
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Tell billing what you need reviewed. This ticket links to the appointment, encounter, and chart."
              className="rounded-xl border border-slate-200 bg-white p-2 text-sm font-medium normal-case tracking-normal text-slate-950"
            />
          </label>

          <button
            type="button"
            onClick={submitTicket}
            disabled={saving}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating ticket..." : "Create Workqueue Ticket"}
          </button>
        </div>
      ) : null}

      {status ? <p className="mt-3 text-sm font-semibold text-slate-700">{status}</p> : null}
    </div>
  );
}
