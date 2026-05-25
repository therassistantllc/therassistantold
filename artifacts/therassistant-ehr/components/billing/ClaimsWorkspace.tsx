"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DEFAULT_ORG_ID } from "@/lib/config";
import styles from "./ClaimsWorkspace.module.css";

// ─── Lifecycle taxonomy ────────────────────────────────────────────────────

type LifecycleTab = "needs_attention" | "submitted" | "denials" | "follow_up" | "resolutions";
type ChipTone = "info" | "pending" | "urgent" | "resolved" | "neutral";

interface ChipDef {
  id: string;
  label: string;
  tone: ChipTone;
  /** Client-side predicate against a NoResponseRow. Returning true means
   *  the row matches the chip. Chips without a predicate are not shown
   *  (Task #771 requirement: chips must reliably narrow data). */
  predicate: (r: NoResponseRow) => boolean;
}

interface LifecycleDef {
  id: LifecycleTab;
  label: string;
  description: string;
  chips: ChipDef[];
  /** When true, this tab's data scope is bounded by what the v1 source
   *  exposes; we render an honest banner explaining the limit. */
  phaseTwo?: boolean;
  phaseTwoNote?: string;
}

const LIFECYCLES: LifecycleDef[] = [
  {
    id: "needs_attention",
    label: "Needs Attention",
    description: "Claims stuck somewhere — pick a reason and clear them.",
    chips: [
      { id: "no_payer_response", label: "No payer response", tone: "pending", predicate: (r) => r.missing_artifact === "no_payer_status" },
      { id: "no_277ca", label: "Missing 277CA", tone: "pending", predicate: (r) => r.missing_artifact === "no_277ca" },
      { id: "no_999", label: "Missing 999", tone: "pending", predicate: (r) => r.missing_artifact === "no_999" },
      { id: "no_era", label: "Missing ERA", tone: "pending", predicate: (r) => r.missing_artifact === "no_era" },
      { id: "past_follow_up", label: "Past follow-up date", tone: "urgent", predicate: (r) => r.missing_artifact === "past_follow_up" },
      { id: "timely_filing", label: "Timely-filing risk", tone: "urgent", predicate: (r) => (r.days_outstanding ?? 0) > 90 },
    ],
  },
  {
    id: "submitted",
    label: "Submitted",
    description: "Out the door, awaiting payer acknowledgement.",
    chips: [
      { id: "no_999", label: "Awaiting 999 ack", tone: "pending", predicate: (r) => r.missing_artifact === "no_999" },
      { id: "no_277ca", label: "Awaiting 277CA", tone: "pending", predicate: (r) => r.missing_artifact === "no_277ca" },
      { id: "no_payer_response", label: "Awaiting payer response", tone: "pending", predicate: (r) => r.missing_artifact === "no_payer_status" },
      { id: "no_era", label: "Awaiting ERA", tone: "pending", predicate: (r) => r.missing_artifact === "no_era" },
    ],
  },
  {
    id: "denials",
    label: "Denials",
    description: "Payer said no. Appeal, correct, or write off.",
    chips: [
      // No CARC/RARC data in the v1 source; show all aged claims as a
      // proxy. The phase-2 note makes the scope explicit.
      { id: "aged_90", label: "90+ days outstanding", tone: "urgent", predicate: (r) => (r.days_outstanding ?? 0) > 90 },
      { id: "aged_60", label: "60–90 days", tone: "pending", predicate: (r) => (r.days_outstanding ?? 0) > 60 && (r.days_outstanding ?? 0) <= 90 },
      { id: "aged_30", label: "30–60 days", tone: "info", predicate: (r) => (r.days_outstanding ?? 0) > 30 && (r.days_outstanding ?? 0) <= 60 },
    ],
    phaseTwo: true,
    phaseTwoNote: "Denial-specific data (CARC/RARC, partial denials, medical necessity) is integrating in phase 2. The table below shows aged claims that often turn into denials.",
  },
  {
    id: "follow_up",
    label: "Follow-Up",
    description: "In motion — appeals filed, corrections sent, awaiting outcome.",
    chips: [
      { id: "past_follow_up", label: "Past follow-up date", tone: "urgent", predicate: (r) => r.missing_artifact === "past_follow_up" },
      { id: "with_followup_date", label: "Follow-up scheduled", tone: "info", predicate: (r) => !!r.follow_up_due_date },
      { id: "assigned", label: "Assigned to someone", tone: "info", predicate: (r) => !!r.assigned_to_user_id },
      { id: "unassigned", label: "Unassigned", tone: "pending", predicate: (r) => !r.assigned_to_user_id },
    ],
    phaseTwo: true,
    phaseTwoNote: "Appeals, corrections, and resubmissions feeds land in phase 2. The table below shows claims currently in active follow-up.",
  },
  {
    id: "resolutions",
    label: "Resolutions",
    description: "Closed out — paid, written off, or moved to patient.",
    chips: [],
    phaseTwo: true,
    phaseTwoNote: "Resolved-claim history (paid, written off, transferred to patient) lives in Payments and Patient Balances today and rolls up here in phase 2.",
  },
];

const LIFECYCLE_BY_ID: Record<LifecycleTab, LifecycleDef> = Object.fromEntries(
  LIFECYCLES.map((l) => [l.id, l]),
) as Record<LifecycleTab, LifecycleDef>;

// ─── Data types ────────────────────────────────────────────────────────────

interface NoResponseRow {
  id: string;
  claim_number: string | null;
  claim_status: string | null;
  patient_id: string | null;
  patient_name: string;
  payer_name: string | null;
  service_date_from: string | null;
  service_date_to: string | null;
  submitted_at: string | null;
  days_outstanding: number | null;
  total_charge: number;
  follow_up_due_date: string | null;
  assigned_to_user_id: string | null;
  assigned_to_display_name: string | null;
  latest_note_at: string | null;
  latest_note_excerpt: string | null;
  last_known_status: string;
  last_status_at: string | null;
  missing_artifact: "no_999" | "no_277ca" | "no_payer_status" | "no_era" | "past_follow_up";
  clearinghouse_trace_number: string | null;
}

interface ClaimRow {
  id: string;
  claimNumber: string;
  patientName: string;
  dosFrom: string | null;
  dosTo: string | null;
  payer: string;
  balance: number;
  daysOut: number | null;
  issue: { label: string; tone: ChipTone };
  lastAction: string;
  lastActionAt: string | null;
  assignee: string | null;
  followUp: string | null;
  raw: NoResponseRow;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getOrganizationId() {
  if (typeof window === "undefined") return DEFAULT_ORG_ID;
  return (
    new URLSearchParams(window.location.search).get("organizationId") ||
    process.env.NEXT_PUBLIC_ORGANIZATION_ID ||
    DEFAULT_ORG_ID
  );
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

function fmtRelative(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 0) return `in ${-days}d`;
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function dosLabel(from: string | null, to: string | null): string {
  if (!from && !to) return "—";
  if (from && to && from !== to) return `${fmtDate(from)} – ${fmtDate(to)}`;
  return fmtDate(from || to);
}

function initials(name: string | null): string {
  if (!name) return "??";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function humanIssueFor(r: NoResponseRow): { label: string; tone: ChipTone } {
  const days = r.days_outstanding ?? 0;
  switch (r.missing_artifact) {
    case "no_999":
      return { label: `No 999 ack ${days}d`, tone: days > 7 ? "urgent" : "pending" };
    case "no_277ca":
      return { label: `No 277CA ${days}d`, tone: days > 14 ? "urgent" : "pending" };
    case "no_payer_status":
      return { label: `No payer response ${days}d`, tone: days > 60 ? "urgent" : "pending" };
    case "no_era":
      return { label: `Awaiting ERA ${days}d`, tone: days > 45 ? "urgent" : "pending" };
    case "past_follow_up":
      return { label: "Past follow-up date", tone: "urgent" };
  }
}

function findChip(tab: LifecycleTab, chipId: string): ChipDef | undefined {
  return LIFECYCLE_BY_ID[tab].chips.find((c) => c.id === chipId);
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ClaimsWorkspace() {
  const router = useRouter();
  const pathname = usePathname() ?? "/billing/claims";
  const searchParams = useSearchParams();

  const initialTab = (searchParams?.get("tab") as LifecycleTab) || "needs_attention";
  const initialFilter = searchParams?.get("filter") || "";
  const initialQuery = searchParams?.get("q") || "";

  const [activeTab, setActiveTab] = useState<LifecycleTab>(
    LIFECYCLE_BY_ID[initialTab] ? initialTab : "needs_attention",
  );
  const [activeChips, setActiveChips] = useState<string[]>(() => {
    if (!initialFilter) return [];
    const startTab = LIFECYCLE_BY_ID[initialTab] ? initialTab : "needs_attention";
    // Only keep chip ids that actually exist in the starting tab.
    return initialFilter
      .split(",")
      .filter(Boolean)
      .filter((id) => findChip(startTab, id));
  });
  const [query, setQuery] = useState(initialQuery);
  const [allRows, setAllRows] = useState<NoResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTabId>("timeline");

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (activeTab !== "needs_attention") params.set("tab", activeTab);
    else params.delete("tab");
    if (activeChips.length > 0) params.set("filter", activeChips.join(","));
    else params.delete("filter");
    if (query) params.set("q", query);
    else params.delete("q");
    const next = params.toString();
    const target = `${pathname}${next ? `?${next}` : ""}`;
    const current = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (target !== current) router.replace(target, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeChips.join(","), query]);

  // Single fetch for all claim rows. v1 source is /api/billing/no-response
  // returning every missing_artifact bucket. Lifecycle tabs are pure UI
  // organizers; chips filter the same client-side dataset.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("organizationId", getOrganizationId());
        const res = await fetch(`/api/billing/no-response?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) {
          setError(json.error || "Could not load claims");
          setAllRows([]);
          return;
        }
        setAllRows((json.items as NoResponseRow[]) ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load claims");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const lifecycle = LIFECYCLE_BY_ID[activeTab];

  const filtered: ClaimRow[] = useMemo(() => {
    // Per-tab default scoping: each tab gets a base predicate so that
    // even with no chips selected the table feels coherent for that tab.
    const tabBase: Record<LifecycleTab, (r: NoResponseRow) => boolean> = {
      needs_attention: () => true,
      submitted: () => true,
      denials: (r) => (r.days_outstanding ?? 0) > 30,
      follow_up: (r) => !!r.follow_up_due_date || r.missing_artifact === "past_follow_up",
      resolutions: () => false,
    };

    let rows = allRows.filter(tabBase[activeTab]);

    // Chip predicates: OR semantics across selected chips.
    const selectedPreds = activeChips
      .map((id) => findChip(activeTab, id)?.predicate)
      .filter((p): p is (r: NoResponseRow) => boolean => !!p);
    if (selectedPreds.length > 0) {
      rows = rows.filter((r) => selectedPreds.some((p) => p(r)));
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.patient_name.toLowerCase().includes(q) ||
          (r.claim_number ?? "").toLowerCase().includes(q) ||
          (r.payer_name ?? "").toLowerCase().includes(q),
      );
    }

    return rows.map((r) => ({
      id: r.id,
      claimNumber: r.claim_number || `(no claim #) ${r.id.slice(0, 6)}`,
      patientName: r.patient_name || "Unknown patient",
      dosFrom: r.service_date_from,
      dosTo: r.service_date_to,
      payer: r.payer_name || "—",
      balance: r.total_charge,
      daysOut: r.days_outstanding,
      issue: humanIssueFor(r),
      lastAction: r.latest_note_excerpt || `Status: ${r.last_known_status || "unknown"}`,
      lastActionAt: r.latest_note_at || r.last_status_at,
      assignee: r.assigned_to_display_name,
      followUp: r.follow_up_due_date,
      raw: r,
    }));
  }, [allRows, activeTab, activeChips, query]);

  const kpis = useMemo(() => {
    const openCount = filtered.length;
    const totalValue = filtered.reduce((sum, r) => sum + (r.balance || 0), 0);
    const avgDays = filtered.length
      ? Math.round(
          filtered.reduce((sum, r) => sum + (r.daysOut ?? 0), 0) / filtered.length,
        )
      : 0;
    const urgent = filtered.filter((r) => r.issue.tone === "urgent").length;
    return { openCount, totalValue, avgDays, urgent };
  }, [filtered]);

  // Cross-tab counts for the tab strip (uses each tab's base predicate).
  const tabCounts: Record<LifecycleTab, number> = useMemo(() => {
    const tabBase: Record<LifecycleTab, (r: NoResponseRow) => boolean> = {
      needs_attention: () => true,
      submitted: () => true,
      denials: (r) => (r.days_outstanding ?? 0) > 30,
      follow_up: (r) => !!r.follow_up_due_date || r.missing_artifact === "past_follow_up",
      resolutions: () => false,
    };
    const counts = {} as Record<LifecycleTab, number>;
    for (const l of LIFECYCLES) counts[l.id] = allRows.filter(tabBase[l.id]).length;
    return counts;
  }, [allRows]);

  const selectedRow = useMemo(
    () => filtered.find((r) => r.id === selectedRowId) ?? null,
    [filtered, selectedRowId],
  );

  const closeDrawer = useCallback(() => setSelectedRowId(null), []);

  useEffect(() => {
    if (!selectedRowId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRowId, closeDrawer]);

  const toggleChip = (id: string) => {
    setActiveChips((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const switchTab = (tab: LifecycleTab) => {
    setActiveTab(tab);
    setActiveChips([]); // chips are per-tab; reset on switch.
    setSelectedRowId(null);
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Claims</h1>
          <p className={styles.subtitle}>{lifecycle.description}</p>
        </div>
        <div className={styles.headerSearch}>
          <input
            type="search"
            placeholder="Search patient, claim #, payer…"
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      {/* KPI tiles */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiTile}>
          <span className={styles.kpiLabel}>Claims in view</span>
          <span className={`${styles.kpiValue} ${kpis.urgent > 0 ? styles.kpiValueUrgent : ""}`}>
            {kpis.openCount}
          </span>
          <span className={styles.kpiSub}>{kpis.urgent} urgent</span>
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiLabel}>Total balance</span>
          <span className={`${styles.kpiValue} ${kpis.totalValue > 10000 ? styles.kpiValuePending : ""}`}>
            {fmtMoney(kpis.totalValue)}
          </span>
          <span className={styles.kpiSub}>Across {kpis.openCount} open claims</span>
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiLabel}>Avg days outstanding</span>
          <span className={`${styles.kpiValue} ${kpis.avgDays > 60 ? styles.kpiValueUrgent : kpis.avgDays > 30 ? styles.kpiValuePending : ""}`}>
            {kpis.avgDays}d
          </span>
          <span className={styles.kpiSub}>Current view</span>
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiLabel}>Past follow-up date</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueUrgent}`}>
            {allRows.filter((r) => r.missing_artifact === "past_follow_up").length}
          </span>
          <span className={styles.kpiSub}>Across all stages</span>
        </div>
      </div>

      {/* Lifecycle tabs */}
      <div className={styles.tabBar} role="tablist" aria-label="Claim lifecycle">
        {LIFECYCLES.map((l) => {
          const isActive = l.id === activeTab;
          const count = tabCounts[l.id];
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              onClick={() => switchTab(l.id)}
            >
              {l.label}
              <span className={styles.tabCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filter chip strip */}
      {lifecycle.chips.length > 0 ? (
        <div className={styles.chipStrip}>
          <span className={styles.chipLabel}>Filter</span>
          {lifecycle.chips.map((c) => {
            const isActive = activeChips.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                onClick={() => toggleChip(c.id)}
                aria-pressed={isActive}
              >
                {c.label}
              </button>
            );
          })}
          {activeChips.length > 0 ? (
            <button type="button" className={styles.clearLink} onClick={() => setActiveChips([])}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <div className={styles.error}>{error}</div> : null}

      {lifecycle.phaseTwo && lifecycle.phaseTwoNote ? (
        <div className={styles.phaseBanner}>
          <strong>Phase 2 in progress.</strong> {lifecycle.phaseTwoNote}
        </div>
      ) : null}

      {/* Body — table */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loading}>Loading claims…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {activeTab === "resolutions"
              ? "Resolved claims will appear here once the phase-2 data source ships."
              : "Nothing matches the current view. Try clearing filters or switching tabs."}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>DOS</th>
                <th>Payer</th>
                <th>Issue</th>
                <th style={{ textAlign: "right" }}>Balance</th>
                <th>Last Action</th>
                <th>Assigned</th>
                <th>Next Follow-Up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isSelected = r.id === selectedRowId;
                const isUrgent = r.issue.tone === "urgent";
                return (
                  <tr
                    key={r.id}
                    className={`${isUrgent ? styles.rowUrgent : ""} ${isSelected ? styles.rowSelected : ""}`}
                    onClick={() => {
                      setSelectedRowId(r.id);
                      setDrawerTab("timeline");
                    }}
                  >
                    <td>
                      <div className={styles.patientCell}>{r.patientName}</div>
                      <div className={styles.patientSub}>Claim {r.claimNumber}</div>
                    </td>
                    <td className={styles.dateCell}>{dosLabel(r.dosFrom, r.dosTo)}</td>
                    <td>{r.payer}</td>
                    <td>
                      <span className={`${styles.issueBadge} ${toneClass(r.issue.tone)}`}>
                        {r.issue.label}
                      </span>
                    </td>
                    <td className={styles.moneyCell}>{fmtMoney(r.balance)}</td>
                    <td>
                      <div style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.lastAction}
                      </div>
                      <div className={styles.patientSub}>{fmtRelative(r.lastActionAt)}</div>
                    </td>
                    <td>
                      {r.assignee ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className={styles.avatar}>{initials(r.assignee)}</span>
                          <span style={{ fontSize: 12 }}>{r.assignee}</span>
                        </span>
                      ) : (
                        <span className={`${styles.avatar} ${styles.avatarUnassigned}`} title="Unassigned">
                          —
                        </span>
                      )}
                    </td>
                    <td className={styles.dateCell}>
                      {r.followUp ? fmtDate(r.followUp) : <span style={{ color: "#94A3B8" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {selectedRow ? (
        <>
          <div className={styles.drawerBackdrop} onClick={closeDrawer} />
          <aside
            className={styles.drawer}
            role="dialog"
            aria-label={`Claim ${selectedRow.claimNumber}`}
          >
            <header className={styles.drawerHeader}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 className={styles.drawerTitle}>{selectedRow.patientName}</h2>
                <p className={styles.drawerSubtitle}>
                  Claim {selectedRow.claimNumber} · {selectedRow.payer} · {fmtMoney(selectedRow.balance)}
                </p>
              </div>
              <button type="button" className={styles.closeBtn} onClick={closeDrawer} aria-label="Close">
                ×
              </button>
            </header>
            <nav className={styles.drawerTabs} aria-label="Claim activity">
              {DRAWER_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.drawerTab} ${drawerTab === t.id ? styles.drawerTabActive : ""}`}
                  onClick={() => setDrawerTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className={styles.drawerBody}>
              <DrawerContent tab={drawerTab} row={selectedRow} />
            </div>
            <div className={styles.drawerActions}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
                Log call outcome
              </button>
              <button type="button" className={styles.btn}>
                Resubmit
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`}>
                Write off
              </button>
              <Link
                href={`/billing/claims/${selectedRow.id}`}
                className={styles.btn}
                style={{ marginLeft: "auto", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                Open full record →
              </Link>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────

type DrawerTabId =
  | "timeline"
  | "notes"
  | "attachments"
  | "status_history"
  | "era_history"
  | "appeal_history"
  | "audit_trail";

const DRAWER_TABS: Array<{ id: DrawerTabId; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "notes", label: "Notes" },
  { id: "attachments", label: "Attachments" },
  { id: "status_history", label: "Status History" },
  { id: "era_history", label: "ERA History" },
  { id: "appeal_history", label: "Appeal History" },
  { id: "audit_trail", label: "Audit Trail" },
];

function DrawerContent({ tab, row }: { tab: DrawerTabId; row: ClaimRow }) {
  const r = row.raw;
  switch (tab) {
    case "timeline":
      return (
        <>
          <div className={styles.section}>
            <h4>Claim summary</h4>
            <div className={styles.kvGrid}>
              <span className={styles.kvKey}>Claim #</span>
              <span className={styles.kvVal}>{row.claimNumber}</span>
              <span className={styles.kvKey}>Status</span>
              <span className={styles.kvVal}>{r.last_known_status || "—"}</span>
              <span className={styles.kvKey}>Date of service</span>
              <span className={styles.kvVal}>{dosLabel(row.dosFrom, row.dosTo)}</span>
              <span className={styles.kvKey}>Submitted</span>
              <span className={styles.kvVal}>{fmtDate(r.submitted_at)}</span>
              <span className={styles.kvKey}>Days outstanding</span>
              <span className={styles.kvVal}>{r.days_outstanding ?? "—"}</span>
              <span className={styles.kvKey}>Trace #</span>
              <span className={styles.kvVal}>{r.clearinghouse_trace_number || "—"}</span>
            </div>
          </div>
          <div className={styles.section}>
            <h4>Lifecycle</h4>
            <ul className={styles.timelineList}>
              <li className={styles.timelineItem}>
                <span className={`${styles.timelineDot} ${styles.timelineDotResolved}`} />
                <div className={styles.timelineMain}>
                  <div className={styles.timelineLabel}>Submitted to payer</div>
                  <div className={styles.timelineMeta}>{fmtDate(r.submitted_at)}</div>
                </div>
              </li>
              <li className={styles.timelineItem}>
                <span className={`${styles.timelineDot} ${styles.timelineDotPending}`} />
                <div className={styles.timelineMain}>
                  <div className={styles.timelineLabel}>{row.issue.label}</div>
                  <div className={styles.timelineMeta}>{fmtRelative(r.last_status_at)}</div>
                </div>
              </li>
              {row.followUp ? (
                <li className={styles.timelineItem}>
                  <span className={styles.timelineDot} />
                  <div className={styles.timelineMain}>
                    <div className={styles.timelineLabel}>Next follow-up scheduled</div>
                    <div className={styles.timelineMeta}>{fmtDate(row.followUp)}</div>
                  </div>
                </li>
              ) : null}
            </ul>
          </div>
        </>
      );
    case "notes":
      return r.latest_note_excerpt ? (
        <div className={styles.section}>
          <h4>Latest note</h4>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.latest_note_excerpt}</div>
          <div className={styles.timelineMeta} style={{ marginTop: 6 }}>{fmtRelative(r.latest_note_at)}</div>
        </div>
      ) : (
        <div className={styles.emptyTabState}>No notes yet. Log the first one with “Log call outcome”.</div>
      );
    case "attachments":
      return <div className={styles.emptyTabState}>EOBs, payer letters, and supporting docs attached to this claim appear here.</div>;
    case "status_history":
      return (
        <div className={styles.section}>
          <h4>Last known status</h4>
          <div className={styles.kvGrid}>
            <span className={styles.kvKey}>Status</span>
            <span className={styles.kvVal}>{r.last_known_status || "—"}</span>
            <span className={styles.kvKey}>As of</span>
            <span className={styles.kvVal}>{fmtRelative(r.last_status_at)}</span>
            <span className={styles.kvKey}>Trace #</span>
            <span className={styles.kvVal}>{r.clearinghouse_trace_number || "—"}</span>
          </div>
        </div>
      );
    case "era_history":
      return <div className={styles.emptyTabState}>835 / ERA payments that touched this claim show up here once received.</div>;
    case "appeal_history":
      return <div className={styles.emptyTabState}>Appeals drafted, sent, and decided for this claim live here.</div>;
    case "audit_trail":
      return <div className={styles.emptyTabState}>Every user action against this claim, in order, with who/when.</div>;
  }
}

function toneClass(t: ChipTone): string {
  switch (t) {
    case "info": return styles.tInfo;
    case "pending": return styles.tPending;
    case "urgent": return styles.tUrgent;
    case "resolved": return styles.tResolved;
    case "neutral": return styles.tNeutral;
  }
}
