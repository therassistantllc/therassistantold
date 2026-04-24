// File: shared/contracts/index.ts

/* =========================
   Common primitives
   ========================= */

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // ISO-8601
export type MoneyString = string; // decimal serialized as string
export type EnvironmentFlag = "test" | "production";

export interface AuditFields {
  id: UUID;
  organization_id: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  created_by_user_id: UUID | null;
  updated_by_user_id: UUID | null;
  archived_at: ISODateTime | null;
}

export type Severity = "blocker" | "warning";

export interface RuleMessage {
  rule_code: string;
  severity: Severity;
  message: string;
  source_object_type:
    | "organization"
    | "client"
    | "appointment"
    | "encounter"
    | "encounter_note"
    | "claim"
    | "claim_service_line"
    | "claim_submission"
    | "claim_status_inquiry"
    | "workqueue_item"
    | "billing_alert"
    | "support_ticket"
    | "payment_posting"
    | "insurance_policy"
    | "eligibility_check"
    | "authorization_or_referral";
  source_object_id: UUID | null;
  field_path?: string;
}

export interface ReadinessResult {
  is_ready: boolean;
  blockers: RuleMessage[];
  warnings: RuleMessage[];
}

export interface PagingRequest {
  limit?: number;
  offset?: number;
}

export interface PagingResponse {
  limit: number;
  offset: number;
  total: number;
}

export interface DateRange {
  start_date: ISODate;
  end_date: ISODate;
}

/* =========================
   Canonical enums
   ========================= */

export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled";

export type EncounterStatus =
  | "open"
  | "completed"
  | "ready_to_bill"
  | "billed"
  | "voided";

export type NoteStatus =
  | "not_started"
  | "in_progress"
  | "signed"
  | "amended";

export type EligibilityStatus =
  | "not_checked"
  | "active"
  | "inactive"
  | "pending"
  | "error";

export type AuthorizationStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "cancelled";

export type ClaimStatus =
  | "draft"
  | "ready_to_submit"
  | "submitted"
  | "accepted"
  | "rejected"
  | "denied"
  | "paid"
  | "partially_paid"
  | "voided";

export type ClaimSubmissionStatus =
  | "queued"
  | "sent"
  | "accepted_by_clearinghouse"
  | "rejected_by_clearinghouse"
  | "accepted_by_payer"
  | "rejected_by_payer"
  | "failed";

export type ClaimStatusInquiryStatus =
  | "queued"
  | "sent"
  | "received"
  | "no_response"
  | "failed";

export type PaymentPostingStatus =
  | "pending"
  | "posted"
  | "partially_posted"
  | "reversed"
  | "failed";

export type BillingAlertStatus = "open" | "snoozed" | "resolved";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "resolved"
  | "closed";

export type WorkqueueStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "resolved"
  | "closed";

export type WorkqueuePriority = "low" | "normal" | "high" | "urgent";

export type WorkqueueType =
  | "eligibility"
  | "authorization"
  | "claim_creation"
  | "claim_follow_up"
  | "payment_posting"
  | "denial"
  | "appeal"
  | "correction"
  | "client_follow_up"
  | "provider_follow_up"
  | "payer_follow_up"
  | "documentation_review";

export type BillingAlertType =
  | "readiness"
  | "eligibility"
  | "authorization"
  | "coding"
  | "claim"
  | "payment"
  | "aging"
  | "duplicate_submission";

export type SupportTicketType =
  | "internal_note"
  | "payer_call"
  | "appeal"
  | "reconsideration"
  | "correspondence"
  | "general_support";

export type ClaimFrequencyCode = "1" | "7" | "8";

export type SourceObjectType =
  | "client"
  | "appointment"
  | "encounter"
  | "encounter_note"
  | "claim"
  | "claim_submission"
  | "claim_status_inquiry"
  | "workqueue_item"
  | "billing_alert"
  | "support_ticket"
  | "eligibility_check"
  | "authorization_or_referral"
  | "payment_posting";

export type ExternalTransactionType = "270" | "276" | "278" | "837";
export type ExternalProcessingMode = "realtime" | "batch";
export type ExternalMessageFormat = "x12" | "json" | "xml";
export type ExternalEnvelopeFormat = "x12" | "none" | "xml_wrapper";

export type ExternalTransactionStatus =
  | "queued"
  | "in_flight"
  | "succeeded"
  | "failed"
  | "deferred"
  | "cancelled";

export type ExternalAttemptStatus =
  | "queued"
  | "sent"
  | "succeeded"
  | "failed"
  | "timeout"
  | "retry_scheduled";

export type ExternalErrorClass =
  | "validation_error"
  | "payer_communication_failure"
  | "timeout"
  | "duplicate_rejection"
  | "transport_failure"
  | "receiver_unavailable"
  | "retry_later"
  | "blocked_pending_correction";

/* =========================
   Core master records
   ========================= */

export interface OrganizationRecord extends AuditFields {
  legal_name: string;
  display_name: string;
  is_active: boolean;
  timezone: string | null;
  default_currency_code: string | null;
}

export interface ClientRecord extends AuditFields {
  external_client_ref: string | null;
  mrn: string | null;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  date_of_birth: ISODate;
  sex_at_birth: string | null;
  gender_identity: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  preferred_language: string | null;
  deceased_at: ISODateTime | null;
}

export interface EncounterRecord extends AuditFields {
  appointment_id: UUID | null;
  client_id: UUID;
  rendering_provider_id: UUID;
  supervising_provider_id: UUID | null;
  provider_location_id: UUID | null;
  encounter_status: EncounterStatus;
  note_status: NoteStatus;
  started_at: ISODateTime | null;
  ended_at: ISODateTime | null;
  note_signed_at: ISODateTime | null;
  note_signed_by_provider_id: UUID | null;
  coding_completed_at: ISODateTime | null;
  required_billing_fields_complete: boolean;
  date_of_service: ISODate;
}

export interface ClaimRecord extends AuditFields {
  encounter_id: UUID;
  client_id: UUID;
  insurance_policy_id: UUID;
  claim_number: string;
  claim_status: ClaimStatus;
  claim_frequency_code: ClaimFrequencyCode;
  total_charge_amount: MoneyString;
  patient_responsibility_amount: MoneyString;
  payer_responsibility_amount: MoneyString;
  total_allowed_amount: MoneyString | null;
  total_insurance_paid_amount: MoneyString | null;
  total_patient_paid_amount: MoneyString | null;
  adjustment_amount: MoneyString | null;
  write_off_amount: MoneyString | null;
  remaining_insurance_balance: MoneyString | null;
  remaining_patient_balance: MoneyString | null;
  date_of_service_from: ISODate;
  date_of_service_to: ISODate;
  ready_to_submit_at: ISODateTime | null;
  submitted_at: ISODateTime | null;
  accepted_at: ISODateTime | null;
  denied_at: ISODateTime | null;
  paid_at: ISODateTime | null;
  last_blocker_codes: string[];
  duplicate_detection_key: string;
  aging_bucket: "not_submitted" | "0-30" | "31-60" | "61-90" | "91-120" | "120+" | null;
}

export interface WorkqueueItemRecord extends AuditFields {
  work_type: string;
  status: WorkqueueStatus;
  priority: WorkqueuePriority;
  source_object_type: SourceObjectType;
  source_object_id: UUID;
  client_id: UUID | null;
  encounter_id: UUID | null;
  claim_id: UUID | null;
  assigned_to_user_id: UUID | null;
  due_at: ISODateTime | null;
  resolved_at: ISODateTime | null;
  closed_at: ISODateTime | null;
  title: string;
  description: string | null;
  context_payload: Record<string, unknown>;
}

/* =========================
   Supporting records
   ========================= */

export interface AppointmentRecord extends AuditFields {
  client_id: UUID;
  provider_id: UUID;
  provider_location_id: UUID | null;
  scheduled_start_at: ISODateTime;
  scheduled_end_at: ISODateTime;
  appointment_status: AppointmentStatus;
  appointment_type: string | null;
  reason: string | null;
  insurance_policy_id: UUID | null;
  check_in_at: ISODateTime | null;
  cancelled_at: ISODateTime | null;
  cancellation_reason: string | null;
}

export interface EncounterNoteRecord extends AuditFields {
  encounter_id: UUID;
  note_type: string;
  note_status: NoteStatus;
  note_text: string | null;
  signed_at: ISODateTime | null;
  signed_by_provider_id: UUID | null;
  amendment_reason: string | null;
}

export interface EncounterDiagnosisRecord extends AuditFields {
  encounter_id: UUID;
  diagnosis_code: string;
  diagnosis_description: string | null;
  is_primary: boolean;
  sequence_number: number;
  present_on_claim: boolean;
}

export interface EncounterServiceLineRecord extends AuditFields {
  encounter_id: UUID;
  service_date: ISODate;
  cpt_hcpcs_code: string;
  modifier_1: string | null;
  modifier_2: string | null;
  modifier_3: string | null;
  modifier_4: string | null;
  units: MoneyString;
  charge_amount: MoneyString;
  rendering_provider_id: UUID | null;
  place_of_service_code: string | null;
  sequence_number: number;
}

export interface ClaimServiceLineRecord extends AuditFields {
  claim_id: UUID;
  encounter_service_line_id: UUID | null;
  service_date: ISODate;
  cpt_hcpcs_code: string;
  modifier_1: string | null;
  modifier_2: string | null;
  modifier_3: string | null;
  modifier_4: string | null;
  units: MoneyString;
  charge_amount: MoneyString;
  allowed_amount: MoneyString | null;
  paid_amount: MoneyString | null;
  sequence_number: number;
  diagnosis_pointers: number[];
  place_of_service_code: string | null;
  rendering_provider_npi: string | null;
  claim_line_status: string | null;
}

export interface ClaimSubmissionRecord extends AuditFields {
  claim_id: UUID;
  submission_status: ClaimSubmissionStatus;
  submission_sequence: number;
  submitted_at: ISODateTime | null;
  acknowledged_at: ISODateTime | null;
  payer_claim_reference: string | null;
  clearinghouse_reference: string | null;
  external_transaction_id: UUID | null;
  duplicate_detection_key: string;
  response_summary: Record<string, unknown> | null;
}

export interface ClaimStatusInquiryRecord extends AuditFields {
  claim_id: UUID;
  inquiry_status: ClaimStatusInquiryStatus;
  requested_at: ISODateTime;
  responded_at: ISODateTime | null;
  payer_status_code: string | null;
  payer_status_text: string | null;
  response_summary: Record<string, unknown> | null;
  external_transaction_id: UUID | null;
  duplicate_detection_key: string;
}

export interface BillingAlertRecord extends AuditFields {
  source_object_type: SourceObjectType;
  source_object_id: UUID;
  workqueue_item_id: UUID | null;
  alert_type: BillingAlertType;
  alert_code: string;
  severity: Severity;
  status: BillingAlertStatus;
  title: string;
  message: string;
  first_detected_at: ISODateTime;
  last_detected_at: ISODateTime;
  resolved_at: ISODateTime | null;
  snoozed_until: ISODateTime | null;
  resolution_note: string | null;
}

export interface SupportTicketRecord extends AuditFields {
  workqueue_item_id: UUID | null;
  source_object_type: SourceObjectType;
  source_object_id: UUID;
  ticket_type: SupportTicketType;
  status: TicketStatus;
  title: string;
  description: string | null;
  assigned_to_user_id: UUID | null;
  opened_at: ISODateTime;
  resolved_at: ISODateTime | null;
  closed_at: ISODateTime | null;
  context_payload: Record<string, unknown>;
}

export interface BillingSnapshot {
  client_id: UUID;
  organization_id: UUID;
  client_balance: MoneyString;
  payer_balance: MoneyString;
  total_open_claim_balance: MoneyString;
  total_open_alert_count: number;
  total_open_workqueue_count: number;
  last_payment_posted_at: ISODateTime | null;
}

export interface InsurancePolicySummary {
  id: UUID;
  organization_id: UUID;
  client_id: UUID;
  payer_name: string;
  payer_id: string;
  member_id: string | null;
  group_number: string | null;
  plan_name: string | null;
  effective_date: ISODate;
  termination_date: ISODate | null;
  is_primary: boolean;
  active_flag: boolean;
  eligibility_status: EligibilityStatus | null;
  eligibility_last_verified_at: ISODateTime | null;
}

export interface EligibilityCheckSummary {
  id: UUID;
  organization_id: UUID;
  client_id: UUID;
  insurance_policy_id: UUID;
  appointment_id: UUID | null;
  encounter_id: UUID | null;
  eligibility_status: EligibilityStatus;
  checked_at: ISODateTime | null;
  coverage_start_date: ISODate | null;
  coverage_end_date: ISODate | null;
  copay_amount: MoneyString | null;
  deductible_remaining: MoneyString | null;
  out_of_pocket_remaining: MoneyString | null;
  eligibility_stale: boolean;
}

export interface AuthorizationSummary {
  id: UUID;
  organization_id: UUID;
  client_id: UUID;
  insurance_policy_id: UUID;
  appointment_id: UUID | null;
  encounter_id: UUID | null;
  authorization_status: AuthorizationStatus;
  auth_type: "authorization" | "referral";
  authorization_number: string | null;
  referral_number: string | null;
  service_code: string | null;
  units_authorized: number | null;
  units_used: number;
  valid_from: ISODate | null;
  valid_to: ISODate | null;
}

/* =========================
   Page/view contracts
   ========================= */

export interface ScheduleAppointmentRow {
  appointment_id: UUID;
  organization_id: UUID;
  client_id: UUID;
  encounter_id: UUID | null;
  scheduled_start_at: ISODateTime;
  scheduled_end_at: ISODateTime;
  appointment_status: AppointmentStatus;
  appointment_type: string | null;
  client_full_name: string;
  provider_id: UUID;
  provider_full_name: string;
  insurance_policy_id: UUID | null;
  payer_name: string | null;
  eligibility_status: EligibilityStatus | null;
  eligibility_checked_at: ISODateTime | null;
  eligibility_stale: boolean;
  note_status: NoteStatus | null;
  claim_id: UUID | null;
  claim_status: ClaimStatus | null;
  client_balance: MoneyString;
  open_alert_count: number;
  open_workqueue_count: number;
}

export interface EncounterWorkspaceResponse {
  encounter: EncounterRecord;
  appointment: AppointmentRecord | null;
  client: ClientRecord;
  note: EncounterNoteRecord | null;
  diagnoses: EncounterDiagnosisRecord[];
  service_lines: EncounterServiceLineRecord[];
  latest_eligibility: EligibilityCheckSummary | null;
  active_authorization: AuthorizationSummary | null;
  claim: ClaimRecord | null;
  billing_snapshot: BillingSnapshot;
  open_alerts: BillingAlertRecord[];
  open_workqueue_items: WorkqueueItemRecord[];
  readiness: {
    encounter_completion: ReadinessResult;
    claim_creation: ReadinessResult;
    route_to_biller: ReadinessResult;
  };
}

export interface ClaimDetailResponse {
  claim: ClaimRecord;
  client: ClientRecord;
  encounter: EncounterRecord;
  insurance_policy: InsurancePolicySummary;
  service_lines: ClaimServiceLineRecord[];
  submissions: ClaimSubmissionRecord[];
  status_inquiries: ClaimStatusInquiryRecord[];
  alerts: BillingAlertRecord[];
  workqueue_items: WorkqueueItemRecord[];
  support_tickets: SupportTicketRecord[];
  billing_snapshot: BillingSnapshot;
}

export interface ClaimSummaryRow {
  claim_id: UUID;
  organization_id: UUID;
  claim_number: string;
  claim_status: ClaimStatus;
  client_id: UUID;
  client_full_name: string;
  encounter_id: UUID;
  payer_name: string;
  date_of_service_from: ISODate;
  date_of_service_to: ISODate;
  total_charge_amount: MoneyString;
  remaining_insurance_balance: MoneyString;
  remaining_patient_balance: MoneyString;
  aging_bucket: ClaimRecord["aging_bucket"];
  assigned_biller_name: string | null;
  open_alert_count: number;
  open_workqueue_count: number;
  last_activity_at: ISODateTime | null;
}

/* =========================
   Workflow requests/responses
   ========================= */

export interface GetScheduleDayRequest extends PagingRequest {
  organization_id: UUID;
  date: ISODate;
  provider_id?: UUID;
  location_id?: UUID;
}

export interface GetScheduleDayResponse extends PagingResponse {
  date: ISODate;
  rows: ScheduleAppointmentRow[];
}

export interface ResolveEncounterForAppointmentRequest {
  organization_id: UUID;
  appointment_id: UUID;
  requested_by_user_id?: UUID;
}

export interface ResolveEncounterForAppointmentResponse {
  encounterId: any;
  encounter_id: UUID;
}

export interface GetEncounterWorkspaceRequest {
  organization_id: UUID;
  encounter_id: UUID;
}

export interface GetEncounterWorkspaceResponse extends EncounterWorkspaceResponse {}

export interface ClaimReadinessResult extends ReadinessResult {
  encounter_id: UUID;
  candidate_claim_id: UUID | null;
  duplicate_detection_key: string | null;
}

export interface CreateClaimRequest {
  organization_id: UUID;
  encounter_id: UUID;
  requested_by_user_id: UUID;
  force_rebuild_service_lines?: boolean;
}

export interface CreateClaimResponse {
  claim_id: UUID | null;
  claim: ClaimRecord | null;
  readiness: ClaimReadinessResult;
}

export interface GetClaimByIdRequest {
  organization_id: UUID;
  claim_id: UUID;
}

export interface GetClaimByIdResponse extends ClaimDetailResponse {}

export interface RunClaimStatusInquiryRequest {
  organization_id: UUID;
  claim_id: UUID;
  requested_by_user_id: UUID;
}

export interface RunClaimStatusInquiryResponse {
  claim_status_inquiry: ClaimStatusInquiryRecord;
  latest_claim_status: ClaimStatus;
  blockers: RuleMessage[];
  warnings: RuleMessage[];
}

export interface RouteToBillerRequest {
  organization_id: UUID;
  source_object_type: "encounter" | "claim";
  source_object_id: UUID;
  requested_by_user_id: UUID;
  priority?: WorkqueuePriority;
  title?: string;
  description?: string;
  assigned_to_user_id?: UUID | null;
  context_payload?: Record<string, unknown>;
}

export interface RouteToBillerResponse {
  workqueue_item: WorkqueueItemRecord;
  blockers: RuleMessage[];
  warnings: RuleMessage[];
}

export interface PaymentAllocationInput {
  claim_id?: UUID;
  claim_service_line_id?: UUID;
  encounter_id?: UUID;
  client_id?: UUID;
  allocation_type: "insurance_payment" | "patient_payment" | "adjustment" | "writeoff";
  allocated_amount: MoneyString;
  allocation_note?: string;
}

export interface PostPaymentRequest {
  organization_id: UUID;
  requested_by_user_id: UUID;
  payment_import_item_id?: UUID;
  posting_reference: string;
  allocations: PaymentAllocationInput[];
}

export interface PaymentPostingRecord extends AuditFields {
  payment_import_item_id: UUID | null;
  posting_status: PaymentPostingStatus;
  posted_at: ISODateTime | null;
  reversed_at: ISODateTime | null;
  posting_reference: string;
  total_posted_amount: MoneyString;
  note: string | null;
}

export interface PaymentPostingAllocationRecord extends AuditFields {
  payment_posting_id: UUID;
  claim_id: UUID | null;
  claim_service_line_id: UUID | null;
  encounter_id: UUID | null;
  client_id: UUID | null;
  allocation_type: "insurance_payment" | "patient_payment" | "adjustment" | "writeoff";
  allocated_amount: MoneyString;
  allocation_note: string | null;
}

export interface PostPaymentResponse {
  payment_posting: PaymentPostingRecord;
  allocations: PaymentPostingAllocationRecord[];
  blockers: RuleMessage[];
  warnings: RuleMessage[];
}

export interface CheckEligibilityRequest {
  organization_id: UUID;
  client_id: UUID;
  insurance_policy_id: UUID;
  appointment_id?: UUID;
  encounter_id?: UUID;
  requested_by_user_id: UUID;
}

export interface CheckEligibilityResponse {
  eligibility_check: EligibilityCheckSummary;
  blockers: RuleMessage[];
  warnings: RuleMessage[];
}

export interface CollectPaymentRequest {
  organization_id: UUID;
  client_id: UUID;
  requested_by_user_id: UUID;
  amount: MoneyString;
  allocations: PaymentAllocationInput[];
  payment_import_item_id?: UUID;
}

export interface CollectPaymentResponse extends PostPaymentResponse {}

export interface UpdateWorkqueueItemRequest {
  organization_id: UUID;
  workqueue_item_id: UUID;
  requested_by_user_id: UUID;
  status?: WorkqueueStatus;
  priority?: WorkqueuePriority;
  assigned_to_user_id?: UUID | null;
  due_at?: ISODateTime | null;
  title?: string;
  description?: string | null;
  context_payload?: Record<string, unknown>;
}

export interface UpdateWorkqueueItemResponse {
  workqueue_item: WorkqueueItemRecord;
}

/* =========================
   External transaction contracts
   ========================= */

export interface ExternalTransactionRecord extends AuditFields {
  transaction_type: ExternalTransactionType;
  payload_type: string;
  payload_version: string;
  message_format: ExternalMessageFormat;
  envelope_format: ExternalEnvelopeFormat;
  processing_mode: ExternalProcessingMode;
  sender_id: string;
  receiver_id: string;
  core_rule_version: string | null;
  payload_id: string | null;
  request_timestamp: ISODateTime;
  response_timestamp: ISODateTime | null;
  provider_office_number: string | null;
  provider_transaction_id: string | null;
  session_id: string | null;
  external_transaction_id: string | null;
  availity_transaction_id: string | null;
  environment_flag: EnvironmentFlag;
  raw_outbound_payload: string | null;
  raw_inbound_response: string | null;
  parsed_response_summary: Record<string, unknown> | null;
  attempt_count: number;
  duplicate_detection_key: string;
  retry_after: ISODateTime | null;
  defer_until: ISODateTime | null;
  error_class: ExternalErrorClass | null;
  error_cause_code: string | null;
  error_description: string | null;
  processing_status: ExternalTransactionStatus;
  source_object_type: SourceObjectType | null;
  source_object_id: UUID | null;
}

export interface ExternalTransactionAttemptRecord extends AuditFields {
  external_transaction_id_fk: UUID;
  attempt_number: number;
  status: ExternalAttemptStatus;
  started_at: ISODateTime | null;
  ended_at: ISODateTime | null;
  http_status_code: number | null;
  transport_error_code: string | null;
  transport_error_message: string | null;
  request_headers: Record<string, unknown> | null;
  response_headers: Record<string, unknown> | null;
  outbound_payload: string | null;
  inbound_payload: string | null;
  retry_after: ISODateTime | null;
}

/* =========================
   Helper type guards
   ========================= */

export function hasBlockers(result: ReadinessResult): boolean {
  return result.blockers.length > 0;
}

export function hasWarnings(result: ReadinessResult): boolean {
  return result.warnings.length > 0;
}

export function isClaimTerminal(status: ClaimStatus): boolean {
  return status === "paid" || status === "voided";
}

export function isWorkqueueOpen(status: WorkqueueStatus): boolean {
  return status !== "completed" && status !== "archived";
}
