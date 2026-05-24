import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

type ActionName =
  | "check_status"
  | "request_update"
  | "move_to_no_response"
  | "add_note"
  | "resubmit";

interface ActionBody {
  organizationId?: string;
  action?: ActionName;
  note?: string | null;
}

const VALID_ACTIONS: ActionName[] = [
  "check_status",
  "request_update",
  "move_to_no_response",
  "add_note",
  "resubmit",
];

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const body = ((await request.json().catch(() => ({}))) as ActionBody) || {};
    const { id: claimId } = await ctx.params;
    const action = body.action;
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing `action`" },
        { status: 400 },
      );
    }

    const guard = await requireBillingAccess({
      requestedOrganizationId: body.organizationId ?? null,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    // Verify the claim belongs to this org.
    const { data: claim, error: claimErr } = await supabase
      .from("professional_claims")
      .select("id, claim_status, claim_number")
      .eq("id", claimId)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .maybeSingle();
    if (claimErr) {
      return NextResponse.json({ success: false, error: claimErr.message }, { status: 422 });
    }
    if (!claim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const note = (body.note ?? "").trim() || null;
    let newClaimStatus: string | null = null;
    let eventStatus = "manual_action";
    let eventMessage = "";

    switch (action) {
      case "check_status":
        eventStatus = "status_check_requested";
        eventMessage = note ?? "Manual status check requested by biller.";
        break;
      case "request_update":
        eventStatus = "update_requested";
        eventMessage = note ?? "Biller requested an update from the payer/clearinghouse.";
        break;
      case "move_to_no_response":
        eventStatus = "no_response_risk";
        eventMessage = note ?? "Moved to No Response Risk queue.";
        break;
      case "add_note":
        if (!note) {
          return NextResponse.json(
            { success: false, error: "`note` is required for add_note" },
            { status: 400 },
          );
        }
        eventStatus = "note";
        eventMessage = note;
        break;
      case "resubmit":
        // Send the claim back through validation so the next batch picks it up.
        newClaimStatus = "ready_for_validation";
        eventStatus = "resubmit_requested";
        eventMessage = note ?? "Biller marked the claim for resubmission.";
        break;
    }

    // Apply claim status change if applicable.
    if (newClaimStatus) {
      const { error: updateErr } = await supabase
        .from("professional_claims")
        .update({ claim_status: newClaimStatus, updated_at: nowIso })
        .eq("id", claimId)
        .eq("organization_id", organizationId);
      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 422 });
      }
    }

    // Always log an audit-trail event.
    const { error: eventErr } = await supabase.from("claim_status_events").insert({
      claim_id: claimId,
      source: "biller",
      status: eventStatus,
      status_message: eventMessage,
      raw_payload: {
        action,
        organization_id: organizationId,
        actor_user_id: guard.userId ?? null,
        previous_status: claim.claim_status,
        new_status: newClaimStatus ?? claim.claim_status,
      },
    });
    if (eventErr) {
      return NextResponse.json({ success: false, error: eventErr.message }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      claimId,
      action,
      newClaimStatus: newClaimStatus ?? claim.claim_status,
      message: eventMessage,
    });
  } catch (error) {
    console.error("submitted-claims action error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Action failed",
      },
      { status: 500 },
    );
  }
}
