"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

type PaymentImportBatch = {
  id: string;
  organization_id: string;
  import_source: string;
  payment_import_status: string;
  source_file_name: string | null;
  source_file_hash: string | null;
  imported_at: string;
  total_item_count: number;
  total_amount: number;
  parse_errors_count: number;
  created_at: string;
  updated_at: string;
};

type PaymentImportItem = {
  id: string;
  organization_id: string;
  batch_id: string;
  payment_import_status: string;
  imported_item_ref: string | null;
  payment_date: string | null;
  payer_id: string | null;
  claim_id: string | null;
  client_id: string | null;
  service_line_ref: string | null;
  gross_amount: number;
  adjustment_amount: number;
  net_amount: number;
  unapplied_amount: number;
  posting_ready: boolean;
  raw_item_payload: Record<string, unknown> | null;
  original_file_name?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  file_hash?: string | null;
  parse_status?: string | null;
  parse_error?: string | null;
  parsed_at?: string | null;
  match_status?: string | null;
  match_reason?: string | null;
  matched_at?: string | null;
  created_at: string;
  updated_at: string;
};

function asText(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(asNumber(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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

function badgeClass(status?: string | null) {
  switch (status) {
    case "matched":
    case "manual_matched":
    case "ready_to_post":
    case "parsed":
    case "posted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "unmatched":
    case "needs_review":
    case "imported":
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "failed":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getPayload(item: PaymentImportItem) {
  return item.raw_item_payload ?? {};
}

function PaymentImportsPageContent() {
  const [batches, setBatches] = useState<PaymentImportBatch[]>([]);
  const [items, setItems] = useState<PaymentImportItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const needsOrganizationCreation =
    uploadError?.includes("Create an organization before importing 835 files") ?? false;

  async function loadData() {
    setLoading(true);
    setError(null);

    const { data: batchData, error: batchError } = await supabase
      .from("payment_import_batches")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (batchError) {
      setError(batchError.message);
      setBatches([]);
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("payment_import_items")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (itemError) {
      setError(itemError.message);
      setBatches((batchData ?? []) as PaymentImportBatch[]);
      setItems([]);
      setLoading(false);
      return;
    }

    setBatches((batchData ?? []) as PaymentImportBatch[]);
    setItems((itemData ?? []) as PaymentImportItem[]);

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (org?.id) {
      setOrganizationId(String(org.id));
    }

    setLoading(false);
  }

  async function createOrganizationFor835() {
    setCreatingOrganization(true);

    try {
      const response = await fetch("/api/organizations/create", {
        method: "POST",
      });

      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.organizationId) {
        throw new Error(payload.error ?? "Failed to create organization");
      }

      setOrganizationId(String(payload.organizationId));
      setUploadError(null);
      setUploadResult(
        payload.warning
          ? `Organization ready. ${String(payload.warning)}`
          : "Organization created. You can now upload 835 files.",
      );
      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreatingOrganization(false);
    }
  }

  async function upload835File(file: File | null | undefined) {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/payments/import-835", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "835 import failed");
      }

      setUploadResult(
        `Imported ${payload.summary?.claimsFound ?? 0} claim payments · ${payload.summary?.matchedClaims ?? 0} matched · ${payload.summary?.unmatchedClaims ?? 0} unmatched`,
      );

      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "835 import failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const payload = getPayload(item);

      const matchesBatch = selectedBatchId === "all" || item.batch_id === selectedBatchId;

      const matchesStatus =
        statusFilter === "all" ||
        item.match_status === statusFilter ||
        item.payment_import_status === statusFilter ||
        item.parse_status === statusFilter;

      const haystack = [
        item.id,
        item.imported_item_ref,
        item.payment_import_status,
        item.parse_status,
        item.match_status,
        item.match_reason,
        item.original_file_name,
        item.storage_path,
        item.claim_id,
        item.client_id,
        payload.payer_name,
        payload.payee_name,
        payload.check_or_eft_number,
        payload.claim_status_code,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const matchesSearch = !q || haystack.includes(q);

      return matchesBatch && matchesStatus && matchesSearch;
    });
  }, [items, selectedBatchId, statusFilter, search]);

  const totals = useMemo(() => {
    return {
      itemCount: filteredItems.length,
      unmatched: filteredItems.filter((item) => item.match_status === "unmatched" || !item.claim_id).length,
      readyToPost: filteredItems.filter((item) => item.posting_ready).length,
      failed: filteredItems.filter((item) => item.parse_status === "failed" || item.payment_import_status === "failed").length,
      totalNet: filteredItems.reduce((sum, item) => sum + Number(item.net_amount ?? 0), 0),
      totalAdjustments: filteredItems.reduce((sum, item) => sum + Number(item.adjustment_amount ?? 0), 0),
    };
  }, [filteredItems]);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-600">
                Billing
              </p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">
                835 Payment Imports
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Upload ERA/835 files, review unmatched payments, adjustment codes, check numbers, and posting readiness.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".835,.era,.txt,.edi"
                className="hidden"
                onChange={(event) => void upload835File(event.target.files?.[0])}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "Importing 835..." : "Upload 835"}
              </button>
              <button
                type="button"
                onClick={loadData}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>

          {uploadResult ? (
            <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
              {uploadResult}
            </div>
          ) : null}

          {uploadError ? (
            <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm">
              <p>{uploadError}</p>
              {needsOrganizationCreation ? (
                <button
                  type="button"
                  onClick={() => void createOrganizationFor835()}
                  disabled={creatingOrganization}
                  className="mt-3 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingOrganization ? "Creating organization..." : "Create organization"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-6">
            <Metric label="Items" value={String(totals.itemCount)} />
            <Metric label="Unmatched" value={String(totals.unmatched)} />
            <Metric label="Ready to post" value={String(totals.readyToPost)} />
            <Metric label="Failed" value={String(totals.failed)} />
            <Metric label="Net payments" value={money(totals.totalNet)} />
            <Metric label="Adjustments" value={money(totals.totalAdjustments)} />
          </div>

          <div className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_240px_220px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search claim ref, payer, check/EFT, file name, match reason"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
            />

            <select
              value={selectedBatchId}
              onChange={(event) => setSelectedBatchId(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
            >
              <option value="all">All batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.source_file_name ?? batch.id.slice(0, 8)} · {batch.total_item_count}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
            >
              <option value="all">All statuses</option>
              <option value="unmatched">Unmatched</option>
              <option value="matched">Matched</option>
              <option value="manual_matched">Manual matched</option>
              <option value="needs_review">Needs review</option>
              <option value="ready_to_post">Ready to post</option>
              <option value="parsed">Parsed</option>
              <option value="posted">Posted</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {loading ? (
            <EmptyState text="Loading payment imports..." />
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm font-semibold text-red-700 shadow-sm">
              {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState text="No payment import items found. Upload an 835 ERA file to begin testing payment import parsing." />
          ) : (
            <div className="grid gap-4">
              {filteredItems.map((item) => (
                <PaymentImportCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}

function PaymentImportCard({ item }: { item: PaymentImportItem }) {
  const payload = getPayload(item);

  const payerName = asText(payload.payer_name, "Unknown payer");
  const payeeName = asText(payload.payee_name, "Unknown payee");
  const checkNumber = asText(payload.check_or_eft_number);
  const claimStatusCode = asText(payload.claim_status_code);
  const adjustments = Array.isArray(payload.adjustments)
    ? payload.adjustments
    : Array.isArray(payload.adjustment_codes)
      ? payload.adjustment_codes
      : [];

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(item.match_status ?? (item.claim_id ? "matched" : "unmatched"))}`}>
              {item.match_status ?? (item.claim_id ? "matched" : "unmatched")}
            </span>

            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(item.payment_import_status)}`}>
              {item.payment_import_status}
            </span>

            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeClass(item.parse_status)}`}>
              parse: {item.parse_status ?? "unknown"}
            </span>

            {item.posting_ready ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                posting ready
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 text-lg font-black text-slate-950">
            {item.imported_item_ref ?? "Unknown claim reference"}
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            {payerName} → {payeeName}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Net payment
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {money(item.net_amount)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-6">
        <Info label="Payment date" value={formatDate(item.payment_date)} />
        <Info label="Gross" value={money(item.gross_amount)} />
        <Info label="Adjustment" value={money(item.adjustment_amount)} />
        <Info label="Unapplied" value={money(item.unapplied_amount)} />
        <Info label="Check/EFT" value={checkNumber} />
        <Info label="Claim status" value={claimStatusCode} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Info label="Claim ID" value={item.claim_id ?? "No matched claim"} />
        <Info label="Client ID" value={item.client_id ?? "No matched client"} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          Source file
        </p>
        <p className="mt-1 break-all text-sm font-semibold text-slate-800">
          {item.original_file_name ?? item.storage_path ?? "—"}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Imported {formatDateTime(item.created_at)}
        </p>
      </div>

      {item.match_reason ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">
            Match status
          </p>
          <p className="mt-1 text-sm font-semibold text-amber-900">
            {item.match_reason}
          </p>
        </div>
      ) : null}

      {item.parse_error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-red-700">
            Parse error
          </p>
          <p className="mt-1 text-sm font-semibold text-red-900">
            {item.parse_error}
          </p>
        </div>
      ) : null}

      {adjustments.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">
            Adjustment codes
          </summary>
          <div className="mt-3 grid gap-2">
            {adjustments.map((adjustment, index) => (
              <pre
                key={index}
                className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-50"
              >
                {JSON.stringify(adjustment, null, 2)}
              </pre>
            ))}
          </div>
        </details>
      ) : null}

      <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">
          Raw parsed payload
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-50">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">
        {arguments[0].value}
      </p>
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

export default function PaymentImportsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-7xl px-6 py-8">
              <EmptyState text="Loading payment imports..." />
            </div>
          </main>
        </AppShell>
      }
    >
      <PaymentImportsPageContent />
    </Suspense>
  );
}
