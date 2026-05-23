import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedStaff } from "@/lib/rbac/auth";
import { writeChartObjectAuditLogs } from "@/lib/audit/chartObjectAudit";

const POLICY_COLUMN_LABELS: Record<string, string> = {
  group_number: "Group number",
  plan_name: "Plan name",
  policy_number: "Policy number",
  subscriber_id: "Subscriber ID",
  archived_at: "Archived",
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; policyId: string }> },
) {
  try {
    const ctx = await requireAuthenticatedStaff();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id: clientId, policyId } = await context.params;
    const body = (await request.json()) as {
      organizationId?: string;
      groupNumber?: string | null;
    };

    if (!("groupNumber" in body)) {
      return NextResponse.json(
        { success: false, error: "groupNumber is required" },
        { status: 400 },
      );
    }

    // Authoritative org always comes from the auth context. If a body
    // organizationId is supplied it must match — never trust it on its own.
    const organizationId = ctx.organizationId;
    if (body.organizationId && body.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: "Organization mismatch" },
        { status: 403 },
      );
    }

    const raw = body.groupNumber;
    const normalized =
      typeof raw === "string" ? raw.trim() : raw == null ? null : String(raw).trim();
    const nextValue = normalized ? normalized : null;

    if (nextValue && nextValue.length > 80) {
      return NextResponse.json(
        { success: false, error: "Group number must be 80 characters or fewer" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from("insurance_policies")
      .select("id, organization_id, client_id, archived_at, group_number")
      .eq("id", policyId)
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 },
      );
    }

    if (!existing || existing.archived_at) {
      return NextResponse.json(
        { success: false, error: "Policy not found" },
        { status: 404 },
      );
    }

    const priorGroup = (existing as { group_number?: string | null }).group_number ?? null;

    // Write audit FIRST so a failure refuses the mutation, matching the
    // demographics pattern (HIPAA — no silent un-audited PHI edits).
    if (priorGroup !== nextValue) {
      await writeChartObjectAuditLogs({
        supabase,
        organizationId,
        patientId: clientId,
        staff: ctx,
        objectType: "insurance_policy",
        objectId: policyId,
        action: "insurance_policy_updated",
        objectLabel: "Insurance policy",
        before: { group_number: priorGroup },
        after: { group_number: nextValue },
        columnLabels: POLICY_COLUMN_LABELS,
      });
    }

    const { error: updateError } = await supabase
      .from("insurance_policies")
      .update({ group_number: nextValue })
      .eq("id", policyId)
      .eq("organization_id", organizationId)
      .eq("client_id", clientId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, groupNumber: nextValue });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update policy",
      },
      { status: 500 },
    );
  }
}
