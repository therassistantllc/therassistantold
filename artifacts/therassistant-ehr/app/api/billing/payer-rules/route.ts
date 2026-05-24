/**
 * POST /api/billing/payer-rules
 *
 * Records a payer-specific handling rule (e.g. "When Aetna returns
 * RARC M25, always attach the treatment plan and resubmit"). We do
 * not yet have a dedicated payer_rules table, so the rule is
 * persisted as an `audit_logs` row with object_type='payer_rule'
 * (durable + queryable) and, when claims are provided, also stamped
 * as a [Payer rule] note on each affected claim so billers see the
 * rule in the claim timeline.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

const text = (v: unknown) => String(v ?? "").trim();

interface Body {
  organizationId?: string;
  payer?: string | null;
  rarcCode?: string | null;
  carcCode?: string | null;
  rule?: string;
  claimIds?: string[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const guard = await requireBillingAccess({
      requestedOrganizationId: body.organizationId ?? null,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const rule = text(body.rule);
    const payer = text(body.payer);
    const rarcCode = text(body.rarcCode).toUpperCase();
    const carcCode = text(body.carcCode).toUpperCase();
    if (!rule) {
      return NextResponse.json(
        { success: false, error: "rule is required" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 },
      );
    }

    const summary = `Payer rule — ${payer || "any payer"} / ${rarcCode || carcCode || "any code"}`;

    const { data: auditRow } = await (supabase as any)
      .from("audit_logs")
      .insert({
        organization_id: organizationId,
        user_id: guard.userId,
        event_type: "denials_by_rarc.payer_rule.upsert",
        event_summary: summary,
        event_metadata: { payer, rarcCode, carcCode, rule },
        action: "upsert",
        object_type: "payer_rule",
        object_id: null,
      })
      .select("id")
      .maybeSingle();

    // Drop a [Payer rule] note on every claim in the group so billers
    // see the guidance in the claim timeline.
    const claimIds = Array.isArray(body.claimIds)
      ? body.claimIds.map(text).filter(Boolean)
      : [];
    let notesWritten = 0;
    if (claimIds.length > 0) {
      const { data: claims } = await (supabase as any)
        .from("professional_claims")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", claimIds);
      const validIds = ((claims as any[]) ?? []).map((c) => text(c.id));
      for (const id of validIds) {
        const { error } = await (supabase as any).from("claim_notes").insert({
          organization_id: organizationId,
          claim_id: id,
          author_user_id: guard.userId,
          author_display_name: "[Payer rule]",
          body: `[Payer rule] ${summary}\n\n${rule}`,
        });
        if (!error) notesWritten += 1;
      }
    }

    return NextResponse.json({
      success: true,
      ruleId: (auditRow as any)?.id ?? null,
      notesWritten,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
