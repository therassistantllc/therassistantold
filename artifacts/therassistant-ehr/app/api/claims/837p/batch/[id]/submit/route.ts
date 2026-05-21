import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Marks a claim_837p_batches row as submitted (or retried if it was rejected).
 * Use this for UI-driven Submit selected / Retry rejected on the batches page,
 * which lists rows from claim_837p_batches (NOT edi_batches).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });

    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const organizationId = String(body.organizationId ?? "").trim();
    const targetStatus = body.action === "retry" ? "submitted" : (String(body.status ?? "submitted").trim() || "submitted");
    if (!organizationId) return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });

    const { data: existing, error: lookupErr } = await supabase
      .from("claim_837p_batches")
      .select("id, batch_status")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (lookupErr) return NextResponse.json({ success: false, error: lookupErr.message }, { status: 422 });
    if (!existing) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("claim_837p_batches")
      .update({
        batch_status: targetStatus,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id, batch_status, submitted_at")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    return NextResponse.json({ success: true, batch: data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
