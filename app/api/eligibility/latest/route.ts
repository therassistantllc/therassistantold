import { NextRequest, NextResponse } from "next/server";
import { getLatestEligibilityForPatient } from "@/lib/eligibility/latestEligibilityService";

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get("organization_id");
    const clientId = req.nextUrl.searchParams.get("client_id") ?? req.nextUrl.searchParams.get("patient_id");
    const payerId = req.nextUrl.searchParams.get("payer_id");

    if (!organizationId || !clientId) {
      return NextResponse.json(
        { error: "organization_id and client_id are required" },
        { status: 400 }
      );
    }

    const eligibility = await getLatestEligibilityForPatient({
      organization_id: organizationId,
      client_id: clientId,
      payer_id: payerId,
    });

    return NextResponse.json({
      ok: true,
      eligibility,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
