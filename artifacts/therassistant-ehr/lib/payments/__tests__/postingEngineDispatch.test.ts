/**
 * Smoke test for commitPosting dispatcher.
 *
 * Verifies that PP-3 source types route to the right handler (no longer
 * the "not implemented" stub from Foundation phase). We can only assert
 * the surface shape without a real DB; the handlers themselves are
 * covered by the dedicated validator tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { commitPosting } from "../postingEngine";

test("recoupment source still returns Task #110 stub error", async () => {
  const r = await commitPosting({
    organizationId: "org-1",
    source: { type: "recoupment", professionalClaimId: "pc-1", amount: 5, reasonCode: null, description: null },
  });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /not implemented/i);
});

test("manual_insurance dispatch reaches the validator (no longer stubbed)", async () => {
  // Without a real DB, the supabase admin client will return null and the
  // engine surfaces a "Database connection not available" error. The
  // important assertion is that we *don't* see the old "Posting source
  // \"manual_insurance\" is not implemented" stub message any more — the
  // dispatcher now routes correctly.
  const r = await commitPosting({
    organizationId: "org-1",
    source: {
      type: "manual_insurance",
      professionalClaimId: "pc-1",
      clientId: "client-1",
      payerPaymentAmount: 100,
      contractualAdjustmentAmount: 50,
      patientResponsibilityAmount: 50,
      checkOrEftNumber: "CHK-1",
      paymentDate: "2026-05-23",
      totalChargeAmount: 200,
    },
  });
  assert.equal(r.ok, false);
  for (const e of r.errors) {
    assert.doesNotMatch(e.message, /not implemented/i);
  }
});

test("patient_payment dispatch reaches the validator (no longer stubbed)", async () => {
  const r = await commitPosting({
    organizationId: "org-1",
    source: {
      type: "patient_payment",
      clientId: "client-1",
      patientInvoiceId: null,
      amount: 75,
      method: "cash",
      reference: null,
      paymentDate: "2026-05-23",
    },
  });
  assert.equal(r.ok, false);
  for (const e of r.errors) {
    assert.doesNotMatch(e.message, /not implemented/i);
  }
});
