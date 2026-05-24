/**
 * POST /api/billing/refunds/[rowId]
 *
 * Action endpoint for the Refund / Overpayment workqueue. The rowId is
 * one of:
 *   refund:<payment_refunds.id>     — existing refund row
 *   recoup:<payment_recoupments.id> — recoupment row
 *   era:<era_claim_payments.id>     — credit-balance review row (no refund yet)
 *
 * Body:  { organizationId, action, reason? }
 *
 * Actions:
 *   approve_refund    — mark a pending refund as approved (writes audit;
 *                        for era: rows, mints a payment_refunds row first)
 *   issue_refund      — set refund_status='issued', issued_at=now()
 *   apply_to_balance  — write a note that the credit was applied to
 *                        future patient balance (cancels the refund row)
 *   dispute_refund    — set refund_status='cancelled' with reason
 *   mark_complete     — set refund_status='issued' (manual reconciliation)
 *
 * Every action writes an audit_logs entry with
 * event_type='refund_action'.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

type Action =
  | "approve_refund"
  | "issue_refund"
  | "apply_to_balance"
  | "dispute_refund"
  | "mark_complete";

const VALID: Action[] = [
  "approve_refund",
  "issue_refund",
  "apply_to_balance",
  "dispute_refund",
  "mark_complete",
];

const text = (v: unknown) => String(v ?? "").trim();

interface Body {
  organizationId?: string;
  action?: Action;
  reason?: string;
}

interface ParsedRow {
  kind: "refund" | "recoup" | "era";
  id: string;
}

function parseRowId(rowId: string): ParsedRow | null {
  const idx = rowId.indexOf(":");
  if (idx < 0) return null;
  const kind = rowId.slice(0, idx);
  const id = rowId.slice(idx + 1);
  if (!id) return null;
  if (kind === "refund" || kind === "recoup" || kind === "era") {
    return { kind, id };
  }
  return null;
}

async function writeAudit(
  supabase: any,
  args: {
    organizationId: string;
    claimId: string | null;
    patientId: string | null;
    objectType: string;
    objectId: string | null;
    action: string;
    summary: string;
    metadata: Record<string, unknown>;
    userId: string | null;
    userRole: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
) {
  await supabase.from("audit_logs").insert({
    organization_id: args.organizationId,
    claim_id: args.claimId,
    patient_id: args.patientId,
    object_type: args.objectType,
    object_id: args.objectId,
    action: args.action,
    event_type: "refund_action",
    event_summary: args.summary,
    event_metadata: args.metadata,
    user_id: args.userId,
    user_role: args.userRole,
    before_value: args.before ?? null,
    after_value: args.after ?? null,
  });
}

/**
 * For Credit Balance Review rows we need an existing payment_refunds row
 * before most actions can run. This mints one from the era_claim_payments
 * record (overpayment amount = paid − charge).
 */
async function mintRefundFromEra(
  supabase: any,
  organizationId: string,
  eraId: string,
  actorId: string | null,
): Promise<{
  id: string;
  clientId: string | null;
  claimId: string | null;
  reused: boolean;
} | null> {
  const { data: era } = await supabase
    .from("era_claim_payments")
    .select(
      "id, professional_claim_id, client_id, clp03_total_charge, clp04_payment_amount",
    )
    .eq("id", eraId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!era) return null;

  // Idempotency: if a non-archived refund already tracks this ERA, reuse it
  // instead of creating duplicates on repeated action clicks.
  const { data: existing } = await supabase
    .from("payment_refunds")
    .select("id, client_id, professional_claim_id")
    .eq("organization_id", organizationId)
    .eq("source_era_claim_payment_id", era.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return {
      id: text(existing.id),
      clientId: text(existing.client_id) || null,
      claimId: text(existing.professional_claim_id) || null,
      reused: true,
    };
  }

  // ERA-derived refunds need a payer_profile_id (NOT NULL on join paths);
  // pull it from the claim.
  let payerProfileId: string | null = null;
  if (era.professional_claim_id) {
    const { data: claim } = await supabase
      .from("professional_claims")
      .select("payer_profile_id")
      .eq("id", era.professional_claim_id)
      .maybeSingle();
    payerProfileId = claim ? text(claim.payer_profile_id) || null : null;
  }

  const charge = Number(era.clp03_total_charge ?? 0);
  const paid = Number(era.clp04_payment_amount ?? 0);
  const amount = Math.max(0.01, Math.round((paid - charge) * 100) / 100);
  const { data: created, error } = await supabase
    .from("payment_refunds")
    .insert({
      organization_id: organizationId,
      refund_type: "insurance",
      source_era_claim_payment_id: era.id,
      client_id: era.client_id,
      professional_claim_id: era.professional_claim_id,
      payer_profile_id: payerProfileId,
      amount,
      reason: "Credit-balance review — payer overpayment",
      refund_status: "pending",
      requested_by_actor_id: actorId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return {
    id: text((created as any).id),
    clientId: text(era.client_id) || null,
    claimId: text(era.professional_claim_id) || null,
    reused: false,
  };
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ rowId: string }> },
) {
  try {
    const { rowId: rawRowId } = await ctx.params;
    const rowId = decodeURIComponent(rawRowId);
    const body = (await request.json().catch(() => ({}))) as Body;

    const guard = await requireBillingAccess({
      requestedOrganizationId: body.organizationId ?? null,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const action = body.action;
    if (!action || !VALID.includes(action)) {
      return NextResponse.json(
        { success: false, error: `action must be one of ${VALID.join(", ")}` },
        { status: 400 },
      );
    }

    const parsed = parseRowId(rowId);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "Invalid row id" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 },
      );
    }

    const reason = text(body.reason).slice(0, 1000) || null;
    const actorId = guard.staffId ?? guard.userId ?? null;

    // ── Recoupment row (Offset Requested) ────────────────────────────────
    if (parsed.kind === "recoup") {
      const { data: rec } = await (supabase as any)
        .from("payment_recoupments")
        .select(
          "id, professional_claim_id, client_id, payer_profile_id, amount, offset_era_claim_payment_id, reason",
        )
        .eq("id", parsed.id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!rec) {
        return NextResponse.json(
          { success: false, error: "Recoupment not found" },
          { status: 404 },
        );
      }
      if (action !== "mark_complete" && action !== "dispute_refund") {
        return NextResponse.json(
          {
            success: false,
            error: "Only mark_complete or dispute_refund apply to recoupments",
          },
          { status: 400 },
        );
      }
      // Both actions archive the recoupment so the next list call removes
      // it from the Offset Requested tab (the table has no status column,
      // so archived_at is the durable resolution flag).
      await (supabase as any)
        .from("payment_recoupments")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", parsed.id)
        .eq("organization_id", organizationId);
      const after: Record<string, unknown> = {
        archived: true,
        resolution: action,
      };
      await writeAudit(supabase, {
        organizationId,
        claimId: text(rec.professional_claim_id) || null,
        patientId: text(rec.client_id) || null,
        objectType: "payment_recoupment",
        objectId: parsed.id,
        action,
        summary:
          action === "dispute_refund"
            ? "Disputed payer recoupment"
            : "Marked recoupment offset complete",
        metadata: { rowId, reason, amount: rec.amount },
        userId: guard.userId ?? null,
        userRole: guard.roles?.[0] ?? null,
        before: rec as Record<string, unknown>,
        after,
      });
      return NextResponse.json({ success: true, action, archived: true });
    }

    // ── ERA overpayment → mint a refund row first when needed ────────────
    let refundId: string;
    let refundClaimId: string | null = null;
    let refundClientId: string | null = null;
    let mintedFromEra = false;
    let reusedExisting = false;
    if (parsed.kind === "era") {
      const minted = await mintRefundFromEra(
        supabase,
        organizationId,
        parsed.id,
        actorId,
      );
      if (!minted) {
        return NextResponse.json(
          { success: false, error: "ERA payment not found" },
          { status: 404 },
        );
      }
      refundId = minted.id;
      refundClaimId = minted.claimId;
      refundClientId = minted.clientId;
      mintedFromEra = true;
      reusedExisting = minted.reused;
    } else {
      refundId = parsed.id;
    }

    const { data: refund } = await (supabase as any)
      .from("payment_refunds")
      .select(
        "id, refund_type, client_id, professional_claim_id, payer_profile_id, amount, refund_status, reason, note, requested_at, issued_at",
      )
      .eq("id", refundId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!refund) {
      return NextResponse.json(
        { success: false, error: "Refund not found" },
        { status: 404 },
      );
    }

    const before = { ...refund };
    refundClaimId = refundClaimId ?? (text(refund.professional_claim_id) || null);
    refundClientId = refundClientId ?? (text(refund.client_id) || null);

    // ── Mutate based on action ───────────────────────────────────────────
    let update: Record<string, unknown> | null = null;
    let summary = "";

    if (action === "approve_refund") {
      const noteLine = `[REFUND_APPROVED ${new Date().toISOString().slice(0, 10)}] ${reason ?? ""}`.trim();
      update = {
        refund_status: "pending",
        note: [text(refund.note), noteLine].filter(Boolean).join("\n"),
        updated_at: new Date().toISOString(),
      };
      summary = "Approved refund (ready to issue)";
    } else if (action === "issue_refund") {
      if (refund.refund_status === "issued") {
        return NextResponse.json(
          { success: false, error: "Refund is already issued" },
          { status: 422 },
        );
      }
      update = {
        refund_status: "issued",
        issued_at: new Date().toISOString(),
        issued_by_actor_id: actorId,
        updated_at: new Date().toISOString(),
      };
      summary = "Issued refund";
    } else if (action === "apply_to_balance") {
      const noteLine = `[APPLIED_TO_BALANCE ${new Date()
        .toISOString()
        .slice(0, 10)}] ${reason ?? "Credit applied to outstanding patient balance"}`;
      update = {
        refund_status: "cancelled",
        note: [text(refund.note), noteLine].filter(Boolean).join("\n"),
        updated_at: new Date().toISOString(),
      };
      summary = "Applied credit to balance (refund cancelled)";
    } else if (action === "dispute_refund") {
      if (!reason) {
        return NextResponse.json(
          { success: false, error: "A reason is required to dispute" },
          { status: 400 },
        );
      }
      update = {
        refund_status: "cancelled",
        note: [
          text(refund.note),
          `[DISPUTED ${new Date().toISOString().slice(0, 10)}] ${reason}`,
        ]
          .filter(Boolean)
          .join("\n"),
        updated_at: new Date().toISOString(),
      };
      summary = "Disputed refund (cancelled)";
    } else if (action === "mark_complete") {
      update = {
        refund_status: "issued",
        issued_at: refund.issued_at ?? new Date().toISOString(),
        issued_by_actor_id: actorId,
        updated_at: new Date().toISOString(),
      };
      summary = "Marked refund complete";
    }

    if (update) {
      const { error: updErr } = await (supabase as any)
        .from("payment_refunds")
        .update(update)
        .eq("id", refundId)
        .eq("organization_id", organizationId);
      if (updErr) {
        return NextResponse.json(
          { success: false, error: updErr.message },
          { status: 422 },
        );
      }
    }

    await writeAudit(supabase, {
      organizationId,
      claimId: refundClaimId,
      patientId: refundClientId,
      objectType: "payment_refund",
      objectId: refundId,
      action,
      summary,
      metadata: {
        rowId,
        reason,
        mintedFromEra,
        reusedExistingRefund: reusedExisting,
      },
      userId: guard.userId ?? null,
      userRole: guard.roles?.[0] ?? null,
      before,
      after: update,
    });

    return NextResponse.json({ success: true, action, refundId });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Action failed",
      },
      { status: 500 },
    );
  }
}
