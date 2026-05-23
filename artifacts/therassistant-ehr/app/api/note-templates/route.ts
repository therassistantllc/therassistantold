import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedStaff } from "@/lib/rbac/auth";
import { DEFAULT_ORG_ID } from "@/lib/config";

const SELECT =
  "id, organization_id, name, service_type, cpt_code, default_subjective, default_interventions, default_plan, is_default, created_at, updated_at";

// Resolve the org for this request:
//   - If a staff user is signed in, ALWAYS use their org. The query-param org
//     is ignored entirely so a caller can't read or mutate another tenant's
//     templates by passing a different organizationId.
//   - If no auth context is available (unauthenticated dev/preview), fall
//     back to the query-param org or the configured default. This matches
//     the project's existing convention for unauthenticated dev usage.
async function resolveOrgId(req: Request): Promise<string | null> {
  const ctx = await requireAuthenticatedStaff();
  if (ctx?.organizationId) return ctx.organizationId;
  const url = new URL(req.url);
  return (
    url.searchParams.get("organizationId") ||
    process.env.NEXT_PUBLIC_ORGANIZATION_ID ||
    DEFAULT_ORG_ID ||
    null
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const organizationId = await resolveOrgId(request);
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("note_templates")
      .select(SELECT)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, organizationId, templates: data ?? [] });
  } catch (error) {
    console.error("Note templates GET error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to list note templates" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const organizationId = await resolveOrgId(request);
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const name = cleanString(body.name).trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }

    const isDefault = Boolean(body.is_default);
    const now = new Date().toISOString();

    if (isDefault) {
      // Only one default per org; clear any existing default before inserting.
      await supabase
        .from("note_templates")
        .update({ is_default: false, updated_at: now })
        .eq("organization_id", organizationId)
        .eq("is_default", true)
        .is("archived_at", null);
    }

    const { data, error } = await supabase
      .from("note_templates")
      .insert({
        organization_id: organizationId,
        name,
        service_type: optionalString(body.service_type),
        cpt_code: optionalString(body.cpt_code),
        default_subjective: cleanString(body.default_subjective),
        default_interventions: cleanString(body.default_interventions),
        default_plan: cleanString(body.default_plan),
        is_default: isDefault,
        created_at: now,
        updated_at: now,
      })
      .select(SELECT)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, template: data }, { status: 201 });
  } catch (error) {
    console.error("Note templates POST error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create note template" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const organizationId = await resolveOrgId(request);
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if ("name" in body) updates.name = cleanString(body.name).trim();
    if ("service_type" in body) updates.service_type = optionalString(body.service_type);
    if ("cpt_code" in body) updates.cpt_code = optionalString(body.cpt_code);
    if ("default_subjective" in body) updates.default_subjective = cleanString(body.default_subjective);
    if ("default_interventions" in body) updates.default_interventions = cleanString(body.default_interventions);
    if ("default_plan" in body) updates.default_plan = cleanString(body.default_plan);

    const now = new Date().toISOString();
    updates.updated_at = now;

    if ("is_default" in body) {
      const isDefault = Boolean(body.is_default);
      updates.is_default = isDefault;
      if (isDefault) {
        await supabase
          .from("note_templates")
          .update({ is_default: false, updated_at: now })
          .eq("organization_id", organizationId)
          .eq("is_default", true)
          .neq("id", id)
          .is("archived_at", null);
      }
    }

    const { data, error } = await supabase
      .from("note_templates")
      .update(updates)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)
      .select(SELECT)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, template: data });
  } catch (error) {
    console.error("Note templates PATCH error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update note template" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const organizationId = await resolveOrgId(request);
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("note_templates")
      .update({ archived_at: now, is_default: false, updated_at: now })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Note templates DELETE error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete note template" },
      { status: 500 },
    );
  }
}
