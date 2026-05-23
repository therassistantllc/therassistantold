"use client";

import { useEffect, useState } from "react";

interface CaseOption {
  id: string;
  name: string;
  caseType: string;
  isDefault: boolean;
  activeFlag: boolean;
  archivedAt: string | null;
}

export default function MoveClaimButton({
  claimId,
  clientId,
  organizationId,
}: {
  claimId: string;
  clientId: string;
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/clients/${clientId}/cases?organizationId=${encodeURIComponent(organizationId)}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load cases");
        if (cancelled) return;
        const active = (json.cases ?? []).filter(
          (c: CaseOption) => c.activeFlag && !c.archivedAt,
        );
        setCases(active);
        setTarget(active[0]?.id ?? "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load cases");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId, organizationId]);

  async function submit() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/move-to-case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          targetCaseId: target,
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to move claim");
      setOpen(false);
      setReason("");
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to move claim");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="button button-secondary" onClick={() => setOpen(true)}>
        Move to case…
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.25rem", marginTop: "0.25rem" }}>
      {loading ? (
        <span className="muted">Loading cases…</span>
      ) : (
        <>
          <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
            {cases.length === 0 ? <option value="">No active cases</option> : null}
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.caseType}){c.isDefault ? " · default" : ""}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Reason for moving (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
        </>
      )}
      {error ? <span className="alert-panel">{error}</span> : null}
      <div style={{ display: "flex", gap: "0.25rem" }}>
        <button type="button" className="button" onClick={submit} disabled={busy || !target}>
          Move claim
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
