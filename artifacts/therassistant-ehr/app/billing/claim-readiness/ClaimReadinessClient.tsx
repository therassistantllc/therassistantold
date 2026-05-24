"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_ORG_ID } from "@/lib/config";

type NoResponseItem = {
  id: string;
  claim_number: string | null;
  claim_status: string | null;
  patient_id: string | null;
  patient_name: string;
  payer_name: string | null;
  service_date_from: string | null;
  service_date_to: string | null;
  submitted_at: string | null;
  aging_days: number | null;
  total_charge: number;
  defer_until: string | null;
  deferred_reason: string | null;
  note_count: number;
  latest_note_excerpt: string | null;
};

type Payload = {
  success: boolean;
  error?: string;
  items?: NoResponseItem[];
};

function getOrganizationId() {
  if (typeof window === "undefined") return DEFAULT_ORG_ID;
  const params = new URLSearchParams(window.location.search);
  return params.get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || DEFAULT_ORG_ID;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatServiceDates(from: string | null, to: string | null) {
  if (!from && !to) return "—";
  if (from && to && from !== to) return `${formatDate(from)} – ${formatDate(to)}`;
  return formatDate(from ?? to);
}

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function todayPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Toast = { id: number; kind: "success" | "error"; message: string };

export default function ClaimReadinessClient() {
  const organizationId = useMemo(() => getOrganizationId(), []);
  const [items, setItems] = useState<NoResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState<NoResponseItem | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!organizationId) {
        throw new Error("Missing organizationId.");
      }
      const res = await fetch(
        `/api/billing/claim-readiness?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as Payload;
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load worklist");
      setItems(json.items ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load worklist");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendStatusRequest(item: NoResponseItem) {
    if (!item.patient_id) {
      setRowError((prev) => ({ ...prev, [item.id]: "Missing patient on claim" }));
      return;
    }
    setStatusBusy((prev) => ({ ...prev, [item.id]: true }));
    setRowError((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    try {
      const res = await fetch("/api/clearinghouse/availity/claim-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          clientId: item.patient_id,
          claimId: item.id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || json.success === false) {
        throw new Error(json.error ?? "Claim status request failed");
      }
      pushToast("success", `Claim status request sent for ${item.claim_number ?? item.id}.`);
    } catch (e) {
      setRowError((prev) => ({
        ...prev,
        [item.id]: e instanceof Error ? e.message : "Claim status request failed",
      }));
    } finally {
      setStatusBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  return (
    <main className="app-shell">
      <nav aria-label="Breadcrumb" className="muted-text" style={{ fontSize: "0.85rem" }}>
        Billing / No Response
      </nav>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>No Response</h1>
          <p className="hero-copy">
            Claims submitted to a payer that have not yet returned a response. Sorted oldest first.
          </p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      {loadError ? <div className="alert-panel">{loadError}</div> : null}

      <section className="panel">
        <h2>Outstanding Claims ({items.length})</h2>
        {loading ? <div className="empty-state">Loading…</div> : null}
        {!loading && items.length === 0 ? (
          <div className="empty-state">No claims awaiting payer response.</div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Claim #</th>
                  <th>Patient</th>
                  <th>Payer</th>
                  <th>Service Date</th>
                  <th>Submitted</th>
                  <th>Aging</th>
                  <th>Total</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const busy = !!statusBusy[item.id];
                  const err = rowError[item.id];
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.claim_number ?? "—"}</strong>
                        <div className="muted-text" style={{ fontSize: "0.75rem" }}>
                          {item.claim_status ?? ""}
                        </div>
                      </td>
                      <td>{item.patient_name}</td>
                      <td>{item.payer_name ?? "—"}</td>
                      <td>{formatServiceDates(item.service_date_from, item.service_date_to)}</td>
                      <td>{formatDate(item.submitted_at)}</td>
                      <td>{item.aging_days != null ? `${item.aging_days}d` : "—"}</td>
                      <td>{formatMoney(item.total_charge)}</td>
                      <td>
                        <div>{item.note_count}</div>
                        {item.latest_note_excerpt ? (
                          <div className="muted-text" style={{ fontSize: "0.75rem", maxWidth: 220 }}>
                            {item.latest_note_excerpt}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => void sendStatusRequest(item)}
                            disabled={busy}
                          >
                            {busy ? "Sending…" : "Send Claim Status Request"}
                          </button>
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => setNoteOpen(item)}
                          >
                            Add Note
                          </button>
                          {err ? (
                            <span className="alert-panel" style={{ fontSize: "0.75rem" }}>
                              {err}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <div
        aria-live="polite"
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          zIndex: 1000,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={t.kind === "success" ? "success-panel" : "alert-panel"}
            style={{ minWidth: 240 }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {noteOpen ? (
        <AddNoteModal
          item={noteOpen}
          organizationId={organizationId}
          onClose={() => setNoteOpen(null)}
          onSaved={(msg) => {
            pushToast("success", msg);
            setNoteOpen(null);
            void load();
          }}
        />
      ) : null}
    </main>
  );
}

function AddNoteModal({
  item,
  organizationId,
  onClose,
  onSaved,
}: {
  item: NoResponseItem;
  organizationId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [body, setBody] = useState("");
  const [deferEnabled, setDeferEnabled] = useState(false);
  const [deferDate, setDeferDate] = useState<string>(() => todayPlusDays(14));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Note body is required");
      return;
    }
    if (deferEnabled && !deferDate) {
      setError("Defer date is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/billing/claims/${encodeURIComponent(item.id)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          body: trimmed,
          defer_until: deferEnabled ? deferDate : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to save note");
      }
      onSaved(
        deferEnabled
          ? `Note saved. Follow-up deferred until ${deferDate}.`
          : "Note saved.",
      );
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add note"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "1rem",
      }}
    >
      <form
        onSubmit={save}
        style={{
          background: "white",
          borderRadius: 8,
          padding: "1.5rem",
          width: "100%",
          maxWidth: 520,
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        <header>
          <h2 style={{ margin: 0 }}>Add Note</h2>
          <div className="muted-text" style={{ fontSize: "0.85rem" }}>
            {item.claim_number ?? item.id} · {item.patient_name}
          </div>
        </header>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <span>Note</span>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            required
            style={{ width: "100%", padding: "0.5rem", fontFamily: "inherit" }}
          />
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={deferEnabled}
              onChange={(e) => setDeferEnabled(e.target.checked)}
            />
            <span>Defer follow-up until</span>
          </label>
          {deferEnabled ? (
            <input
              type="date"
              value={deferDate}
              required
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDeferDate(e.target.value)}
              style={{ padding: "0.4rem", maxWidth: 200 }}
            />
          ) : null}
        </div>

        {error ? <div className="alert-panel">{error}</div> : null}

        <footer style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={saving}>
            {saving ? "Saving…" : "Save Note"}
          </button>
        </footer>
      </form>
    </div>
  );
}
