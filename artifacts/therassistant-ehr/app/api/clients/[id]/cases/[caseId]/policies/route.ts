import { NextResponse } from "next/server";
import {
  attachPolicyToCase,
  reorderCasePolicies,
  type PolicyPriority,
} from "@/lib/cases/clientCasesService";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    const body = (await request.json()) as {
      organizationId?: string;
      policyId?: string;
      priority?: PolicyPriority;
    };
    if (!body.organizationId || !body.policyId || !body.priority) {
      return NextResponse.json(
        { success: false, error: "organizationId, policyId, and priority are required" },
        { status: 400 },
      );
    }
    const result = await attachPolicyToCase({
      organizationId: body.organizationId,
      caseId,
      policyId: body.policyId,
      priority: body.priority,
    });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to attach policy" },
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
      ordered?: Array<{ policyId: string; priority: PolicyPriority }>;
    };
    if (!body.organizationId || !Array.isArray(body.ordered)) {
      return NextResponse.json(
        { success: false, error: "organizationId and ordered are required" },
        { status: 400 },
      );
    }
    const result = await reorderCasePolicies({
      organizationId: body.organizationId,
      caseId,
      ordered: body.ordered,
    });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reorder policies" },
      { status: 500 },
    );
  }
}
