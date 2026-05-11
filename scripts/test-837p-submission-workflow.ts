#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { mark837PBatchSubmitted } from "../lib/claims/edi837pSubmissionService";

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
  for (const table of ["edi_batches", "edi_batch_claims", "professional_claims"]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    const message = error?.message ?? "";
    if (message.includes("schema cache") || message.includes("does not exist")) {
      fail(`Missing required table for 837P submission workflow test: ${table}`);
    }
    if (error) fail(`Preflight failed for ${table}: ${message}`);
  }
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
    .eq("status", "generated")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (batchError) fail(`Failed to query generated 837P batches: ${batchError.message}`);
  if (!batch) fail("No generated 837P batch found. Run test:837p-batch first.");

  const officeAllyFileId = `OA-FILE-${Date.now()}`;
  const result = await mark837PBatchSubmitted({ organizationId, batchId: String(batch.id), officeAllyFileId });

  if (!result.ok) fail(`Expected submission tracking to pass: ${JSON.stringify(result.errors)}`);
  if (result.linkedClaimIds.length === 0) fail("Expected submitted batch to have linked claims.");

  const { data: batchAfter, error: batchAfterError } = await supabase
    .from("edi_batches")
    .select("status, office_ally_file_id, submitted_at")
    .eq("id", batch.id)
    .single();

  if (batchAfterError || !batchAfter) fail(`Failed to reload submitted batch: ${batchAfterError?.message}`);
  if (batchAfter.status !== "submitted") fail(`Expected batch status submitted, got ${batchAfter.status}`);
  if (batchAfter.office_ally_file_id !== officeAllyFileId) fail("Office Ally file ID was not preserved.");
  if (!batchAfter.submitted_at) fail("Submitted timestamp was not recorded.");

  const { data: claimsAfter, error: claimsAfterError } = await supabase
    .from("professional_claims")
    .select("id, claim_status")
    .in("id", result.linkedClaimIds);

  if (claimsAfterError || !claimsAfter) fail(`Failed to reload linked claims: ${claimsAfterError?.message}`);
  if (claimsAfter.some((claim) => claim.claim_status !== "submitted")) {
    fail(`Expected all linked claims to be submitted: ${JSON.stringify(claimsAfter)}`);
  }

  console.log("837P submission workflow test completed.");
  console.log(JSON.stringify({ organizationId, batchId: batch.id, result, batchAfter, claimsAfter }, null, 2));
  console.log("Assertions passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
