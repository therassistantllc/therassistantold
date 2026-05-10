#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { generate837PBatch } from "../lib/claims/edi837pBatchService";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(message: string): never {
  throw new Error(message);
}

async function assertTablesExist() {
  for (const table of ["edi_batches", "edi_batch_claims", "clearinghouse_connections", "professional_claims"]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    const message = error?.message ?? "";
    if (message.includes("schema cache") || message.includes("does not exist")) {
      fail(`Missing required table for 837P batch workflow test: ${table}`);
    }
    if (error) fail(`Preflight failed for ${table}: ${message}`);
  }
}

async function main() {
  await assertTablesExist();

  const { data: org, error: orgError } = await supabase.from("organizations").select("id").limit(1).single();
  if (orgError || !org) fail("No organization found.");

  const organizationId = String(org.id);

  const { data: readyClaim, error: claimError } = await supabase
    .from("professional_claims")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("claim_status", "ready_for_batch")
    .limit(1)
    .maybeSingle();

  if (claimError) fail(`Failed to query ready claims: ${claimError.message}`);
  if (!readyClaim) fail("No ready_for_batch claim found. Run test:claim-readiness first.");

  const { data: connection } = await supabase
    .from("clearinghouse_connections")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("clearinghouse_name", "office_ally")
    .eq("mode", "test")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!connection) {
    fail("No active Office Ally test clearinghouse connection found.");
  }

  const result = await generate837PBatch({
    organizationId,
    claimIds: [String(readyClaim.id)],
    mode: "test",
  });

  if (!result.ok || !result.batchId) {
    fail(`Expected 837P batch generation to pass: ${JSON.stringify(result.errors)}`);
  }

  const { data: batch, error: batchError } = await supabase
    .from("edi_batches")
    .select("id, transaction_type, file_content, claim_count, status")
    .eq("id", result.batchId)
    .single();

  if (batchError || !batch) fail(`Failed to load batch: ${batchError?.message}`);
  if (batch.transaction_type !== "837P") fail(`Expected 837P transaction type, got ${batch.transaction_type}`);
  if (batch.claim_count !== 1) fail(`Expected claim_count=1, got ${batch.claim_count}`);
  if (!String(batch.file_content).includes("ST*837")) fail("Generated file is missing ST*837 segment.");
  if (!String(batch.file_content).includes("CLM*")) fail("Generated file is missing CLM segment.");

  const { data: linkRows, error: linkError } = await supabase
    .from("edi_batch_claims")
    .select("id")
    .eq("edi_batch_id", result.batchId)
    .eq("claim_id", readyClaim.id);

  if (linkError || !linkRows || linkRows.length !== 1) {
    fail(`Expected one batch-claim link: ${linkError?.message}`);
  }

  const { data: claimAfter, error: claimAfterError } = await supabase
    .from("professional_claims")
    .select("claim_status")
    .eq("id", readyClaim.id)
    .single();

  if (claimAfterError || !claimAfter) fail(`Failed to reload claim: ${claimAfterError?.message}`);
  if (claimAfter.claim_status !== "batched") fail(`Expected claim_status batched, got ${claimAfter.claim_status}`);

  console.log("837P batch workflow test completed.");
  console.log(JSON.stringify({ organizationId, claimId: readyClaim.id, result, batch }, null, 2));
  console.log("Assertions passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
