// File: app/api/patients/[patientId]/eligibility/route.ts
import { NextResponse } from "next/server";
import { ClearinghouseService } from "@/lib/clearinghouse/ClearinghouseService";

export async function GET(
  _request: Request,
  context: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await context.params;
    const service = new ClearinghouseService();
    const result = await service.getPatientEligibility(patientId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load eligibility history." },
      { status: 500 }
    );
  }
}
