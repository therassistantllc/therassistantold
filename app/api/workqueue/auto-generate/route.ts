// File: app/api/workqueue/auto-generate/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

function generateUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const workqueueItems: any[] = [];

    // 1. Find appointments with missing or stale eligibility
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        id,
        client_id,
        insurance_policy_id,
        scheduled_start_at
      `)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .gte("scheduled_start_at", now)
      .limit(100);

    for (const appt of appointments || []) {
      if (!appt.client_id || !appt.insurance_policy_id) continue;

      // Check eligibility status
      const { data: eligibility } = await supabase
        .from("eligibility_checks")
        .select("id, eligibility_status, checked_at")
        .eq("patient_id", appt.client_id)
        .eq("insurance_policy_id", appt.insurance_policy_id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const needsCheck =
        !eligibility ||
        eligibility.eligibility_status === "not_checked" ||
        eligibility.eligibility_status === "stale" ||
        !eligibility.checked_at ||
        eligibility.checked_at < thirtyDaysAgo;

      if (needsCheck) {
        // Check if workqueue item already exists
        const { data: existing } = await supabase
          .from("workqueue_items")
          .select("id")
          .eq("queue_type", "eligibility_needed")
          .eq("client_id", appt.client_id)
          .eq("status", "open")
          .is("archived_at", null)
          .maybeSingle();

        if (!existing) {
          workqueueItems.push({
            id: generateUuid(),
            organization_id: organizationId,
            queue_type: "eligibility_needed",
            work_type: "eligibility_verification",
            status: "open",
            priority: "high",
            title: `Eligibility check needed`,
            description: `Patient has upcoming appointment on ${appt.scheduled_start_at.split("T")[0]} but eligibility is missing or stale`,
            client_id: appt.client_id,
            appointment_id: appt.id,
            created_at: now,
          });
        }
      }
    }

    // 2. Find encounters without claims (ready_to_bill)
    const { data: encounters } = await supabase
      .from("encounters")
      .select(`
        id,
        client_id,
        encounter_status,
        service_date
      `)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("encounter_status", ["signed", "completed"])
      .limit(100);

    for (const enc of encounters || []) {
      const { data: claim } = await supabase
        .from("claims")
        .select("id")
        .eq("encounter_id", enc.id)
        .is("archived_at", null)
        .maybeSingle();

      if (!claim) {
        // Check if workqueue item already exists
        const { data: existing } = await supabase
          .from("workqueue_items")
          .select("id")
          .eq("queue_type", "ready_to_bill")
          .eq("encounter_id", enc.id)
          .eq("status", "open")
          .is("archived_at", null)
          .maybeSingle();

        if (!existing) {
          workqueueItems.push({
            id: generateUuid(),
            organization_id: organizationId,
            queue_type: "ready_to_bill",
            work_type: "claim_creation",
            status: "open",
            priority: "normal",
            title: `Encounter ready for billing`,
            description: `Signed encounter from ${enc.service_date} needs claim creation`,
            client_id: enc.client_id,
            encounter_id: enc.id,
            created_at: now,
          });
        }
      }
    }

    // 3. Find claims with no response (no_response queue)
    const { data: claimsNoResponse } = await supabase
      .from("claims")
      .select(`
        id,
        client_id,
        encounter_id,
        submission_status,
        submitted_at
      `)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("submission_status", "submitted")
      .lt("submitted_at", thirtyDaysAgo)
      .limit(100);

    for (const claim of claimsNoResponse || []) {
      // Check if there's a response transaction
      const { data: response } = await supabase
        .from("external_transactions")
        .select("id")
        .eq("source_object_id", claim.id)
        .in("transaction_type", ["277", "835"])
        .eq("processing_status", "succeeded")
        .maybeSingle();

      if (!response) {
        // Check if workqueue item already exists
        const { data: existing } = await supabase
          .from("workqueue_items")
          .select("id")
          .eq("queue_type", "no_response")
          .eq("claim_id", claim.id)
          .eq("status", "open")
          .is("archived_at", null)
          .maybeSingle();

        if (!existing) {
          workqueueItems.push({
            id: generateUuid(),
            organization_id: organizationId,
            queue_type: "no_response",
            work_type: "claim_follow_up",
            status: "open",
            priority: "high",
            title: `Claim missing response`,
            description: `Claim submitted over 30 days ago with no clearinghouse response (277/835)`,
            client_id: claim.client_id,
            claim_id: claim.id,
            encounter_id: claim.encounter_id,
            created_at: now,
          });
        }
      }
    }

    // 4. Find rejected claims
    const { data: rejectedClaims } = await supabase
      .from("claims")
      .select(`
        id,
        client_id,
        encounter_id,
        claim_status
      `)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("claim_status", "rejected")
      .limit(100);

    for (const claim of rejectedClaims || []) {
      // Check if workqueue item already exists
      const { data: existing } = await supabase
        .from("workqueue_items")
        .select("id")
        .eq("queue_type", "rejected")
        .eq("claim_id", claim.id)
        .eq("status", "open")
        .is("archived_at", null)
        .maybeSingle();

      if (!existing) {
        workqueueItems.push({
          id: generateUuid(),
          organization_id: organizationId,
          queue_type: "rejected",
          work_type: "claim_correction",
          status: "open",
          priority: "urgent",
          title: `Rejected claim needs attention`,
          description: `Claim was rejected by clearinghouse and requires correction`,
          client_id: claim.client_id,
          claim_id: claim.id,
          encounter_id: claim.encounter_id,
          created_at: now,
        });
      }
    }

    // Insert all new workqueue items
    if (workqueueItems.length > 0) {
      const { error: insertError } = await supabase
        .from("workqueue_items")
        .insert(workqueueItems);

      if (insertError) {
        console.error("Failed to insert workqueue items:", insertError);
        return NextResponse.json(
          { error: "Failed to generate workqueue items" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      itemsCreated: workqueueItems.length,
      queues: {
        eligibility_needed: workqueueItems.filter((i) => i.queue_type === "eligibility_needed").length,
        ready_to_bill: workqueueItems.filter((i) => i.queue_type === "ready_to_bill").length,
        no_response: workqueueItems.filter((i) => i.queue_type === "no_response").length,
        rejected: workqueueItems.filter((i) => i.queue_type === "rejected").length,
      },
      message: `Auto-generated ${workqueueItems.length} workqueue items`,
    });
  } catch (error) {
    console.error("Auto-generate workqueue error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to auto-generate workqueue",
      },
      { status: 500 }
    );
  }
}
