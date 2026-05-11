#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { intake277CAAcknowledgement } from "../lib/claims/edi277caAcknowledgementService";

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
      fail(`Missing required table for 277CA acknowledgement workflow test: ${table}`);
    }
    if (error) fail(`Preflight failed for ${table}: ${message}`);
  }
}

function sampleAccepted277CA() {
  return [
    "ISA*00*          *00*          *30*330897513      *ZZ*SENDER         *260510*1200*^*00501*000000906*0*T*:~",
    "GS*HN*OFFICEALLY*SENDER*20260510*1200*1*X*005010X214~",
    "ST*277*0001*005010X214~",
    "BHT*0085*08*277CA0001*20260510*1200*TH~",
    "HL*1**20*1~",
    "NM1*PR*2*OFFICEALLY*****PI*330897513~",
    "HL*2*1*21*1~",
    "NM1*41*2*THERASSISTANT*****46*SENDER~",
    "HL*3*2*19*1~",
    "NM1*85*2*THERASSISTANT TEST BILLING PROVIDER*****XX*1234567893~",
    "HL*4*3*PT~",
    "NM1*QC*1*CLIENT*TEST****MI*TESTMEMBER~",
    "TRN*2*TESTTRACE*OFFICEALLY~",
    "STC*A1:19:PR*20260510*WQ*150~",
    "SE*14*0001~",
    "GE*1*1~",
    "IEA*1*000000906~",
  ].join("");
}

async function main() {
  await assertTablesExist();

  const { data: org, error: orgError } = await supabase.from("organizations").select("id").limit(1).single();
  if (orgError || !org) fail("No organization found.");

  const organizationId = String(org.id);
  const { data: batch, error: batchError } = await supabase
    .from("edi_batches")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("transaction_type", "837P")
    .in("status", ["accepted_999", "submitted"])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (batchError) fail(`Failed to query 837P batches: ${batchError.message}`);
  if (!batch) fail("No 837P batch ready for 277CA found. Run 837P submission and 999 acknowledgement tests first.");

  const result = await intake277CAAcknowledgement({
    organizationId,
    batchId: String(batch.id),
    fileName: `277ca-${Date.now()}.edi`,
    rawContent: sampleAccepted277CA(),
  });

  if (!result.ok || !result.acknowledgementId) {
    fail(`Expected 277CA acknowledgement intake to pass: ${JSON.stringify(result.errors)}`);
  }
  if (result.outcome !== "accepted") fail(`Expected accepted outcome, got ${result.outcome}`);
  if (result.linkedClaimIds.length === 0) fail("Expected 277CA intake to update linked claims.");

  const { data: batchAfter, error: batchAfterError } = await supabase
    .from("edi_batches")
    .select("status")
    .eq("id", batch.id)
    .single();
  if (batchAfterError || !batchAfter) fail(`Failed to reload batch: ${batchAfterError?.message}`);
  if (batchAfter.status !== "accepted_277ca") fail(`Expected batch status accepted_277ca, got ${batchAfter.status}`);

  const { data: claimsAfter, error: claimsAfterError } = await supabase
    .from("professional_claims")
    .select("id, claim_status")
    .in("id", result.linkedClaimIds);
  if (claimsAfterError || !claimsAfter) fail(`Failed to reload claims: ${claimsAfterError?.message}`);
  if (claimsAfter.some((claim) => claim.claim_status !== "accepted_payer")) {
    fail(`Expected linked claims accepted_payer: ${JSON.stringify(claimsAfter)}`);
  }

  const { data: ack, error: ackError } = await supabase
    .from("edi_acknowledgements")
    .select("acknowledgement_type, parsed_content")
    .eq("id", result.acknowledgementId)
    .single();
  if (ackError || !ack) fail(`Failed to reload acknowledgement: ${ackError?.message}`);
  if (ack.acknowledgement_type !== "277CA") fail(`Expected acknowledgement_type 277CA, got ${ack.acknowledgement_type}`);

  console.log("277CA acknowledgement workflow test completed.");
  console.log(JSON.stringify({ organizationId, batchId: batch.id, result, batchAfter, claimsAfter, ack }, null, 2));
  console.log("Assertions passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
