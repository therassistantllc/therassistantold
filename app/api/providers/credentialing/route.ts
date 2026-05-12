import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("provider_credentialing_profiles")
      .select("id, provider_name, credential_display, individual_npi, email, practice_name, practice_address, practice_tax_id, group_npi, group_medicaid_id, phone, taxonomy_code, individual_medicaid_id, caqh_id, other_payer_id, primary_license_number, primary_license_effective_date, payer_effective_date, payer_revalidation_date, secondary_license_number, secondary_license_effective_date, is_active, updated_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("practice_name", { ascending: true })
      .order("provider_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, organizationId, providers: data ?? [] });
  } catch (error) {
    console.error("Provider credentialing API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Provider credentialing API failed" },
      { status: 500 },
    );
  }
}
