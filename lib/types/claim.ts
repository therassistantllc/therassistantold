// Claim Types for THERASSISTANT
// Based on CMS-1500 form structure

export type ClaimStatus = 
  | "draft"
  | "ready_to_submit"
  | "submitted"
  | "accepted"
  | "rejected"
  | "denied"
  | "paid"
  | "partially_paid"
  | "appealed"
  | "void"
  | "corrected"
  | "pending_review";

export type ClaimFrequencyType = 
  | "1" // Original
  | "7" // Replacement
  | "8"; // Void

export type PlaceOfService = 
  | "02" // Telehealth
  | "11" // Office
  | "12" // Home
  | "21" // Inpatient Hospital
  | "22" // Outpatient Hospital
  | "23" // Emergency Room
  | "31" // Skilled Nursing Facility
  | "32" // Nursing Facility
  | "33" // Custodial Care Facility
  | "99"; // Other

export type ClaimPriority = "routine" | "urgent" | "stat";

export type ClaimSource = "manual" | "ehr" | "import" | "batch";

export interface Provider {
  id: string;
  npi: string;
  name: string;
  taxonomy_code?: string;
  ein?: string;
  address?: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  sex: "M" | "F" | "U";
  address: Address;
  phone?: string;
  email?: string;
  relationship_to_subscriber: "self" | "spouse" | "child" | "other";
  marital_status?: "single" | "married" | "divorced" | "widowed";
  employment_status?: "employed" | "unemployed" | "retired" | "student";
  student_status?: "full_time" | "part_time" | "none";
}

export interface Insurance {
  id: string;
  payer_name: string;
  payer_id: string;
  member_id: string;
  group_number?: string;
  policy_holder_name?: string;
  policy_holder_dob?: string;
  policy_holder_relationship?: string;
  policy_holder_address?: Address;
  plan_type?: string;
  effective_date?: string;
  termination_date?: string;
  copay?: number;
  coinsurance?: number;
  deductible?: number;
  eligibility_status?: "active" | "inactive" | "unknown" | "pending";
  eligibility_last_verified?: string;
}

export interface DiagnosisCode {
  id: string;
  priority: number;
  code: string;
  description: string;
  active: boolean;
  present_on_claim: boolean;
}

export interface ServiceLine {
  id: string;
  dos_from: string;
  dos_to: string;
  place_of_service: PlaceOfService;
  cpt_code: string;
  modifier_1?: string;
  modifier_2?: string;
  modifier_3?: string;
  modifier_4?: string;
  diagnosis_pointers: string[]; // e.g., ["A", "B"]
  units: number;
  charge_amount: number;
  allowed_amount?: number;
  paid_amount?: number;
  patient_paid?: number;
  rendering_provider_id?: string;
  rendering_provider_npi?: string;
  authorization_number?: string;
  cob_indicator?: boolean;
  epsdt_indicator?: boolean;
  emergency_indicator?: boolean;
  family_planning_indicator?: boolean;
  rendering_notes?: string;
  claim_line_status?: string;
  claim_line_balance?: number;
  carc_codes?: string[];
  rarc_codes?: string[];
  era_match_status?: "matched" | "unmatched" | "partial";
}

export interface ClaimNote {
  id: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  note: string;
  note_type: "internal" | "payer_call" | "appeal" | "ticket";
}

export interface ClaimHistoryEvent {
  id: string;
  timestamp: string;
  event_type: string;
  description: string;
  user_id?: string;
  user_name?: string;
  details?: Record<string, any>;
}

export interface ClaimAlert {
  id: string;
  type: 
    | "missing_authorization"
    | "eligibility_expired"
    | "missing_npi"
    | "missing_diagnosis_pointer"
    | "era_not_posted"
    | "claim_over_90_days"
    | "recoupment_risk"
    | "duplicate_claim_risk"
    | "missing_modifier"
    | "missing_attachment";
  severity: "error" | "warning" | "info";
  message: string;
}

export interface Claim {
  id: string;
  claim_number: string;
  original_claim_number?: string;
  frequency_type: ClaimFrequencyType;
  status: ClaimStatus;
  source: ClaimSource;
  priority: ClaimPriority;
  
  // Dates
  submission_date?: string;
  dos_from: string;
  dos_to: string;
  created_at: string;
  updated_at: string;
  last_activity?: string;
  
  // Patient & Insurance
  patient: Patient;
  primary_insurance: Insurance;
  secondary_insurance?: Insurance;
  
  // Providers
  billing_provider: Provider;
  rendering_provider?: Provider;
  referring_provider?: Provider;
  supervising_provider?: Provider;
  service_location?: Address;
  
  // Clinical
  diagnosis_codes: DiagnosisCode[];
  service_lines: ServiceLine[];
  
  // Authorization & Referral
  authorization_number?: string;
  referral_number?: string;
  
  // Accident Related
  accident_related?: boolean;
  auto_accident?: boolean;
  work_comp?: boolean;
  
  // Financial
  total_charges: number;
  total_allowed_amount?: number;
  total_insurance_paid?: number;
  total_patient_paid?: number;
  remaining_insurance_balance?: number;
  remaining_patient_balance?: number;
  write_off_amount?: number;
  adjustment_amount?: number;
  overpayment_amount?: number;
  refund_due?: number;
  recoupment_status?: boolean;
  last_payment_date?: string;
  payment_source?: string;
  linked_era_number?: string;
  
  // Workflow
  assigned_biller_id?: string;
  assigned_biller_name?: string;
  due_date?: string;
  aging_bucket?: "0-30" | "31-60" | "61-90" | "91-120" | "120+";
  open_tickets?: number;
  defer_until?: string;
  
  // Activity
  notes: ClaimNote[];
  history: ClaimHistoryEvent[];
  alerts: ClaimAlert[];
  attachments?: string[];
}
