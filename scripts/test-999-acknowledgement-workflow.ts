#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { intake999Acknowledgement } from "../lib/claims/edi999AcknowledgementService";

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
  for (const table of ["edi_batches", "edi_batch_claims", "edi_acknowledgements", "professional_claims"]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    const message = error?.message ?? "";
    if (message.includes("schema cache") || message.includes("does not exist")) {
      fail(`Missing required table for 999 acknowledgement workflow test: ${table}`);
    }
    if (error) fail(`Preflight failed for ${table}: ${message}`);
  }
}

function sampleAccepted999(stControlNumber: string) {
  return [
    "ISA*00*          *00*          *ZZ*SENDER         *30*330897513      *260510*1200*^*00501*000000905*0*T*:~",
    "GS*FA*OFFICEALLY*SENDER*20260510*1200*1*X*005010X231A1~",
    "ST*999*0001*005010X231A1~",
    `AK1*HC*1*005010X222A1~`,
    `AK2*837*${stControlNumber}*005010X222A1~`,
    "IK5*A~",
    "AK9*A*1*1*1~",
    "SE*6*0001~",
    "GE*1*1~",
    "IEA*1*000000905~",
  ].join("");
}

async function main() {
  await assertTablesExist();

  const { data: org, error: orgError } = await supabase.from("organizations").select("id").limit(1).single();
  if (orgError || !org) fail("No organization found.");

  const organizationId = String(org.id);
  const { data: batch, error: batchError } = await supabase
    .from("edi_batches")
    .select("id, st_control_number")
    .eq("organization_id", organizationId)
    .eq("transaction_type", "837P")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (batchError) fail(`Failed to query submitted 837P batches: ${batchError.message}`);
  if (!batch) fail("No submitted 837P batch found. Run test:837p-submission first.");

  const rawContent = sampleAccepted999(String(batch.st_control_number ?? "0001"));
  const result = await intake999Acknowledgement({
    organizationId,
    batchId: String(batch.id),
    fileName: `999-${Date.now()}.edi`,
    rawContent,
  });

  if (!result.ok || !result.acknowledgementId) {
    fail(`Expected 999 acknowledgement intake to pass: ${JSON.stringify(result.errors)}`);
  }
  if (result.outcome !== "accepted") fail(`Expected accepted outcome, got ${result.outcome}`);
  if (result.linkedClaimIds.length === 0) fail("Expected 999 intake to update linked claims.");

  const { data: batchAfter, error: batchAfterError } = await supabase
    .from("edi_batches")
    .select("status")
    .eq("id", batch.id)
    .single();
  if (batchAfterError || !batchAfter) fail(`Failed to reload batch: ${batchAfterError?.message}`);
  if (batchAfter.status !== "accepted_999") fail(`Expected batch status accepted_999, got ${batchAfter.status}`);

  const { data: claimsAfter, error: claimsAfterError } = await supabase
    .from("professional_claims")
    .select("id, claim_status")
    .in("id", result.linkedClaimIds);
  if (claimsAfterError || !claimsAfter) fail(`Failed to reload claims: ${claimsAfterError?.message}`);
  if (claimsAfter.some((claim) => claim.claim_status !== "accepted_oa")) {
    fail(`Expected linked claims accepted_oa: ${JSON.stringify(claimsAfter)}`);
  }

  const { data: ack, error: ackError } = await supabase
    .from("edi_acknowledgements")
    .select("acknowledgement_type, parsed_content")
    .eq("id", result.acknowledgementId)
    .single();
  if (ackError || !ack) fail(`Failed to reload acknowledgement: ${ackError?.message}`);
  if (ack.acknowledgement_type !== "999") fail(`Expected acknowledgement_type 999, got ${ack.acknowledgement_type}`);

  console.log("999 acknowledgement workflow test completed.");
  console.log(JSON.stringify({ organizationId, batchId: batch.id, result, batchAfter, claimsAfter, ack }, null, 2));
  console.log("Assertions passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
