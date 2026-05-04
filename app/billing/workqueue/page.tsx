"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { SupportTicketRecord, WorkqueueItemRecord } from "@/lib/types";
import { useActiveContext } from "@/lib/store/activeContext";

type QueueStatusFilter = "all" | "open" | "in_progress" | "blocked" | "resolved" | "closed";
type WorkqueuePayload = Record<string, unknown>;

type WorkqueueRow = Omit<WorkqueueItemRecord, "context_payload"> & {
  support_ticket?: SupportTicketRecord | null;

  appointment_id?: string | null;
  client_id?: string | null;
  claim_id?: string | null;
  encounter_id?: string | null;

  organization_id?: string | null;
  priority?: string | null;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  work_type?: string | null;
  queue_type?: string | null;
  ticket_category?: string | null;
  work_status?: string | null;

  source_object_type?: string | null;
  source_object_id?: string | null;
  context_payload?: WorkqueuePayload | string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

function getPayload(item: WorkqueueRow): WorkqueuePayload {
  if (!item.context_payload) return {};

  if (typeof item.context_payload === "string") {
    try {
      return JSON.parse(item.context_payload) as WorkqueuePayload;
    } catch {
      return {};
    }
  }

  return item.context_payload;
}

function asText(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(asNumber(value));
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function badgeClass(value?: string | null) {
  switch (value) {
    case "high":
    case "urgent":
    case "urgent_response":
    case "claims_denial":
    case "failed":
    case "angry":
      return "border-red-200 bg-red-50 text-red-700";

    case "normal":
    case "needs_review":
    case "address_change":
    case "unmatched":
    case "confused":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "low":
    case "matched":
    case "posted":
    case "parsed":
    case "positive":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "open":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "closed":
    case "resolved":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getWorkTypeLabel(workType: string): string {
  const labels: Record<string, string> = {
    eligibility_needed: "Eligibility Needed",
    ready_to_bill: "Ready to Bill",
    no_response: "No Response",
    denial_followup: "Denial Follow-up",
    payment_posting_needed: "Payment Posting",
    payment_import_review: "Payment Import Review",
    mailroom: "Mailroom Review",
    mailroom_review: "Gmail Mailroom",
    vcc_processing: "VCC Processing",
    checkin_review: "Check-in Review",
    uncategorized: "Uncategorized",
  };

  return labels[workType] || formatLabel(workType);
}

function getContextSummary(item: WorkqueueRow): string {
  const payload = getPayload(item);

  if (payload.ai_summary) {
    return asText(payload.ai_summary);
  }

  if (payload.source === "835") {
    return `835 payment ${asText(payload.imported_item_ref)} · net ${formatMoney(payload.net_amount)}`;
  }

  if (payload.from_email || payload.subject) {
    return `${asText(payload.subject, "Gmail message")} from ${asText(payload.from_email, "unknown sender")}`;
  }

  return item.description ?? "—";
}

function isGmailItem(item: WorkqueueRow) {
  const payload = getPayload(item);

  return (
    item.work_type === "mailroom_review" ||
    item.source_object_type === "mailroom_item" ||
    payload.source === "gmail" ||
    Boolean(payload.ai_summary || payload.ai_draft_reply)
  );
}

function is835Item(item: WorkqueueRow) {
  const payload = getPayload(item);

  return (
    item.work_type === "payment_import_review" ||
    item.source_object_type === "payment_import_item" ||
    payload.source === "835"
  );
}

function matchesStatus(item: WorkqueueRow, filter: QueueStatusFilter) {
  if (filter === "all") return true;
  return (item.status ?? "") === filter;
}

export default function BillingWorkqueuePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workTypeFilter = searchParams.get("work_type");

  const [items, setItems] = useState<WorkqueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filingItem, setFilingItem] = useState<WorkqueueRow | null>(null);
  const [filingDestination, setFilingDestination] = useState<string>("patient_chart");
  const [filingTargetId, setFilingTargetId] = useState<string>("");
  const [filingComments, setFilingComments] = useState<string>("");
  const [filingLoading, setFilingLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { setContext } = useActiveContext();

  async function loadQueue() {
    setLoading(true);
    setError(null);

    const { data: workqueueData, error: workqueueError } = await supabase
      .from("workqueue_items")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (workqueueError) {
      setError(workqueueError.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (workqueueData ?? []) as WorkqueueRow[];
    const workqueueIds = rows.map((row) => row.id);

    let ticketsByWorkqueueId = new Map<string, SupportTicketRecord>();

    if (workqueueIds.length > 0) {
      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .in("workqueue_item_id", workqueueIds)
        .is("archived_at", null);

      if (ticketError) {
        setError(ticketError.message);
        setItems([]);
        setLoading(false);
        return;
      }

      ticketsByWorkqueueId = new Map(
        ((ticketData ?? []) as SupportTicketRecord[])
          .filter((ticket) => ticket.workqueue_item_id)
          .map((ticket) => [ticket.workqueue_item_id as string, ticket]),
      );
    }

    const merged = rows.map((row) => ({
      ...row,
      support_ticket: ticketsByWorkqueueId.get(row.id) ?? null,
    }));

    setItems(merged);
    setLoading(false);
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  async function syncWorkqueue() {
    setSyncing(true);

    try {
      const response = await fetch("/api/workqueue/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync workqueue");
      }

      alert(`Sync complete: ${data.itemsCreated || 0} new items created`);
      await loadQueue();
    } catch (caught) {
      alert(`Sync error: ${caught instanceof Error ? caught.message : "Unknown error"}`);
    } finally {
      setSyncing(false);
    }
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const ticket = item.support_ticket;
      const payload = getPayload(item);

      const haystack = [
        item.id,
        item.title,
        item.description,
        item.work_type,
        item.queue_type,
        item.status,
        item.client_id,
        item.claim_id,
        item.encounter_id,
        ticket?.title,
        ticket?.category,
        payload.source,
        payload.ai_category,
        payload.ai_sentiment,
        payload.ai_summary,
        payload.from_email,
        payload.subject,
        payload.imported_item_ref,
        payload.payer_name,
        payload.check_or_eft_number,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesQuery = query.length === 0 || haystack.includes(query);
      const matchesWorkType = !workTypeFilter || item.work_type === workTypeFilter;

      return matchesQuery && matchesStatus(item, statusFilter) && matchesWorkType;
    });
  }, [items, search, statusFilter, workTypeFilter]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, WorkqueueRow[]>();

    filteredItems.forEach((item) => {
      const workType = item.work_type || item.queue_type || "uncategorized";
      if (!groups.has(workType)) groups.set(workType, []);
      groups.get(workType)!.push(item);
    });

    return Array.from(groups.entries()).map(([workType, groupItems]) => ({
      workType,
      items: groupItems,
      count: groupItems.length,
    }));
  }, [filteredItems]);

  function toggleGroup(workType: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(workType)) next.delete(workType);
      else next.add(workType);
      return next;
    });
  }

  function handleRowClick(item: WorkqueueRow) {
    const patientName = item.client_id ? `Patient ${item.client_id.slice(0, 8)}` : null;

    setContext({
      patientId: item.client_id ?? null,
      patientName,
      encounterId: item.encounter_id ?? null,
      encounterStatus: null,
      appointmentId: null,
      appointmentDate: null,
    });
  }

  function navigateToSource(item: WorkqueueRow) {
    if (isGmailItem(item)) {
      setFilingItem(item);
      setFilingTargetId(item.client_id || "");
      return;
    }

    if (item.encounter_id) router.push(`/encounters/${item.encounter_id}`);
    else if (item.claim_id) router.push(`/claims/${item.claim_id}`);
    else if (item.appointment_id) router.push(`/appointments/${item.appointment_id}`);
    else if (item.client_id) router.push(`/patients/${item.client_id}`);
  }

  async function handleAssign(itemId: string) {
    alert(`Assign item ${itemId} - placeholder`);
  }

  async function handleComment(itemId: string) {
    alert(`Comment on item ${itemId} - placeholder`);
  }

  async function handleDefer(itemId: string) {
    const { error: updateError } = await supabase
      .from("workqueue_items")
      .update({ status: "blocked", updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (updateError) {
      alert(`Error deferring: ${updateError.message}`);
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: "blocked" } : item)));
  }

  async function handleResolve(itemId: string) {
    const { error: updateError } = await supabase
      .from("workqueue_items")
      .update({ status: "resolved", updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (updateError) {
      alert(`Error resolving: ${updateError.message}`);
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: "resolved" } : item)));
  }

  async function handleFilingSubmit() {
    if (!filingItem) return;

    if (
      (filingDestination === "patient_chart" ||
        filingDestination === "claim" ||
        filingDestination === "encounter") &&
      !filingTargetId
    ) {
      alert("Please enter a target ID");
      return;
    }

    setFilingLoading(true);

    try {
      const response = await fetch("/api/mailroom/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailroom_item_id: filingItem.source_object_id,
          filing_destination: filingDestination,
          target_id: filingTargetId || null,
          admin_comments: filingComments,
          organization_id: filingItem.organization_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to file document");
      }

      alert("Document filed successfully");
      setFilingItem(null);
      setFilingDestination("patient_chart");
      setFilingTargetId("");
      setFilingComments("");
      await handleResolve(filingItem.id);
    } catch (caught) {
      alert(`Error: ${caught instanceof Error ? caught.message : "Unknown error"}`);
    } finally {
      setFilingLoading(false);
    }
  }

  const openCount = items.filter((item) => item.status === "open").length;
  const inProgressCount = items.filter((item) => item.status === "in_progress").length;
  const gmailCount = items.filter(isGmailItem).length;
  const paymentImportCount = items.filter(is835Item).length;

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Billing Operations</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Billing Work Queue</h1>
              <p className="mt-2 text-sm text-slate-600">
                Review Gmail mailroom items, billing exceptions, support tickets, and payment-import follow-up.
              </p>

              {workTypeFilter ? (
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2">
                  <span className="text-sm text-blue-900">
                    Filtered by: <strong>{getWorkTypeLabel(workTypeFilter)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push("/billing/workqueue")}
                    className="ml-auto text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    Clear filter
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={syncWorkqueue}
              disabled={syncing}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Workqueue"}
            </button>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <Metric label="Total loaded" value={String(items.length)} />
            <Metric label="Filtered" value={String(filteredItems.length)} />
            <Metric label="Open" value={String(openCount)} />
            <Metric label="Gmail AI" value={String(gmailCount)} />
            <Metric label="835 follow-up" value={String(paymentImportCount)} />
          </div>

          <div className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, Gmail sender, AI summary, claim, check/EFT, payer, or work type"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as QueueStatusFilter)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {loading ? (
            <EmptyState text="Loading work queue..." />
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700 shadow-sm">
              Could not load work queue: {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState text="No work queue items found." />
          ) : (
            <div className="space-y-5">
              {groupedItems.map((group) => {
                const isCollapsed = collapsedGroups.has(group.workType);

                return (
                  <section key={group.workType} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.workType)}
                      className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 text-left"
                    >
                      <div>
                        <h2 className="text-base font-black text-slate-950">{getWorkTypeLabel(group.workType)}</h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {group.count} item{group.count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="text-xl font-black text-slate-400">{isCollapsed ? "+" : "−"}</span>
                    </button>

                    {!isCollapsed ? (
                      <div className="divide-y divide-slate-100">
                        {group.items.map((item) => (
                          <WorkqueueCard
                            key={item.id}
                            item={item}
                            onAssign={handleAssign}
                            onComment={handleComment}
                            onDefer={handleDefer}
                            onResolve={handleResolve}
                            onNavigate={navigateToSource}
                            onContext={handleRowClick}
                          />
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {filingItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-black text-slate-950">File mailroom item</h2>
              <p className="mt-2 text-sm text-slate-600">
                Select where this Gmail/mailroom item should be filed after review.
              </p>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Filing destination
                  <select
                    value={filingDestination}
                    onChange={(event) => setFilingDestination(event.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <option value="patient_chart">Patient chart</option>
                    <option value="claim">Claim</option>
                    <option value="encounter">Encounter</option>
                    <option value="general_archive">General archive</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Target ID
                  <input
                    value={filingTargetId}
                    onChange={(event) => setFilingTargetId(event.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    placeholder="Client, claim, or encounter ID"
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Comments
                  <textarea
                    value={filingComments}
                    onChange={(event) => setFilingComments(event.target.value)}
                    className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    placeholder="Optional filing note"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFilingItem(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFilingSubmit}
                  disabled={filingLoading}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {filingLoading ? "Filing..." : "File item"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

function WorkqueueCard({
  item,
  onAssign,
  onComment,
  onDefer,
  onResolve,
  onNavigate,
  onContext,
}: {
  item: WorkqueueRow;
  onAssign: (itemId: string) => void;
  onComment: (itemId: string) => void;
  onDefer: (itemId: string) => void;
  onResolve: (itemId: string) => void;
  onNavigate: (item: WorkqueueRow) => void;
  onContext: (item: WorkqueueRow) => void;
}) {
  return (
    <article className="p-5 hover:bg-slate-50/60" onClick={() => onContext(item)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(item.priority)}`}>
              {item.priority ?? "normal"} priority
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(item.status)}`}>
              {item.status ?? "open"}
            </span>
            {isGmailItem(item) ? (
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                Gmail AI
              </span>
            ) : null}
            {is835Item(item) ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                835
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-base font-black text-slate-950">{item.title ?? "Untitled workqueue item"}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{getContextSummary(item)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); onAssign(item.id); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Assign
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onComment(item.id); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Comment
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDefer(item.id); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Defer
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onResolve(item.id); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
            Resolve
          </button>
        </div>
      </div>

      {isGmailItem(item) ? <GmailPanel item={item} /> : null}
      {is835Item(item) ? <Payment835Panel item={item} /> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-400">
          Created {formatDateTime(item.created_at)} · {item.work_type ?? item.queue_type ?? "uncategorized"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(item);
          }}
          className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
        >
          Open source
        </button>
      </div>
    </article>
  );
}

function GmailPanel({ item }: { item: WorkqueueRow }) {
  const payload = getPayload(item);
  const category = asText(payload.ai_category, "uncategorized");
  const sentiment = asText(payload.ai_sentiment, "unknown");
  const summary = asText(payload.ai_summary, item.description ?? "No AI summary available.");
  const draftReply = asText(payload.ai_draft_reply, "No draft reply generated yet.");
  const fromEmail = asText(payload.from_email, "Unknown sender");
  const subject = asText(payload.subject, item.title ?? "Gmail message");

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(category)}`}>
          {formatLabel(category)}
        </span>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(sentiment)}`}>
          sentiment: {sentiment}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Gmail message</p>
        <p className="mt-1 text-sm font-bold text-slate-950">{subject}</p>
        <p className="mt-1 text-xs text-slate-600">From: {fromEmail}</p>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-indigo-700">AI Summary</p>
        <p className="mt-2 text-sm leading-6 text-slate-800">{summary}</p>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">
          Draft reply
        </summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{draftReply}</p>
      </details>
    </div>
  );
}

function Payment835Panel({ item }: { item: WorkqueueRow }) {
  const payload = getPayload(item);
  const adjustments = Array.isArray(payload.adjustment_codes) ? payload.adjustment_codes : [];

  return (
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">835 payment import</p>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Info label="Claim ref" value={asText(payload.imported_item_ref)} />
        <Info label="Payer" value={asText(payload.payer_name)} />
        <Info label="Check/EFT" value={asText(payload.check_or_eft_number)} />
        <Info label="Net" value={formatMoney(payload.net_amount)} />
      </div>

      {adjustments.length > 0 ? (
        <details className="mt-3 rounded-xl border border-emerald-100 bg-white p-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">
            Adjustment codes
          </summary>
          <pre className="mt-3 overflow-x-auto text-xs text-slate-700">{JSON.stringify(adjustments, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
      {text}
    </div>
  );
}