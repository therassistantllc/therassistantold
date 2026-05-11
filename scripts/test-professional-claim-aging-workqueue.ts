#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { routeAgingProfessionalClaimsToWorkqueue } from "../lib/workqueue/professionalClaimAgingWorkqueueService";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function fail(message: string): never {
  throw new Error(message);
}

async function assertTablesExist() {
  for (const table of ["professional_claims", "workqueue_items", "edi_batch_claims", "edi_acknowledgements"]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    const message = error?.message ?? "";
    if (message.includes("schema cache") || message.includes("does not exist")) {
      fail(`Missing required table for professional claim aging workqueue test: ${table}`);
    }
    if (error) fail(`Preflight failed for ${table}: ${message}`);
  }
}

async function main() {
  await assertTablesExist();

  const { data: org, error: orgError } = await supabase.from("organizations").select("id").limit(1).single();
  if (orgError || !org) fail("No organization found.");

  const organizationId = String(org.id);
  const oldDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const suffix = String(Date.now()).slice(-10);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      first_name: `Aging${suffix}`,
      last_name: `Client${suffix}`,
      date_of_birth: "1993-01-01",
    })
    .select("id")
    .single();
  if (clientError || !client) fail(`Failed to create aging test client: ${clientError?.message}`);

  const { data: claim, error: claimError } = await supabase
    .from("professional_claims")
    .insert({
      organization_id: organizationId,
      patient_id: client.id,
      claim_number: `AGING-${suffix}`,
      patient_account_number: `AGING-ACCT-${suffix}`,
      claim_status: "submitted",
      total_charge: 100,
      place_of_service: "10",
      diagnosis_codes: ["F411"],
      updated_at: oldDate,
    })
    .select("id")
    .single();
  if (claimError || !claim) fail(`Failed to create aging test claim: ${claimError?.message}`);

  const result = await routeAgingProfessionalClaimsToWorkqueue({ organizationId, agingDays: 7 });
  if (!result.ok) fail(`Expected aging workqueue routing to pass: ${JSON.stringify(result.errors)}`);
  if (result.created < 1) fail(`Expected at least one no_response workqueue item, got ${result.created}`);

  const { data: item, error: itemError } = await supabase
    .from("workqueue_items")
    .select("id, work_type, status, priority, source_object_type, source_object_id, claim_id, client_id, context_payload")
    .eq("organization_id", organizationId)
    .eq("source_object_type", "professional_claim")
    .eq("source_object_id", claim.id)
    .eq("work_type", "no_response")
    .maybeSingle();

  if (itemError || !item) fail(`Expected no_response workqueue item: ${itemError?.message}`);
  if (item.status !== "open") fail(`Expected open workqueue item, got ${item.status}`);
  if (item.priority !== "high") fail(`Expected high priority, got ${item.priority}`);
  if (item.claim_id !== claim.id) fail("Workqueue item was not linked to the aging claim.");
  if (item.client_id !== client.id) fail("Workqueue item was not linked to the aging client.");

  const duplicate = await routeAgingProfessionalClaimsToWorkqueue({ organizationId, agingDays: 7 });
  if (!duplicate.ok) fail(`Expected duplicate routing check to pass: ${JSON.stringify(duplicate.errors)}`);

  const { data: duplicateItems, error: duplicateError } = await supabase
    .from("workqueue_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_object_type", "professional_claim")
    .eq("source_object_id", claim.id)
    .eq("work_type", "no_response");

  if (duplicateError || !duplicateItems) fail(`Failed duplicate lookup: ${duplicateError?.message}`);
  if (duplicateItems.length !== 1) fail(`Expected dedupe to keep one item, got ${duplicateItems.length}`);

  console.log("Professional claim aging workqueue test completed.");
  console.log(JSON.stringify({ organizationId, claimId: claim.id, firstRun: result, item, duplicateRun: duplicate }, null, 2));
  console.log("Assertions passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
