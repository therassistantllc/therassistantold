/**
 * EXAMPLE: How to integrate OpenMRS patient search into existing /api/clients
 * 
 * This shows the non-breaking integration pattern.
 * No frontend changes needed - same response format.
 * Can toggle OpenMRS on/off via env flag.
 * 
 * File: app/api/clients/route.ts (UPDATED)
 */

import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { searchOpenMRSPatients, getOpenMRSConfig, deduplicateClients, type TherAssistantClientRosterItem } from "@/lib/openmrs-adapter/patient-search";

const useOpenMrsPatients = process.env.USE_OPENMRS_PATIENTS === "true";

type Row = Record<string, unknown>;

function value(input: unknown) {
  return String(input ?? "").trim();
}

function nameOf(row: Row) {
  return [row.first_name, row.last_name].map(value).filter(Boolean).join(" ") || "Unnamed client";
}

function amount(input: unknown) {
  const numberValue = Number(input ?? 0);
  return Number.isFinite(numberValue) ? Math.round(numberValue * 100) / 100 : 0;
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const q = value(searchParams.get("q")).toLowerCase();

    if (!organizationId) return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });

    // ===== FETCH FROM SUPABASE (UNCHANGED) =====
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, preferred_name, email, phone, archived_at, deceased_at, updated_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("last_name", { ascending: true })
      .limit(250);

    if (error) throw error;

    const rows = ((clients ?? []) as Row[]).filter((client) => {
      if (!q) return true;
      return [client.first_name, client.last_name, client.preferred_name, client.email, client.phone]
        .map(value)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    // ===== NEW: FETCH FROM OPENMRS (IF ENABLED) =====
    let openMrsClients: TherAssistantClientRosterItem[] = [];
    if (useOpenMrsPatients) {
      const openMrsConfig = getOpenMRSConfig();
      if (openMrsConfig) {
        openMrsClients = await searchOpenMRSPatients(q, organizationId, openMrsConfig);
        console.debug(`[OpenMRS] Found ${openMrsClients.length} patients matching query`);
      }
    }

    // ===== BUILD SUPABASE ROSTER (UNCHANGED) =====
    const ids = rows.map((client) => value(client.id)).filter(Boolean);
    const { data: invoices } = ids.length
      ? await supabase
          .from("patient_invoices")
          .select("client_id, balance_amount, invoice_status")
          .eq("organization_id", organizationId)
          .in("client_id", ids)
          .is("archived_at", null)
      : { data: [] as Row[] };

    const balances = new Map<string, number>();
    for (const invoice of (invoices ?? []) as Row[]) {
      const status = value(invoice.invoice_status).toLowerCase();
      if (!["open", "sent", "collections"].includes(status)) continue;
      const clientId = value(invoice.client_id);
      balances.set(clientId, (balances.get(clientId) ?? 0) + amount(invoice.balance_amount));
    }

    const supabaseRoster = rows.map((client) => ({
      id: value(client.id),
      name: nameOf(client),
      preferredName: client.preferred_name ?? null,
      email: client.email ?? null,
      phone: client.phone ?? null,
      status: client.deceased_at ? "deceased" : "active",
      intakeStatus: null,
      openBalance: balances.get(value(client.id)) ?? 0,
      updatedAt: client.updated_at ?? null,
      externalSource: "supabase", // ← NEW: Mark data source
      externalPatientUuid: null as unknown as string, // ← NEW: No external UUID for Supabase
    })) as TherAssistantClientRosterItem[];

    // ===== MERGE & DEDUPLICATE =====
    const allRecords = deduplicateClients([...supabaseRoster, ...openMrsClients]);

    return NextResponse.json({
      success: true,
      organizationId,
      metrics: {
        total: allRecords.length,
        active: allRecords.filter((record) => record.status === "active").length,
        intakeIncomplete: allRecords.filter((record) => record.intakeStatus !== "complete").length,
        withBalance: allRecords.filter((record) => record.openBalance > 0).length,
      },
      clients: allRecords,
      _debug: useOpenMrsPatients ? { openMrsEnabled: true, openMrsCount: openMrsClients.length } : undefined,
    });
  } catch (error) {
    console.error("Clients roster API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Clients roster API failed" },
      { status: 500 },
    );
  }
}
