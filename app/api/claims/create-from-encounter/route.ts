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
    const { encounterId } = body;

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
        message: "Claim already exists for this encounter",
        claim: existingClaim,
      });
    }

    // Create new claim
    const now = new Date().toISOString();
    const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    
    const claimPayload = {
      id: generateUuid(),
      organization_id: encounter.organization_id,
      patient_id: encounter.patient_id,
      provider_id: encounter.provider_id,
      encounter_id: encounterId,
      claim_number: claimNumber,
      claim_status: "draft",
      filing_date: now.split("T")[0],
      service_date_start: encounter.service_date || now.split("T")[0],
      service_date_end: encounter.service_date || now.split("T")[0],
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

    // Create external_transactions record for future 837 submission
    const duplicateDetectionKey = `837-${encounterId}-${now.slice(0, 10)}`;
    
    const transactionPayload = {
      id: generateUuid(),
      organization_id: encounter.organization_id,
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
      source_object_id: claim.id,
      duplicate_detection_key: duplicateDetectionKey,
      request_payload: {
        claim_id: claim.id,
        encounter_id: encounterId,
        claim_number: claimNumber,
        service_date: encounter.service_date,
      },
      created_at: now,
      updated_at: now,
    };

    const { data: transaction, error: txnError } = await supabase
      .from("external_transactions")
      .insert(transactionPayload)
      .select()
      .single();

    if (txnError) {
      console.error("Failed to create transaction:", txnError);
      // Continue even if transaction creation fails
    }

    // Create workqueue item for claim submission
    const workqueuePayload = {
      id: generateUuid(),
      organization_id: encounter.organization_id,
      title: `Claim ${claimNumber} ready to submit`,
      work_type: "ready_to_submit",
      work_status: "queued",
      priority: "medium",
      source_object_type: "claim",
      source_object_id: claim.id,
      patient_id: encounter.patient_id,
      encounter_id: encounterId,
      claim_id: claim.id,
      external_transaction_id: transaction?.id || null,
      created_at: now,
      updated_at: now,
    };

    await supabase
      .from("workqueue_items")
      .insert(workqueuePayload);

    return NextResponse.json({
      success: true,
      message: "Claim created successfully",
      claim,
      transaction,
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
