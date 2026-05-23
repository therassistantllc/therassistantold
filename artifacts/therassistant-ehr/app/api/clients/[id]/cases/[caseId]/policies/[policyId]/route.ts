import { NextResponse } from "next/server";
import { detachPolicyFromCase } from "@/lib/cases/clientCasesService";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; caseId: string; policyId: string }> },
) {
  try {
    const { caseId, policyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }
    const result = await detachPolicyFromCase({ organizationId, caseId, policyId });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to detach policy" },
      { status: 500 },
    );
  }
}
