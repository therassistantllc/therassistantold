// File: app/api/encounters/create/route.ts
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
    const { appointmentId, organizationId } = body;

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
        encounter: existingEncounter,
        message: "Encounter already exists for this appointment",
      });
    }

    // Create encounter
    const now = new Date().toISOString();
    const encounterPayload = {
      id: generateUuid(),
      organization_id: appointment.organization_id,
      client_id: appointment.client_id,
      provider_id: appointment.provider_id,
      appointment_id: appointmentId,
      encounter_status: "draft",
      service_date: appointment.scheduled_start_at?.split("T")[0] || now.split("T")[0],
      started_at: appointment.scheduled_start_at,
      chief_complaint: appointment.reason || null,
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

    return NextResponse.json({
      success: true,
      encounter,
      message: "Encounter created successfully",
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
