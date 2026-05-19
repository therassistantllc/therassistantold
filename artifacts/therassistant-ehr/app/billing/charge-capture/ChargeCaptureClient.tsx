"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./charge-capture.module.css";

type ChargeStatus = "ready" | "unsigned" | "missing_dx" | "hold";

interface ChargeRow {
  id: string;
  clientId: string;
  patient: string;
  dob: string;
  dos: string;
  cpt: string;
  cptDesc: string;
  provider: string;
  insurance: string;
  charge: number;
  status: ChargeStatus;
  blockers: string[];
}

const DEMO_CHARGES: ChargeRow[] = [
  { id: "cc-1", clientId: "cc100001-0000-0000-0000-000000000001", patient: "Elena Rodriguez", dob: "1989-03-14", dos: "05/19/2026", cpt: "90791", cptDesc: "Psychiatric diagnostic evaluation", provider: "Lena Ortiz, LPC", insurance: "BCBS Colorado", charge: 195.00, status: "missing_dx", blockers: ["No diagnosis attached"] },
  { id: "cc-2", clientId: "cc100001-0000-0000-0000-000000000002", patient: "Avery Morgan", dob: "1995-07-22", dos: "05/19/2026", cpt: "90837", cptDesc: "Psychotherapy, 60 min", provider: "Lena Ortiz, LPC", insurance: "Aetna", charge: 150.00, status: "unsigned", blockers: ["Clinical note not signed"] },
  { id: "cc-3", clientId: "cc100001-0000-0000-0000-000000000003", patient: "Sofia Martinez", dob: "2009-11-05", dos: "05/19/2026", cpt: "90837", cptDesc: "Psychotherapy, 60 min", provider: "Noah Kim, LCSW", insurance: "BCBS Colorado", charge: 150.00, status: "ready", blockers: [] },
  { id: "cc-4", clientId: "cc100001-0000-0000-0000-000000000004", patient: "James Rivera", dob: "1973-01-30", dos: "05/16/2026", cpt: "90834", cptDesc: "Psychotherapy, 45 min", provider: "Priya Shah, PsyD", insurance: "Medicare", charge: 120.00, status: "ready", blockers: [] },
  { id: "cc-5", clientId: "cc100001-0000-0000-0000-000000000005", patient: "Marcus Thompson", dob: "1984-09-18", dos: "05/19/2026", cpt: "90791", cptDesc: "Psychiatric diagnostic evaluation", provider: "Priya Shah, PsyD", insurance: "Colorado Medicaid", charge: 195.00, status: "unsigned", blockers: ["Clinical note not signed", "Prior auth required"] },
  { id: "cc-6", clientId: "cc100001-0000-0000-0000-000000000001", patient: "Dana Patel", dob: "1991-05-27", dos: "05/14/2026", cpt: "H0032", cptDesc: "Treatment planning", provider: "Lena Ortiz, LPC", insurance: "United Behavioral Health", charge: 110.00, status: "hold", blockers: ["Auth pending"] },
  { id: "cc-7", clientId: "cc100001-0000-0000-0000-000000000002", patient: "Sarah Johnson", dob: "1968-12-03", dos: "05/12/2026", cpt: "90837", cptDesc: "Psychotherapy, 60 min", provider: "Noah Kim, LCSW", insurance: "Aetna", charge: 150.00, status: "missing_dx", blockers: ["No diagnosis attached", "Session documentation missing"] },
  { id: "cc-8", clientId: "cc100001-0000-0000-0000-000000000004", patient: "James Rivera", dob: "1973-01-30", dos: "05/09/2026", cpt: "90834", cptDesc: "Psychotherapy, 45 min", provider: "Priya Shah, PsyD", insurance: "Medicare", charge: 120.00, status: "ready", blockers: [] },
];

const STATUS_LABELS: Record<ChargeStatus, string> = {
  ready: "Ready",
  unsigned: "Unsigned",
  missing_dx: "Missing DX",
  hold: "Hold",
};

const STATUS_CLASS: Record<ChargeStatus, string> = {
  ready: styles.statusReady,
  unsigned: styles.statusUnsigned,
  missing_dx: styles.statusMissingDx,
  hold: styles.statusHold,
};

type FilterType = "all" | ChargeStatus;

function money(v: number) {
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function ChargeCaptureClient() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => ({
    total: DEMO_CHARGES.length,
    ready: DEMO_CHARGES.filter((c) => c.status === "ready").length,
    unsigned: DEMO_CHARGES.filter((c) => c.status === "unsigned").length,
    missing_dx: DEMO_CHARGES.filter((c) => c.status === "missing_dx").length,
    hold: DEMO_CHARGES.filter((c) => c.status === "hold").length,
    totalCharge: DEMO_CHARGES.reduce((s, c) => s + c.charge, 0),
  }), []);

  const filtered = useMemo(() => {
    let list = DEMO_CHARGES;
    if (filter !== "all") list = list.filter((c) => c.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.patient.toLowerCase().includes(q) ||
        c.cpt.includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        c.insurance.toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, search]);

  const readySelected = filtered.filter((c) => selected.has(c.id) && c.status === "ready");

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (filtered.every((c) => selected.has(c.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  const allChecked = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <span className={styles.headerTitle}>Charge Capture</span>
        <div className={styles.headerSpacer} />
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input className={styles.searchInput} placeholder="Search patient, CPT, provider…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={styles.filterRow}>
          {(["all", "ready", "unsigned", "missing_dx", "hold"] as FilterType[]).map((f) => (
            <button key={f} type="button" className={filter === f ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "missing_dx" ? "Missing DX" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" ? ` (${counts[f]})` : ""}
            </button>
          ))}
        </div>
        <button type="button" className={styles.releaseBtn} disabled={readySelected.length === 0}>
          Release {readySelected.length > 0 ? `${readySelected.length} ` : ""}to Billing
        </button>
      </header>

      {/* Summary */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{counts.total}</span>
          <span className={styles.summaryLabel}>Total Charges</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={`${styles.summaryValue} ${styles.summaryValueGreen}`}>{counts.ready}</span>
          <span className={styles.summaryLabel}>Ready to Bill</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={`${styles.summaryValue} ${styles.summaryValueAmber}`}>{counts.unsigned}</span>
          <span className={styles.summaryLabel}>Unsigned Notes</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={`${styles.summaryValue} ${styles.summaryValueRed}`}>{counts.missing_dx}</span>
          <span className={styles.summaryLabel}>Missing DX</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{counts.hold}</span>
          <span className={styles.summaryLabel}>On Hold</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{money(counts.totalCharge)}</span>
          <span className={styles.summaryLabel}>Total Charges</span>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkCell}>
                <input type="checkbox" className={styles.cb} checked={allChecked} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th>Patient</th>
              <th>DOS</th>
              <th>CPT</th>
              <th>Provider</th>
              <th>Insurance</th>
              <th>Charge</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className={styles.emptyState}>No charges match the current filter.</td></tr>
            ) : null}
            {filtered.map((row) => (
              <tr key={row.id} className={selected.has(row.id) ? styles.rowSelected : ""}>
                <td className={styles.checkCell}>
                  <input type="checkbox" className={styles.cb} checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} aria-label={`Select ${row.patient}`} />
                </td>
                <td>
                  <span className={styles.patientName}>{row.patient}</span>
                  <span className={styles.patientDob}>DOB {row.dob}</span>
                </td>
                <td style={{ whiteSpace: "nowrap", color: "#475569" }}>{row.dos}</td>
                <td>
                  <span className={styles.cptCode}>{row.cpt}</span>
                  <span className={styles.cptDesc}>{row.cptDesc}</span>
                </td>
                <td style={{ color: "#475569", whiteSpace: "nowrap" }}>{row.provider.split(",")[0]}</td>
                <td style={{ color: "#475569", whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{row.insurance}</td>
                <td className={styles.chargeAmt}>{money(row.charge)}</td>
                <td>
                  <span className={`${styles.status} ${STATUS_CLASS[row.status]}`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                  {row.blockers.map((b) => (
                    <span key={b} className={styles.blocker}>{b}</span>
                  ))}
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <Link className={styles.actionBtn} href={`/clients/${row.clientId}`}>Open Chart</Link>
                    {row.status === "missing_dx" ? (
                      <Link className={styles.actionBtn} href={`/clients/${row.clientId}/notes`}>Attach DX</Link>
                    ) : null}
                    {row.status === "unsigned" ? (
                      <Link className={styles.actionBtn} href={`/clients/${row.clientId}/notes`}>Sign Note</Link>
                    ) : null}
                    {row.status === "hold" ? (
                      <button type="button" className={styles.actionBtn}>Review Auth</button>
                    ) : null}
                    {row.status === "ready" ? (
                      <button type="button" className={`${styles.actionBtn} ${styles.actionBtnGreen}`}>Release</button>
                    ) : null}
                    <button type="button" className={styles.actionBtn}>Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
