import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type DbRow = Record<string, any>;

function fullName(client: DbRow | null | undefined) {
  if (!client) return "Unknown client";
  return [client.first_name, client.last_name].filter(Boolean).join(" ") || "Unknown client";
}

export async function GET(request: Request, context: { params: Promise<{ encounterId: string }> }) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }

    const { encounterId } = await context.params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }

    const { data: encounter, error: encounterError } = await supabase
      .from("encounters")
      .select("id, organization_id, appointment_id, client_id, provider_id, encounter_status, service_date, started_at, ended_at, required_billing_fields_complete")
      .eq("organization_id", organizationId)
      .eq("id", encounterId)
      .is("archived_at", null)
      .maybeSingle();

    if (encounterError || !encounter) {
      return NextResponse.json({ success: false, error: "Encounter not found" }, { status: 404 });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id, first_name, last_name, date_of_birth, preferred_name, pronouns")
      .eq("organization_id", organizationId)
      .eq("id", encounter.client_id)
      .is("archived_at", null)
      .maybeSingle();

    const { data: appointment } = encounter.appointment_id
      ? await supabase
          .from("appointments")
          .select("id, scheduled_start_at, scheduled_end_at, appointment_type, service_location, telehealth_url, appointment_status")
          .eq("organization_id", organizationId)
          .eq("id", encounter.appointment_id)
          .is("archived_at", null)
          .maybeSingle()
      : { data: null };

    const { data: diagnoses } = await supabase
      .from("encounter_diagnoses")
      .select("id, diagnosis_code, diagnosis_description, is_primary, sequence_number, present_on_claim")
      .eq("organization_id", organizationId)
      .eq("encounter_id", encounterId)
      .is("archived_at", null)
      .order("sequence_number", { ascending: true });

    const { data: serviceLines } = await supabase
      .from("encounter_service_lines")
      .select("id, service_date, sequence_number, cpt_hcpcs_code, modifier_1, modifier_2, modifier_3, modifier_4, units, charge_amount, place_of_service_code")
      .eq("organization_id", organizationId)
      .eq("encounter_id", encounterId)
      .is("archived_at", null)
      .order("sequence_number", { ascending: true });

    return NextResponse.json({
      success: true,
      organizationId,
      encounter,
      patient: client
        ? {
            id: client.id,
            name: fullName(client),
            preferredName: client.preferred_name,
            dateOfBirth: client.date_of_birth,
            pronouns: client.pronouns,
          }
        : null,
      appointment: appointment ?? null,
      diagnoses: diagnoses ?? [],
      serviceLines: serviceLines ?? [],
    });
  } catch (error) {
    console.error("Encounter summary API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Encounter summary failed" },
      { status: 500 },
    );
  }
}
