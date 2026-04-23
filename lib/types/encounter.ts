// Encounter Workspace Types
// Single-page workspace for completing visits and moving toward billing

import { ClaimStatus } from "./claim";
import { EligibilityRecord, NoteStatus } from "./schedule";

export type EncounterStatus = 
  | "scheduled"
  | "checked_in"
  | "in_progress" 
  | "completed"
  | "ready_to_bill"
  | "billed"
  | "cancelled"
  | "no_show";

export type ReadinessStatus = "ready" | "blocked" | "warning";

export type DocumentationType = "progress_note" | "assessment" | "treatment_plan";

export interface BillingAlert {
  id: string;
  severity: "error" | "warning" | "info";
  category: "authorization" | "eligibility" | "documentation" | "coding" | "payer";
  message: string;
  createdAt: string;
}

export interface PriorAuthorization {
  id: string;
  authNumber: string;
  startDate: string;
  endDate: string;
  unitsAuthorized: number;
  unitsUsed: number;
  status: "active" | "expired" | "pending" | "denied";
  serviceCodes: string[];
}

export interface EncounterNote {
  id: string;
  noteType: DocumentationType;
  status: NoteStatus;
  lastModified?: string;
  lockedAt?: string;
  signedBy?: string;
  signedAt?: string;
  requiredFieldsComplete: boolean;
  diagnosesCount: number;
  hasServiceCodes: boolean;
}

export interface DiagnosisInfo {
  id: string;
  code: string;
  description: string;
  isPrimary: boolean;
}

export interface ServiceCodeInfo {
  code: string;
  description: string;
  units: number;
  modifiers?: string[];
  isSuggested: boolean;
}

export interface CodingReadiness {
  status: ReadinessStatus;
  diagnoses: DiagnosisInfo[];
  serviceCodes: ServiceCodeInfo[];
  renderingProvider: {
    id: string;
    name: string;
    npi: string;
  } | null;
  billingProvider: {
    id: string;
    name: string;
    npi: string;
    taxId: string;
  } | null;
  blockers: string[];
  warnings: string[];
}

export interface ClaimInfo {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  createdAt: string;
  submittedAt?: string;
  billedAmount?: number;
}

export interface ClientBillingSnapshot {
  clientBalance: number;
  insuranceBalance: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  alerts: BillingAlert[];
  priorAuth?: PriorAuthorization;
}

export interface EncounterWorkspace {
  // Core appointment data
  encounterId: string;
  appointmentId: string;
  appointmentDate: string;
  appointmentTime: string;
  status: EncounterStatus;
  
  // Patient/Client
  clientId: string;
  clientFullName: string;
  clientDob: string;
  
  // Provider
  providerId: string;
  providerName: string;
  appointmentType?: string;
  
  // Payer/Insurance
  payerName: string;
  payerId?: string;
  memberId?: string;
  eligibility: EligibilityRecord;
  
  // Billing snapshot
  billing: ClientBillingSnapshot;
  
  // Documentation
  note: EncounterNote | null;
  
  // Coding & Readiness
  coding: CodingReadiness;
  
  // Claim
  claim: ClaimInfo | null;
}

export interface EncounterActionRequest {
  action: "open_client" | "open_note" | "check_eligibility" | "route_to_biller" | "collect" | "create_claim" | "open_claim";
  encounterId: string;
  metadata?: Record<string, unknown>;
}

export interface EncounterActionResult {
  success: boolean;
  message?: string;
  redirect?: string;
  error?: string;
}
