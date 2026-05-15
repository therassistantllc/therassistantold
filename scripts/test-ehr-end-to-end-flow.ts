#!/usr/bin/env tsx
/**
 * End-to-End EHR Billing Foundation Test
 *
 * Verifies the complete billing flow introduced in migration 20260515000000:
 *   organization → provider → patient → patient_contact → insurance →
 *   appointment → eligibility_request → encounter → clinical_note →
 *   encounter_code → coding_suggestion → claim_header → claim_line →
 *   clearinghouse_txn → claim_status → ERA payment →
 *   billing_alert → claim_workqueue_item → ticket
 *
 * Usage: npm run test:ehr-flow
 *        tsx scripts/test-ehr-end-to-end-flow.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or service role / anon key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string, id?: string) {
  console.log(`   ✅ ${label}${id ? ` (${id.slice(0, 8)}…)` : ""}`);
  passed++;
}

function fail(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`   ❌ ${label}: ${msg}`);
  failed++;
  failures.push(`${label}: ${msg}`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function requireRow<T extends { id: string }>(
  table: string,
  filter: Record<string, unknown>,
  label: string,
): Promise<T | null> {
  let query = supabase.from(table).select("*").limit(1);
  for (const [k, v] of Object.entries(filter)) query = query.eq(k, v);
  const { data, error } = await query.maybeSingle() as { data: T | null; error: unknown };
  if (error || !data) { fail(`Fetch ${label}`, error ?? "no rows"); return null; }
  ok(`Fetched ${label}`, data.id);
  return data;
}

async function insertRow<T extends { id: string }>(
  table: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<T | null> {
  const { data, error } = await supabase.from(table).insert(payload).select("id").single() as { data: T | null; error: unknown };
  if (error || !data) { fail(`Insert ${label}`, error ?? "no id"); return null; }
  ok(`Inserted ${label}`, data.id);
  return data;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  THERASSISTANT EHR — End-to-End Billing Foundation Test");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Step 1: Organization ──────────────────────────────────────────────────
  console.log("Step 1: Organization");
  const org = await requireRow<{ id: string }>("organizations", {}, "organization");
  if (!org) { printSummary(); return; }
  const orgId = org.id;

  // ── Step 2: Provider ──────────────────────────────────────────────────────
  console.log("\nStep 2: Provider");
  const provider = await requireRow<{ id: string; npi?: string }>(
    "provider_profiles", { organization_id: orgId }, "provider_profile"
  );
  if (!provider) { printSummary(); return; }

  // ── Step 3: Patient (client) ─────────────────────────────────────────────
  console.log("\nStep 3: Patient");
  const client = await requireRow<{ id: string }>(
    "clients", { organization_id: orgId }, "client"
  );
  if (!client) { printSummary(); return; }

  // ── Step 4: Patient contact ───────────────────────────────────────────────
  console.log("\nStep 4: Patient contact");
  const contact = await insertRow(
    "patient_contacts",
    {
      organization_id: orgId,
      client_id: client.id,
      contact_type: "emergency",
      first_name: "Test",
      last_name: "Contact",
      phone: "555-0100",
      relationship: "spouse",
    },
    "patient_contact",
  );

  // ── Step 5: Insurance policy ──────────────────────────────────────────────
  console.log("\nStep 5: Insurance policy");
  let insurance = await requireRow<{ id: string; payer_id?: string }>(
    "insurance_policies",
    { organization_id: orgId, client_id: client.id },
    "insurance_policy (existing)",
  );
  if (!insurance) {
    insurance = await insertRow<{ id: string }>(
      "insurance_policies",
      {
        organization_id: orgId,
        client_id: client.id,
        policy_number: `TEST-${Date.now()}`,
        active_flag: true,
        group_number: "GRP001",
        plan_name: "Test Health Plan",
      },
      "insurance_policy (new)",
    );
  }

  // ── Step 6: Appointment ───────────────────────────────────────────────────
  console.log("\nStep 6: Appointment");
  const appointment = await insertRow<{ id: string }>(
    "appointments",
    {
      organization_id: orgId,
      client_id: client.id,
      provider_id: provider.id,
      appointment_status: "scheduled",
      appointment_type: "individual",
      scheduled_start_at: new Date(Date.now() + 86_400_000).toISOString(),
      scheduled_end_at:   new Date(Date.now() + 86_400_000 + 3600_000).toISOString(),
    },
    "appointment",
  );

  // ── Step 7: Eligibility request ───────────────────────────────────────────
  console.log("\nStep 7: Eligibility request");
  const eligReq = await insertRow<{ id: string }>(
    "eligibility_requests",
    {
      organization_id: orgId,
      patient_id: client.id,
      appointment_id: appointment?.id ?? null,
      service_type_code: "98",
      service_type_description: "Professional Services",
      request_mode: "mock",
      status: "created",
      payer_id: "00001",
      payer_name: "Test Payer",
    },
    "eligibility_request",
  );

  // ── Step 8: Encounter ─────────────────────────────────────────────────────
  console.log("\nStep 8: Encounter");
  const encounter = await insertRow<{ id: string }>(
    "encounters",
    {
      organization_id: orgId,
      client_id: client.id,
      provider_id: provider.id,
      appointment_id: appointment?.id ?? null,
      encounter_status: "draft",
      service_date: new Date().toISOString().split("T")[0],
    },
    "encounter",
  );
  if (!encounter) { printSummary(); return; }

  // ── Step 9: Clinical note (SOAP) ──────────────────────────────────────────
  console.log("\nStep 9: Clinical note (SOAP)");
  const note = await insertRow<{ id: string }>(
    "encounter_clinical_notes",
    {
      organization_id: orgId,
      encounter_id: encounter.id,
      client_id: client.id,
      provider_id: provider.id,
      note_status: "draft",
      subjective: "Client reports improved mood. Sleep is fair. Denies SI/HI.",
      objective:  "Alert and oriented ×3. Affect: euthymic. Eye contact appropriate.",
      assessment: "MDD in partial remission (F32.1). Tolerating treatment well.",
      plan:       "Continue 90837 weekly. Introduce CBT worksheet for thought logging.",
      suggested_codes: ["90837"],
    },
    "encounter_clinical_note (SOAP)",
  );

  // ── Step 10: Encounter code ───────────────────────────────────────────────
  console.log("\nStep 10: Encounter code");
  const encCode = await insertRow<{ id: string }>(
    "encounter_codes",
    {
      organization_id: orgId,
      encounter_id: encounter.id,
      client_id: client.id,
      code_type: "CPT",
      procedure_code: "90837",
      units: 1,
      is_primary: true,
      source: "manual",
    },
    "encounter_code (90837)",
  );

  // ── Step 11: Coding suggestion ────────────────────────────────────────────
  console.log("\nStep 11: Coding suggestion");
  const codingSugg = await insertRow<{ id: string }>(
    "coding_suggestions",
    {
      organization_id: orgId,
      encounter_id: encounter.id,
      client_id: client.id,
      suggestion_type: "cpt",
      suggested_code: "90785",
      description: "Interactive Complexity add-on",
      rationale: "Collateral contact present during session; interactive complexity applies.",
      confidence_score: 0.82,
      suggestion_status: "pending",
      source: "rules_engine",
    },
    "coding_suggestion (90785)",
  );

  // ── Step 12: Claim header ─────────────────────────────────────────────────
  console.log("\nStep 12: Claim header (professional_claims)");
  // Get or create a payer profile
  let payerProfile = await requireRow<{ id: string }>(
    "payer_profiles", { organization_id: orgId }, "payer_profile (existing)"
  );
  if (!payerProfile) {
    payerProfile = await insertRow<{ id: string }>(
      "payer_profiles",
      {
        organization_id: orgId,
        payer_name: "Test Payer",
        payer_id_code: "00001",
        is_active: true,
      },
      "payer_profile (new)",
    );
  }

  const claim = await insertRow<{ id: string }>(
    "professional_claims",
    {
      organization_id: orgId,
      patient_id: client.id,
      encounter_id: encounter.id,
      appointment_id: appointment?.id ?? null,
      payer_profile_id: payerProfile?.id ?? null,
      claim_status: "draft",
      total_charge: 200.00,
      place_of_service: "11",
      diagnosis_codes: ["F32.1"],
    },
    "claim_header (professional_claims)",
  );
  if (!claim) { printSummary(); return; }

  // ── Step 13: Claim line ───────────────────────────────────────────────────
  console.log("\nStep 13: Claim line (professional_claim_service_lines)");
  const claimLine = await insertRow<{ id: string }>(
    "professional_claim_service_lines",
    {
      organization_id: orgId,
      professional_claim_id: claim.id,
      line_number: 1,
      procedure_code: "90837",
      units: 1,
      charge_amount: 200.00,
      diagnosis_pointer: "A",
      place_of_service: "11",
      service_date_from: new Date().toISOString().split("T")[0],
    },
    "claim_line (90837 × 1)",
  );

  // ── Step 14: Clearinghouse transaction (EDI) ──────────────────────────────
  console.log("\nStep 14: Clearinghouse transaction (edi_transactions)");
  const ediTxn = await insertRow<{ id: string }>(
    "edi_transactions",
    {
      organization_id: orgId,
      client_id: client.id,
      transaction_type: "837P",
      direction: "outbound",
      status: "queued",
      payload: {},
    },
    "EDI 837P transaction",
  );

  // ── Step 15: Claim status event ───────────────────────────────────────────
  console.log("\nStep 15: Claim status event");
  const claimStatus = await insertRow<{ id: string }>(
    "claim_status_events",
    {
      claim_id: claim.id,
      organization_id: orgId,
      source: "manual",
      status: "submitted",
      status_message: "Test submission via workflow test",
    },
    "claim_status_event (submitted)",
  );

  // ── Step 16: ERA import batch + ERA claim payment ─────────────────────────
  console.log("\nStep 16: ERA import batch + claim payment");
  const eraBatch = await insertRow<{ id: string }>(
    "era_import_batches",
    {
      organization_id: orgId,
      source: "manual_upload",
      file_name: "test_835.txt",
      raw_content: "ISA*test*835",
      parsed_summary: {},
      import_status: "parsed",
      total_claims: 1,
      total_payment_amount: 140.00,
      total_patient_responsibility: 60.00,
    },
    "ERA import batch",
  );

  const eraPayment = eraBatch
    ? await insertRow<{ id: string }>(
        "era_claim_payments",
        {
          organization_id: orgId,
          era_import_batch_id: eraBatch.id,
          professional_claim_id: claim.id,
          client_id: client.id,
          clp01_claim_control_number: claim.id.slice(0, 12),
          clp02_claim_status_code: "1",
          clp03_total_charge: 200.00,
          clp04_payment_amount: 140.00,
          clp05_patient_responsibility: 60.00,
          claim_match_status: "matched",
          posting_status: "ready",
          check_eft_number: "CHK000123",
          payer_trace_number: "TRC9999",
          allowed_amount: 160.00,
          adjustment_amount: 40.00,
          carc_codes: ["45"],
          rarc_codes: ["N30"],
          co_amount: 40.00,
          pr_amount: 60.00,
        },
        "ERA claim payment",
      )
    : null;

  // ── Step 17: Billing alert ────────────────────────────────────────────────
  console.log("\nStep 17: Billing alert");
  const alert = await insertRow<{ id: string }>(
    "billing_alerts",
    {
      organization_id: orgId,
      client_id: client.id,
      claim_id: claim.id,
      alert_type: "era_mismatch",
      severity: "warning",
      alert_status: "open",
      title: "ERA amount mismatch — review required",
      description: "Paid $140 vs billed $200. CO-45: $40 contractual adj. PR: $60 patient resp.",
    },
    "billing_alert",
  );

  // ── Step 18: claim_workqueue_item ─────────────────────────────────────────
  console.log("\nStep 18: Claim workqueue item");
  const wqItem = await insertRow<{ id: string }>(
    "claim_workqueue_items",
    {
      organization_id: orgId,
      claim_id: claim.id,
      client_id: client.id,
      encounter_id: encounter.id,
      era_claim_payment_id: eraPayment?.id ?? null,
      billing_alert_id: alert?.id ?? null,
      item_status: "no_response",
      priority: "normal",
      carc_code: "45",
      rarc_code: "N30",
      group_code: "CO",
    },
    "claim_workqueue_item",
  );

  // ── Step 19: Ticket ───────────────────────────────────────────────────────
  console.log("\nStep 19: Ticket");
  const ticketNumber = `TKT-TEST-${Date.now()}`;
  const ticket = await insertRow<{ id: string }>(
    "tickets",
    {
      organization_id: orgId,
      client_id: client.id,
      claim_id: claim.id,
      encounter_id: encounter.id,
      billing_alert_id: alert?.id ?? null,
      ticket_number: ticketNumber,
      ticket_type: "billing",
      ticket_status: "open",
      priority: "normal",
      subject: "ERA review — CO-45 contractual adjustment",
      description: "Claim paid $140 of $200 billed. CO-45 applied. Verify contract rate.",
    },
    "ticket",
  );

  // ── Step 20: Ticket comment with smart phrase key ─────────────────────────
  console.log("\nStep 20: Ticket comment (smart phrase)");
  if (ticket) {
    await insertRow<{ id: string }>(
      "ticket_comments",
      {
        organization_id: orgId,
        ticket_id: ticket.id,
        comment_body: "Claim denied with CARC 45. Action taken: verified contract rate. Resubmission deadline: 2026-11-15.",
        smart_phrase_keys: ["claim_denial_note"],
        comment_type: "note",
        is_internal: true,
      },
      "ticket_comment",
    );
  }

  // ── Step 21: Documents ────────────────────────────────────────────────────
  console.log("\nStep 21: Document");
  const doc = await insertRow<{ id: string }>(
    "documents",
    {
      organization_id: orgId,
      client_id: client.id,
      encounter_id: encounter.id,
      document_scope: "encounter",
      document_type: "clinical_note",
      title: "Test Session Note",
      file_name: "note_test.pdf",
      mime_type: "application/pdf",
      notes: "Uploaded during E2E test",
    },
    "document",
  );

  // ── Step 22: Document link ────────────────────────────────────────────────
  console.log("\nStep 22: Document link");
  if (doc && claim) {
    await insertRow<{ id: string }>(
      "document_links",
      {
        organization_id: orgId,
        document_id: doc.id,
        linked_entity_type: "claim",
        linked_entity_id: claim.id,
      },
      "document_link (doc→claim)",
    );
  }

  // ── Step 23: System settings ──────────────────────────────────────────────
  console.log("\nStep 23: System settings");
  await supabase.from("system_settings").upsert({
    organization_id: orgId,
    setting_key: "eligibility_service_type_code",
    setting_value: JSON.stringify("98"),
    setting_category: "eligibility",
    description: "Default X12 270 service type for professional services",
  }, { onConflict: "organization_id,setting_key" });
  ok("System setting upserted (eligibility_service_type_code)");

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("\nStep 24: Cleanup (archive test records)");
  const cleanTargets: Array<[string, string | undefined]> = [
    ["ticket_comments",               ticket?.id ? undefined : undefined],
    ["document_links",                doc?.id],
    ["documents",                     doc?.id],
    ["tickets",                       ticket?.id],
    ["claim_workqueue_items",         wqItem?.id],
    ["billing_alerts",                alert?.id],
    ["era_claim_payments",            eraPayment?.id],
    ["era_import_batches",            eraBatch?.id],
    ["claim_status_events",           claimStatus?.id],
    ["professional_claim_service_lines", claimLine?.id],
    ["professional_claims",           claim?.id],
    ["coding_suggestions",            codingSugg?.id],
    ["encounter_codes",               encCode?.id],
    ["encounter_clinical_notes",      note?.id],
    ["encounters",                    encounter?.id],
    ["eligibility_requests",          eligReq?.id],
    ["appointments",                  appointment?.id],
    ["patient_contacts",              contact?.id],
  ];

  for (const [table, id] of cleanTargets) {
    if (!id) continue;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) console.warn(`   ⚠️  Could not delete ${table} ${id.slice(0, 8)}: ${error.message}`);
  }
  console.log("   ✅ Test records removed");

  printSummary();
}

function printSummary() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\n  Failures:");
    failures.forEach(f => console.log(`  • ${f}`));
  }
  console.log("═══════════════════════════════════════════════════════════\n");
  if (failed > 0) process.exit(1);
}

run().catch(e => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
