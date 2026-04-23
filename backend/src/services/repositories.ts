import type {
  AuthorizationSummary,
  BillingSnapshot,
  BillingAlertRecord,
  ClaimRecord,
  ClaimServiceLineRecord,
  ClaimStatusInquiryRecord,
  ClaimSubmissionRecord,
  ClientRecord,
  EligibilityCheckSummary,
  EncounterDiagnosisRecord,
  EncounterNoteRecord,
  EncounterRecord,
  EncounterServiceLineRecord,
  InsurancePolicySummary,
  PaymentPostingRecord,
  SupportTicketRecord,
  WorkqueueItemRecord,
} from "../../../shared/contracts";

export interface EncounterRepository {
  getById(organization_id: string, encounter_id: string): Promise<EncounterRecord | null>;
  getNoteByEncounterId(organization_id: string, encounter_id: string): Promise<EncounterNoteRecord | null>;
  listDiagnoses(organization_id: string, encounter_id: string): Promise<EncounterDiagnosisRecord[]>;
  listServiceLines(organization_id: string, encounter_id: string): Promise<EncounterServiceLineRecord[]>;
}

export interface ClientRepository {
  getById(organization_id: string, client_id: string): Promise<ClientRecord | null>;
  getBillingSnapshot(organization_id: string, client_id: string): Promise<BillingSnapshot>;
}

export interface InsuranceRepository {
  getPrimaryPolicyForEncounter(organization_id: string, encounter_id: string): Promise<InsurancePolicySummary | null>;
  getLatestEligibilityForEncounter(organization_id: string, encounter_id: string): Promise<EligibilityCheckSummary | null>;
  getActiveAuthorizationForEncounter(organization_id: string, encounter_id: string): Promise<AuthorizationSummary | null>;
}

export interface ClaimRepository {
  getById(organization_id: string, claim_id: string): Promise<ClaimRecord | null>;
  getByEncounterId(organization_id: string, encounter_id: string): Promise<ClaimRecord | null>;
  listServiceLines(organization_id: string, claim_id: string): Promise<ClaimServiceLineRecord[]>;
  listSubmissions(organization_id: string, claim_id: string): Promise<ClaimSubmissionRecord[]>;
  listStatusInquiries(organization_id: string, claim_id: string): Promise<ClaimStatusInquiryRecord[]>;
  createClaim(claim: ClaimRecord, service_lines: ClaimServiceLineRecord[]): Promise<{ claim: ClaimRecord; service_lines: ClaimServiceLineRecord[] }>;
}

export interface WorkqueueRepository {
  findOpenBySource(organization_id: string, source_object_type: "encounter" | "claim", source_object_id: string): Promise<WorkqueueItemRecord | null>;
  create(item: WorkqueueItemRecord): Promise<WorkqueueItemRecord>;
  update(item: WorkqueueItemRecord): Promise<WorkqueueItemRecord>;
  listByClaimId(organization_id: string, claim_id: string): Promise<WorkqueueItemRecord[]>;
  listByEncounterId(organization_id: string, encounter_id: string): Promise<WorkqueueItemRecord[]>;
}

export interface AlertRepository {
  listOpenByClaimId(organization_id: string, claim_id: string): Promise<BillingAlertRecord[]>;
  listOpenByEncounterId(organization_id: string, encounter_id: string): Promise<BillingAlertRecord[]>;
}

export interface TicketRepository {
  listByClaimId(organization_id: string, claim_id: string): Promise<SupportTicketRecord[]>;
}

export interface PaymentRepository {
  findPostingByReference(organization_id: string, posting_reference: string): Promise<PaymentPostingRecord | null>;
}

export interface ScheduleRepository {
  getScheduleDay(request: {
    organization_id: string;
    date: string;
    provider_id?: string;
    location_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; rows: unknown[] }>;
}
