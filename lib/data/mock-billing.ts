import { ReadyClaimValidation, SubmissionBatch, UnpostedPayment, ClaimPaymentMatch, BillingDashboardMetrics } from "../types/billing";
import { getMockClaim } from "./mock-claims";

export function getReadyClaimValidation(claimId: string): ReadyClaimValidation {
  return {
    claim_id: claimId,
    validation_score: 95,
    is_ready: true,
    has_warnings: false,
    has_errors: false,
    missing_items: [],
    ready_since: "2026-04-18T10:00:00Z",
    aging_days: 2
  };
}

export function getReadyClaimWithWarnings(claimId: string): ReadyClaimValidation {
  return {
    claim_id: claimId,
    validation_score: 85,
    is_ready: true,
    has_warnings: true,
    has_errors: false,
    missing_items: [
      {
        rule: "authorization_required",
        passed: false,
        severity: "warning",
        message: "Authorization number recommended but not required for this payer"
      }
    ],
    ready_since: "2026-04-17T14:30:00Z",
    aging_days: 3
  };
}

export function getReadyClaimsList(): ReadyClaimValidation[] {
  return [
    getReadyClaimValidation("claim-001"),
    getReadyClaimValidation("claim-002"),
    getReadyClaimWithWarnings("claim-003"),
    getReadyClaimValidation("claim-004"),
    getReadyClaimValidation("claim-005")
  ];
}

export function getMockSubmissionBatch(batchId: string): SubmissionBatch {
  return {
    id: batchId,
    batch_number: `BATCH-${batchId.slice(0, 8).toUpperCase()}`,
    submission_date: "2026-04-20T09:15:00Z",
    submitted_by_id: "user-001",
    submitted_by_name: "Jessica Kim",
    claim_count: 5,
    total_amount: 1750.00,
    status: "submitted",
    failed_claims_count: 0,
    clearinghouse: "Office Ally",
    file_837_path: "/exports/837_20260420_091500.txt",
    claims: [
      getMockClaim("claim-001"),
      getMockClaim("claim-002"),
      getMockClaim("claim-003"),
      getMockClaim("claim-004"),
      getMockClaim("claim-005")
    ]
  };
}

export function getMockSubmissionBatches(): SubmissionBatch[] {
  return [
    getMockSubmissionBatch("batch-001"),
    {
      ...getMockSubmissionBatch("batch-002"),
      submission_date: "2026-04-19T14:30:00Z",
      status: "accepted",
      claim_count: 12,
      total_amount: 4200.00
    },
    {
      ...getMockSubmissionBatch("batch-003"),
      submission_date: "2026-04-18T11:00:00Z",
      status: "partially_rejected",
      claim_count: 8,
      total_amount: 2800.00,
      failed_claims_count: 2
    }
  ];
}

export function getMockUnpostedPayment(paymentId: string): UnpostedPayment {
  return {
    id: paymentId,
    payment_id: `PAY-${paymentId.slice(0, 8).toUpperCase()}`,
    era_number: `ERA20260415${paymentId.slice(0, 4)}`,
    payment_type: "ERA",
    insurance_company: "Anthem Blue Cross Blue Shield",
    payer_id: "54771",
    deposit_date: "2026-04-15",
    payment_amount: 1250.00,
    posted_amount: 0,
    remaining_amount: 1250.00,
    claims_matched: 3,
    claims_unmatched: 0,
    posting_status: "unposted",
    assigned_staff_id: "user-001",
    assigned_staff_name: "Jessica Kim",
    import_date: "2026-04-15T08:30:00Z",
    batch_number: "ERA_BATCH_20260415_001",
    payment_method: "ACH",
    matched_claims: [
      {
        claim_id: "claim-001",
        claim_number: "CLM-2026-001",
        patient_name: "Sarah Johnson",
        dos: "2026-04-10",
        billed_amount: 350.00,
        allowed_amount: 315.00,
        paid_amount: 252.00,
        patient_responsibility: 63.00,
        adjustments: [
          {
            carc_code: "45",
            adjustment_amount: 35.00,
            adjustment_reason: "Charge exceeds fee schedule/maximum allowable"
          }
        ],
        match_confidence: "exact",
        match_score: 100
      },
      {
        claim_id: "claim-002",
        claim_number: "CLM-2026-002",
        patient_name: "Michael Rodriguez",
        dos: "2026-04-11",
        billed_amount: 500.00,
        allowed_amount: 450.00,
        paid_amount: 405.00,
        patient_responsibility: 45.00,
        adjustments: [
          {
            carc_code: "45",
            adjustment_amount: 50.00,
            adjustment_reason: "Charge exceeds fee schedule/maximum allowable"
          }
        ],
        match_confidence: "exact",
        match_score: 100
      }
    ]
  };
}

export function getMockUnpostedPayments(): UnpostedPayment[] {
  return [
    getMockUnpostedPayment("pay-001"),
    {
      ...getMockUnpostedPayment("pay-002"),
      insurance_company: "UnitedHealthcare",
      payment_amount: 3200.00,
      remaining_amount: 3200.00,
      claims_matched: 8,
      posting_status: "unposted"
    },
    {
      ...getMockUnpostedPayment("pay-003"),
      insurance_company: "Cigna",
      payment_amount: 875.50,
      remaining_amount: 875.50,
      claims_matched: 2,
      claims_unmatched: 1,
      posting_status: "missing_claim_match"
    },
    {
      ...getMockUnpostedPayment("pay-004"),
      payment_type: "CHK",
      check_number: "CHK-789456",
      insurance_company: "Medicaid Colorado",
      payment_amount: 1500.00,
      posted_amount: 750.00,
      remaining_amount: 750.00,
      claims_matched: 5,
      posting_status: "partially_posted"
    }
  ];
}

export function getMockBillingDashboardMetrics(): BillingDashboardMetrics {
  return {
    ready_claims_count: 47,
    ready_claims_amount: 16450.00,
    unposted_payments_count: 23,
    unposted_payments_amount: 45230.50,
    failed_submissions_count: 3,
    rejected_claims_count: 8,
    payments_needing_review: 5,
    overpayments_detected_count: 2,
    recoupments_pending_count: 1
  };
}
