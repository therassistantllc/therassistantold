import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

function generateUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "Database connection not available" }, { status: 500 });

    const { appointmentId } = await request.json();
    if (!appointmentId) return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    if (!appointment.client_id) return NextResponse.json({ error: "Appointment is missing client_id" }, { status: 422 });

    const appointmentStatus = String(appointment.appointment_status ?? appointment.status ?? "").toLowerCase();
    if (appointmentStatus !== "completed") {
      return NextResponse.json(
        { error: "Only completed appointments can create encounters for billing workflow." },
        { status: 409 },
      );
    }

    const { data: existingEncounter } = await supabase
      .from("encounters")
      .select("*")
      .eq("appointment_id", appointmentId)
      .is("archived_at", null)
      .maybeSingle();

    if (existingEncounter) {
      return NextResponse.json({ success: true, message: "Encounter already exists", encounter: existingEncounter });
    }

    const now = new Date().toISOString();
    const serviceDate = appointment.scheduled_start_at
      ? new Date(appointment.scheduled_start_at).toISOString().split("T")[0]
      : now.split("T")[0];

    const encounterPayload = {
      id: generateUuid(),
      organization_id: appointment.organization_id,
      client_id: appointment.client_id,
      provider_id: appointment.provider_id,
      appointment_id: appointmentId,
      encounter_status: "draft",
      service_date: serviceDate,
      required_billing_fields_complete: false,
      started_at: appointment.scheduled_start_at ?? null,
      ended_at: appointment.scheduled_end_at ?? null,
      created_at: now,
      updated_at: now,
    };

    const { data: encounter, error: encounterError } = await supabase
      .from("encounters")
      .insert(encounterPayload)
      .select()
      .single();

    if (encounterError) throw encounterError;

    await supabase.from("workqueue_items").insert({
      id: generateUuid(),
      organization_id: appointment.organization_id,
      title: "Encounter created - documentation needed",
      description: "Complete and sign the clinical note before claim creation.",
      work_type: "documentation_needed",
      status: "open",
      priority: "medium",
      source_object_type: "encounter",
      source_object_id: encounter.id,
      client_id: appointment.client_id,
      encounter_id: encounter.id,
      appointment_id: appointmentId,
      context_payload: { lifecycle_step: "appointment_to_encounter" },
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ success: true, message: "Encounter created successfully", encounter });
  } catch (error) {
    console.error("Create encounter error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create encounter" },
      { status: 500 },
    );
  }
}
