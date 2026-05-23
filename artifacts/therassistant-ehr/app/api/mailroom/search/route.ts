/**
 * GET /api/mailroom/search?organizationId=&type=patient|claim|encounter&q=
 *
 * Lightweight typeahead search powering the mailroom filing destination picker.
 * Returns a small, display-ready list of entities scoped to the org so users
 * can resolve the correct UUID without pasting it by hand.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedStaff } from "@/lib/rbac/auth";

type Row = Record<string, unknown>;

const MAX_LIMIT = 20;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function escapeIlike(value: string) {
  return value.replace(/[\\%_,]/g, (ch) => `\\${ch}`);
}

function fullName(row: Row | null | undefined) {
  if (!row) return "";
  return [row.first_name, row.last_name].map(text).filter(Boolean).join(" ");
}

async function searchPatients(supabase: ReturnType<typeof createServerSupabaseAdminClient>, organizationId: string, q: string, limit: number) {
  if (!supabase) return [];
  let query = supabase
    .from("clients")
    .select("id, first_name, last_name, preferred_name, date_of_birth")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("last_name", { ascending: true })
    .limit(limit);

  if (q) {
    const term = `%${escapeIlike(q)}%`;
    query = query.or(`first_name.ilike.${term},last_name.ilike.${term},preferred_name.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: Row) => {
    const name = fullName(row) || "Unnamed client";
    const dob = text(row.date_of_birth);
    return {
      id: text(row.id),
      label: name,
      sublabel: dob ? `DOB ${dob}` : "",
    };
  });
}

async function searchClaims(supabase: ReturnType<typeof createServerSupabaseAdminClient>, organizationId: string, q: string, limit: number) {
  if (!supabase) return [];
  let query = supabase
    .from("professional_claims")
    .select("id, claim_number, patient_account_number, patient_id, payer_profile_id, date_of_service_from, date_of_service_to, claim_status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    const term = `%${escapeIlike(q)}%`;
    query = query.or(`claim_number.ilike.${term},patient_account_number.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const claims = (data ?? []) as Row[];

  const patientIds = [...new Set(claims.map((row) => text(row.patient_id)).filter(Boolean))];
  const payerIds = [...new Set(claims.map((row) => text(row.payer_profile_id)).filter(Boolean))];

  const [{ data: clients }, { data: payers }] = await Promise.all([
    patientIds.length
      ? supabase.from("clients").select("id, first_name, last_name").in("id", patientIds)
      : Promise.resolve({ data: [] as Row[] }),
    payerIds.length
      ? supabase.from("insurance_payers").select("id, payer_name").in("id", payerIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const clientMap = new Map<string, Row>();
  for (const row of (clients ?? []) as Row[]) clientMap.set(text(row.id), row);
  const payerMap = new Map<string, string>();
  for (const row of (payers ?? []) as Row[]) payerMap.set(text(row.id), text(row.payer_name));

  return claims.map((row) => {
    const claimNumber = text(row.claim_number) || text(row.patient_account_number) || text(row.id).slice(0, 8);
    const patientName = fullName(clientMap.get(text(row.patient_id))) || "Unknown patient";
    const payerName = payerMap.get(text(row.payer_profile_id)) || "Unknown payer";
    const dosFrom = text(row.date_of_service_from);
    const dosTo = text(row.date_of_service_to);
    const dos = dosFrom && dosTo && dosFrom !== dosTo ? `${dosFrom} – ${dosTo}` : dosFrom || dosTo;
    const sublabelParts = [patientName, payerName, dos ? `DOS ${dos}` : ""].filter(Boolean);
    return {
      id: text(row.id),
      label: `Claim ${claimNumber}`,
      sublabel: sublabelParts.join(" · "),
    };
  });
}

async function searchEncounters(supabase: ReturnType<typeof createServerSupabaseAdminClient>, organizationId: string, q: string, limit: number) {
  if (!supabase) return [];

  // For encounters there's no obvious free-text field, so we filter by the
  // related patient name (or accept an empty query and return the most recent).
  let patientIds: string[] | null = null;
  if (q) {
    const term = `%${escapeIlike(q)}%`;
    const { data: matched, error: matchError } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`first_name.ilike.${term},last_name.ilike.${term},preferred_name.ilike.${term}`)
      .limit(50);
    if (matchError) throw matchError;
    patientIds = ((matched ?? []) as Row[]).map((row) => text(row.id)).filter(Boolean);
    if (patientIds.length === 0) return [];
  }

  let query = supabase
    .from("encounters")
    .select("id, client_id, provider_id, service_date, started_at, encounter_status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("service_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (patientIds && patientIds.length) {
    query = query.in("client_id", patientIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  const encounters = (data ?? []) as Row[];

  const clientIds = [...new Set(encounters.map((row) => text(row.client_id)).filter(Boolean))];
  const providerIds = [...new Set(encounters.map((row) => text(row.provider_id)).filter(Boolean))];

  const [{ data: clients }, { data: providers }] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id, first_name, last_name").in("id", clientIds)
      : Promise.resolve({ data: [] as Row[] }),
    providerIds.length
      ? supabase.from("provider_profiles").select("id, staff_id").in("id", providerIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const clientMap = new Map<string, Row>();
  for (const row of (clients ?? []) as Row[]) clientMap.set(text(row.id), row);

  const staffIds = [...new Set(((providers ?? []) as Row[]).map((row) => text(row.staff_id)).filter(Boolean))];
  const { data: staff } = staffIds.length
    ? await supabase.from("staff_profiles").select("id, first_name, last_name").in("id", staffIds)
    : { data: [] as Row[] };
  const staffMap = new Map<string, Row>();
  for (const row of (staff ?? []) as Row[]) staffMap.set(text(row.id), row);

  const providerMap = new Map<string, string>();
  for (const provider of (providers ?? []) as Row[]) {
    const staffRow = staffMap.get(text(provider.staff_id));
    providerMap.set(text(provider.id), fullName(staffRow) || "Unassigned provider");
  }

  return encounters.map((row) => {
    const date = text(row.service_date) || text(row.started_at).slice(0, 10);
    const patientName = fullName(clientMap.get(text(row.client_id))) || "Unknown patient";
    const providerName = providerMap.get(text(row.provider_id)) || "Unassigned provider";
    return {
      id: text(row.id),
      label: `${date || "No date"} · ${patientName}`,
      sublabel: providerName,
    };
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = text(searchParams.get("type")).toLowerCase();
    const q = text(searchParams.get("q"));
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 10), 1), MAX_LIMIT);

    if (!["patient", "claim", "encounter"].includes(type)) {
      return NextResponse.json({ success: false, error: "type must be patient, claim, or encounter" }, { status: 400 });
    }

    const ctx = await requireAuthenticatedStaff();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }
    if (!ctx.organizationId) {
      return NextResponse.json({ success: false, error: "Authenticated user has no organization" }, { status: 403 });
    }
    const organizationId = ctx.organizationId;
    const requestedOrganizationId = text(searchParams.get("organizationId"));
    if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
      return NextResponse.json({ success: false, error: "Organization mismatch" }, { status: 403 });
    }

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });

    let results: { id: string; label: string; sublabel: string }[] = [];
    if (type === "patient") results = await searchPatients(supabase, organizationId, q, limit);
    else if (type === "claim") results = await searchClaims(supabase, organizationId, q, limit);
    else if (type === "encounter") results = await searchEncounters(supabase, organizationId, q, limit);

    return NextResponse.json({ success: true, type, results });
  } catch (error) {
    console.error("Mailroom search API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
