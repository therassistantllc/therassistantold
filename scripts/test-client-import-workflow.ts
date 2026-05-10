#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as path from "path";

import { createClient } from "@supabase/supabase-js";
import {
  applyClientImportMapping,
  proposeClientImportMapping,
} from "../lib/imports/clientImportMappingService";
import { validateClientImportRows } from "../lib/imports/clientImportValidationService";
import { promoteClientImportRows } from "../lib/imports/clientImportPromotionService";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type AnyRow = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();

  if (orgError || !org) {
    fail("No organization found; cannot run import workflow test.");
  }

  const organizationId = String(org.id);
  const sourceSystem = "script-ehr";
  const duplicateSourceClientId = `dup-${Date.now()}`;

  const { data: existingClient, error: existingClientError } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      first_name: "Ariana",
      last_name: "Morris",
      date_of_birth: "1990-05-12",
      external_client_ref: `${sourceSystem}:${duplicateSourceClientId}`,
    })
    .select("id")
    .single();

  if (existingClientError || !existingClient) {
    fail(`Failed to create seed duplicate client: ${existingClientError?.message}`);
  }

  const importRows: Array<Record<string, string>> = [
    {
      "Source Client ID": `new-${Date.now()}`,
      "First Name": "Jordan",
      "Last Name": "Lyle",
      DOB: "1989-01-15",
      Email: "jordan.lyle@example.com",
      Phone: "555-112-2300",
      "Primary Insurance": "Aetna",
      "Primary Member ID": "M111222",
      "Primary Group ID": "G-77",
    },
    {
      "Source Client ID": duplicateSourceClientId,
      "First Name": "Ariana",
      "Last Name": "Morris",
      DOB: "1990-05-12",
      Email: "ariana.morris@example.com",
      Phone: "555-333-9000",
      "Primary Insurance": "Blue Shield",
      "Primary Member ID": "M999000",
      "Primary Group ID": "GRP-44",
    },
    {
      "Source Client ID": `invalid-${Date.now()}`,
      "First Name": "",
      "Last Name": "",
      DOB: "not-a-date",
      Email: "bad-email",
      Phone: "",
      "Primary Insurance": "",
      "Primary Member ID": "",
      "Primary Group ID": "",
    },
  ];

  const headers = Object.keys(importRows[0] ?? {});
  const mapping = proposeClientImportMapping(headers);

  const { data: job, error: jobError } = await supabase
    .from("client_import_jobs")
    .insert({
      organization_id: organizationId,
      source_system: sourceSystem,
      original_file_name: "script-test.csv",
      file_type: "text/csv",
      status: "uploaded",
      total_rows: importRows.length,
      mapping,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    fail(`Failed to create import job: ${jobError?.message}`);
  }

  const jobId = String(job.id);

  const stagePayload = importRows.map((rawRow, index) => ({
    import_job_id: jobId,
    row_number: index + 1,
    raw_data: rawRow,
    import_status: "pending",
  }));

  const { error: stageError } = await supabase.from("client_import_rows").insert(stagePayload);
  if (stageError) {
    fail(`Failed to stage import rows: ${stageError.message}`);
  }

  const { data: stagedRows, error: stagedRowsError } = await supabase
    .from("client_import_rows")
    .select("id, row_number, raw_data")
    .eq("import_job_id", jobId)
    .order("row_number", { ascending: true });

  if (stagedRowsError || !stagedRows) {
    fail(`Failed to load staged rows: ${stagedRowsError?.message}`);
  }

  const mappedRows = stagedRows.map((row) => ({
    id: String(row.id),
    row_number: Number(row.row_number),
    mapped_data: applyClientImportMapping((row.raw_data ?? {}) as AnyRow, mapping),
  }));

  const validatedRows = await validateClientImportRows(mappedRows, {
    organizationId,
    sourceSystem,
  });

  for (const row of validatedRows) {
    const { error: updateError } = await supabase
      .from("client_import_rows")
      .update({
        mapped_data: row.mappedData,
        validation_errors: row.errors.length ? row.errors : null,
        validation_warnings: row.warnings.length ? row.warnings : null,
        source_client_id: row.sourceClientId,
        duplicate_match_client_id: row.duplicateMatchClientId,
        duplicate_reason: row.duplicateReason,
        duplicate_strategy: row.duplicateStrategy,
        import_status: row.importStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      fail(`Failed to persist mapped/validated row ${row.rowNumber}: ${updateError.message}`);
    }
  }

  await supabase
    .from("client_import_jobs")
    .update({
      status: "validated",
      valid_rows: validatedRows.filter((row) => row.importStatus === "valid").length,
      invalid_rows: validatedRows.filter((row) => row.importStatus === "invalid").length,
      duplicate_rows: validatedRows.filter((row) => row.importStatus === "duplicate").length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  const promotion = await promoteClientImportRows({
    jobId,
    importDuplicates: false,
    allowUpdateExisting: false,
  });

  const { data: finalRows } = await supabase
    .from("client_import_rows")
    .select("row_number, import_status, imported_client_id, promoted_policy_id, source_client_id")
    .eq("import_job_id", jobId)
    .order("row_number", { ascending: true });

  console.log("Client import workflow test completed.");
  console.log(JSON.stringify({ jobId, promotion, finalRows }, null, 2));

  if (promotion.promoted < 1) {
    fail("Expected at least one promoted row.");
  }

  if (!promotion.duplicates) {
    fail("Expected at least one duplicate row.");
  }

  if (!promotion.invalid) {
    fail("Expected at least one invalid row.");
  }

  console.log("Assertions passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
