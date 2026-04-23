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
} from "../../../shared/contracts";

export interface ScheduleService {
  getScheduleDay(request: GetScheduleDayRequest): Promise<GetScheduleDayResponse>;
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
}
