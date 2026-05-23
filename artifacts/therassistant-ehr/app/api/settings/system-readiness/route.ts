import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { runConfigValidation } from "@/lib/validation/runValidation";


import { requireOrgAccess } from "@/lib/auth/requireOrgAccess";
export async function GET(req: NextRequest) {
  const guard = await requireOrgAccess({
    requestedOrganizationId: req.nextUrl.searchParams.get("organizationId"),
  });
  if (guard instanceof NextResponse) return guard;
  const organizationId = guard.organizationId;

  const supabase = createServerSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database connection not available" }, { status: 503 });
  }

  try {
    const report = await runConfigValidation(supabase, organizationId);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
