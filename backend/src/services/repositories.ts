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
  AppointmentRecord,
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
  listReadyToSubmit(organization_id: string): Promise<Array<{
    claim_id: string;
    claim_number: string;
    client_name: string | null;
    payer_name: string | null;
    date_of_service_from: string;
    total_charge_amount: string | number;
    readiness_status: "ready" | "warning" | "blocked";
    blockers: string[];
    warnings: string[];
  }>>;
  listSubmissionBatches(organization_id: string): Promise<Array<{
    id: string;
    batch_number: string;
    created_at: string;
    claim_count: number;
    total_charge_amount: string | number;
    status: string;
  }>>;
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
  create(ticket: SupportTicketRecord): Promise<SupportTicketRecord>;
  listByClaimId(organization_id: string, claim_id: string): Promise<SupportTicketRecord[]>;
  listByEncounterId(organization_id: string, encounter_id: string): Promise<SupportTicketRecord[]>;
}

export interface PaymentRepository {
  findPostingByReference(organization_id: string, posting_reference: string): Promise<PaymentPostingRecord | null>;
  listUnpostedPayments(organization_id: string): Promise<Array<{
    id: string;
    source_type: string | null;
    payer_name: string | null;
    patient_name: string | null;
    received_at: string | null;
    amount: string | number;
    status: string | null;
  }>>;
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
  getAppointmentById(
    organization_id: string,
    appointment_id: string,
  ): Promise<AppointmentRecord | null>;
  getEncounterByAppointmentId(
    organization_id: string,
    appointment_id: string,
  ): Promise<EncounterRecord | null>;
  createEncounterForAppointment(args: {
    organization_id: string;
    appointment: AppointmentRecord;
    requested_by_user_id?: string;
  }): Promise<EncounterRecord>;
  setAppointmentEncounterIdIfColumnExists(
    organization_id: string,
    appointment_id: string,
    encounter_id: string,
  ): Promise<void>;
}
