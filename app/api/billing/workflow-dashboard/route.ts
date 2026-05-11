import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

async function countRows(table: string, filters: Record<string, string>) {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection not available");

  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [field, value] of Object.entries(filters)) {
    query = query.eq(field, value);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countWorkqueue(organizationId: string, workType: string) {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection not available");

  const { count, error } = await supabase
    .from("workqueue_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("work_type", workType)
    .in("status", ["open", "in_progress", "blocked"])
    .is("archived_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }

    const claimStatuses = [
      "ready_for_validation",
      "validation_failed",
      "ready_for_batch",
      "batched",
      "submitted",
      "accepted_oa",
      "rejected_oa",
      "accepted_payer",
      "rejected_payer",
      "paid",
      "denied",
    ];

    const batchStatuses = [
      "generated",
      "submitted",
      "accepted_999",
      "rejected_999",
      "accepted_277ca",
      "rejected_277ca",
      "partially_accepted",
      "failed",
    ];

    const claimCounts: Record<string, number> = {};
    for (const status of claimStatuses) {
      claimCounts[status] = await countRows("professional_claims", {
        organization_id: organizationId,
        claim_status: status,
      });
    }

    const batchCounts: Record<string, number> = {};
    for (const status of batchStatuses) {
      batchCounts[status] = await countRows("edi_batches", {
        organization_id: organizationId,
        status,
      });
    }

    const workqueueCounts = {
      no_response: await countWorkqueue(organizationId, "no_response"),
      clearinghouse_rejection: await countWorkqueue(organizationId, "clearinghouse_rejection"),
      payer_rejection: await countWorkqueue(organizationId, "payer_rejection"),
      eligibility_needed: await countWorkqueue(organizationId, "eligibility_needed"),
      payment_posting_needed: await countWorkqueue(organizationId, "payment_posting_needed"),
    };

    return NextResponse.json({
      success: true,
      organizationId,
      claimCounts,
      batchCounts,
      workqueueCounts,
      totals: {
        needsBillingAction:
          claimCounts.validation_failed +
          claimCounts.rejected_oa +
          claimCounts.rejected_payer +
          workqueueCounts.no_response +
          workqueueCounts.clearinghouse_rejection +
          workqueueCounts.payer_rejection,
        readyToSend: claimCounts.ready_for_batch,
        waitingForResponse: claimCounts.submitted + claimCounts.accepted_oa,
        payerAccepted: claimCounts.accepted_payer,
      },
    });
  } catch (error) {
    console.error("Billing workflow dashboard API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Billing workflow dashboard failed" },
      { status: 500 },
    );
  }
}
