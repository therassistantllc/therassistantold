/**
 * Verifies that loadPayerReceivedClaims drives the "Expected adjudication date"
 * off the per-payer payer_profiles.adjudication_sla_days column rather than a
 * hard-coded 30-day default. This is the core behavior for Task #447.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { loadPayerReceivedClaims } from "../payerReceivedService";

type Row = Record<string, unknown>;

function fakeSupabase(tables: Record<string, Row[]>): {
  from: (t: string) => unknown;
} {
  function build(table: string) {
    let rows: Row[] = [...(tables[table] ?? [])];
    const self: Record<string, unknown> = {
      select: () => self,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] === val);
        return self;
      },
      in: (col: string, vals: unknown[]) => {
        const set = new Set(vals);
        rows = rows.filter((r) => set.has(r[col] as unknown));
        return self;
      },
      is: (col: string, val: unknown) => {
        rows = rows.filter((r) => (r[col] ?? null) === val);
        return self;
      },
      order: () => self,
      limit: () => Promise.resolve({ data: rows, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
        resolve({ data: rows, error: null }),
    };
    return self;
  }
  return { from: (t: string) => build(t) };
}

const ORG = "org-1";
const RECEIVED_AT = "2026-05-01T00:00:00.000Z";

function baseFixture(slaDays: number | null) {
  return {
    professional_claims: [
      {
        id: "claim-1",
        organization_id: ORG,
        patient_id: "client-1",
        appointment_id: "appt-1",
        payer_profile_id: "payer-1",
        claim_number: "C-1",
        claim_status: "accepted_payer",
        total_charge: 100,
        submitted_at: RECEIVED_AT,
        billing_notes: null,
        created_at: RECEIVED_AT,
        updated_at: RECEIVED_AT,
      },
    ],
    clients: [{ id: "client-1", first_name: "Ada", last_name: "Lovelace" }],
    appointments: [
      {
        id: "appt-1",
        scheduled_start_at: RECEIVED_AT,
        provider_id: null,
        provider_location_id: null,
      },
    ],
    payer_profiles: [
      {
        id: "payer-1",
        payer_name: "Test Payer",
        availity_payer_id: "TEST",
        adjudication_sla_days: slaDays,
      },
    ],
    claim_status_events: [],
    claim_status_inquiries: [],
    claim_submissions: [],
    audit_logs: [],
  } as Record<string, Row[]>;
}

async function expectedFor(sla: number | null): Promise<string | null> {
  const sb = fakeSupabase(baseFixture(sla)) as unknown as Parameters<
    typeof loadPayerReceivedClaims
  >[0]["supabase"];
  const rows = await loadPayerReceivedClaims({ supabase: sb, organizationId: ORG });
  assert.equal(rows.length, 1);
  return rows[0].expectedAdjudicationAt;
}

describe("loadPayerReceivedClaims uses per-payer SLA for expected adjudication", () => {
  it("adds the payer's adjudication_sla_days to payerReceivedAt (Medicare ~14)", async () => {
    const iso = await expectedFor(14);
    assert.equal(iso, "2026-05-15T00:00:00.000Z");
  });

  it("respects a long Medicaid-style SLA (60 days)", async () => {
    const iso = await expectedFor(60);
    assert.equal(iso, "2026-06-30T00:00:00.000Z");
  });

  it("falls back to 30 days when the payer's SLA is null", async () => {
    const iso = await expectedFor(null);
    assert.equal(iso, "2026-05-31T00:00:00.000Z");
  });
});
