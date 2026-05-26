import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AUTO_CHECK_LAST_RUN_SETTING_KEY,
  type AutoCheckLastRunSummary,
} from "@/lib/billing/claimStatusAutoCheck";

/**
 * Heartbeat check for the nightly claim-status auto-check cron (Task #706).
 *
 * The auto-check job lives in Supabase pg_cron and POSTs to
 * `/api/billing/claim-status/cron/auto-check` once a day. If Supabase
 * drops the schedule, the CRON_SECRET drifts, or the deployment URL
 * changes, the job silently stops and no one notices for days.
 *
 * This helper answers a single question: "When was the most recent
 * `trigger_source='auto'` row written to `claim_status_inquiries`?" If
 * the answer is older than `staleAfterHours` (default 36h — enough
 * headroom to absorb a missed daily run without paging on a 24h
 * cadence), we surface a stale heartbeat.
 *
 * Returned to:
 *   - `GET /api/admin/cron-heartbeat/claim-status-auto-check` (banner
 *     on the Billing Defaults page, callable by an external uptime
 *     monitor via CRON_SECRET).
 */

export const DEFAULT_STALE_AFTER_HOURS = 36;

export type AutoCheckHeartbeatStatus = "ok" | "stale" | "never_run" | "disabled";

export interface AutoCheckHeartbeat {
  status: AutoCheckHeartbeatStatus;
  lastRunAt: string | null;
  hoursSinceLastRun: number | null;
  thresholdHours: number;
  /** Human-readable reason — safe to drop into a banner or email body. */
  message: string;
  /**
   * Snapshot of the most recent per-org cron run, persisted by
   * `runClaimStatusAutoCheck` into `organization_settings`. Used by the
   * Billing Defaults page to show "scanned X, polled Y, skipped Z" and
   * an explicit "auto-check disabled" note when the org has the feature
   * turned off. Null when no run summary has been recorded yet (e.g.
   * never run, or scoped to all orgs).
   */
  lastRunSummary?: AutoCheckLastRunSummary | null;
}

export interface GetAutoCheckHeartbeatOptions {
  /** Scope to one org. Omit to check globally (cron-level monitoring). */
  organizationId?: string | null;
  /** Override the staleness threshold (hours). Default 36. */
  staleAfterHours?: number;
  /** Override `now` for tests. */
  now?: Date;
}

export async function getClaimStatusAutoCheckHeartbeat(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  options: GetAutoCheckHeartbeatOptions = {},
): Promise<AutoCheckHeartbeat> {
  const thresholdHours = Math.max(
    1,
    Number(options.staleAfterHours ?? DEFAULT_STALE_AFTER_HOURS) || DEFAULT_STALE_AFTER_HOURS,
  );
  const now = options.now ?? new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("claim_status_inquiries")
    .select("created_at")
    .eq("trigger_source", "auto")
    .order("created_at", { ascending: false })
    .limit(1);
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to read claim_status_inquiries heartbeat: ${error.message}`);
  }

  const row = Array.isArray(data) ? (data[0] as { created_at?: string } | undefined) : null;
  const lastRunAt = row?.created_at ?? null;

  // Best-effort: load the per-org last-run summary so the UI can show
  // "scanned X, polled Y, skipped Z" alongside the freshness verdict.
  // Skipped (and unrecoverable from claim_status_inquiries) only lands
  // here when the cron wrote it. Globally-scoped heartbeat calls have
  // no org context, so the summary is omitted in that mode.
  let lastRunSummary: AutoCheckLastRunSummary | null = null;
  if (options.organizationId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as unknown as { from: (t: string) => any };
      const { data: settingRow } = await sb
        .from("organization_settings")
        .select("setting_value")
        .eq("organization_id", options.organizationId)
        .eq("setting_key", AUTO_CHECK_LAST_RUN_SETTING_KEY)
        .maybeSingle();
      const raw = (settingRow as { setting_value?: unknown } | null)?.setting_value;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const r = raw as Record<string, unknown>;
        if (typeof r.ran_at === "string") {
          lastRunSummary = {
            ran_at: r.ran_at,
            scanned: Number(r.scanned) || 0,
            dispatched: Number(r.dispatched) || 0,
            skipped: Number(r.skipped) || 0,
            failures: Number(r.failures) || 0,
            disabled: r.disabled === true,
          };
        }
      }
    } catch {
      // organization_settings is optional — silently fall through.
    }
  }

  // Disabled orgs are expected to have no recent inquiries, so freshness
  // alarms based on `claim_status_inquiries` would be misleading. Short-
  // circuit to a non-alarming `disabled` status, using the persisted
  // last-run timestamp (when the cron last visited and skipped this org)
  // as `lastRunAt`. Without this, the Billing Defaults page would render
  // both the "disabled" tile AND the red "looks broken" banner.
  if (lastRunSummary?.disabled) {
    return {
      status: "disabled",
      lastRunAt: lastRunSummary.ran_at,
      hoursSinceLastRun: null,
      thresholdHours,
      message:
        "Payer auto-check is disabled for this organization. The scheduled cron is visiting and intentionally skipping it.",
      lastRunSummary,
    };
  }

  if (!lastRunAt) {
    return {
      status: "never_run",
      lastRunAt: null,
      hoursSinceLastRun: null,
      thresholdHours,
      message:
        "Nightly payer auto-check has never produced an inquiry. Confirm the Supabase pg_cron job is scheduled and the CRON_SECRET matches the deployment.",
      lastRunSummary,
    };
  }

  const parsed = new Date(lastRunAt).getTime();
  if (!Number.isFinite(parsed)) {
    return {
      status: "stale",
      lastRunAt,
      hoursSinceLastRun: null,
      thresholdHours,
      message: `Last auto-check timestamp is unparseable (${lastRunAt}).`,
      lastRunSummary,
    };
  }
  const hoursSinceLastRun = (now.getTime() - parsed) / (1000 * 60 * 60);
  const rounded = Math.round(hoursSinceLastRun * 10) / 10;

  if (hoursSinceLastRun > thresholdHours) {
    return {
      status: "stale",
      lastRunAt,
      hoursSinceLastRun: rounded,
      thresholdHours,
      message: `Nightly payer auto-check has not run in ${rounded}h (threshold ${thresholdHours}h). Check the Supabase pg_cron schedule, the CRON_SECRET, and the deployment URL.`,
      lastRunSummary,
    };
  }

  return {
    status: "ok",
    lastRunAt,
    hoursSinceLastRun: rounded,
    thresholdHours,
    message: `Last auto-check ran ${rounded}h ago.`,
    lastRunSummary,
  };
}
