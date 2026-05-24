import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

import { requireOrgAccess } from "@/lib/auth/requireOrgAccess";
import {
  REJECTION_277CA_AUTOROUTE_DEFAULTS,
  REJECTION_277CA_AUTOROUTE_SETTING_KEY,
} from "@/lib/billing/rejections277ca";
const BILLING_DEFAULTS_KEY = "billing.defaults";


const DEFAULTS = {
  claim_frequency_code: "1",
  default_pos: "11",
  default_diagnosis_behavior: "first_encounter",
  default_procedure_charge_behavior: "manual",
  eligibility_recheck_days: 30,
  claim_hold_days: 3,
  aging_bucket_rules: "30/60/90/120",
  auto_route_missing_info: true,
};

const AUTOROUTE_DEFAULTS = {
  enabled: REJECTION_277CA_AUTOROUTE_DEFAULTS.enabled,
  route_invalid_member: REJECTION_277CA_AUTOROUTE_DEFAULTS.routeInvalidMember,
  route_invalid_provider: REJECTION_277CA_AUTOROUTE_DEFAULTS.routeInvalidProvider,
};

function pickBooleans<T extends Record<string, boolean>>(
  defaults: T,
  raw: Record<string, unknown>,
): T {
  const out = { ...defaults } as Record<string, boolean>;
  for (const key of Object.keys(defaults)) {
    if (typeof raw[key] === "boolean") out[key] = raw[key] as boolean;
  }
  return out as T;
}

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

  const { data, error } = await supabase
    .from("system_settings")
    .select("setting_key,setting_value")
    .eq("organization_id", organizationId)
    .in("setting_key", [BILLING_DEFAULTS_KEY, REJECTION_277CA_AUTOROUTE_SETTING_KEY]);

  if (error) {
    console.error("[GET /api/settings/billing-defaults]", error);
    return NextResponse.json({ error: "Failed to load billing defaults" }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];
  const defaultsRow = rows.find((r) => r.setting_key === BILLING_DEFAULTS_KEY);
  const autorouteRow = rows.find((r) => r.setting_key === REJECTION_277CA_AUTOROUTE_SETTING_KEY);

  const storedDefaults =
    defaultsRow?.setting_value && typeof defaultsRow.setting_value === "object" && !Array.isArray(defaultsRow.setting_value)
      ? (defaultsRow.setting_value as Record<string, unknown>)
      : {};
  const storedAutoroute =
    autorouteRow?.setting_value && typeof autorouteRow.setting_value === "object" && !Array.isArray(autorouteRow.setting_value)
      ? (autorouteRow.setting_value as Record<string, unknown>)
      : {};

  return NextResponse.json({
    billing_defaults: { ...DEFAULTS, ...storedDefaults },
    rejections_277ca_autoroute: pickBooleans(AUTOROUTE_DEFAULTS, storedAutoroute),
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOrgAccess({
    requestedOrganizationId: req.nextUrl.searchParams.get("organizationId"),
  });
  if (guard instanceof NextResponse) return guard;
  const organizationId = guard.organizationId;

  const supabase = createServerSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database connection not available" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowedKeys = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[];
  const updates: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in body) updates[key] = body[key];
  }

  const now = new Date().toISOString();
  const upserts: Array<{
    organization_id: string;
    setting_key: string;
    setting_value: Record<string, unknown>;
    updated_at: string;
    created_at: string;
  }> = [];

  if (Object.keys(updates).length > 0) {
    upserts.push({
      organization_id: organizationId,
      setting_key: BILLING_DEFAULTS_KEY,
      setting_value: updates,
      updated_at: now,
      created_at: now,
    });
  }

  const autorouteBody =
    body.rejections_277ca_autoroute && typeof body.rejections_277ca_autoroute === "object"
      ? (body.rejections_277ca_autoroute as Record<string, unknown>)
      : null;
  if (autorouteBody) {
    const autorouteUpdates: Record<string, boolean> = {};
    for (const key of Object.keys(AUTOROUTE_DEFAULTS)) {
      if (typeof autorouteBody[key] === "boolean") {
        autorouteUpdates[key] = autorouteBody[key] as boolean;
      }
    }
    if (Object.keys(autorouteUpdates).length > 0) {
      upserts.push({
        organization_id: organizationId,
        setting_key: REJECTION_277CA_AUTOROUTE_SETTING_KEY,
        setting_value: autorouteUpdates,
        updated_at: now,
        created_at: now,
      });
    }
  }

  if (upserts.length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("system_settings")
    .upsert(upserts, { onConflict: "organization_id,setting_key" });

  if (error) {
    console.error("[PUT /api/settings/billing-defaults]", error);
    return NextResponse.json({ error: "Failed to save billing defaults" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
