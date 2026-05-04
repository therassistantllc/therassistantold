"use client";

import { useState } from "react";
import type { EncounterRecord, WorkqueueItemRecord } from "@/lib/types";
import type { EncounterReadinessResult } from "@/lib/workqueue/model";
import EncounterReadinessPanel from "@/components/encounters/EncounterReadinessPanel";

interface BillingWorkqueuePanelProps {
  encounter: EncounterLike;
  readiness: EncounterReadinessResult;
  workqueueItems: WorkqueueItemRecord[];
}

type WorkqueuePayload = Record<string, unknown>;

type EncounterLike = EncounterRecord & {
  billing_status?: string | null;
};

type WorkqueueLike = WorkqueueItemRecord & {
  queue_type?: string | null;
  ticket_category?: string | null;
  clinician_message?: string | null;
  work_type?: string | null;
  source_object_type?: string | null;
  source_object_id?: string | null;
  context_payload?: WorkqueuePayload | null;
  metadata?: WorkqueuePayload | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function priorityClass(priority?: string | null) {
  switch (priority) {
    case "high":
      return "border-red-200 bg-red-50 text-red-800";
    case "normal":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "low":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function categoryClass(category?: string | null) {
  switch (category) {
    case "claims_denial":
      return "bg-red-100 text-red-800";
    case "urgent_response":
      return "bg-orange-100 text-orange-800";
    case "address_change":
      return "bg-blue-100 text-blue-800";
    case "payment":
      return "bg-emerald-100 text-emerald-800";
    case "authorization":
    case "eligibility":
      return "bg-violet-100 text-violet-800";
    case "complaint":
      return "bg-rose-100 text-rose-800";
    case "clinical":
      return "bg-cyan-100 text-cyan-800";
    case "scheduling":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function BillingWorkqueuePanel({ encounter, readiness, workqueueItems }: BillingWorkqueuePanelProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const items = workqueueItems as WorkqueueLike[];

  const readyToBillItem = items.find((item) => item.queue_type === "ready_to_bill" && item.status !== "closed");

  const clinicianTickets = items.filter(
    (item) => item.metadata?.source === "clinician_route_to_biller" || item.clinician_message,
  );

  const gmailMailroomItems = items.filter((item) => {
    const payload = item.context_payload ?? item.metadata ?? {};
    return (
      item.work_type === "mailroom_review" ||
      item.source_object_type === "mailroom_item" ||
      payload.source === "gmail" ||
      Boolean(payload.ai_summary || payload.ai_draft_reply)
    );
  });

  const highPriorityGmailCount = gmailMailroomItems.filter((item) => item.priority === "high").length;
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Billing Workqueue</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review billing readiness, scrub status, Gmail mailroom items, and AI-prioritized follow-up.
            </p>
          </div>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
            {workqueueItems.length} items
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          <Info label="Ready-to-bill item" value={readyToBillItem ? "Open" : "Not open"} />
          <Info label="Billing status" value={encounter.billing_status ?? "hold"} />
          <Info label="Scrub status" value={scrubPassed ? "Passed" : "Pending"} />
          <Info label="Claim creation" value={scrubPassed ? "Allowed" : "Blocked until scrub passes"} />
          <Info label="Gmail AI items" value={`${gmailMailroomItems.length} open · ${highPriorityGmailCount} high priority`} />
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-950">AI Mailroom Workqueue</h3>
            <p className="mt-1 text-sm text-slate-600">
              Gmail messages routed into mailroom with AI category, sentiment, summary, and draft reply.
            </p>
          </div>

          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            {gmailMailroomItems.length} Gmail AI items
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          {gmailMailroomItems.length ? (
            gmailMailroomItems.map((item) => {
              const payload = item.context_payload ?? item.metadata ?? {};
              const category = asText(payload.ai_category, "uncategorized");
              const sentiment = asText(payload.ai_sentiment, "unknown");
              const summary = asText(payload.ai_summary, item.description ?? "No AI summary available.");
              const draftReply = asText(payload.ai_draft_reply, "No draft reply generated yet.");
              const fromEmail = asText(payload.from_email, "Unknown sender");
              const subject = asText(payload.subject, item.title ?? "Gmail message");

              return (
                <article
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityClass(item.priority)}`}>
                          {item.priority ?? "normal"} priority
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${categoryClass(category)}`}>
                          {formatLabel(category)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                          sentiment: {sentiment}
                        </span>
                      </div>

                      <h4 className="mt-3 text-base font-extrabold text-slate-950">{subject}</h4>
                      <p className="mt-1 text-sm text-slate-600">From: {fromEmail}</p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-indigo-700">AI Summary</p>
                    <p className="mt-2 text-sm leading-6 text-slate-800">{summary}</p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Draft Reply</p>
                      <span className="text-xs font-semibold text-slate-400">Review before sending</span>
                    </div>

                    <textarea
                      className="mt-3 min-h-36 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                      defaultValue={draftReply}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                    >
                      Review Reply
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Open Mailroom Item
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Mark Reviewed
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No Gmail AI mailroom items are currently open.
            </p>
          )}
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