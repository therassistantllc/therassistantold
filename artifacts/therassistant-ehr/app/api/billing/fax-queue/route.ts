import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireBillingAccess } from "@/lib/billing/requireBillingAccess";

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }
    const { searchParams } = new URL(request.url);
    const guard = await requireBillingAccess({ requestedOrganizationId: searchParams.get("organizationId") });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const { count, error } = await (supabase as any)
      .from("fax_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    if (error) throw error;
    return NextResponse.json({ success: true, pendingCount: count ?? 0 });
  } catch (error) {
    console.error("Fax queue GET error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fax queue read failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }
    const body = await request.json().catch(() => ({}));
    const guard = await requireBillingAccess({ requestedOrganizationId: body?.organizationId ?? null });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const toFaxNumber = String(body?.toFaxNumber ?? "").trim();
    const bodyText = String(body?.body ?? "").trim();
    if (!toFaxNumber) {
      return NextResponse.json({ success: false, error: "toFaxNumber is required" }, { status: 400 });
    }
    if (!bodyText) {
      return NextResponse.json({ success: false, error: "body is required" }, { status: 400 });
    }

    const insertRow: Record<string, unknown> = {
      organization_id: organizationId,
      claim_id: body?.claimId ?? null,
      payer_id: body?.payerId ?? null,
      to_fax_number: toFaxNumber,
      subject: body?.subject ?? null,
      body: bodyText,
      status: "pending",
      created_by_user_id: guard.userId ?? null,
    };

    const { data: inserted, error: insertErr } = await (supabase as any)
      .from("fax_queue")
      .insert(insertRow)
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    const { count, error: countErr } = await (supabase as any)
      .from("fax_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    if (countErr) throw countErr;

    return NextResponse.json({
      success: true,
      id: inserted?.id ?? null,
      pendingCount: count ?? 0,
    });
  } catch (error) {
    console.error("Fax queue POST error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fax queue insert failed" },
      { status: 500 },
    );
  }
}
