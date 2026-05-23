import { NextResponse } from "next/server";
import { detachPolicyFromCase } from "@/lib/cases/clientCasesService";

import { requireOrgAccess } from "@/lib/auth/requireOrgAccess";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; caseId: string; policyId: string }> },
) {
  try {
    const { caseId, policyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const guard = await requireOrgAccess({
      requestedOrganizationId: searchParams.get("organizationId"),
    });
    if (guard instanceof NextResponse) return guard;
    const result = await detachPolicyFromCase({ organizationId: guard.organizationId, caseId, policyId });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to detach policy" },
      { status: 500 },
    );
  }
}
