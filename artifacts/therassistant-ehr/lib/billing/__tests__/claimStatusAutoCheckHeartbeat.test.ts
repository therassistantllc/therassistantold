/**
 * Tests for the nightly auto-check heartbeat (Task #706).
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  DEFAULT_STALE_AFTER_HOURS,
  getClaimStatusAutoCheckHeartbeat,
} from "../claimStatusAutoCheckHeartbeat";

interface Filter {
  col: string;
  val: unknown;
}

function makeFakeSupabase(opts: {
  rows?: Array<{ created_at: string }>;
  error?: { message: string };
}) {
  const recordedFilters: Filter[] = [];
  function builder() {
    const self = {
      select: () => self,
      eq: (col: string, val: unknown) => {
        recordedFilters.push({ col, val });
        return self;
      },
      order: () => self,
      limit: () => self,
      then: (resolve: (r: { data: unknown; error: unknown }) => void) => {
        if (opts.error) return resolve({ data: null, error: opts.error });
        return resolve({ data: opts.rows ?? [], error: null });
      },
    };
    return self;
  }
  return {
    fake: { from: () => builder() },
    recordedFilters,
  };
}

describe("getClaimStatusAutoCheckHeartbeat", () => {
  it("returns 'never_run' when no auto inquiries exist yet", async () => {
    const { fake } = makeFakeSupabase({ rows: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await getClaimStatusAutoCheckHeartbeat(fake as any);
    assert.equal(r.status, "never_run");
    assert.equal(r.lastRunAt, null);
    assert.equal(r.hoursSinceLastRun, null);
    assert.equal(r.thresholdHours, DEFAULT_STALE_AFTER_HOURS);
    assert.match(r.message, /never produced an inquiry/);
  });

  it("returns 'ok' when the latest auto inquiry is inside the threshold", async () => {
    const now = new Date("2026-05-25T12:00:00Z");
    const tenHoursAgo = new Date(now.getTime() - 10 * 3600 * 1000).toISOString();
    const { fake } = makeFakeSupabase({ rows: [{ created_at: tenHoursAgo }] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await getClaimStatusAutoCheckHeartbeat(fake as any, { now });
    assert.equal(r.status, "ok");
    assert.equal(r.lastRunAt, tenHoursAgo);
    assert.equal(r.hoursSinceLastRun, 10);
  });

  it("returns 'stale' when the latest auto inquiry is older than the threshold", async () => {
    const now = new Date("2026-05-25T12:00:00Z");
    const fortyHoursAgo = new Date(now.getTime() - 40 * 3600 * 1000).toISOString();
    const { fake } = makeFakeSupabase({ rows: [{ created_at: fortyHoursAgo }] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await getClaimStatusAutoCheckHeartbeat(fake as any, { now });
    assert.equal(r.status, "stale");
    assert.equal(r.hoursSinceLastRun, 40);
    assert.equal(r.thresholdHours, DEFAULT_STALE_AFTER_HOURS);
    assert.match(r.message, /has not run in 40h/);
  });

  it("honors a custom staleAfterHours override", async () => {
    const now = new Date("2026-05-25T12:00:00Z");
    const fifteenHoursAgo = new Date(now.getTime() - 15 * 3600 * 1000).toISOString();
    const { fake } = makeFakeSupabase({ rows: [{ created_at: fifteenHoursAgo }] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await getClaimStatusAutoCheckHeartbeat(fake as any, {
      now,
      staleAfterHours: 12,
    });
    assert.equal(r.status, "stale");
    assert.equal(r.thresholdHours, 12);
  });

  it("scopes the query by organization_id when provided", async () => {
    const { fake, recordedFilters } = makeFakeSupabase({ rows: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClaimStatusAutoCheckHeartbeat(fake as any, { organizationId: "org-123" });
    assert.ok(
      recordedFilters.some((f) => f.col === "trigger_source" && f.val === "auto"),
      "filters by trigger_source=auto",
    );
    assert.ok(
      recordedFilters.some((f) => f.col === "organization_id" && f.val === "org-123"),
      "filters by organization_id when scoped",
    );
  });

  it("does NOT add an organization_id filter when scope is omitted", async () => {
    const { fake, recordedFilters } = makeFakeSupabase({ rows: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getClaimStatusAutoCheckHeartbeat(fake as any);
    assert.ok(
      !recordedFilters.some((f) => f.col === "organization_id"),
      "no organization_id filter when unscoped",
    );
  });

  it("surfaces the underlying error when supabase fails", async () => {
    const { fake } = makeFakeSupabase({ error: { message: "boom" } });
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => getClaimStatusAutoCheckHeartbeat(fake as any),
      /boom/,
    );
  });
});
