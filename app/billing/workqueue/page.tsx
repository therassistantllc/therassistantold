// File: app/billing/workqueue/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { SupportTicketRecord, WorkqueueItemRecord } from "@/lib/types";
import { useActiveContext } from "@/lib/store/activeContext";

type QueueStatusFilter = "all" | "open" | "in_progress" | "blocked" | "resolved" | "closed";

interface WorkqueueRow extends WorkqueueItemRecord {
  support_ticket?: SupportTicketRecord | null;
}

function matchesStatus(item: WorkqueueRow, filter: QueueStatusFilter) {
  if (filter === "all") return true;
  return (item.status ?? "") === filter;
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

  // Global Active Context
  const { setContext } = useActiveContext();

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const { data: workqueueData, error: workqueueError } = await supabase
        .from("workqueue_items")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (workqueueError) {
        setError(workqueueError.message);
        setItems([]);
        setLoading(false);
        return;
      }

      const rows = (workqueueData ?? []) as WorkqueueItemRecord[];
      const workqueueIds = rows.map((row) => row.id);

      let ticketsByWorkqueueId = new Map<string, SupportTicketRecord>();

      if (workqueueIds.length > 0) {
        const { data: ticketData, error: ticketError } = await supabase
          .from("support_tickets")
          .select("*")
          .in("workqueue_item_id", workqueueIds)
          .is("archived_at", null);

        if (!active) return;

        if (ticketError) {
          setError(ticketError.message);
          setItems([]);
          setLoading(false);
          return;
        }

        ticketsByWorkqueueId = new Map(
          ((ticketData ?? []) as SupportTicketRecord[])
            .filter((ticket) => ticket.workqueue_item_id)
            .map((ticket) => [ticket.workqueue_item_id as string, ticket])
        );
      }

      const merged = rows.map((row) => ({
        ...row,
        support_ticket: ticketsByWorkqueueId.get(row.id) ?? null,
      }));

      setItems(merged);
      setLoading(false);
    }

    void loadQueue();

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const ticket = item.support_ticket;
      const matchesQuery =
        query.length === 0 ||
        item.id.toLowerCase().includes(query) ||
        (item.title ?? "").toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query) ||
        (item.work_type ?? "").toLowerCase().includes(query) ||
        (item.status ?? "").toLowerCase().includes(query) ||
        (ticket?.title ?? "").toLowerCase().includes(query) ||
        (ticket?.category ?? "").toLowerCase().includes(query) ||
        (item.client_id ?? "").toLowerCase().includes(query) ||
        (item.claim_id ?? "").toLowerCase().includes(query) ||
        (item.encounter_id ?? "").toLowerCase().includes(query);

      const matchesWorkType = !workTypeFilter || (item.work_type === workTypeFilter);

      return matchesQuery && matchesStatus(item, statusFilter) && matchesWorkType;
    });
  }, [items, search, statusFilter, workTypeFilter]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, WorkqueueRow[]>();
    
    filteredItems.forEach((item) => {
      const workType = item.work_type || "uncategorized";
      if (!groups.has(workType)) {
        groups.set(workType, []);
      }
      groups.get(workType)!.push(item);
    });

    return Array.from(groups.entries()).map(([workType, items]) => ({
      workType,
      items,
      count: items.length,
    }));
  }, [filteredItems]);

  function toggleGroup(workType: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(workType)) {
        next.delete(workType);
      } else {
        next.add(workType);
      }
      return next;
    });
  }

  async function handleAssign(itemId: string) {
    alert(`Assign item ${itemId} - placeholder`);
  }

  async function handleComment(itemId: string) {
    alert(`Comment on item ${itemId} - placeholder`);
  }

  async function handleDefer(itemId: string) {
    const { error } = await supabase
      .from("workqueue_items")
      .update({ work_status: "deferred", updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (error) {
      alert(`Error deferring: ${error.message}`);
    } else {
      // Reload items
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, work_status: "deferred" } : item
        )
      );
    }
  }

  async function handleResolve(itemId: string) {
    const { error } = await supabase
      .from("workqueue_items")
      .update({ work_status: "completed", updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (error) {
      alert(`Error resolving: ${error.message}`);
    } else {
      // Reload items
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, work_status: "completed" } : item
        )
      );
    }
  }

  function navigateToSource(item: WorkqueueRow) {
    if (item.work_type === "mailroom") {
      // Open filing modal for mailroom items
      setFilingItem(item);
      setFilingTargetId(item.client_id || "");
      return;
    }
    
    if (item.encounter_id) {
      router.push(`/encounters/${item.encounter_id}`);
    } else if (item.claim_id) {
      router.push(`/claims/${item.claim_id}`);
    } else if (item.appointment_id) {
      router.push(`/appointments/${item.appointment_id}`);
    } else if (item.client_id) {
      router.push(`/patients/${item.client_id}`);
    }
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
      
      // Close modal and refresh items
      setFilingItem(null);
      setFilingDestination("patient_chart");
      setFilingTargetId("");
      setFilingComments("");
      
      // Remove the item from the list or mark as completed
      await handleResolve(filingItem.id);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setFilingLoading(false);
    }
  }

  function getContextSummary(item: WorkqueueRow): string {
    if (item.context_payload) {
      try {
        const payload = JSON.parse(item.context_payload);
        const keys = Object.keys(payload);
        if (keys.length > 0) {
          return keys.map((key) => `${key}: ${payload[key]}`).join(", ");
        }
      } catch {
        // ignore parse errors
      }
    }
    return "—";
  }

  function getWorkTypeLabel(workType: string): string {
    const labels: Record<string, string> = {
      eligibility_needed: "Eligibility Needed",
      ready_to_bill: "Ready to Bill",
      no_response: "No Response",
      denial_followup: "Denial Followup",
      payment_posting_needed: "Payment Posting",
      mailroom: "Mailroom Review",
      vcc_processing: "VCC Processing",
      checkin_review: "Check-in Review",
      uncategorized: "Uncategorized",
    };
    return labels[workType] || workType;
  }

  function handleRowClick(item: WorkqueueRow) {
    // Set global active context from billing workqueue item
    const patientName = item.client_id 
      ? `Patient ${item.client_id.slice(0, 8)}` 
      : null;
    
    setContext({
      patientId: item.client_id ?? null,
      patientName,
      encounterId: item.encounter_id ?? null,
      encounterStatus: null,
      // Clear appointment context since we're coming from billing
      appointmentId: null,
      appointmentDate: null,
    });
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Billing Work Queue</h1>
            <p className="mt-2 text-sm text-gray-600">
              Live queue data from workqueue_items and linked support_tickets.
            </p>
            {workTypeFilter && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <span className="text-sm text-blue-900">
                  Filtered by: <strong>{getWorkTypeLabel(workTypeFilter)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/billing/workqueue")}
                  className="ml-auto text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div>
              <div className="text-sm text-gray-500">Total loaded</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{items.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Filtered</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{filteredItems.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Open</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {items.filter((item) => item.status === "open").length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">In progress</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {items.filter((item) => item.status === "in_progress").length}
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, status, work type, client, claim, encounter, or ticket"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as QueueStatusFilter)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
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
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading work queue...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Could not load work queue: {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <div className="text-sm text-gray-500">No work queue items found.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedItems.map((group) => {
                const isCollapsed = collapsedGroups.has(group.workType);
                return (
                  <div
                    key={group.workType}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.workType)}
                      className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">
                          {getWorkTypeLabel(group.workType)}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {group.count}
                        </span>
                      </div>
                      <span className="text-gray-400">{isCollapsed ? "▼" : "▲"}</span>
                    </button>

                    {!isCollapsed && (
                      <div className="divide-y divide-gray-100">
                        {group.items.map((item) => (
                          <div key={item.id} className="p-4 hover:bg-gray-50">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => navigateToSource(item)}
                                    className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                                  >
                                    {item.title || "Untitled"}
                                  </button>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      item.priority === "high"
                                        ? "bg-red-100 text-red-700"
                                        : item.priority === "medium"
                                          ? "bg-yellow-100 text-yellow-700"
                                          : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {item.priority || "normal"}
                                  </span>
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                    {item.work_status || "queued"}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {item.description || "No description"}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                                  {item.patient_id && (
                                    <span>
                                      Patient: <span className="font-mono">{item.patient_id.slice(0, 8)}</span>
                                    </span>
                                  )}
                                  {item.encounter_id && (
                                    <span>
                                      Encounter: <span className="font-mono">{item.encounter_id.slice(0, 8)}</span>
                                    </span>
                                  )}
                                  {item.claim_id && (
                                    <span>
                                      Claim: <span className="font-mono">{item.claim_id.slice(0, 8)}</span>
                                    </span>
                                  )}
                                  {item.appointment_id && (
                                    <span>
                                      Appt: <span className="font-mono">{item.appointment_id.slice(0, 8)}</span>
                                    </span>
                                  )}
                                </div>
                                {item.context_payload && (
                                  <div className="mt-2 text-xs text-gray-500">
                                    Context: {getContextSummary(item)}
                                  </div>
                                )}
                                <div className="mt-1 text-xs text-gray-400">
                                  Created {formatDateTime(item.created_at)}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAssign(item.id)}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Assign
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleComment(item.id)}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Comment
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDefer(item.id)}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  Defer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResolve(item.id)}
                                  className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                                >
                                  Resolve
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Mailroom Filing Modal */}
      {filingItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setFilingItem(null)}
        >
          <div 
            className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">File Mailroom Document</h2>
              <button
                onClick={() => setFilingItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700">Document</div>
                <div className="mt-1 text-sm text-gray-900">{filingItem.title}</div>
                {filingItem.description && (
                  <div className="mt-1 text-xs text-gray-500">{filingItem.description}</div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Filing Destination</label>
                <select
                  value={filingDestination}
                  onChange={(e) => setFilingDestination(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="patient_chart">Patient Chart</option>
                  <option value="claim">Attach to Claim</option>
                  <option value="encounter">Attach to Encounter</option>
                  <option value="practice_documents">Practice Documents</option>
                </select>
              </div>

              {(filingDestination === "patient_chart" || 
                filingDestination === "claim" || 
                filingDestination === "encounter") && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Target ID ({filingDestination === "patient_chart" ? "Patient" : 
                               filingDestination === "claim" ? "Claim" : "Encounter"})
                  </label>
                  <input
                    type="text"
                    value={filingTargetId}
                    onChange={(e) => setFilingTargetId(e.target.value)}
                    placeholder={`Enter ${filingDestination === "patient_chart" ? "patient" : filingDestination} ID`}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Admin Comments (Optional)</label>
                <textarea
                  value={filingComments}
                  onChange={(e) => setFilingComments(e.target.value)}
                  placeholder="Add any notes about this filing..."
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setFilingItem(null)}
                disabled={filingLoading}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFilingSubmit}
                disabled={filingLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {filingLoading ? "Filing..." : "File Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
