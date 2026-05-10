#!/usr/bin/env tsx

import * as dotenv from "dotenv";
import * as path from "path";

import { createClient } from "@supabase/supabase-js";
import {
  createEligibilityCheck,
  DEFAULT_SERVICE_TYPE_CODE,
  getLatestEligibilityForClient,
  resolveEligibilityInput,
} from "../lib/eligibility/clientEligibilityService";

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

async function createSeedClient(organizationId: string, suffix: string, withInsurance: boolean) {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      first_name: `Eligibility${suffix}`,
      last_name: `Client${suffix}`,
      date_of_birth: "1991-04-17",
      email: `eligibility.${suffix.toLowerCase()}@example.com`,
      phone: "555-420-9800",
      external_client_ref: `eligibility-test:${suffix}`,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    fail(`Failed to create seed client: ${clientError?.message}`);
  }

  if (!withInsurance) {
    return { clientId: String(client.id), policyId: null, payerId: null, subscriberId: null };
  }

  const { data: payer, error: payerError } = await supabase
    .from("insurance_payers")
    .insert({
      organization_id: organizationId,
      payer_name: `Aetna Eligibility ${suffix}`,
      payer_id: `OA-${suffix}`,
    })
    .select("id")
    .single();

  if (payerError || !payer) {
    fail(`Failed to create payer: ${payerError?.message}`);
  }

  const { data: subscriber, error: subscriberError } = await supabase
    .from("insurance_subscribers")
    .insert({
      organization_id: organizationId,
      first_name: `Eligibility${suffix}`,
      last_name: `Client${suffix}`,
      date_of_birth: "1991-04-17",
      relationship_to_client: "self",
      member_id: `MEM-${suffix}`,
      group_number: `GRP-${suffix}`,
    })
    .select("id")
    .single();

  if (subscriberError || !subscriber) {
    fail(`Failed to create subscriber: ${subscriberError?.message}`);
  }

  const today = new Date().toISOString().split("T")[0];
  const { data: policy, error: policyError } = await supabase
    .from("insurance_policies")
    .insert({
      organization_id: organizationId,
      client_id: client.id,
      payer_id: payer.id,
      subscriber_id: subscriber.id,
      plan_name: `Aetna Eligibility ${suffix}`,
      policy_number: `POL-${suffix}`,
      priority: "primary",
      active_flag: true,
      effective_date: today,
    })
    .select("id")
    .single();

  if (policyError || !policy) {
    fail(`Failed to create primary policy: ${policyError?.message}`);
  }

  return {
    clientId: String(client.id),
    policyId: String(policy.id),
    payerId: String(payer.id),
    subscriberId: String(subscriber.id),
  };
}

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();

  if (orgError || !org) {
    fail("No organization found; cannot run eligibility workflow test.");
  }

  const organizationId = String(org.id);
  const suffix = String(Date.now());

  const missingInsurance = await createSeedClient(organizationId, `Missing${suffix}`, false);
  const missingResult = await resolveEligibilityInput(missingInsurance.clientId, organizationId);

  if (missingResult.resolved) {
    fail("Expected missing-policy validation to return no resolved input.");
  }

  if (!missingResult.errors.some((error) => error.field === "insurance_policy")) {
    fail("Expected missing-policy validation error for insurance_policy.");
  }

  const ready = await createSeedClient(organizationId, `Ready${suffix}`, true);
  const resolvedResult = await resolveEligibilityInput(ready.clientId, organizationId);

  if (!resolvedResult.resolved) {
    fail(`Expected eligibility input to resolve: ${JSON.stringify(resolvedResult.errors)}`);
  }

  if (resolvedResult.resolved.serviceTypeCode !== DEFAULT_SERVICE_TYPE_CODE) {
    fail(`Expected default service type ${DEFAULT_SERVICE_TYPE_CODE}.`);
  }

  if (resolvedResult.resolved.policyId !== ready.policyId) {
    fail("Resolved eligibility input did not use the active primary policy.");
  }

  const created = await createEligibilityCheck({
    clientId: ready.clientId,
    organizationId,
    mode: "mock",
  });

  if (!created.ok || !created.checkId || !created.resolvedInput) {
    fail(`Expected eligibility check creation to succeed: ${JSON.stringify(created.errors)}`);
  }

  const { data: checkRow, error: checkError } = await supabase
    .from("eligibility_checks")
    .select("id, client_id, insurance_policy_id, eligibility_status, response_summary")
    .eq("id", created.checkId)
    .single();

  if (checkError || !checkRow) {
    fail(`Failed to load created eligibility check: ${checkError?.message}`);
  }

  if (String(checkRow.client_id) !== ready.clientId) {
    fail("Eligibility check is not linked to the expected client.");
  }

  if (String(checkRow.insurance_policy_id) !== ready.policyId) {
    fail("Eligibility check is not linked to the expected primary policy.");
  }

  const responseSummary = (checkRow.response_summary ?? {}) as Record<string, unknown>;
  if (String(responseSummary.service_type_code ?? "") !== DEFAULT_SERVICE_TYPE_CODE) {
    fail("Eligibility check response_summary did not preserve service_type_code 98.");
  }

  if (!responseSummary.subscriber_member_id) {
    fail("Eligibility check response_summary is missing subscriber_member_id.");
  }

  const latest = await getLatestEligibilityForClient(ready.clientId, organizationId, ready.policyId);
  if (latest.checkId !== created.checkId) {
    fail("Latest eligibility lookup did not return the created eligibility check.");
  }

  if (latest.serviceTypeCode !== DEFAULT_SERVICE_TYPE_CODE) {
    fail("Latest eligibility lookup did not preserve service type 98.");
  }

  const unknownLatest = await getLatestEligibilityForClient(
    "00000000-0000-0000-0000-000000000000",
    organizationId
  );

  if (unknownLatest.computedStatus !== "not_checked" || !unknownLatest.needsRecheck) {
    fail("Unknown client latest eligibility should return not_checked and needsRecheck=true.");
  }

  console.log("Eligibility workflow test completed.");
  console.log(
    JSON.stringify(
      {
        organizationId,
        missingPolicyErrors: missingResult.errors,
        clientId: ready.clientId,
        policyId: ready.policyId,
        payerId: ready.payerId,
        subscriberId: ready.subscriberId,
        checkId: created.checkId,
        defaultServiceTypeCode: DEFAULT_SERVICE_TYPE_CODE,
        latest,
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
