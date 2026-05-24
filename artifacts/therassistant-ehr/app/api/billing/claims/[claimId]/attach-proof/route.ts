/**
 * POST /api/billing/claims/[claimId]/attach-proof
 *
 * Records proof of timely filing as a structured claim note. Stores the
 * proof reference (clearinghouse trace #, fax confirmation #, URL, etc.)
 * so it surfaces in the Timely Filing Risk detail panel.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

const text = (v: unknown) => String(v ?? "").trim();

interface Body {
  organizationId?: string;
  kind?: string;
  reference?: string;
  description?: string;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ claimId: string }> },
) {
  try {
    const { claimId } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as Body;
    const guard = await requireBillingAccess({
      requestedOrganizationId: body.organizationId ?? null,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 },
      );
    }

    const kind = text(body.kind) || "other";
    const reference = text(body.reference);
    const description = text(body.description);
    if (!reference && !description) {
      return NextResponse.json(
        { success: false, error: "Reference or description required" },
        { status: 400 },
      );
    }

    const { data: claim } = await (supabase as any)
      .from("professional_claims")
      .select("id")
      .eq("id", claimId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!claim) {
      return NextResponse.json(
        { success: false, error: "Claim not found" },
        { status: 404 },
      );
    }

    const noteBody = [
      "[Proof of timely filing]",
      `Kind: ${kind}`,
      reference ? `Reference: ${reference}` : null,
      description ? `Notes: ${description}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await (supabase as any).from("claim_notes").insert({
      organization_id: organizationId,
      claim_id: claimId,
      author_user_id: guard.userId ?? null,
      author_display_name: "Timely Filing workqueue",
      body: noteBody,
    });
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
