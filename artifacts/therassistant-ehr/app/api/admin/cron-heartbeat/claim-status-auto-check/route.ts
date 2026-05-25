/**
 * GET /api/admin/cron-heartbeat/claim-status-auto-check
 *
 * Surfaces the freshness of the nightly payer-status auto-check cron
 * (Task #706). Returns:
 *
 *   { status: 'ok' | 'stale' | 'never_run',
 *     lastRunAt, hoursSinceLastRun, thresholdHours, message }
 *
 * Two callable modes:
 *   1. External uptime monitor: header `x-cron-secret: $CRON_SECRET` —
 *      checks across all orgs (no org context). Responds with HTTP 503
 *      when stale so a generic uptime monitor (UptimeRobot, BetterStack,
 *      etc.) can page the on-call.
 *   2. Authenticated staff: cookie session via `requireOrgAccess` — used
 *      by the Billing Defaults banner. Always responds 200 with the
 *      heartbeat body; the UI renders the banner when `status !== 'ok'`.
 *
 * Optional query params (both modes):
 *   - `thresholdHours` (number, default 36)
 *   - `organizationId` (uuid)   — restricts to one org. The authenticated
 *     mode also enforces tenant isolation against the session org.
 */
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireOrgAccess } from "@/lib/auth/requireOrgAccess";
import {
  DEFAULT_STALE_AFTER_HOURS,
  getClaimStatusAutoCheckHeartbeat,
} from "@/lib/billing/claimStatusAutoCheckHeartbeat";

export const runtime = "nodejs";

function parseThreshold(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_STALE_AFTER_HOURS;
  return n;
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const url = req.nextUrl;
  const thresholdHours = parseThreshold(url.searchParams.get("thresholdHours"));
  const requestedOrganizationId = url.searchParams.get("organizationId");

  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  const isCronCaller = !!(cronSecret && headerSecret && headerSecret === cronSecret);

  let organizationId: string | null = null;
  if (isCronCaller) {
    organizationId = requestedOrganizationId || null;
  } else {
    const guard = await requireOrgAccess({ requestedOrganizationId });
    if (guard instanceof NextResponse) return guard;
    organizationId = guard.organizationId;
  }

  try {
    const heartbeat = await getClaimStatusAutoCheckHeartbeat(supabase, {
      organizationId,
      staleAfterHours: thresholdHours,
    });

    // Cron callers want a non-2xx when stale so generic uptime monitors page.
    // Staff UI always wants 200 so it can render the banner from the body.
    const httpStatus = isCronCaller && heartbeat.status !== "ok" ? 503 : 200;
    return NextResponse.json(heartbeat, { status: httpStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
