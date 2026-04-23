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
} from "../../../shared/contracts";
import { validateClaimCreation } from "../validators/claim-readiness";
import { validatePaymentPosting } from "../validators/payment-posting";
import { validateRouteToBiller } from "../validators/workqueue-rules";
import type {
  AlertRepository,
  BillingService,
  ClaimRepository,
  ClaimService,
  ClientRepository,
  EncounterRepository,
  EncounterService,
  InsuranceRepository,
  PaymentRepository,
  ScheduleRepository,
  ScheduleService,
  TicketRepository,
  WorkqueueRepository,
  WorkqueueService,
} from "./interfaces";

export interface RepositoryBundle {
  scheduleRepository: ScheduleRepository;
  encounterRepository: EncounterRepository;
  clientRepository: ClientRepository;
  insuranceRepository: InsuranceRepository;
  claimRepository: ClaimRepository;
  workqueueRepository: WorkqueueRepository;
  alertRepository: AlertRepository;
  ticketRepository: TicketRepository;
  paymentRepository: PaymentRepository;
}

export function createScheduleService(repos: RepositoryBundle): ScheduleService {
  return {
    async getScheduleDay(request: GetScheduleDayRequest): Promise<GetScheduleDayResponse> {
      const data = await repos.scheduleRepository.getScheduleDay(request);
      return {
        date: request.date,
        limit: request.limit ?? 50,
        offset: request.offset ?? 0,
        total: data.total,
        rows: data.rows as GetScheduleDayResponse["rows"],
      };
    },
  };
}

export function createEncounterService(repos: RepositoryBundle): EncounterService {
  return {
    async getEncounterWorkspace(request: GetEncounterWorkspaceRequest): Promise<GetEncounterWorkspaceResponse> {
      const encounter = await repos.encounterRepository.getById(request.organization_id, request.encounter_id);
      if (!encounter) throw new Error("Encounter not found");

      const [note, diagnoses, service_lines, claim, latest_eligibility, active_authorization] = await Promise.all([
        repos.encounterRepository.getNoteByEncounterId(request.organization_id, request.encounter_id),
        repos.encounterRepository.listDiagnoses(request.organization_id, request.encounter_id),
        repos.encounterRepository.listServiceLines(request.organization_id, request.encounter_id),
        repos.claimRepository.getByEncounterId(request.organization_id, request.encounter_id),
        repos.insuranceRepository.getLatestEligibilityForEncounter(request.organization_id, request.encounter_id),
        repos.insuranceRepository.getActiveAuthorizationForEncounter(request.organization_id, request.encounter_id),
      ]);

      const client = await repos.clientRepository.getById(request.organization_id, encounter.client_id);
      if (!client) throw new Error("Client not found");

      const billing_snapshot = await repos.clientRepository.getBillingSnapshot(request.organization_id, encounter.client_id);
      const open_alerts = claim
        ? await repos.alertRepository.listOpenByClaimId(request.organization_id, claim.id)
        : await repos.alertRepository.listOpenByEncounterId(request.organization_id, request.encounter_id);
      const open_workqueue_items = claim
        ? await repos.workqueueRepository.listByClaimId(request.organization_id, claim.id)
        : await repos.workqueueRepository.listByEncounterId(request.organization_id, request.encounter_id);
      const insurance_policy = await repos.insuranceRepository.getPrimaryPolicyForEncounter(request.organization_id, request.encounter_id);

      const claim_creation = validateClaimCreation({
        encounter, note, diagnoses, service_lines, insurance_policy, latest_eligibility, active_authorization,
        existing_claim: claim, duplicate_detection_key: claim?.duplicate_detection_key ?? null,
      });

      return {
        encounter,
        appointment: null,
        client,
        note,
        diagnoses,
        service_lines,
        latest_eligibility,
        active_authorization,
        claim,
        billing_snapshot,
        open_alerts,
        open_workqueue_items,
        readiness: {
          encounter_completion: {
            is_ready: claim_creation.blockers.filter(b => b.rule_code.startsWith("ENCOUNTER_") || b.rule_code.startsWith("SERVICE_LINE_")).length === 0,
            blockers: claim_creation.blockers.filter(b => b.rule_code.startsWith("ENCOUNTER_") || b.rule_code.startsWith("SERVICE_LINE_")),
            warnings: claim_creation.warnings.filter(w => w.rule_code.startsWith("ENCOUNTER_")),
          },
          claim_creation,
          route_to_biller: { is_ready: true, blockers: [], warnings: [] },
        },
      };
    },
  };
}

export function createClaimService(repos: RepositoryBundle): ClaimService {
  return {
    async getClaimById(request: GetClaimByIdRequest): Promise<GetClaimByIdResponse> {
      const claim = await repos.claimRepository.getById(request.organization_id, request.claim_id);
      if (!claim) throw new Error("Claim not found");
      const [encounter, client, insurance_policy, service_lines, submissions, status_inquiries, alerts, workqueue_items, support_tickets, billing_snapshot] = await Promise.all([
        repos.encounterRepository.getById(request.organization_id, claim.encounter_id),
        repos.clientRepository.getById(request.organization_id, claim.client_id),
        repos.insuranceRepository.getPrimaryPolicyForEncounter(request.organization_id, claim.encounter_id),
        repos.claimRepository.listServiceLines(request.organization_id, claim.id),
        repos.claimRepository.listSubmissions(request.organization_id, claim.id),
        repos.claimRepository.listStatusInquiries(request.organization_id, claim.id),
        repos.alertRepository.listOpenByClaimId(request.organization_id, claim.id),
        repos.workqueueRepository.listByClaimId(request.organization_id, claim.id),
        repos.ticketRepository.listByClaimId(request.organization_id, claim.id),
        repos.clientRepository.getBillingSnapshot(request.organization_id, claim.client_id),
      ]);
      if (!encounter || !client || !insurance_policy) throw new Error("Missing claim dependencies");
      return { claim, client, encounter, insurance_policy, service_lines, submissions, status_inquiries, alerts, workqueue_items, support_tickets, billing_snapshot };
    },

    async computeClaimReadiness(encounter_id: string, organization_id: string): Promise<ClaimReadinessResult> {
      const encounter = await repos.encounterRepository.getById(organization_id, encounter_id);
      if (!encounter) throw new Error("Encounter not found");
      const [note, diagnoses, service_lines, insurance_policy, latest_eligibility, active_authorization, existing_claim] = await Promise.all([
        repos.encounterRepository.getNoteByEncounterId(organization_id, encounter_id),
        repos.encounterRepository.listDiagnoses(organization_id, encounter_id),
        repos.encounterRepository.listServiceLines(organization_id, encounter_id),
        repos.insuranceRepository.getPrimaryPolicyForEncounter(organization_id, encounter_id),
        repos.insuranceRepository.getLatestEligibilityForEncounter(organization_id, encounter_id),
        repos.insuranceRepository.getActiveAuthorizationForEncounter(organization_id, encounter_id),
        repos.claimRepository.getByEncounterId(organization_id, encounter_id),
      ]);
      const duplicate_detection_key = `${organization_id}:${encounter.client_id}:${encounter_id}:${encounter.date_of_service}`;
      return validateClaimCreation({ encounter, note, diagnoses, service_lines, insurance_policy, latest_eligibility, active_authorization, existing_claim, duplicate_detection_key });
    },

    async createClaim(request: CreateClaimRequest): Promise<CreateClaimResponse> {
      const readiness = await this.computeClaimReadiness(request.encounter_id, request.organization_id);
      if (!readiness.is_ready) return { claim_id: null, claim: null, readiness };
      throw new Error("Not implemented: persist claim using repository after mapper is added.");
    },

    async runClaimStatusInquiry(request: RunClaimStatusInquiryRequest): Promise<RunClaimStatusInquiryResponse> {
      const claim = await repos.claimRepository.getById(request.organization_id, request.claim_id);
      if (!claim) throw new Error("Claim not found");
      return {
        claim_status_inquiry: {
          id: "not-implemented",
          organization_id: request.organization_id,
          claim_id: claim.id,
          inquiry_status: "queued",
          requested_at: new Date().toISOString(),
          responded_at: null,
          payer_status_code: null,
          payer_status_text: null,
          response_summary: null,
          external_transaction_id: null,
          duplicate_detection_key: `${request.organization_id}:${claim.id}:${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by_user_id: request.requested_by_user_id,
          updated_by_user_id: request.requested_by_user_id,
          archived_at: null,
        },
        latest_claim_status: claim.claim_status,
        blockers: [],
        warnings: [],
      };
    },
  };
}

export function createWorkqueueService(repos: RepositoryBundle): WorkqueueService {
  return {
    async findOpenBySource(organization_id, source_object_type, source_object_id) {
      return repos.workqueueRepository.findOpenBySource(organization_id, source_object_type, source_object_id);
    },

    async routeToBiller(request: RouteToBillerRequest): Promise<RouteToBillerResponse> {
      const encounter = request.source_object_type === "encounter"
        ? await repos.encounterRepository.getById(request.organization_id, request.source_object_id)
        : null;
      const claim = request.source_object_type === "claim"
        ? await repos.claimRepository.getById(request.organization_id, request.source_object_id)
        : null;
      const existing = await repos.workqueueRepository.findOpenBySource(request.organization_id, request.source_object_type, request.source_object_id);
      const readiness = validateRouteToBiller({ request, encounter, claim, existing_open_workqueue_item: existing });
      if (!readiness.is_ready && !existing) throw new Error(`Route to biller blocked: ${readiness.blockers.map(b => b.rule_code).join(", ")}`);
      if (existing) return { workqueue_item: existing, blockers: readiness.blockers, warnings: readiness.warnings };
      throw new Error("Not implemented: create workqueue item after repository mapper is added.");
    },

    async updateWorkqueueItem(_request: UpdateWorkqueueItemRequest): Promise<UpdateWorkqueueItemResponse> {
      throw new Error("Not implemented");
    },
  };
}

export function createBillingService(repos: RepositoryBundle): BillingService {
  return {
    async postPayment(request: PostPaymentRequest): Promise<PostPaymentResponse> {
      const existing = await repos.paymentRepository.findPostingByReference(request.organization_id, request.posting_reference);
      const readiness = validatePaymentPosting({ request, existing_posting: existing });
      if (!readiness.is_ready) {
        return {
          payment_posting: {
            id: "not-created",
            organization_id: request.organization_id,
            payment_import_item_id: request.payment_import_item_id ?? null,
            posting_status: "failed",
            posted_at: null,
            reversed_at: null,
            posting_reference: request.posting_reference,
            total_posted_amount: "0.00",
            note: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by_user_id: request.requested_by_user_id,
            updated_by_user_id: request.requested_by_user_id,
            archived_at: null,
          },
          allocations: [],
          blockers: readiness.blockers,
          warnings: readiness.warnings,
        };
      }
      throw new Error("Not implemented: persist payment posting after repository mapper is added.");
    },

    async getBillingSnapshot(organization_id: string, client_id: string): Promise<BillingSnapshot> {
      return repos.clientRepository.getBillingSnapshot(organization_id, client_id);
    },
  };
}
