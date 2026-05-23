import { NextResponse } from "next/server";
import { archiveCase, getCaseById, updateCase, type CaseType } from "@/lib/cases/clientCasesService";

import { requireOrgAccess } from "@/lib/auth/requireOrgAccess";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    const { searchParams } = new URL(request.url);
    const guard = await requireOrgAccess({
      requestedOrganizationId: searchParams.get("organizationId"),
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;
    const c = await getCaseById({ organizationId, caseId });
    if (!c) return NextResponse.json({ success: false, error: "Case not found" }, { status: 404 });
    return NextResponse.json({ success: true, case: c });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load case" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    const body = (await request.json()) as {
      organizationId?: string;
      name?: string;
      caseType?: CaseType;
      notes?: string | null;
      activeFlag?: boolean;
      isDefault?: boolean;
    };
    const guard = await requireOrgAccess({
      requestedOrganizationId: body.organizationId,
    });
    if (guard instanceof NextResponse) return guard;
    const result = await updateCase({
      organizationId: guard.organizationId,
      caseId,
      name: body.name,
      caseType: body.caseType,
      notes: "notes" in body ? body.notes ?? null : undefined,
      activeFlag: body.activeFlag,
      isDefault: body.isDefault,
    });
    if (!result.ok) return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, case: result.case });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update case" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    const { searchParams } = new URL(request.url);
    const guard = await requireOrgAccess({
      requestedOrganizationId: searchParams.get("organizationId"),
    });
    if (guard instanceof NextResponse) return guard;
    const result = await archiveCase({ organizationId: guard.organizationId, caseId });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to archive case" },
      { status: 500 },
    );
  }
}
