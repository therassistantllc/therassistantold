"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_ORG_ID } from "@/lib/config";

type DenialRow = {
  id: string;
  claimNumber: string;
  patientId: string;
  patientName: string;
  memberId: string;
  payerProfileId: string;
  payerId: string | null;
  payerName: string;
  payerFaxNumber: string | null;
  serviceDateFrom: string | null;
  serviceDateTo: string | null;
  totalChargeAmount: number;
  outstandingBalance: number;
  denialReason: string;
  noteCount: number;
  deferUntil: string | null;
  deferredReason: string | null;
  updatedAt: string | null;
};

type AppealTemplate = { id: string; name: string; body: string; isSystem: boolean };

type DenialsPayload = {
  success: boolean;
  error?: string;
  rows?: DenialRow[];
  templates?: AppealTemplate[];
};

const WRITE_OFF_REASONS: { value: string; label: string }[] = [
  { value: "small_balance", label: "Small balance" },
  { value: "bad_debt", label: "Bad debt" },
  { value: "contractual", label: "Contractual" },
  { value: "timely_filing", label: "Timely filing" },
  { value: "no_authorization", label: "No authorization" },
  { value: "patient_deceased", label: "Patient deceased" },
  { value: "charity_care", label: "Charity care" },
  { value: "other", label: "Other" },
];

function getOrganizationId() {
  if (typeof window === "undefined") return DEFAULT_ORG_ID;
  return (
    new URLSearchParams(window.location.search).get("organizationId") ||
    process.env.NEXT_PUBLIC_ORGANIZATION_ID ||
    DEFAULT_ORG_ID
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function applyPlaceholders(body: string, row: DenialRow) {
  const dos = row.serviceDateFrom
    ? row.serviceDateTo && row.serviceDateTo !== row.serviceDateFrom
      ? `${formatDate(row.serviceDateFrom)} - ${formatDate(row.serviceDateTo)}`
      : formatDate(row.serviceDateFrom)
    : "";
  return body
    .replaceAll("[Patient Name]", row.patientName || "")
    .replaceAll("[Claim Number]", row.claimNumber || "")
    .replaceAll("[DOS]", dos)
    .replaceAll("[Member ID]", row.memberId || "")
    .replaceAll("[Payer Name]", row.payerName || "");
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "#111827",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        zIndex: 1100,
      }}
    >
      {message}
    </div>
  );
}

// ─── Modal shell ───────────────────────────────────────────────────────────────
function ModalShell({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          width,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflow: "auto",
          borderRadius: 8,
          padding: 24,
          boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#6B7280" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Note Modal ────────────────────────────────────────────────────────────────
function NoteModal({
  row,
  organizationId,
  onClose,
  onSaved,
}: {
  row: DenialRow;
  organizationId: string;
  onClose: () => void;
  onSaved: (claimId: string) => void;
}) {
  const [body, setBody] = useState("");
  const [deferUntil, setDeferUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!body.trim()) {
      setError("Note body is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/claims/${row.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          body: body.trim(),
          deferUntil: deferUntil || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.error ?? "Failed to save note");
      onSaved(row.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Add note — ${row.patientName}`} onClose={onClose}>
      <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 12px" }}>
        Claim {row.claimNumber || row.id.slice(0, 8)} · {row.payerName || "Unknown payer"}
      </p>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Note</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        style={{ width: "100%", padding: 8, border: "1px solid #D1D5DB", borderRadius: 4, fontFamily: "inherit" }}
      />
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>
        Defer until (optional)
      </label>
      <input
        type="date"
        value={deferUntil}
        onChange={(e) => setDeferUntil(e.target.value)}
        style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 4 }}
      />
      {error ? <div style={{ color: "#B91C1C", marginTop: 8, fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save note"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Appeal Modal ──────────────────────────────────────────────────────────────
function AppealModal({
  row,
  organizationId,
  templates,
  onClose,
  onSaved,
  onToast,
}: {
  row: DenialRow;
  organizationId: string;
  templates: AppealTemplate[];
  onClose: () => void;
  onSaved: (claimId: string) => void;
  onToast: (msg: string) => void;
}) {
  const [templateId, setTemplateId] = useState<string>("");
  const [letter, setLetter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setLetter(applyPlaceholders(tpl.body, row));
  }

  async function saveAsNote() {
    if (!letter.trim()) {
      setError("Letter is empty");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/claims/${row.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          body: `APPEAL DRAFT:\n\n${letter}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.error ?? "Failed to save appeal note");
      onSaved(row.id);
      onToast("Appeal draft saved as note");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save appeal note");
    } finally {
      setBusy(false);
    }
  }

  async function faxToPayer() {
    if (!row.payerFaxNumber) return;
    if (!letter.trim()) {
      setError("Letter is empty");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/fax-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          claimId: row.id,
          payerId: row.payerId,
          toFaxNumber: row.payerFaxNumber,
          subject: `Appeal: Claim ${row.claimNumber || row.id}`,
          body: letter,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.error ?? "Failed to queue fax");
      onToast(`Fax queued — ${json.pendingCount ?? 0} pending faxes`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to queue fax");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`File an appeal — ${row.patientName}`} onClose={onClose} width={680}>
      <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 12px" }}>
        Claim {row.claimNumber || row.id.slice(0, 8)} · {row.payerName || "Unknown payer"}
        {row.payerFaxNumber ? ` · Fax: ${row.payerFaxNumber}` : ""}
      </p>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Template</label>
      <select
        value={templateId}
        onChange={(e) => pickTemplate(e.target.value)}
        style={{ width: "100%", padding: 8, border: "1px solid #D1D5DB", borderRadius: 4 }}
      >
        <option value="">— Choose a template —</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.isSystem ? " (system)" : ""}
          </option>
        ))}
      </select>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>
        Appeal letter
      </label>
      <textarea
        value={letter}
        onChange={(e) => setLetter(e.target.value)}
        rows={14}
        style={{ width: "100%", padding: 8, border: "1px solid #D1D5DB", borderRadius: 4, fontFamily: "inherit" }}
      />
      {error ? <div style={{ color: "#B91C1C", marginTop: 8, fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="button" onClick={saveAsNote} disabled={busy}>
          {busy ? "Saving…" : "Save as appeal note"}
        </button>
        {row.payerFaxNumber ? (
          <button type="button" className="button" onClick={faxToPayer} disabled={busy}>
            {busy ? "Sending…" : "Fax to payer"}
          </button>
        ) : null}
      </div>
    </ModalShell>
  );
}

// ─── Write-off Modal ───────────────────────────────────────────────────────────
function WriteOffModal({
  row,
  organizationId,
  onClose,
  onSaved,
}: {
  row: DenialRow;
  organizationId: string;
  onClose: () => void;
  onSaved: (claimId: string) => void;
}) {
  const [reason, setReason] = useState<string>("small_balance");
  const [amount, setAmount] = useState<string>(String(row.totalChargeAmount.toFixed(2)));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/claims/${row.id}/write-off`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          reason,
          amount: Number(amount),
          comment: comment.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.error ?? "Failed to write off claim");
      onSaved(row.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to write off claim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Write-off — ${row.patientName}`} onClose={onClose}>
      <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 12px" }}>
        Claim {row.claimNumber || row.id.slice(0, 8)} · Total charge {formatCurrency(row.totalChargeAmount)}
      </p>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Reason</label>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ width: "100%", padding: 8, border: "1px solid #D1D5DB", borderRadius: 4 }}
      >
        {WRITE_OFF_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Amount</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: 160, padding: 8, border: "1px solid #D1D5DB", borderRadius: 4 }}
      />
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>
        Comment (optional)
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        style={{ width: "100%", padding: 8, border: "1px solid #D1D5DB", borderRadius: 4, fontFamily: "inherit" }}
      />
      {error ? <div style={{ color: "#B91C1C", marginTop: 8, fontSize: 13 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="button" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Write off"}
        </button>
      </div>
    </ModalShell>
  );
}

export default function ClaimSubmissionClient() {
  const organizationId = useMemo(() => getOrganizationId(), []);
  const [rows, setRows] = useState<DenialRow[]>([]);
  const [templates, setTemplates] = useState<AppealTemplate[]>([]);
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [noteRow, setNoteRow] = useState<DenialRow | null>(null);
  const [appealRow, setAppealRow] = useState<DenialRow | null>(null);
  const [writeOffRow, setWriteOffRow] = useState<DenialRow | null>(null);
  const [billingRowId, setBillingRowId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/billing/denials?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as DenialsPayload;
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load denials");
      setRows(json.rows ?? []);
      setTemplates(json.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load denials");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  function removeRow(claimId: string) {
    setRows((prev) => prev.filter((r) => r.id !== claimId));
  }

  function bumpNoteCount(claimId: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === claimId ? { ...r, noteCount: r.noteCount + 1 } : r)),
    );
  }

  async function billToPatient(row: DenialRow) {
    setBillingRowId(row.id);
    try {
      const res = await fetch("/api/patient-invoices/from-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, claimId: row.id }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.error ?? "Failed to create invoice");
      setToast(`Invoice sent to ${json.patientName ?? row.patientName}`);
      removeRow(row.id);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setBillingRowId(null);
    }
  }

  const missingOrgMessage =
    "Missing organizationId. Add ?organizationId=... to the URL or configure NEXT_PUBLIC_ORGANIZATION_ID.";

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>Denials</h1>
          <p className="hero-copy">
            Worklist of denied claims. Add notes, file appeals, write off uncollectible balances, or bill the patient.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button button-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </section>

      {!organizationId ? <div className="alert-panel">{missingOrgMessage}</div> : null}
      {error ? <div className="alert-panel">{error}</div> : null}

      <section className="panel" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #E5E7EB" }}>
              <th style={{ padding: 8 }}>Claim #</th>
              <th style={{ padding: 8 }}>Patient</th>
              <th style={{ padding: 8 }}>Payer</th>
              <th style={{ padding: 8 }}>DOS</th>
              <th style={{ padding: 8, textAlign: "right" }}>Charge</th>
              <th style={{ padding: 8, textAlign: "right" }}>Outstanding</th>
              <th style={{ padding: 8 }}>Denial reason</th>
              <th style={{ padding: 8, textAlign: "center" }}>Notes</th>
              <th style={{ padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 16, color: "#6B7280" }}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 16, color: "#6B7280" }}>
                  No denied claims.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const dos = row.serviceDateFrom
                  ? row.serviceDateTo && row.serviceDateTo !== row.serviceDateFrom
                    ? `${formatDate(row.serviceDateFrom)} – ${formatDate(row.serviceDateTo)}`
                    : formatDate(row.serviceDateFrom)
                  : "—";
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <td style={{ padding: 8, fontFamily: "monospace" }}>
                      {row.claimNumber || row.id.slice(0, 8)}
                    </td>
                    <td style={{ padding: 8 }}>{row.patientName}</td>
                    <td style={{ padding: 8 }}>
                      {row.payerName || "—"}
                      {row.payerFaxNumber ? (
                        <div style={{ fontSize: 12, color: "#6B7280" }}>Fax: {row.payerFaxNumber}</div>
                      ) : null}
                    </td>
                    <td style={{ padding: 8 }}>{dos}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{formatCurrency(row.totalChargeAmount)}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{formatCurrency(row.outstandingBalance)}</td>
                    <td style={{ padding: 8, color: row.denialReason ? "#111827" : "#9CA3AF" }}>
                      {row.denialReason || "—"}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>{row.noteCount}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => setNoteRow(row)}
                        >
                          Note
                        </button>
                        <button type="button" className="button" onClick={() => setAppealRow(row)}>
                          File an Appeal
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => setWriteOffRow(row)}
                        >
                          Write-off
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => void billToPatient(row)}
                          disabled={billingRowId === row.id}
                        >
                          {billingRowId === row.id ? "Billing…" : "Bill to Patient"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {noteRow ? (
        <NoteModal
          row={noteRow}
          organizationId={organizationId}
          onClose={() => setNoteRow(null)}
          onSaved={(id) => bumpNoteCount(id)}
        />
      ) : null}
      {appealRow ? (
        <AppealModal
          row={appealRow}
          organizationId={organizationId}
          templates={templates}
          onClose={() => setAppealRow(null)}
          onSaved={(id) => bumpNoteCount(id)}
          onToast={(msg) => setToast(msg)}
        />
      ) : null}
      {writeOffRow ? (
        <WriteOffModal
          row={writeOffRow}
          organizationId={organizationId}
          onClose={() => setWriteOffRow(null)}
          onSaved={(id) => removeRow(id)}
        />
      ) : null}
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </main>
  );
}
