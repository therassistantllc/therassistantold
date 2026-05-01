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
    const { appointmentId } = body;

    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId is required" },
        { status: 400 }
      );
    }

    // Load appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check if encounter already exists
    const { data: existingEncounter } = await supabase
      .from("encounters")
      .select("id")
      .eq("appointment_id", appointmentId)
      .is("archived_at", null)
      .maybeSingle();

    if (existingEncounter) {
      return NextResponse.json({
        success: true,
        message: "Encounter already exists for this appointment",
        encounter: existingEncounter,
      });
    }

    // Create new encounter
    const now = new Date().toISOString();
    const encounterPayload = {
      id: generateUuid(),
      organization_id: appointment.organization_id,
      patient_id: appointment.client_id,
      provider_id: appointment.provider_id,
      appointment_id: appointmentId,
      encounter_status: "draft",
      service_date: appointment.scheduled_start_at
        ? new Date(appointment.scheduled_start_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      place_of_service: appointment.appointment_type === "Telehealth" ? "02" : "11",
      created_at: now,
      updated_at: now,
    };

    const { data: encounter, error: encounterError } = await supabase
      .from("encounters")
      .insert(encounterPayload)
      .select()
      .single();

    if (encounterError) {
      console.error("Failed to create encounter:", encounterError);
      return NextResponse.json(
        { error: "Failed to create encounter" },
        { status: 500 }
      );
    }

    // Create workqueue item for billing readiness
    const workqueuePayload = {
      id: generateUuid(),
      organization_id: appointment.organization_id,
      title: "Encounter created - needs documentation",
      work_type: "ready_to_bill",
      work_status: "queued",
      priority: "medium",
      source_object_type: "encounter",
      source_object_id: encounter.id,
      patient_id: appointment.client_id,
      encounter_id: encounter.id,
      appointment_id: appointmentId,
      created_at: now,
      updated_at: now,
    };

    await supabase
      .from("workqueue_items")
      .insert(workqueuePayload);

    return NextResponse.json({
      success: true,
      message: "Encounter created successfully",
      encounter,
    });
  } catch (error) {
    console.error("Create encounter error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create encounter",
      },
      { status: 500 }
    );
  }
}
