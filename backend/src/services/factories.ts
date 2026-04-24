// File: backend/src/services/factories.ts
import crypto from "crypto";
import { getMockClaimData } from "../mock-data/claims";
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
  ResolveEncounterForAppointmentRequest,
  ResolveEncounterForAppointmentResponse,
  RouteToBillerRequest,
  RouteToBillerResponse,
  RunClaimStatusInquiryRequest,
  RunClaimStatusInquiryResponse,
  UpdateWorkqueueItemRequest,
  UpdateWorkqueueItemResponse,
  WorkqueueItemRecord,
  SupportTicketRecord,
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

function toMoneyString(value: number): string {
  const normalized = Number.isFinite(value) ? value : 0;
  return normalized.toFixed(2);
}

async function listTicketsByEncounterSafe(
  repos: RepositoryBundle,
  organization_id: string,
  encounter_id: string,
) {
  const repo = repos.ticketRepository as unknown as {
    listByEncounterId?: (organization_id: string, encounter_id: string) => Promise<any[]>;
  };

  if (typeof repo.listByEncounterId !== "function") {
    return [];
  }

  return repo.listByEncounterId(organization_id, encounter_id);
}

async function listTicketsByClaimSafe(
  repos: RepositoryBundle,
  organization_id: string,
  claim_id: string,
) {
  const repo = repos.ticketRepository as unknown as {
    listByClaimId?: (organization_id: string, claim_id: string) => Promise<any[]>;
  };

  if (typeof repo.listByClaimId !== "function") {
    return [];
  }

  return repo.listByClaimId(organization_id, claim_id);
}

async function createSupportTicketSafe(
  repos: RepositoryBundle,
  ticket: SupportTicketRecord,
): Promise<SupportTicketRecord | null> {
  const repo = repos.ticketRepository as unknown as {
    create?: (ticket: SupportTicketRecord) => Promise<SupportTicketRecord>;
  };

  if (typeof repo.create !== "function") {
    return null;
  }

  return repo.create(ticket);
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

    async resolveEncounterForAppointment(
      request: ResolveEncounterForAppointmentRequest,
    ): Promise<ResolveEncounterForAppointmentResponse> {
      const appointment = await repos.scheduleRepository.getAppointmentById(
        request.organization_id,
        request.appointment_id,
      );
      if (!appointment) {
        throw new Error("Appointment not found");
      }

      const existing = await repos.scheduleRepository.getEncounterByAppointmentId(
        request.organization_id,
        request.appointment_id,
      );
      if (existing) {
        return { encounter_id: existing.id };
      }

      const created = await repos.scheduleRepository.createEncounterForAppointment({
        organization_id: request.organization_id,
        appointment,
        requested_by_user_id: request.requested_by_user_id,
      });
      if (!created) {
        throw new Error("Failed to create encounter");
      }

      await repos.scheduleRepository.setAppointmentEncounterIdIfColumnExists(
        request.organization_id,
        request.appointment_id,
        created.id,
      );

      return { encounter_id: created.id };
    },
  };
}

export function createEncounterService(repos: RepositoryBundle): EncounterService {
  return {
    async getEncounterWorkspace(
      request: GetEncounterWorkspaceRequest,
    ): Promise<GetEncounterWorkspaceResponse> {
      const encounter = await repos.encounterRepository.getById(
        request.organization_id,
        request.encounter_id,
      );
      if (!encounter) {
        throw new Error("Encounter not found");
      }

      const [note, diagnoses, service_lines, claim, latest_eligibility] = await Promise.all([
        repos.encounterRepository.getNoteByEncounterId(
          request.organization_id,
          request.encounter_id,
        ),
        repos.encounterRepository.listDiagnoses(
          request.organization_id,
          request.encounter_id,
        ),
        repos.encounterRepository.listServiceLines(
          request.organization_id,
          request.encounter_id,
        ),
        repos.claimRepository.getByEncounterId(
          request.organization_id,
          request.encounter_id,
        ),
        repos.insuranceRepository.getLatestEligibilityForEncounter(
          request.organization_id,
          request.encounter_id,
        ),
      ]);

      const client = await repos.clientRepository.getById(
        request.organization_id,
        encounter.client_id,
      );
      if (!client) {
        throw new Error("Client not found");
      }

      const billing_snapshot = await repos.clientRepository.getBillingSnapshot(
        request.organization_id,
        encounter.client_id,
      );

      const alerts = claim
        ? await repos.alertRepository.listOpenByClaimId(request.organization_id, claim.id)
        : await repos.alertRepository.listOpenByEncounterId(
            request.organization_id,
            request.encounter_id,
          );

      const workqueue_items = claim
        ? await repos.workqueueRepository.listByClaimId(request.organization_id, claim.id)
        : await repos.workqueueRepository.listByEncounterId(
            request.organization_id,
            request.encounter_id,
          );

      const support_tickets = claim
        ? await listTicketsByClaimSafe(repos, request.organization_id, claim.id)
        : await listTicketsByEncounterSafe(
            repos,
            request.organization_id,
            request.encounter_id,
          );

      const insurance_policy =
        await repos.insuranceRepository.getPrimaryPolicyForEncounter(
          request.organization_id,
          request.encounter_id,
        );

      const claim_creation = validateClaimCreation({
        encounter,
        note,
        diagnoses,
        service_lines,
        insurance_policy,
        latest_eligibility,
        active_authorization: null,
        existing_claim: claim,
        duplicate_detection_key: claim?.duplicate_detection_key ?? null,
      });

      return {
        encounter,
        appointment: null,
        client,
        note,
        diagnoses,
        service_lines,
        latest_eligibility,
        active_authorization: null,
        insurance_policy,
        claim,
        readiness: {
          claim_creation,
        },
        alerts,
        workqueue_items,
        support_tickets,
        billing_snapshot,
      } as GetEncounterWorkspaceResponse;
    },
  };
}

export function createClaimService(repos: RepositoryBundle): ClaimService {
  return {
    async getClaimById(request: GetClaimByIdRequest): Promise<GetClaimByIdResponse> {
      // Check for mock data first (for test UUIDs)
      const mockData = getMockClaimData(request.claim_id);
      if (mockData) {
        return {
          claim: mockData.claim,
          client: mockData.client!,
          encounter: mockData.encounter!,
          insurance_policy: mockData.insurance_policy || null,
          diagnoses: mockData.diagnoses,
          service_lines: mockData.service_lines,
          submissions: [],
          status_inquiries: [],
          alerts: [],
          workqueue_items: [],
          support_tickets: [],
          billing_snapshot: null,
        };
      }

      const claim = await repos.claimRepository.getById(
        request.organization_id,
        request.claim_id,
      );
      if (!claim) {
        throw new Error("Claim not found");
      }

      const encounter = await repos.encounterRepository.getById(
        request.organization_id,
        claim.encounter_id,
      );
      if (!encounter) {
        throw new Error("Encounter not found");
      }

      const [client, insurance_policy, diagnoses, service_lines] = await Promise.all([
        repos.clientRepository.getById(request.organization_id, claim.client_id),
        repos.insuranceRepository.getPrimaryPolicyForEncounter(
          request.organization_id,
          claim.encounter_id,
        ),
        repos.encounterRepository.listDiagnoses(
          request.organization_id,
          claim.encounter_id,
        ),
        repos.encounterRepository.listServiceLines(
          request.organization_id,
          claim.encounter_id,
        ),
      ]);

      if (!client) {
        throw new Error("Client not found");
      }

      const [submissions, status_inquiries, alerts, workqueue_items, support_tickets, billing_snapshot] =
        await Promise.all([
          repos.claimRepository.listSubmissions(
            request.organization_id,
            request.claim_id,
          ),
          repos.claimRepository.listStatusInquiries(
            request.organization_id,
            request.claim_id,
          ),
          repos.alertRepository.listOpenByClaimId(
            request.organization_id,
            request.claim_id,
          ),
          repos.workqueueRepository.listByClaimId(
            request.organization_id,
            request.claim_id,
          ),
          listTicketsByClaimSafe(repos, request.organization_id, request.claim_id),
          repos.clientRepository.getBillingSnapshot(
            request.organization_id,
            claim.client_id,
          ),
        ]);

      return {
        claim,
        encounter,
        client,
        insurance_policy,
        diagnoses,
        service_lines,
        submissions,
        status_inquiries,
        alerts,
        workqueue_items,
        support_tickets,
        billing_snapshot,
      };
    },

    async computeClaimReadiness(
      encounter_id: string,
      organization_id: string,
    ): Promise<ClaimReadinessResult> {
      const encounter = await repos.encounterRepository.getById(
        organization_id,
        encounter_id,
      );
      if (!encounter) {
        throw new Error("Encounter not found");
      }

      const [note, diagnoses, service_lines, insurance_policy, latest_eligibility, existing_claim] =
        await Promise.all([
          repos.encounterRepository.getNoteByEncounterId(organization_id, encounter_id),
          repos.encounterRepository.listDiagnoses(organization_id, encounter_id),
          repos.encounterRepository.listServiceLines(organization_id, encounter_id),
          repos.insuranceRepository.getPrimaryPolicyForEncounter(
            organization_id,
            encounter_id,
          ),
          repos.insuranceRepository.getLatestEligibilityForEncounter(
            organization_id,
            encounter_id,
          ),
          repos.claimRepository.getByEncounterId(organization_id, encounter_id),
        ]);

      const duplicate_detection_key = `${organization_id}:${encounter.client_id}:${encounter_id}:${encounter.service_date}`;

      return validateClaimCreation({
        encounter,
        note,
        diagnoses,
        service_lines,
        insurance_policy,
        latest_eligibility,
        active_authorization: null,
        existing_claim,
        duplicate_detection_key,
      });
    },

    async createClaim(request: CreateClaimRequest): Promise<CreateClaimResponse> {
      const readiness = await this.computeClaimReadiness(
        request.encounter_id,
        request.organization_id,
      );

      if (!readiness.is_ready) {
        return {
          claim_id: null,
          claim: null,
          readiness,
        };
      }
      const encounter = await repos.encounterRepository.getById(
        request.organization_id,
        request.encounter_id,
      );
      if (!encounter) {
        throw new Error("Encounter not found");
      }

      const [service_lines, insurance_policy] = await Promise.all([
        repos.encounterRepository.listServiceLines(
          request.organization_id,
          request.encounter_id,
        ),
        repos.insuranceRepository.getPrimaryPolicyForEncounter(
          request.organization_id,
          request.encounter_id,
        ),
      ]);

      if (!insurance_policy?.id) {
        throw new Error("Primary insurance policy is required for claim creation");
      }

      const totalChargeAmount = service_lines.reduce(
        (sum, line) => sum + Number(line.charge_amount || 0),
        0,
      );

      const now = new Date().toISOString();
      const claimSeed = `${encounter.id}`.replace(/-/g, "").slice(0, 10).toUpperCase();
      const claimNumber = `CLM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${claimSeed}`;
      const duplicateDetectionKey =
        readiness.duplicate_detection_key ||
        `${request.organization_id}:${encounter.client_id}:${encounter.id}:${encounter.service_date}`;

      const claimRecord: any = {
        organization_id: request.organization_id,
        encounter_id: encounter.id,
        client_id: encounter.client_id,
        insurance_policy_id: insurance_policy.id,
        claim_number: claimNumber,
        claim_status: "ready_to_submit",
        claim_frequency_code: "1",
        total_charge_amount: toMoneyString(totalChargeAmount),
        patient_responsibility_amount: "0.00",
        payer_responsibility_amount: toMoneyString(totalChargeAmount),
        date_of_service_from: encounter.service_date,
        date_of_service_to: encounter.service_date,
        ready_to_submit_at: now,
        submitted_at: null,
        accepted_at: null,
        denied_at: null,
        paid_at: null,
        last_blocker_codes: [],
        duplicate_detection_key: duplicateDetectionKey,
        created_by_user_id: request.requested_by_user_id,
        updated_by_user_id: request.requested_by_user_id,
      };

      const claimServiceLines: any[] = service_lines.map((line) => ({
        organization_id: request.organization_id,
        encounter_service_line_id: line.id,
        service_date: line.service_date,
        cpt_hcpcs_code: line.cpt_hcpcs_code,
        modifier_1: line.modifier_1 ?? null,
        modifier_2: line.modifier_2 ?? null,
        modifier_3: line.modifier_3 ?? null,
        modifier_4: line.modifier_4 ?? null,
        units: line.units,
        charge_amount: line.charge_amount,
        allowed_amount: null,
        paid_amount: null,
        sequence_number: line.sequence_number,
        created_by_user_id: request.requested_by_user_id,
        updated_by_user_id: request.requested_by_user_id,
      }));

      const created = await repos.claimRepository.createClaim(
        claimRecord,
        claimServiceLines,
      );

      return {
        claim_id: created.claim.id,
        claim: created.claim as any,
        readiness,
      };
    },

    async runClaimStatusInquiry(
      request: RunClaimStatusInquiryRequest,
    ): Promise<RunClaimStatusInquiryResponse> {
      const claim = await repos.claimRepository.getById(
        request.organization_id,
        request.claim_id,
      );
      if (!claim) {
        throw new Error("Claim not found");
      }

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
      return repos.workqueueRepository.findOpenBySource(
        organization_id,
        source_object_type,
        source_object_id,
      );
    },

    async routeToBiller(request: RouteToBillerRequest): Promise<RouteToBillerResponse> {
      const encounter =
        request.source_object_type === "encounter"
          ? await repos.encounterRepository.getById(
              request.organization_id,
              request.source_object_id,
            )
          : null;

      const claim =
        request.source_object_type === "claim"
          ? await repos.claimRepository.getById(
              request.organization_id,
              request.source_object_id,
            )
          : null;

      const existing = await repos.workqueueRepository.findOpenBySource(
        request.organization_id,
        request.source_object_type,
        request.source_object_id,
      );

      const readiness = validateRouteToBiller({
        request,
        encounter,
        claim,
        existing_open_workqueue_item: existing,
      });

      if (!readiness.is_ready && !existing) {
        throw new Error(
          `Route to biller blocked: ${readiness.blockers
            .map((b) => b.rule_code)
            .join(", ")}`,
        );
      }

      if (existing) {
        return {
          workqueue_item: existing,
          blockers: readiness.blockers,
          warnings: readiness.warnings,
        };
      }

      const now = new Date().toISOString();
      const defaultContextPayload = {
        route_to_biller: true,
        source_route:
          request.source_object_type === "encounter"
            ? `/scheduling?encounterId=${request.source_object_id}`
            : `/claims/${request.source_object_id}`,
        source_label:
          request.source_object_type === "encounter" ? "Encounter / Schedule" : "Claim Detail",
        patient_chart_link:
          encounter?.id != null ? `/encounters/${encounter.id}` : null,
        client_id: encounter?.client_id ?? claim?.client_id ?? null,
        encounter_id: encounter?.id ?? claim?.encounter_id ?? null,
        claim_id: claim?.id ?? null,
      };

      const newItem: WorkqueueItemRecord = {
        id: crypto.randomUUID(),
        organization_id: request.organization_id,
        work_type: "route_to_biller",
        status: "open",
        priority: request.priority ?? "normal",
        source_object_type: request.source_object_type,
        source_object_id: request.source_object_id,
        client_id: encounter?.client_id ?? claim?.client_id ?? null,
        encounter_id: encounter?.id ?? claim?.encounter_id ?? null,
        claim_id: claim?.id ?? null,
        assigned_to_user_id: request.assigned_to_user_id ?? null,
        due_at: null,
        resolved_at: null,
        closed_at: null,
        title: request.title ?? `Billing review: ${request.source_object_type} ${request.source_object_id}`,
        description: request.description ?? null,
        context_payload: {
          ...defaultContextPayload,
          ...(request.context_payload ?? {}),
        },
        created_at: now,
        updated_at: now,
        created_by_user_id: request.requested_by_user_id,
        updated_by_user_id: request.requested_by_user_id,
        archived_at: null,
      };

      const created = await repos.workqueueRepository.create(newItem);

      const supportTicket = await createSupportTicketSafe(repos, {
        id: crypto.randomUUID(),
        organization_id: request.organization_id,
        workqueue_item_id: created.id,
        source_object_type: request.source_object_type,
        source_object_id: request.source_object_id,
        requestor_user_id: request.requested_by_user_id,
        assigned_to_user_id: request.assigned_to_user_id ?? null,
        status: "open",
        category: "Billing Review",
        priority: request.priority ?? "normal",
        title: created.title,
        description: created.description,
        due_at: null,
        resolved_at: null,
        closed_at: null,
        created_at: now,
        updated_at: now,
        created_by_user_id: request.requested_by_user_id,
        updated_by_user_id: request.requested_by_user_id,
        archived_at: null,
      });

      let finalItem = created;
      if (supportTicket) {
        finalItem = await repos.workqueueRepository.update({
          ...created,
          context_payload: {
            ...(created.context_payload ?? {}),
            support_ticket_id: supportTicket.id,
          },
          updated_at: new Date().toISOString(),
          updated_by_user_id: request.requested_by_user_id,
        });
      }

      return {
        workqueue_item: finalItem,
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      };
    },

    async updateWorkqueueItem(
      _request: UpdateWorkqueueItemRequest,
    ): Promise<UpdateWorkqueueItemResponse> {
      throw new Error("Not implemented");
    },
  };
}

export function createBillingService(repos: RepositoryBundle): BillingService {
  return {
    async postPayment(request: PostPaymentRequest): Promise<PostPaymentResponse> {
      const existing = await repos.paymentRepository.findPostingByReference(
        request.organization_id,
        request.posting_reference,
      );

      const readiness = validatePaymentPosting({
        request,
        existing_posting: existing,
      });

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

    async getBillingSnapshot(
      organization_id: string,
      client_id: string,
    ): Promise<BillingSnapshot> {
      return repos.clientRepository.getBillingSnapshot(organization_id, client_id);
    },

    async getUnpostedPayments(organization_id: string) {
      return repos.paymentRepository.listUnpostedPayments(organization_id);
    },

    async getReadyToSubmitClaims(organization_id: string) {
      return repos.claimRepository.listReadyToSubmit(organization_id);
    },

    async getSubmissionBatches(organization_id: string) {
      return repos.claimRepository.listSubmissionBatches(organization_id);
    },
  };
}
