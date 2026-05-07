import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

function generateUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function POST() {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 500 },
      );
    }

    const { data: existingOrg, error: existingErr } = await supabase
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existingOrg?.id) {
      return NextResponse.json({ success: true, organizationId: existingOrg.id, created: false });
    }

    const now = new Date().toISOString();
    const organizationId = generateUuid();
    const organizationName = `Organization ${new Date().toLocaleDateString("en-US")}`;

    // Try with common columns first, then gracefully fall back if schema differs.
    const attempts: Array<Record<string, unknown>> = [
      { id: organizationId, name: organizationName, created_at: now, updated_at: now },
      { id: organizationId, name: organizationName },
      { name: organizationName },
    ];

    let createdId: string | null = null;
    let lastError: unknown = null;

    for (const payload of attempts) {
      const { data, error } = await supabase
        .from("organizations")
        .insert(payload)
        .select("id")
        .single();

      if (!error && data?.id) {
        createdId = String(data.id);
        break;
      }

      lastError = error;
    }

    if (!createdId) {
      throw lastError ?? new Error("Could not create organization");
    }

    return NextResponse.json({ success: true, organizationId: createdId, created: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create organization",
      },
      { status: 500 },
    );
  }
}
