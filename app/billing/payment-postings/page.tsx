"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { PaymentPostingRecord, WorkqueueItemRecord } from "@/lib/types";

type PaymentImportItemRow = {
  id: string;
  organization_id: string;
  payment_import_status: string | null;
  imported_item_ref: string | null;
  payment_date: string | null;
  claim_id: string | null;
  client_id: string | null;
  net_amount: number | string | null;
  unapplied_amount: number | string | null;
  posting_ready: boolean | null;
  match_status: string | null;
  match_reason: string | null;
  raw_item_payload: Record<string, unknown> | null;
  original_file_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at?: string | null;
};

type PostingQueueRow = Pick<WorkqueueItemRecord, "id" | "source_object_id" | "status" | "priority" | "title" | "description" | "created_at">;

function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
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

function asNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export default function BillingPaymentPostingsPage() {
  const [importItems, setImportItems] = useState<PaymentImportItemRow[]>([]);
  const [postings, setPostings] = useState<PaymentPostingRecord[]>([]);
  const [queueItems, setQueueItems] = useState<PostingQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postingItemId, setPostingItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PaymentImportItemRow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    const [itemsResp, postingsResp, queueResp] = await Promise.all([
      supabase
        .from("payment_import_items")
        .select("id, organization_id, payment_import_status, imported_item_ref, payment_date, claim_id, client_id, net_amount, unapplied_amount, posting_ready, match_status, match_reason, raw_item_payload, original_file_name, created_at, updated_at, archived_at")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payment_postings")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("workqueue_items")
        .select("id, source_object_id, status, priority, title, description, created_at")
        .eq("work_type", "payment_posting_needed")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const firstError = itemsResp.error ?? postingsResp.error ?? queueResp.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setImportItems((itemsResp.data ?? []) as PaymentImportItemRow[]);
    setPostings((postingsResp.data ?? []) as PaymentPostingRecord[]);
    setQueueItems((queueResp.data ?? []) as PostingQueueRow[]);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function loadActive() {
      setLoading(true);
      await loadData();
    }

    void loadActive();
    return () => {
      active = false;
    };
  }, []);

  async function handlePostPayment(itemId: string) {
    setPostingItemId(itemId);
    setActionMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/payments/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentImportItemId: itemId }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to post payment");
      }

      setActionMessage(payload.reused ? "Payment posting already existed." : "Payment posted successfully.");
      setSelectedItem(null);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to post payment");
    } finally {
      setPostingItemId(null);
    }
  }

  const postingByImportItemId = useMemo(() => {
    return new Map(
      postings
        .filter((posting) => posting.payment_import_item_id)
        .map((posting) => [posting.payment_import_item_id as string, posting]),
    );
  }, [postings]);

  const pendingItems = useMemo(() => {
    return importItems.filter((item) => item.posting_ready && !postingByImportItemId.has(item.id));
  }, [importItems, postingByImportItemId]);

  const totals = useMemo(() => {
    return {
      pendingCount: pendingItems.length,
      queueCount: queueItems.filter((item) => item.status !== "resolved" && item.status !== "closed").length,
      postedCount: postings.length,
      pendingAmount: pendingItems.reduce((sum, item) => sum + asNumber(item.net_amount), 0),
      postedAmount: postings.reduce((sum, item) => sum + asNumber(item.total_posted_amount), 0),
    };
  }, [pendingItems, postings, queueItems]);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Billing</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Payment Posting</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Review ready-to-post ERA items, open payment posting queue work, and posted payment records in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/billing/payment-imports" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">
                835 imports
              </Link>
              <Link href="/billing/workqueue?work_type=payment_posting_needed" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800">
                Posting work queue
              </Link>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <Metric label="Ready to post" value={String(totals.pendingCount)} />
            <Metric label="Posting queue" value={String(totals.queueCount)} />
            <Metric label="Posted records" value={String(totals.postedCount)} />
            <Metric label="Pending amount" value={formatMoney(totals.pendingAmount)} />
            <Metric label="Posted amount" value={formatMoney(totals.postedAmount)} />
          </div>

          {actionMessage ? (
            <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
              {actionMessage}
            </div>
          ) : null}

          {loading ? (
            <EmptyState text="Loading payment posting workspace..." />
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700 shadow-sm">
              Could not load payment posting workspace: {error}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-lg font-black text-slate-950">Ready To Post</h2>
                  <p className="mt-1 text-sm text-slate-600">Matched import items waiting for payment posting.</p>
                </div>

                <div className="divide-y divide-slate-100">
                  {pendingItems.length === 0 ? (
                    <EmptyState text="No ready-to-post payment items found." compact />
                  ) : (
                    pendingItems.map((item) => (
                      <div key={item.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">{item.imported_item_ref ?? item.id}</p>
                            <p className="mt-1 text-sm text-slate-600">{item.original_file_name ?? "Imported ERA item"}</p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Net payment</p>
                            <p className="mt-1 text-lg font-black text-slate-950">{formatMoney(item.net_amount)}</p>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-4">
                          <Info label="Claim" value={item.claim_id ?? "No claim"} mono />
                          <Info label="Client" value={item.client_id ?? "No client"} mono />
                          <Info label="Payment date" value={formatDateTime(item.payment_date)} />
                          <Info label="Match status" value={item.match_status ?? "—"} />
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-slate-500">{item.match_reason ?? "Matched and ready for posting."}</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedItem(item)}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100"
                            >
                              Review details
                            </button>
                            <button
                              type="button"
                              onClick={() => void handlePostPayment(item.id)}
                              disabled={postingItemId === item.id}
                              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {postingItemId === item.id ? "Posting..." : "Post payment now"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <div className="grid gap-6">
                <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-lg font-black text-slate-950">Posting Queue</h2>
                    <p className="mt-1 text-sm text-slate-600">Open workqueue items specifically for payment posting.</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {queueItems.length === 0 ? (
                      <EmptyState text="No payment posting workqueue items found." compact />
                    ) : (
                      queueItems.map((item) => (
                        <div key={item.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-950">{item.title ?? "Payment posting needed"}</p>
                              <p className="mt-1 text-sm text-slate-600">{item.description ?? item.source_object_id ?? "—"}</p>
                            </div>
                            <div className="text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                              <p>{item.status ?? "open"}</p>
                              <p className="mt-1">{item.priority ?? "medium"}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Created {formatDateTime(item.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-lg font-black text-slate-950">Recently Posted</h2>
                    <p className="mt-1 text-sm text-slate-600">Latest rows from the payment_postings table.</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {postings.length === 0 ? (
                      <EmptyState text="No payment postings found yet." compact />
                    ) : (
                      postings.slice(0, 8).map((posting) => (
                        <div key={posting.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-950">{posting.posting_reference ?? posting.id}</p>
                              <p className="mt-1 text-sm text-slate-600">{posting.note ?? posting.payment_import_item_id ?? "—"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-950">{formatMoney(posting.total_posted_amount)}</p>
                              <p className="mt-1 text-xs text-slate-500">{posting.posting_status ?? "—"}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Posted {formatDateTime(posting.posted_at ?? posting.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        {selectedItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-4xl rounded-3xl bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Payment review</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedItem.imported_item_ref ?? selectedItem.id}</h2>
                  <p className="mt-2 text-sm text-slate-600">Review matched ERA details before creating the payment posting.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-6 px-6 py-6 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Info label="Claim" value={selectedItem.claim_id ?? "No claim"} mono />
                    <Info label="Client" value={selectedItem.client_id ?? "No client"} mono />
                    <Info label="Net amount" value={formatMoney(selectedItem.net_amount)} />
                    <Info label="Unapplied" value={formatMoney(selectedItem.unapplied_amount)} />
                    <Info label="Payment date" value={formatDateTime(selectedItem.payment_date)} />
                    <Info label="Import status" value={selectedItem.payment_import_status ?? "—"} />
                    <Info label="Match status" value={selectedItem.match_status ?? "—"} />
                    <Info label="Source file" value={selectedItem.original_file_name ?? "—"} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Match reason</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{selectedItem.match_reason ?? "Matched and ready for posting."}</p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedItem(null)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePostPayment(selectedItem.id)}
                      disabled={postingItemId === selectedItem.id}
                      className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {postingItemId === selectedItem.id ? "Posting..." : "Post payment now"}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Raw ERA payload</p>
                  <pre className="mt-3 max-h-[420px] overflow-auto text-xs text-slate-50">
                    {JSON.stringify(selectedItem.raw_item_payload ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
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

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 break-all text-sm font-semibold text-slate-950 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div className={compact ? "px-5 py-8 text-sm text-slate-500" : "rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm"}>{text}</div>;
}