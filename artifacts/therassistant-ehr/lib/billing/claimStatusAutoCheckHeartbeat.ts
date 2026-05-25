import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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

export type AutoCheckHeartbeatStatus = "ok" | "stale" | "never_run";

export interface AutoCheckHeartbeat {
  status: AutoCheckHeartbeatStatus;
  lastRunAt: string | null;
  hoursSinceLastRun: number | null;
  thresholdHours: number;
  /** Human-readable reason — safe to drop into a banner or email body. */
  message: string;
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

  if (!lastRunAt) {
    return {
      status: "never_run",
      lastRunAt: null,
      hoursSinceLastRun: null,
      thresholdHours,
      message:
        "Nightly payer auto-check has never produced an inquiry. Confirm the Supabase pg_cron job is scheduled and the CRON_SECRET matches the deployment.",
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
    };
  }

  return {
    status: "ok",
    lastRunAt,
    hoursSinceLastRun: rounded,
    thresholdHours,
    message: `Last auto-check ran ${rounded}h ago.`,
  };
}
