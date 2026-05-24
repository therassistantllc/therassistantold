/**
 * POST /api/billing/ready-to-generate/bulk-batch
 *
 * Body:
 *   {
 *     organizationId: string,
 *     claimIds: string[],
 *     payerProfileId?: string,   // optional — if provided, every selected
 *                                  // claim must be on this payer
 *     splitByPayer?: boolean,    // if true, partition the selection by
 *                                  // payer_profile_id and create ONE batch
 *                                  // per payer in a single request
 *   }
 *
 * Clearinghouses (Availity included) expect one payer per 837P file. This
 * endpoint enforces that invariant in TWO ways:
 *
 *   1. Hard pre-flight: a multi-payer selection without `splitByPayer:true`
 *      is rejected with 422 + a per-payer breakdown so the caller can
 *      either narrow the selection or opt into the split path.
 *   2. Opt-in split: with `splitByPayer:true`, the selection is grouped by
 *      payer_profile_id and one claim_837p_batches row is created per
 *      group. Claims missing a payer profile cannot be batched and force
 *      a 422 before any writes happen.
 *
 * Each batch (whether 1 or N) is created with its own claim_837p_batches
 * row, claim_837p_batch_claims links, and claim_status flip to 'batched'.
 * If any write fails mid-flight, best-effort rollback removes orphaned
 * rows and flips already-batched claims back to ready_for_batch so the
 * user does not end up with a half-built set of batches.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

const UNASSIGNED_PAYER_KEY = "__no_payer__";

function batchNumber(suffix?: number) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return suffix == null ? `837P-${stamp}` : `837P-${stamp}-${suffix}`;
}

type ClaimRow = {
  id: string;
  claim_status: string;
  total_charge: number | null;
  held_at: string | null;
  archived_at: string | null;
  payer_profile_id: string | null;
};

type CreatedBatch = {
  payerProfileId: string | null;
  batchId: string;
  batchNumber: string;
  claimCount: number;
  totalChargeAmount: number;
  claimIds: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      organizationId?: string;
      claimIds?: unknown;
      payerProfileId?: string | null;
      splitByPayer?: boolean;
    };

    const claimIds = Array.isArray(body.claimIds)
      ? Array.from(new Set(body.claimIds.filter((x): x is string => typeof x === "string" && x.length > 0)))
      : [];
    if (claimIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "claimIds must be a non-empty array" },
        { status: 400 },
      );
    }
    if (claimIds.length > 500) {
      return NextResponse.json(
        { success: false, error: "Cannot batch more than 500 claims at once" },
        { status: 400 },
      );
    }

    const splitByPayer = body.splitByPayer === true;

    const guard = await requireBillingAccess({
      requestedOrganizationId: body.organizationId ?? null,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const { data: claims, error: fetchError } = await (supabase as any)
      .from("professional_claims")
      .select("id, claim_status, total_charge, held_at, archived_at, payer_profile_id")
      .eq("organization_id", organizationId)
      .in("id", claimIds);
    if (fetchError) throw fetchError;

    const found = (claims ?? []) as ClaimRow[];
    if (found.length !== claimIds.length) {
      const foundIds = new Set(found.map((c) => c.id));
      const missing = claimIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { success: false, error: `Claims not found: ${missing.join(", ")}` },
        { status: 404 },
      );
    }

    const archived = found.filter((c) => c.archived_at);
    if (archived.length > 0) {
      return NextResponse.json(
        { success: false, error: `${archived.length} selected claim(s) are archived` },
        { status: 422 },
      );
    }
    const held = found.filter((c) => c.held_at);
    if (held.length > 0) {
      return NextResponse.json(
        { success: false, error: `${held.length} selected claim(s) are on hold; release the hold(s) before batching` },
        { status: 422 },
      );
    }
    const notReady = found.filter((c) => c.claim_status !== "ready_for_batch");
    if (notReady.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${notReady.length} selected claim(s) are not ready_for_batch (statuses: ${[
            ...new Set(notReady.map((c) => c.claim_status)),
          ].join(", ")})`,
        },
        { status: 422 },
      );
    }

    if (body.payerProfileId) {
      const wrongPayer = found.filter((c) => c.payer_profile_id !== body.payerProfileId);
      if (wrongPayer.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `${wrongPayer.length} selected claim(s) do not match the requested payer`,
          },
          { status: 422 },
        );
      }
    }

    // ── Group selection by payer ───────────────────────────────────────────
    const groups = new Map<string, ClaimRow[]>();
    for (const c of found) {
      const key = c.payer_profile_id ?? UNASSIGNED_PAYER_KEY;
      const list = groups.get(key);
      if (list) list.push(c);
      else groups.set(key, [c]);
    }

    const payerBreakdown = [...groups.entries()].map(([key, rows]) => ({
      payerProfileId: key === UNASSIGNED_PAYER_KEY ? null : key,
      claimCount: rows.length,
      totalChargeAmount: rows.reduce((s, r) => s + Number(r.total_charge ?? 0), 0),
    }));

    // Claims without a payer profile cannot be sent on an 837P — block early
    // whether we're splitting or not.
    if (groups.has(UNASSIGNED_PAYER_KEY)) {
      const orphan = groups.get(UNASSIGNED_PAYER_KEY)!;
      return NextResponse.json(
        {
          success: false,
          error: `${orphan.length} selected claim(s) have no payer assigned; assign a payer before batching`,
          payerBreakdown,
        },
        { status: 422 },
      );
    }

    // Hard pre-flight: refuse to mix payers in one 837P. The caller can
    // either narrow the selection or pass splitByPayer:true to fan out.
    if (!splitByPayer && groups.size > 1) {
      return NextResponse.json(
        {
          success: false,
          code: "multi_payer_selection",
          error: `Selection spans ${groups.size} payers. Pass splitByPayer:true to create one batch per payer, or filter to a single payer.`,
          payerBreakdown,
        },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const created: CreatedBatch[] = [];

    // Cleanup helper: undo every batch+links+status-flip created so far so
    // an N-of-M failure doesn't leave the org with half a fan-out.
    async function rollback(reason: unknown) {
      for (const b of created) {
        try {
          await (supabase as any)
            .from("professional_claims")
            .update({ claim_status: "ready_for_batch", updated_at: new Date().toISOString() })
            .eq("organization_id", organizationId)
            .in("id", b.claimIds);
        } catch (err) {
          console.warn("[bulk-batch] rollback status flip failed", { batchId: b.batchId, err });
        }
        try {
          await (supabase as any)
            .from("claim_837p_batch_claims")
            .delete()
            .eq("organization_id", organizationId)
            .eq("batch_id", b.batchId);
        } catch (err) {
          console.warn("[bulk-batch] rollback link delete failed", { batchId: b.batchId, err });
        }
        try {
          await (supabase as any)
            .from("claim_837p_batches")
            .delete()
            .eq("organization_id", organizationId)
            .eq("id", b.batchId);
        } catch (err) {
          console.warn("[bulk-batch] rollback batch delete failed", { batchId: b.batchId, err });
        }
      }
      throw reason;
    }

    // Stable order so the per-payer batch_number suffix is deterministic
    // (helps log/audit readability).
    const orderedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (let i = 0; i < orderedGroups.length; i++) {
      const [payerKey, rows] = orderedGroups[i];
      const payerProfileId = payerKey === UNASSIGNED_PAYER_KEY ? null : payerKey;
      const totalChargeAmount = rows.reduce((s, r) => s + Number(r.total_charge ?? 0), 0);
      const number = orderedGroups.length === 1 ? batchNumber() : batchNumber(i + 1);

      const { data: batch, error: batchError } = await (supabase as any)
        .from("claim_837p_batches")
        .insert({
          organization_id: organizationId,
          batch_number: number,
          batch_status: "ready_to_generate",
          claim_count: rows.length,
          total_charge_amount: totalChargeAmount,
          created_at: now,
          updated_at: now,
        })
        .select("id, batch_number")
        .single();
      if (batchError || !batch) {
        await rollback(batchError ?? new Error("Failed to create batch"));
      }

      const linkRows = rows.map((c) => ({
        organization_id: organizationId,
        batch_id: batch!.id,
        professional_claim_id: c.id,
        created_at: now,
      }));
      const { error: linkError } = await (supabase as any)
        .from("claim_837p_batch_claims")
        .insert(linkRows);
      if (linkError) {
        // Best-effort cleanup of this batch row before rolling back prior ones.
        await (supabase as any)
          .from("claim_837p_batches")
          .delete()
          .eq("organization_id", organizationId)
          .eq("id", batch!.id);
        await rollback(linkError);
      }

      const ids = rows.map((c) => c.id);
      const { error: updateError } = await (supabase as any)
        .from("professional_claims")
        .update({ claim_status: "batched", updated_at: now })
        .eq("organization_id", organizationId)
        .in("id", ids);
      if (updateError) {
        await (supabase as any)
          .from("claim_837p_batch_claims")
          .delete()
          .eq("organization_id", organizationId)
          .eq("batch_id", batch!.id);
        await (supabase as any)
          .from("claim_837p_batches")
          .delete()
          .eq("organization_id", organizationId)
          .eq("id", batch!.id);
        await rollback(updateError);
      }

      created.push({
        payerProfileId,
        batchId: batch!.id,
        batchNumber: batch!.batch_number,
        claimCount: rows.length,
        totalChargeAmount,
        claimIds: ids,
      });
    }

    // Best-effort audit trail per claim (do not fail the batch if it errors).
    try {
      const eventRows = created.flatMap((b) =>
        b.claimIds.map((cid) => ({
          organization_id: organizationId,
          claim_id: cid,
          source: "ready_to_generate",
          detail: {
            action: "bulk_batch",
            batch_id: b.batchId,
            batch_number: b.batchNumber,
            claim_count: b.claimCount,
            payer_profile_id: b.payerProfileId,
            split_by_payer: splitByPayer && created.length > 1,
          },
        })),
      );
      if (eventRows.length > 0) {
        await (supabase as any).from("claim_status_events").insert(eventRows);
      }
    } catch (err) {
      console.warn("[ready-to-generate/bulk-batch] audit insert failed", {
        organizationId,
        batchIds: created.map((b) => b.batchId),
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const totalChargeAmount = created.reduce((s, b) => s + b.totalChargeAmount, 0);
    const totalClaims = created.reduce((s, b) => s + b.claimCount, 0);

    // Preserve the single-batch response shape callers already depend on,
    // and add a `batches` array for the split path.
    const first = created[0];
    return NextResponse.json({
      success: true,
      batchId: first.batchId,
      batchNumber: first.batchNumber,
      claimCount: totalClaims,
      totalChargeAmount,
      batches: created.map((b) => ({
        payerProfileId: b.payerProfileId,
        batchId: b.batchId,
        batchNumber: b.batchNumber,
        claimCount: b.claimCount,
        totalChargeAmount: b.totalChargeAmount,
      })),
    });
  } catch (error) {
    console.error("Ready-to-Generate bulk-batch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Bulk batch failed" },
      { status: 500 },
    );
  }
}
