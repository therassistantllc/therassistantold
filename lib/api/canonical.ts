// File: lib/api/canonical.ts
import type {
  Claim,
  ClaimAlert,
  ClaimHistoryEvent,
  ClaimNote,
  ClaimStatus,
  ServiceLine,
} from "@/lib/types/claim";
import type { EncounterWorkspace } from "@/lib/types/encounter";
import type {
  GetScheduleDayResponse,
  ResolveEncounterForAppointmentResponse,
} from "@/shared/contracts";

const API_BASE =
  process.env.NEXT_PUBLIC_CANONICAL_API_BASE || "http://localhost:4000";

const DEFAULT_ORGANIZATION_ID =
  process.env.NEXT_PUBLIC_ORGANIZATION_ID || "org-demo";

const DEFAULT_USER_ID =
  process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "00000000-0000-0000-0000-000000000001";

type ApiHeaders = Record<string, string>;

type ApiClaimReadinessEntry = {
  message?: string;
  rule_code?: string;
};

type ApiEncounterResponse = {
  encounter?: {
    id?: string;
    appointment_id?: string;
    date_of_service?: string;
    encounter_status?: string;
    note_status?: string;
    rendering_provider_id?: string;
    required_billing_fields_complete?: boolean;
  };
  appointment?: {
    id?: string;
    scheduled_start_at?: string;
    appointment_type?: string | null;
  };
  client?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    sex?: string;
    email?: string;
    phone_home?: string;
    phone_mobile?: string;
    address_line_1?: string;
    address_city?: string;
    address_state?: string;
    address_postal_code?: string;
  };
  insurance_policy?: {
    id?: string;
    payer_name?: string;
    payer_id?: string;
    member_id?: string;
    policy_number?: string;
    group_number?: string;
  };
  latest_eligibility?: {
    checked_at?: string;
    eligibility_status?: string;
  };
  note?: {
    id?: string;
    note_type?: string;
    note_status?: string;
    updated_at?: string;
    signed_at?: string;
    signed_by_provider_id?: string;
  };
  diagnoses?: Array<{
    id?: string;
    diagnosis_code?: string;
    diagnosis_description?: string;
    is_primary?: boolean;
  }>;
  service_lines?: Array<{
    id?: string;
    service_date?: string;
    cpt_hcpcs_code?: string;
    modifier_1?: string;
    modifier_2?: string;
    modifier_3?: string;
    modifier_4?: string;
    diagnosis_pointers?: string[];
    units?: number | string;
    charge_amount?: number | string;
    allowed_amount?: number | string;
    paid_amount?: number | string;
    claim_line_status?: string;
    claim_line_balance?: number | string;
  }>;
  billing_snapshot?: {
    patient_balance?: number | string;
    insurance_balance?: number | string;
    total_balance?: number | string;
    unposted_amount?: number | string;
  };
  alerts?: Array<{ id?: string; severity?: string; title?: string; message?: string }>;
  claim?: {
    id?: string;
    claim_number?: string;
    claim_status?: string;
    created_at?: string;
    submitted_at?: string;
    total_charge_amount?: number | string;
    total_allowed_amount?: number | string;
    total_paid_amount?: number | string;
    patient_responsibility_amount?: number | string;
    claim_balance?: number | string;
    organization_id?: string;
    client_id?: string;
    date_of_service_from?: string;
    date_of_service_to?: string;
    rendering_provider_id?: string;
    billing_provider_id?: string;
  };
  readiness?: {
    claim_creation?: {
      blockers?: ApiClaimReadinessEntry[];
      warnings?: ApiClaimReadinessEntry[];
    };
  };
  submissions?: Array<{
    id?: string;
    created_at?: string;
    processing_status?: string;
  }>;
  status_inquiries?: Array<{
    id?: string;
    created_at?: string;
    processing_status?: string;
  }>;
  support_tickets?: Array<{
    id?: string;
    assigned_to_user_id?: string;
    created_at?: string;
    description?: string;
    title?: string;
  }>;
};

function getLocalStorageValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  const supabaseAuthKey = Object.keys(window.localStorage).find(
    (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
  );

  if (!supabaseAuthKey) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(supabaseAuthKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { access_token?: string };
    return parsed.access_token || null;
  } catch {
    return null;
  }
}

export function getOrganizationId(): string {
  return (
    getLocalStorageValue("organization_id") ||
    getLocalStorageValue("org_id") ||
    DEFAULT_ORGANIZATION_ID
  );
}

export function getRequestedByUserId(): string {
  return (
    getLocalStorageValue("requested_by_user_id") ||
    getLocalStorageValue("user_id") ||
    getLocalStorageValue("auth_user_id") ||
    DEFAULT_USER_ID
  );
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return `Request failed: ${response.status} ${response.statusText}`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error || parsed.message || text;
  } catch {
    return text;
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  const headers: ApiHeaders = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as ApiHeaders | undefined) || {}),
  };

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Cannot reach canonical API at ${API_BASE}. ${message}`);
  }

  if (!response.ok) {
    throw new Error(await readErrorBody(response));
  }

  return (await response.json()) as T;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapEncounterStatus(value?: string): EncounterWorkspace["status"] {
  switch (value) {
    case "open":
      return "in_progress";
    case "voided":
      return "cancelled";
    case "completed":
    case "ready_to_bill":
    case "billed":
      return value;
    default:
      return "scheduled";
  }
}

function mapClaimStatus(value?: string): ClaimStatus {
  if (!value) return "draft";
  if (value === "voided") return "void";
  return value as ClaimStatus;
}

function mapReadinessMessages(entries: ApiClaimReadinessEntry[] | undefined): string[] {
  return (entries || []).map((entry) => entry.message || entry.rule_code || "Unknown issue");
}

export async function fetchEncounterWorkspaceFromApi(
  encounterId: string,
): Promise<EncounterWorkspace | null> {
  const organizationId = getOrganizationId();

  const payload = await apiRequest<ApiEncounterResponse>(
    `/api/encounters/${encodeURIComponent(encounterId)}/workspace?organization_id=${encodeURIComponent(
      organizationId,
    )}`,
  );

  if (!payload.encounter || !payload.client) {
    return null;
  }

  const blockers = mapReadinessMessages(payload.readiness?.claim_creation?.blockers);
  const warnings = mapReadinessMessages(payload.readiness?.claim_creation?.warnings);

  const eligibilityCheckedAt = payload.latest_eligibility?.checked_at;
  const eligibilityIsStale = eligibilityCheckedAt
    ? Date.now() - new Date(eligibilityCheckedAt).getTime() > 30 * 24 * 60 * 60 * 1000
    : true;

  return {
    encounterId: String(payload.encounter.id || encounterId),
    appointmentId: String(payload.encounter.appointment_id || payload.appointment?.id || ""),
    appointmentDate: String(payload.encounter.date_of_service || "").slice(0, 10),
    appointmentTime: payload.appointment?.scheduled_start_at
      ? new Date(payload.appointment.scheduled_start_at).toISOString().slice(11, 16)
      : "09:00",
    status: mapEncounterStatus(payload.encounter.encounter_status),
    clientId: String(payload.client.id || ""),
    clientFullName: `${payload.client.first_name || ""} ${payload.client.last_name || ""}`.trim(),
    clientDob: String(payload.client.date_of_birth || ""),
    providerId: String(payload.encounter.rendering_provider_id || ""),
    providerName: String(payload.encounter.rendering_provider_id || "Assigned Provider"),
    appointmentType: payload.appointment?.appointment_type || null,
    payerName: String(payload.insurance_policy?.payer_name || "Unknown Payer"),
    payerId: payload.insurance_policy?.payer_id,
    memberId: payload.insurance_policy?.member_id,
    eligibility: {
      checkedAt: eligibilityCheckedAt,
      isActive: payload.latest_eligibility?.eligibility_status === "active",
      status: payload.latest_eligibility?.eligibility_status || "unknown",
      stale: eligibilityIsStale,
    },
    billing: {
      patientBalance: toNumber(payload.billing_snapshot?.patient_balance),
      insuranceBalance: toNumber(payload.billing_snapshot?.insurance_balance),
      totalBalance: toNumber(payload.billing_snapshot?.total_balance),
      unpostedAmount: toNumber(payload.billing_snapshot?.unposted_amount),
      billingAlertCount: Array.isArray(payload.alerts) ? payload.alerts.length : 0,
    },
    note: payload.note
      ? {
          id: String(payload.note.id || ""),
          noteType: (payload.note.note_type || "progress_note") as "progress_note",
          status: payload.note.note_status || payload.encounter.note_status || "not_started",
          lastModified: payload.note.updated_at,
          signedAt: payload.note.signed_at,
          signedBy: payload.note.signed_by_provider_id,
          requiredFieldsComplete: Boolean(payload.encounter.required_billing_fields_complete),
          diagnosesCount: Array.isArray(payload.diagnoses) ? payload.diagnoses.length : 0,
          hasServiceCodes: Array.isArray(payload.service_lines) ? payload.service_lines.length > 0 : false,
        }
      : null,
    coding: {
      status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
      diagnoses: (payload.diagnoses || []).map((dx) => ({
        id: String(dx.id || ""),
        code: String(dx.diagnosis_code || ""),
        description: String(dx.diagnosis_description || ""),
        isPrimary: Boolean(dx.is_primary),
      })),
      serviceCodes: (payload.service_lines || []).map((line) => ({
        code: String(line.cpt_hcpcs_code || ""),
        description: String(line.cpt_hcpcs_code || "Service"),
        units: toNumber(line.units, 1),
        modifiers: [line.modifier_1, line.modifier_2, line.modifier_3, line.modifier_4].filter(
          Boolean,
        ) as string[],
        isSuggested: true,
      })),
      renderingProvider: {
        id: String(payload.encounter.rendering_provider_id || ""),
        name: String(payload.encounter.rendering_provider_id || "Assigned Provider"),
        npi: "0000000000",
      },
      billingProvider: {
        id: organizationId,
        name: "Billing Provider",
        npi: "0000000000",
        taxId: "",
      },
      blockers,
      warnings,
    },
    claim: payload.claim
      ? {
          id: String(payload.claim.id || ""),
          claimNumber: String(payload.claim.claim_number || payload.claim.id || ""),
          status: mapClaimStatus(payload.claim.claim_status),
          createdAt: String(payload.claim.created_at || new Date().toISOString()),
          submittedAt: payload.claim.submitted_at,
          billedAmount: toNumber(payload.claim.total_charge_amount),
        }
      : null,
  };
}

export async function createClaimViaApi(
  encounterId: string,
): Promise<{ claimId?: string; blockers?: string[] }> {
  const response = await apiRequest<{
    claim_id?: string;
    readiness?: { blockers?: ApiClaimReadinessEntry[] };
  }>("/api/claims", {
    method: "POST",
    body: JSON.stringify({
      organization_id: getOrganizationId(),
      encounter_id: encounterId,
      requested_by_user_id: getRequestedByUserId(),
      force_rebuild_service_lines: false,
    }),
  });

  const blockers = mapReadinessMessages(response.readiness?.blockers);

  return {
    claimId: response.claim_id,
    blockers: blockers.length > 0 ? blockers : undefined,
  };
}

export async function routeToBillerViaApi(args: {
  sourceObjectType: "encounter" | "claim";
  sourceObjectId: string;
  title?: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  assignedToUserId?: string | null;
  contextPayload?: Record<string, unknown>;
}): Promise<{ workqueueItemId?: string }> {
  const response = await apiRequest<{ workqueue_item?: { id?: string } }>(
    "/api/workqueue/route-to-biller",
    {
      method: "POST",
      body: JSON.stringify({
        organization_id: getOrganizationId(),
        source_object_type: args.sourceObjectType,
        source_object_id: args.sourceObjectId,
        requested_by_user_id: getRequestedByUserId(),
        priority: args.priority || "normal",
        title: args.title || "Route to biller",
        description: args.description || null,
        assigned_to_user_id: args.assignedToUserId ?? null,
        context_payload: args.contextPayload ?? {},
      }),
    },
  );

  return {
    workqueueItemId: response.workqueue_item?.id,
  };
}

export async function fetchClaimDetailFromApi(claimId: string): Promise<Claim> {
  const organizationId = getOrganizationId();

  const payload = await apiRequest<ApiEncounterResponse>(
    `/api/claims/${encodeURIComponent(claimId)}?organization_id=${encodeURIComponent(
      organizationId,
    )}`,
  );

  const claimRecord = payload.claim || {};
  const client = payload.client || {};
  const encounter = payload.encounter || {};

  const serviceLines: ServiceLine[] = (payload.service_lines || []).map((line) => ({
    id: String(line.id || ""),
    dos_from: String(line.service_date || claimRecord.date_of_service_from || ""),
    dos_to: String(line.service_date || claimRecord.date_of_service_to || ""),
    place_of_service: "11",
    cpt_code: String(line.cpt_hcpcs_code || ""),
    modifier_1: line.modifier_1,
    modifier_2: line.modifier_2,
    modifier_3: line.modifier_3,
    modifier_4: line.modifier_4,
    diagnosis_pointers: Array.isArray(line.diagnosis_pointers) ? line.diagnosis_pointers : ["A"],
    units: toNumber(line.units, 1),
    charge_amount: toNumber(line.charge_amount),
    allowed_amount: line.allowed_amount == null ? undefined : toNumber(line.allowed_amount),
    paid_amount: line.paid_amount == null ? undefined : toNumber(line.paid_amount),
    claim_line_status: line.claim_line_status,
    claim_line_balance:
      line.claim_line_balance == null ? undefined : toNumber(line.claim_line_balance),
  }));

  const alerts: ClaimAlert[] = (payload.alerts || []).map((alert) => ({
    id: String(alert.id || ""),
    type: "era_not_posted",
    severity: alert.severity === "blocker" ? "error" : "warning",
    message: String(alert.message || alert.title || "Claim alert"),
  }));

  const notes: ClaimNote[] = (payload.support_tickets || []).map((ticket) => ({
    id: String(ticket.id || ""),
    user_id: String(ticket.assigned_to_user_id || "system"),
    user_name: String(ticket.assigned_to_user_id || "System"),
    timestamp: String(ticket.created_at || new Date().toISOString()),
    note: String(ticket.description || ticket.title || "Ticket created"),
    note_type: "ticket",
  }));

  const history: ClaimHistoryEvent[] = [
    ...(payload.submissions || []).map((submission) => ({
      id: String(submission.id || ""),
      type: "submission" as const,
      timestamp: String(submission.created_at || new Date().toISOString()),
      status: String(submission.processing_status || "submitted"),
      description: `Claim submission ${submission.processing_status || "submitted"}`,
    })),
    ...(payload.status_inquiries || []).map((inquiry) => ({
      id: String(inquiry.id || ""),
      type: "status" as const,
      timestamp: String(inquiry.created_at || new Date().toISOString()),
      status: String(inquiry.processing_status || "checked"),
      description: `Claim status inquiry ${inquiry.processing_status || "checked"}`,
    })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    id: String(claimRecord.id || claimId),
    claim_number: String(claimRecord.claim_number || claimRecord.id || claimId),
    frequency_type: "original" as const,
    source: "manual" as const,
    priority: "normal" as const,
    status: mapClaimStatus(claimRecord.claim_status),
    organization_id: String(claimRecord.organization_id || organizationId),
    client_id: String(client.id || claimRecord.client_id || ""),
    client_name: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
    member_id: String(payload.insurance_policy?.member_id || ""),
    payer_name: String(payload.insurance_policy?.payer_name || ""),
    payer_id: String(payload.insurance_policy?.payer_id || ""),
    date_of_service_from: String(
      claimRecord.date_of_service_from || encounter.date_of_service || "",
    ),
    date_of_service_to: String(
      claimRecord.date_of_service_to || encounter.date_of_service || "",
    ),
    dos_from: String(
      claimRecord.date_of_service_from || encounter.date_of_service || "",
    ),
    dos_to: String(
      claimRecord.date_of_service_to || encounter.date_of_service || "",
    ),
    submission_date: String(claimRecord.submitted_at || ""),
    created_at: String(claimRecord.created_at || new Date().toISOString()),
    updated_at: String(claimRecord.updated_at || new Date().toISOString()),
    total_charge_amount: toNumber(claimRecord.total_charge_amount),
    total_charges: toNumber(claimRecord.total_charge_amount),
    total_allowed_amount: toNumber(claimRecord.total_allowed_amount),
    total_paid_amount: toNumber(claimRecord.total_paid_amount),
    remaining_insurance_balance: toNumber(claimRecord.claim_balance),
    remaining_patient_balance: 0,
    patient_responsibility_amount: toNumber(claimRecord.patient_responsibility_amount),
    claim_balance: toNumber(claimRecord.claim_balance),
    rendering_provider_id: String(claimRecord.rendering_provider_id || ""),
    billing_provider_id: String(claimRecord.billing_provider_id || ""),
    diagnosis_codes: (payload.diagnoses || []).map((dx, index) => ({
      id: String(dx.id || `dx-${index}`),
      priority: index + 1,
      code: String(dx.diagnosis_code || ""),
      description: String(dx.diagnosis_description || ""),
      active: true,
      present_on_claim: true,
    })),
    service_lines: serviceLines,
    alerts,
    notes,
    history,
    // Nested objects required by ClaimHeader and other components
    patient: {
      id: String(client.id || ""),
      first_name: String(client.first_name || ""),
      last_name: String(client.last_name || ""),
      date_of_birth: String(client.date_of_birth || ""),
      dob: String(client.date_of_birth || ""),
      sex: (String(client.sex || "U") as "M" | "F" | "U"),
      member_id: String(payload.insurance_policy?.member_id || ""),
      phone: String(client.phone_home || client.phone_mobile || ""),
      email: String(client.email || ""),
      relationship_to_subscriber: "self" as const,
      address: {
        street: String(client.address_line_1 || ""),
        city: String(client.address_city || ""),
        state: String(client.address_state || ""),
        zip: String(client.address_postal_code || ""),
      },
    },
    primary_insurance: {
      id: String(payload.insurance_policy?.id || ""),
      payer_id: String(payload.insurance_policy?.payer_id || ""),
      payer_name: String(payload.insurance_policy?.payer_name || ""),
      policy_number: String(payload.insurance_policy?.policy_number || ""),
      group_number: String(payload.insurance_policy?.group_number || ""),
      member_id: String(payload.insurance_policy?.member_id || ""),
    },
    billing_provider: {
      id: String(claimRecord.billing_provider_id || ""),
      name: String(encounter.provider_name || "Provider"),
      npi: "",
      taxonomy_code: "",
    },
  } as Claim;
}

export async function fetchScheduleDayFromApi(args: {
  date: string;
  providerId?: string;
}): Promise<GetScheduleDayResponse> {
  const params = new URLSearchParams({
    organization_id: getOrganizationId(),
    date: args.date,
  });

  if (args.providerId && args.providerId !== "all") {
    params.set("provider_id", args.providerId);
  }

  return apiRequest<GetScheduleDayResponse>(`/api/schedule?${params.toString()}`);
}

export async function resolveEncounterForAppointmentViaApi(
  appointmentId: string,
): Promise<ResolveEncounterForAppointmentResponse> {
  return apiRequest<ResolveEncounterForAppointmentResponse>(
    `/api/appointments/${encodeURIComponent(appointmentId)}/resolve-encounter`,
    {
      method: "POST",
      body: JSON.stringify({
        organization_id: getOrganizationId(),
        requested_by_user_id: getRequestedByUserId(),
      }),
    },
  );
}
