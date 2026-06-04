import { NextResponse } from "next/server";
import { captureSignedEncounterCharge } from "@/lib/charges/signedEncounterChargeCaptureService";
import { createClaimDraftFromChargeCapture } from "@/lib/claims/chargeCaptureClaimBridgeService";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "Database connection not available" }, { status: 500 });

    const body = await request.json();
    const encounterId = text(body.encounterId);
    const organizationId = text(body.organizationId);
    if (!encounterId) return NextResponse.json({ error: "encounterId is required" }, { status: 400 });

    let encounterQuery = supabase
      .from("encounters")
      .select("id, organization_id, encounter_status")
      .eq("id", encounterId)
      .is("archived_at", null);

    if (organizationId) encounterQuery = encounterQuery.eq("organization_id", organizationId);

    const { data: encounter, error: encounterError } = await encounterQuery.maybeSingle();

    if (encounterError || !encounter) return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
    if (encounter.encounter_status !== "signed") {
      return NextResponse.json({ error: "Encounter must be signed before claim creation" }, { status: 422 });
    }

    const chargeCapture = await captureSignedEncounterCharge({
      organizationId: String(encounter.organization_id),
      encounterId,
    });

    let claimDraft = null;
    if (chargeCapture.chargeId && chargeCapture.status === "ready_for_claim") {
      claimDraft = await createClaimDraftFromChargeCapture({
        organizationId: String(encounter.organization_id),
        chargeCaptureId: chargeCapture.chargeId,
      });
    }

    return NextResponse.json({
      success: chargeCapture.ok && (!claimDraft || claimDraft.ok),
      encounterId,
      chargeCapture,
      claimDraft,
    });
  } catch (error) {
    console.error("Create claim from encounter error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create claim from encounter" },
      { status: 500 },
    );
  }
}
