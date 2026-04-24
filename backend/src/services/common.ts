import type {
  BillingSnapshot,
  ClaimReadinessResult,
  CreateClaimRequest,
  CreateClaimResponse,
  GetClaimByIdRequest,
  GetClaimByIdResponse,
  GetEncounterWorkspaceRequest,
  GetEncounterWorkspaceResponse,
  GetScheduleDayRequest,
  GetScheduleDayResponse,
  PostPaymentRequest,
  PostPaymentResponse,
  RouteToBillerRequest,
  RouteToBillerResponse,
  RunClaimStatusInquiryRequest,
  RunClaimStatusInquiryResponse,
  UpdateWorkqueueItemRequest,
  UpdateWorkqueueItemResponse,
  WorkqueueItemRecord,
  ResolveEncounterForAppointmentRequest,
  ResolveEncounterForAppointmentResponse,
} from "../../../shared/contracts";

export interface ScheduleService {
  getScheduleDay(request: GetScheduleDayRequest): Promise<GetScheduleDayResponse>;
  resolveEncounterForAppointment(
    request: ResolveEncounterForAppointmentRequest,
  ): Promise<ResolveEncounterForAppointmentResponse>;
}

export interface EncounterService {
  getEncounterWorkspace(request: GetEncounterWorkspaceRequest): Promise<GetEncounterWorkspaceResponse>;
}

export interface ClaimService {
  getClaimById(request: GetClaimByIdRequest): Promise<GetClaimByIdResponse>;
  createClaim(request: CreateClaimRequest): Promise<CreateClaimResponse>;
  runClaimStatusInquiry(request: RunClaimStatusInquiryRequest): Promise<RunClaimStatusInquiryResponse>;
  computeClaimReadiness(encounter_id: string, organization_id: string): Promise<ClaimReadinessResult>;
}

export interface WorkqueueService {
  routeToBiller(request: RouteToBillerRequest): Promise<RouteToBillerResponse>;
  updateWorkqueueItem(request: UpdateWorkqueueItemRequest): Promise<UpdateWorkqueueItemResponse>;
  findOpenBySource(
    organization_id: string,
    source_object_type: "encounter" | "claim",
    source_object_id: string,
  ): Promise<WorkqueueItemRecord | null>;
}

export interface BillingService {
  postPayment(request: PostPaymentRequest): Promise<PostPaymentResponse>;
  getBillingSnapshot(organization_id: string, client_id: string): Promise<BillingSnapshot>;
  getUnpostedPayments(organization_id: string): Promise<Array<{
    id: string;
    source_type: string | null;
    payer_name: string | null;
    patient_name: string | null;
    received_at: string | null;
    amount: string | number;
    status: string | null;
  }>>;
  getReadyToSubmitClaims(organization_id: string): Promise<Array<{
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
  getSubmissionBatches(organization_id: string): Promise<Array<{
    id: string;
    batch_number: string;
    created_at: string;
    claim_count: number;
    total_charge_amount: string | number;
    status: string;
  }>>;
}
