import { Claim } from "./claim";

// Batch Submission Types
export interface ClaimValidationRule {
  rule: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface ReadyClaimValidation {
  claim_id: string;
  validation_score: number; // 0-100
  is_ready: boolean;
  has_warnings: boolean;
  has_errors: boolean;
  missing_items: ClaimValidationRule[];
  ready_since?: string;
  aging_days: number;
}

export interface SubmissionBatch {
  id: string;
  batch_number: string;
  submission_date: string;
  submitted_by_id: string;
  submitted_by_name: string;
  claim_count: number;
  total_amount: number;
  status: "pending" | "submitted" | "accepted" | "partially_rejected" | "failed";
  failed_claims_count: number;
  clearinghouse?: string;
  file_837_path?: string;
  claims: Claim[];
}

export type SubmissionStatus = 
  | "ready"
  | "submitted" 
  | "accepted" 
  | "rejected" 
  | "pending_clearinghouse" 
  | "pending_payer" 
  | "failed_submission";

// Payment Posting Types
export interface PaymentAdjustment {
  carc_code: string;
  rarc_code?: string;
  adjustment_amount: number;
  adjustment_reason: string;
}

export interface ClaimPaymentMatch {
  claim_id: string;
  claim_number: string;
  patient_name: string;
  dos: string;
  billed_amount: number;
  allowed_amount: number;
  paid_amount: number;
  patient_responsibility: number;
  adjustments: PaymentAdjustment[];
  match_confidence: "exact" | "high" | "medium" | "low" | "no_match";
  match_score: number; // 0-100
}

export interface UnpostedPayment {
  id: string;
  payment_id: string;
  era_number?: string;
  check_number?: string;
  eft_number?: string;
  payment_type: "ERA" | "VCC" | "CHK" | "EFT" | "Manual";
  insurance_company: string;
  payer_id: string;
  deposit_date: string;
  payment_amount: number;
  posted_amount: number;
  remaining_amount: number;
  claims_matched: number;
  claims_unmatched: number;
  posting_status: PaymentPostingStatus;
  assigned_staff_id?: string;
  assigned_staff_name?: string;
  import_date: string;
  batch_number?: string;
  payment_method?: "ACH" | "Check" | "Wire" | "Virtual Card";
  matched_claims: ClaimPaymentMatch[];
  notes?: string;
}

export type PaymentPostingStatus = 
  | "unposted"
  | "partially_posted"
  | "fully_posted"
  | "needs_review"
  | "missing_claim_match"
  | "missing_patient_match"
  | "overpayment_detected"
  | "underpayment_detected"
  | "recoupment_detected";

export interface PaymentDetail {
  payment: UnpostedPayment;
  era_details?: {
    payer_name: string;
    payer_address: string;
    payee_name: string;
    payee_npi: string;
    check_issue_date: string;
    effective_date: string;
  };
  suggested_matches: ClaimPaymentMatch[];
  posting_history: PaymentPostingEvent[];
}

export interface PaymentPostingEvent {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  event_type: "matched" | "posted" | "unmatched" | "adjusted" | "reviewed" | "split";
  details: Record<string, any>;
}

export interface BillingDashboardMetrics {
  ready_claims_count: number;
  ready_claims_amount: number;
  unposted_payments_count: number;
  unposted_payments_amount: number;
  failed_submissions_count: number;
  rejected_claims_count: number;
  payments_needing_review: number;
  overpayments_detected_count: number;
  recoupments_pending_count: number;
}
