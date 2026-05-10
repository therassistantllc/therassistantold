#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as path from "path";

import { createClient } from "@supabase/supabase-js";
import {
  createProfessionalClaimDraft,
  validateProfessionalClaimReadiness,
} from "../lib/claims/claimReadinessService";

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

function fail(message: string): never {
  throw new Error(message);
}

async function createClaimReadyClient(organizationId: string, suffix: string) {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      first_name: `Claim${suffix}`,
      last_name: `Ready${suffix}`,
      date_of_birth: "1992-08-21",
      sex_at_birth: "U",
      address_line_1: "100 Test Claim Way",
      city: "Denver",
      state: "CO",
      postal_code: "80202",
      external_client_ref: `claim-readiness-test:${suffix}`,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    fail(`Failed to create claim-ready client: ${clientError?.message}`);
  }

  const { data: payer, error: payerError } = await supabase
    .from("insurance_payers")
    .insert({
      organization_id: organizationId,
      payer_name: `Aetna Claim ${suffix}`,
      payer_id: `OA-CLAIM-${suffix}`,
    })
    .select("id")
    .single();

  if (payerError || !payer) {
    fail(`Failed to create claim payer: ${payerError?.message}`);
  }

  const { data: subscriber, error: subscriberError } = await supabase
    .from("insurance_subscribers")
    .insert({
      organization_id: organizationId,
      first_name: `Claim${suffix}`,
      last_name: `Ready${suffix}`,
      date_of_birth: "1992-08-21",
      relationship_to_client: "self",
      member_id: `CMEM-${suffix}`,
      group_number: `CGRP-${suffix}`,
    })
    .select("id")
    .single();

  if (subscriberError || !subscriber) {
    fail(`Failed to create claim subscriber: ${subscriberError?.message}`);
  }

  const today = new Date().toISOString().split("T")[0];
  const { data: policy, error: policyError } = await supabase
    .from("insurance_policies")
    .insert({
      organization_id: organizationId,
      client_id: client.id,
      payer_id: payer.id,
      subscriber_id: subscriber.id,
      plan_name: `Aetna Claim ${suffix}`,
      policy_number: `CPOL-${suffix}`,
      priority: "primary",
      active_flag: true,
      effective_date: today,
    })
    .select("id")
    .single();

  if (policyError || !policy) {
    fail(`Failed to create claim primary policy: ${policyError?.message}`);
  }

  return {
    clientId: String(client.id),
    payerId: String(payer.id),
    subscriberId: String(subscriber.id),
    policyId: String(policy.id),
  };
}

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();

  if (orgError || !org) {
    fail("No organization found; cannot run claim readiness workflow test.");
  }

  const organizationId = String(org.id);
  const suffix = String(Date.now());

  const noInsuranceClient = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      first_name: `ClaimMissing${suffix}`,
      last_name: `Insurance${suffix}`,
      date_of_birth: "1988-03-10",
    })
    .select("id")
    .single();

  if (noInsuranceClient.error || !noInsuranceClient.data) {
    fail(`Failed to create missing-insurance client: ${noInsuranceClient.error?.message}`);
  }

  const missingResult = await createProfessionalClaimDraft({
    organizationId,
    clientId: String(noInsuranceClient.data.id),
    diagnosisCodes: ["F41.1"],
    serviceLines: [
      {
        serviceDate: "2026-05-10",
        procedureCode: "90837",
        chargeAmount: 150,
        units: 1,
        diagnosisPointers: ["1"],
        placeOfService: "10",
      },
    ],
    billingProvider: {
      name: "Therassistant Test Billing Provider",
      npi: "1234567893",
      taxId: "123456789",
      address1: "2408 N Meade Ave",
      city: "Colorado Springs",
      state: "CO",
      zip: "80907",
    },
  });

  if (missingResult.ok) {
    fail("Expected claim draft creation to fail for missing primary insurance.");
  }

  if (!missingResult.errors.some((entry) => entry.field === "insurance_policy")) {
    fail(`Expected missing insurance_policy error, got ${JSON.stringify(missingResult.errors)}`);
  }

  const ready = await createClaimReadyClient(organizationId, suffix);

  const draft = await createProfessionalClaimDraft({
    organizationId,
    clientId: ready.clientId,
    policyId: ready.policyId,
    placeOfService: "10",
    diagnosisCodes: ["F41.1", "Z63.0"],
    serviceLines: [
      {
        serviceDate: "2026-05-10",
        procedureCode: "90837",
        chargeAmount: 150,
        units: 1,
        diagnosisPointers: ["1"],
        placeOfService: "10",
      },
    ],
    billingProvider: {
      name: "Therassistant Test Billing Provider",
      npi: "1234567893",
      taxId: "123456789",
      address1: "2408 N Meade Ave",
      city: "Colorado Springs",
      state: "CO",
      zip: "80907",
    },
    claimNumber: `TEST-CLM-${suffix}`,
    patientAccountNumber: `TEST-ACCT-${suffix}`,
  });

  if (!draft.ok || !draft.claimId) {
    fail(`Expected claim draft creation to succeed: ${JSON.stringify(draft.errors)}`);
  }

  const readiness = await validateProfessionalClaimReadiness(draft.claimId, organizationId);
  if (!readiness.ok) {
    fail(`Expected claim readiness validation to pass: ${JSON.stringify(readiness.errors)}`);
  }

  const { data: claim, error: claimError } = await supabase
    .from("professional_claims")
    .select("id, patient_id, claim_status, total_charge, place_of_service, diagnosis_codes")
    .eq("id", draft.claimId)
    .single();

  if (claimError || !claim) {
    fail(`Failed to load created professional claim: ${claimError?.message}`);
  }

  if (claim.claim_status !== "ready_for_batch") {
    fail(`Expected claim_status ready_for_batch, got ${claim.claim_status}`);
  }

  if (Number(claim.total_charge) !== 150) {
    fail(`Expected total charge 150, got ${claim.total_charge}`);
  }

  const { data: lines, error: lineError } = await supabase
    .from("professional_claim_service_lines")
    .select("id, procedure_code, charge_amount, units, place_of_service")
    .eq("claim_id", draft.claimId);

  if (lineError || !lines || lines.length !== 1) {
    fail(`Expected one claim service line: ${lineError?.message}`);
  }

  if (lines[0].procedure_code !== "90837") {
    fail(`Expected procedure 90837, got ${lines[0].procedure_code}`);
  }

  const { data: snapshot, error: snapshotError } = await supabase
    .from("claim_parties_snapshot")
    .select("payer_id, subscriber_member_id, billing_provider_npi, subscriber_first_name, subscriber_last_name")
    .eq("claim_id", draft.claimId)
    .single();

  if (snapshotError || !snapshot) {
    fail(`Expected claim party snapshot: ${snapshotError?.message}`);
  }

  if (!snapshot.payer_id || !snapshot.subscriber_member_id || !snapshot.billing_provider_npi) {
    fail(`Claim party snapshot missing required claim data: ${JSON.stringify(snapshot)}`);
  }

  console.log("Claim readiness workflow test completed.");
  console.log(
    JSON.stringify(
      {
        organizationId,
        ready,
        claimId: draft.claimId,
        readiness,
        claim,
        serviceLine: lines[0],
        snapshot,
        missingInsuranceErrors: missingResult.errors,
      },
      null,
      2
    )
  );
  console.log("Assertions passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
