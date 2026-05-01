// File: app/api/claims/create/route.ts
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
    const { encounterId, organizationId } = body;

    if (!encounterId) {
      return NextResponse.json(
        { error: "encounterId is required" },
        { status: 400 }
      );
    }

    // Load encounter
    const { data: encounter, error: encounterError } = await supabase
      .from("encounters")
      .select("*")
      .eq("id", encounterId)
      .single();

    if (encounterError || !encounter) {
      return NextResponse.json(
        { error: "Encounter not found" },
        { status: 404 }
      );
    }

    // Check if claim already exists
    const { data: existingClaim } = await supabase
      .from("claims")
      .select("id")
      .eq("encounter_id", encounterId)
      .is("archived_at", null)
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json({
        success: true,
        claim: existingClaim,
        message: "Claim already exists for this encounter",
      });
    }

    const now = new Date().toISOString();
    const claimId = generateUuid();
    const transactionId = generateUuid();

    // Load service lines for total charge calculation
    const { data: serviceLines } = await supabase
      .from("encounter_service_lines")
      .select("charge_amount, units")
      .eq("encounter_id", encounterId)
      .is("archived_at", null);

    const totalCharge = (serviceLines || []).reduce((sum, line) => {
      const charge = parseFloat(String(line.charge_amount || 0));
      const units = line.units || 1;
      return sum + (isFinite(charge) ? charge * units : 0);
    }, 0);

    // Create claim
    const claimPayload = {
      id: claimId,
      organization_id: encounter.organization_id,
      client_id: encounter.client_id,
      encounter_id: encounterId,
      provider_id: encounter.provider_id,
      claim_status: "draft",
      submission_status: "not_submitted",
      total_charge_amount: totalCharge.toFixed(2),
      service_date_from: encounter.service_date,
      service_date_to: encounter.service_date,
      created_at: now,
      updated_at: now,
    };

    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .insert(claimPayload)
      .select()
      .single();

    if (claimError) {
      console.error("Failed to create claim:", claimError);
      return NextResponse.json(
        { error: "Failed to create claim" },
        { status: 500 }
      );
    }

    // Get integration connection for Office Ally
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("id")
      .eq("organization_id", encounter.organization_id)
      .eq("integration_name", "office_ally")
      .maybeSingle();

    const duplicateDetectionKey = `claim-837-${encounterId}-${now.slice(0, 10)}`;

    // Create external_transactions record for 837 (queued, not yet submitted)
    const transactionPayload = {
      id: transactionId,
      organization_id: encounter.organization_id,
      integration_connection_id: connection?.id || null,
      transaction_type: "837",
      payload_type: "claim_submission",
      payload_version: "005010X222A1",
      message_format: "x12",
      envelope_format: "x12",
      processing_mode: "sandbox",
      environment_flag: "test",
      processing_status: "queued",
      sender_id: "therassistant",
      receiver_id: "office_ally",
      source_object_type: "claim",
      source_object_id: claimId,
      duplicate_detection_key: duplicateDetectionKey,
      request_payload: {
        claim_id: claimId,
        encounter_id: encounterId,
        transaction_type: "837",
        total_charge: totalCharge,
      },
      request_timestamp: now,
      created_at: now,
      updated_at: now,
    };

    const { error: txnError } = await supabase
      .from("external_transactions")
      .insert(transactionPayload);

    if (txnError) {
      console.error("Failed to create transaction:", txnError);
      // Continue even if transaction creation fails
    }

    // Create workqueue item for ready_to_submit
    const workqueuePayload = {
      id: generateUuid(),
      organization_id: encounter.organization_id,
      queue_type: "ready_to_submit",
      work_type: "claim_submission",
      status: "open",
      priority: "normal",
      title: `Claim ready for submission`,
      description: `Claim ${claimId.slice(0, 8)} created from encounter and ready to submit to clearinghouse`,
      client_id: encounter.client_id,
      claim_id: claimId,
      encounter_id: encounterId,
      created_at: now,
    };

    const { error: workqueueError } = await supabase
      .from("workqueue_items")
      .insert(workqueuePayload);

    if (workqueueError) {
      console.error("Failed to create workqueue item:", workqueueError);
      // Continue even if workqueue creation fails
    }

    return NextResponse.json({
      success: true,
      claim,
      transactionId,
      message: "Claim created successfully and queued for submission",
    });
  } catch (error) {
    console.error("Create claim error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create claim",
      },
      { status: 500 }
    );
  }
}
