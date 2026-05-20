"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Per-claim "Claim Readiness" panel.
 *
 * Reuses the same Configuration Validation Engine output the claim
 * submission gate (lib/validation/claimSubmissionGate.ts) consults. Fetches
 * GET /api/settings/system-readiness?organizationId=... — the exact engine
 * report — so this panel and the gate can never disagree.
 */

type Severity = "blocking" | "warning" | "info";

type Finding = {
  ruleId: string;
  category: string;
  severity: Severity;
  message: string;
  fixRoute: string;
  whyItMatters: string;
  resolution: string;
};

type ReadinessReport = {
  organizationId: string;
  generatedAt: string;
  summary: {
    total: number;
    blocking: number;
    warning: number;
    info: number;
    ready: boolean;
  };
  findings: Finding[];
};

const SEVERITY_COLOR: Record<Severity, string> = {
  blocking: "var(--text-danger, #c53030)",
  warning: "var(--text-warning, #b45309)",
  info: "var(--accent, #2563eb)",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  blocking: "Blocking",
  warning: "Warning",
  info: "Info",
};

const CATEGORY_LABEL: Record<string, string> = {
  organization: "Organization",
  providers: "Providers",
  locations: "Service Locations",
  payers: "Payers",
  clearinghouse: "Clearinghouse",
  feeSchedules: "Fee Schedules",
  billingDefaults: "Billing Defaults",
};

function fixHref(route: string, organizationId: string) {
  if (!organizationId) return route;
  return `${route}${route.includes("?") ? "&" : "?"}organizationId=${encodeURIComponent(organizationId)}`;
}

export interface ClaimSubmissionReadinessPanelProps {
  organizationId: string;
  /** Optional — for display only ("Claim #ABC123") */
  claimLabel?: string;
}

export default function ClaimSubmissionReadinessPanel({
  organizationId,
  claimLabel,
}: ClaimSubmissionReadinessPanelProps) {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      setError("Missing organizationId.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/settings/system-readiness?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load claim readiness");
      setReport(json as ReadinessReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load claim readiness.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const blocking = useMemo(
    () => (report?.findings ?? []).filter((f) => f.severity === "blocking"),
    [report],
  );
  const warnings = useMemo(
    () => (report?.findings ?? []).filter((f) => f.severity === "warning"),
    [report],
  );

  const ready = report?.summary.ready === true;
  const statusColor = ready
    ? "var(--text-success, #15803d)"
    : "var(--text-danger, #c53030)";

  return (
    <section
      className="panel"
      style={{
        borderLeft: `3px solid ${statusColor}`,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          marginBottom: "var(--space-2)",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Claim Readiness{claimLabel ? ` — ${claimLabel}` : ""}{" "}
          {loading ? (
            <span style={{ color: "var(--text-secondary)", fontSize: "0.85em", fontWeight: 400 }}>
              checking…
            </span>
          ) : ready ? (
            <span style={{ color: statusColor }}>· ✓ Ready to Submit</span>
          ) : (
            <span style={{ color: statusColor }}>· ⚠ Blocked</span>
          )}
        </h2>
        <button
          type="button"
          className="button button-secondary"
          onClick={load}
          disabled={loading}
          style={{ fontSize: "var(--text-sm)", padding: "4px 10px" }}
        >
          {loading ? "Validating…" : "Run Validation Again"}
        </button>
      </header>

      {error && <div className="alert-panel">{error}</div>}

      {!error && report && (
        <>
          {!ready && (
            <p style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-3)" }}>
              <strong>This claim cannot be generated or transmitted</strong> while blocking
              configuration findings exist. The same rules are enforced by the submission gate.
            </p>
          )}

          {blocking.length > 0 && (
            <div style={{ marginBottom: "var(--space-3)" }}>
              <h3 style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-2)", color: SEVERITY_COLOR.blocking }}>
                {blocking.length} Blocking finding{blocking.length === 1 ? "" : "s"}
              </h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
                {blocking.map((f) => (
                  <FindingRow key={f.ruleId} finding={f} organizationId={organizationId} />
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div style={{ marginBottom: "var(--space-3)" }}>
              <h3 style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-2)", color: SEVERITY_COLOR.warning }}>
                {warnings.length} Warning{warnings.length === 1 ? "" : "s"}
              </h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
                {warnings.map((f) => (
                  <FindingRow key={f.ruleId} finding={f} organizationId={organizationId} />
                ))}
              </ul>
            </div>
          )}

          {ready && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
              No blocking configuration findings. Submission gate will permit this claim.
            </p>
          )}

          <p
            style={{
              fontSize: "var(--text-xs, 0.7rem)",
              color: "var(--text-secondary)",
              textAlign: "right",
              marginTop: "var(--space-3)",
              marginBottom: 0,
            }}
          >
            Last validated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </section>
  );
}

function FindingRow({ finding, organizationId }: { finding: Finding; organizationId: string }) {
  const categoryLabel = CATEGORY_LABEL[finding.category] ?? finding.category;
  return (
    <li
      style={{
        padding: "var(--space-2) var(--space-3)",
        background: "var(--surface-2, #f7f9fc)",
        borderLeft: `3px solid ${SEVERITY_COLOR[finding.severity]}`,
        borderRadius: "var(--radius, 6px)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "baseline",
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs, 0.7rem)",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: 999,
            background: SEVERITY_COLOR[finding.severity],
            color: "white",
          }}
        >
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <strong style={{ fontSize: "var(--text-sm)" }}>{finding.message}</strong>
      </div>
      <p style={{ fontSize: "var(--text-xs, 0.75rem)", color: "var(--text-secondary)", margin: "2px 0" }}>
        <strong>Why: </strong>
        {finding.whyItMatters}
      </p>
      <p style={{ fontSize: "var(--text-xs, 0.75rem)", margin: "2px 0" }}>
        <strong>Resolve: </strong>
        {finding.resolution}
      </p>
      <Link
        href={fixHref(finding.fixRoute, organizationId)}
        style={{
          color: "var(--accent)",
          fontSize: "var(--text-xs, 0.75rem)",
          textDecoration: "underline",
        }}
      >
        Fix in {categoryLabel} →
      </Link>
    </li>
  );
}
