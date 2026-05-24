/**
 * Shared action handlers for the 277CA Rejections workqueue.
 *
 * The per-item route (`POST /api/billing/rejections-277ca/[itemId]`) and the
 * bulk route (`POST /api/billing/rejections-277ca/bulk`) both call
 * `applyRejection277CaAction` so the resubmit / route / resolve semantics are
 * defined in exactly one place.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addWorkqueueComment,
  deferWorkqueueItem,
  resolveWorkqueueItem,
} from "@/lib/workqueue/workqueueActionService";

export type Rejection277CaActionId =
  | "correct_claim"
  | "resubmit_corrected_claim"
  | "route_to_eligibility"
  | "route_to_enrollment"
  | "mark_resolved";

export interface Rejection277CaActionContext {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string | null;
  staffId: string | null;
  itemId: string;
  action: Rejection277CaActionId;
  note?: string | null;
}

export interface Rejection277CaActionResult {
  ok: boolean;
  itemId: string;
  action: Rejection277CaActionId;
  status?: string | null;
  error?: string;
  /** HTTP-style status code used by the single-item route. */
  httpStatus: number;
}

const FAR_FUTURE_ISO = "9999-12-31T00:00:00.000Z";

export async function applyRejection277CaAction(
  ctx: Rejection277CaActionContext,
): Promise<Rejection277CaActionResult> {
  const { supabase, organizationId, userId, staffId, itemId, action, note } = ctx;

  const { data: item, error: lookupErr } = await (supabase as any)
    .from("workqueue_items")
    .select(
      "id, status, professional_claim_id, client_id, work_type, context_payload",
    )
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .is("archived_at", null)
    .maybeSingle();

  if (lookupErr) {
    return {
      ok: false,
      itemId,
      action,
      error: lookupErr.message,
      httpStatus: 500,
    };
  }
  if (!item) {
    return {
      ok: false,
      itemId,
      action,
      error: "Workqueue item not found",
      httpStatus: 404,
    };
  }
  if (item.work_type !== "payer_rejection") {
    return {
      ok: false,
      itemId,
      action,
      error: "Not a 277CA rejection item",
      httpStatus: 400,
    };
  }

  const claimId: string | null = item.professional_claim_id ?? null;

  if (action === "correct_claim") {
    const r = await addWorkqueueComment({
      organizationId,
      workqueueItemId: itemId,
      userId,
      comment: note ?? "Started correcting claim from 277CA rejection.",
    });
    if (!r.ok) {
      return {
        ok: false,
        itemId,
        action,
        error: r.errors[0]?.message ?? "Action failed",
        httpStatus: 500,
      };
    }
    await writeAudit(supabase, {
      organizationId,
      userId,
      claimId,
      eventType: "rejection_277ca_correction_started",
      summary: "Biller opened 277CA rejection to correct claim.",
      metadata: { workqueueItemId: itemId, staffId },
    });
    return { ok: true, itemId, action, status: r.status, httpStatus: 200 };
  }

  if (action === "resubmit_corrected_claim") {
    if (!claimId) {
      return {
        ok: false,
        itemId,
        action,
        error: "Rejection item is not linked to a claim",
        httpStatus: 400,
      };
    }
    const { error: updErr } = await (supabase as any)
      .from("professional_claims")
      .update({
        claim_status: "ready_for_validation",
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .eq("organization_id", organizationId);
    if (updErr) {
      return { ok: false, itemId, action, error: updErr.message, httpStatus: 500 };
    }

    const r = await resolveWorkqueueItem({
      organizationId,
      workqueueItemId: itemId,
      userId,
      comment:
        note ??
        "Corrected claim queued for resubmission (claim returned to ready_for_validation).",
    });
    if (!r.ok) {
      return {
        ok: false,
        itemId,
        action,
        error: r.errors[0]?.message ?? "Action failed",
        httpStatus: 500,
      };
    }
    await writeAudit(supabase, {
      organizationId,
      userId,
      claimId,
      eventType: "rejection_277ca_resubmitted",
      summary: "Claim re-queued for batch after 277CA correction.",
      metadata: { workqueueItemId: itemId, staffId },
    });
    return { ok: true, itemId, action, status: r.status, httpStatus: 200 };
  }

  if (action === "route_to_eligibility" || action === "route_to_enrollment") {
    const reason =
      action === "route_to_eligibility"
        ? "routed_to_eligibility"
        : "routed_to_credentialing";
    const r = await deferWorkqueueItem({
      organizationId,
      workqueueItemId: itemId,
      userId,
      deferredUntil: FAR_FUTURE_ISO,
      deferReason: reason,
      comment:
        note ??
        (action === "route_to_eligibility"
          ? "Routed to eligibility for member/coverage verification."
          : "Routed to credentialing/enrollment for provider setup."),
    });
    if (!r.ok) {
      return {
        ok: false,
        itemId,
        action,
        error: r.errors[0]?.message ?? "Action failed",
        httpStatus: 500,
      };
    }
    await writeAudit(supabase, {
      organizationId,
      userId,
      claimId,
      eventType:
        action === "route_to_eligibility"
          ? "rejection_277ca_routed_eligibility"
          : "rejection_277ca_routed_enrollment",
      summary:
        action === "route_to_eligibility"
          ? "277CA rejection routed to eligibility."
          : "277CA rejection routed to credentialing/enrollment.",
      metadata: { workqueueItemId: itemId, staffId },
    });
    return { ok: true, itemId, action, status: r.status, httpStatus: 200 };
  }

  if (action === "mark_resolved") {
    const r = await resolveWorkqueueItem({
      organizationId,
      workqueueItemId: itemId,
      userId,
      comment: note ?? "Marked 277CA rejection resolved.",
    });
    if (!r.ok) {
      return {
        ok: false,
        itemId,
        action,
        error: r.errors[0]?.message ?? "Action failed",
        httpStatus: 500,
      };
    }
    await writeAudit(supabase, {
      organizationId,
      userId,
      claimId,
      eventType: "rejection_277ca_resolved",
      summary: "277CA rejection marked resolved.",
      metadata: { workqueueItemId: itemId, staffId },
    });
    return { ok: true, itemId, action, status: r.status, httpStatus: 200 };
  }

  return {
    ok: false,
    itemId,
    action,
    error: `Unknown action: ${action}`,
    httpStatus: 400,
  };
}

async function writeAudit(
  supabase: SupabaseClient,
  args: {
    organizationId: string;
    userId: string | null;
    claimId: string | null;
    eventType: string;
    summary: string;
    metadata: Record<string, unknown>;
  },
) {
  try {
    await (supabase as any).from("audit_logs").insert({
      organization_id: args.organizationId,
      user_id: args.userId,
      action: args.eventType,
      object_type: args.claimId ? "claim" : "workqueue_item",
      object_id: args.claimId ?? args.metadata.workqueueItemId ?? null,
      event_type: args.eventType,
      event_summary: args.summary,
      event_metadata: args.metadata,
    });
  } catch {
    // Audit failure must not block the action's success response.
  }
}
