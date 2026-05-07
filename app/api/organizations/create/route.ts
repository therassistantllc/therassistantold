import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

function generateUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function getBootstrapOrganizationId() {
  const fromEnv = String(process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "").trim();
  if (fromEnv && isUuid(fromEnv)) return fromEnv;
  return generateUuid();
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
    const organizationId = getBootstrapOrganizationId();
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
      return NextResponse.json({
        success: true,
        organizationId,
        created: false,
        warning: `Could not persist organization row; using bootstrap organization ID. ${extractErrorMessage(lastError)}`,
      });
    }

    return NextResponse.json({ success: true, organizationId: createdId, created: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: extractErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
