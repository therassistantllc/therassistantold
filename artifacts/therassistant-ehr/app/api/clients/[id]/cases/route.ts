import { NextResponse } from "next/server";
import { createCase, listCasesForClient, type CaseType } from "@/lib/cases/clientCasesService";

import { requireOrgAccess } from "@/lib/auth/requireOrgAccess";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const guard = await requireOrgAccess({
      requestedOrganizationId: searchParams.get("organizationId"),
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;
    const includeArchived = searchParams.get("includeArchived") === "true";
    const cases = await listCasesForClient({ organizationId, clientId: id, includeArchived });
    return NextResponse.json({ success: true, cases });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load cases" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
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
    const result = await createCase({
      organizationId: guard.organizationId,
      clientId: id,
      name: body.name ?? "",
      caseType: body.caseType,
      notes: body.notes ?? null,
      activeFlag: body.activeFlag,
      isDefault: body.isDefault,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ success: true, case: result.case });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create case" },
      { status: 500 },
    );
  }
}
