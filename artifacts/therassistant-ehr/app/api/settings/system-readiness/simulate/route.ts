import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { runTestClaimSimulation } from "@/lib/validation/simulation";

import { requireOrgAccess } from "@/lib/auth/requireOrgAccess";
/**
 * POST /api/settings/system-readiness/simulate
 *
 * Validation-only test-claim simulation. Synthesises a non-PHI test claim
 * from configuration and checks every dependency the 837P generator would
 * touch. NEVER transmits to a clearinghouse, NEVER persists.
 *
 * Body: { organizationId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const guard = await requireOrgAccess({
      requestedOrganizationId:
        typeof body?.organizationId === "string" ? body.organizationId.trim() : null,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database connection not available" }, { status: 503 });
    }

    const report = await runTestClaimSimulation(supabase, organizationId);
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test claim simulation failed" },
      { status: 500 },
    );
  }
}
