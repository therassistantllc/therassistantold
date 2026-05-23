import { NextResponse } from "next/server";
import { createServerSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkProviderAvailability } from "@/lib/scheduling/core";

import { requireOrgAccess } from "@/lib/auth/requireOrgAccess";
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Service role key is required for availability checks." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      organizationId?: string;
      providerId?: string;
      startAt?: string;
      endAt?: string;
      location?: "office" | "telehealth" | "any";
    };

    const guard = await requireOrgAccess({
      requestedOrganizationId: body.organizationId,
    });
    if (guard instanceof NextResponse) return guard;
    const organizationId = guard.organizationId;

    const providerId = String(body.providerId ?? "").trim();
    const startAt = String(body.startAt ?? "").trim();
    const endAt = String(body.endAt ?? "").trim();
    const location = body.location ?? "any";

    const result = await checkProviderAvailability({
      supabase,
      organizationId,
      providerId,
      startAt,
      endAt,
      location,
    });

    return NextResponse.json({ success: true, organizationId, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Availability check failed",
      },
      { status: 500 },
    );
  }
}
