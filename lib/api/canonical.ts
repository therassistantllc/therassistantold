import { Claim, ClaimAlert, ClaimHistoryEvent, ClaimNote, ClaimStatus, ServiceLine } from "@/lib/types/claim";
import { EncounterWorkspace } from "@/lib/types/encounter";

const API_BASE = process.env.NEXT_PUBLIC_CANONICAL_API_BASE || "http://localhost:4000";
const DEFAULT_ORGANIZATION_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID || "org-demo";
const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "system-user";

function getLocalStorageValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  const directKeys = ["access_token", "sb-access-token", "supabase_access_token"];
  for (const key of directKeys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }

  for (const key of Object.keys(window.localStorage)) {
    if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "{}") as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    } catch {
      // Ignore malformed auth cache entry.
    }
  }

  return null;
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

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapClaimStatus(value: string | undefined): ClaimStatus {
  if (!value) return "draft";
  if (value === "voided") return "void";
  return value as ClaimStatus;
}

function mapEncounterStatus(value: string | undefined): EncounterWorkspace["status"] {
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

export async function fetchEncounterWorkspaceFromApi(encounterId: string): Promise<EncounterWorkspace | null> {
  const organizationId = getOrganizationId();
  const payload = await apiRequest<any>(
    `/api/encounters/${encodeURIComponent(encounterId)}/workspace?organization_id=${encodeURIComponent(organizationId)}`,
  );

  if (!payload?.encounter) {
    return null;
  }

  const claimReadiness = payload.readiness?.claim_creation;
  const blockers = (claimReadiness?.blockers || []).map((entry: any) => entry.message || entry.rule_code);
  const warnings = (claimReadiness?.warnings || []).map((entry: any) => entry.message || entry.rule_code);

  const encounter = payload.encounter;
  const client = payload.client;
  const policy = payload.insurance_policy;
  const latestEligibility = payload.latest_eligibility;
  const note = payload.note;
  const billingSnapshot = payload.billing_snapshot || {};

  return {
    encounterId: String(encounter.id),
    appointmentId: String(encounter.appointment_id || payload.appointment?.id || ""),
    appointmentDate: String(encounter.date_of_service || "").slice(0, 10),
    appointmentTime: payload.appointment?.scheduled_start_at
      ? new Date(payload.appointment.scheduled_start_at).toISOString().slice(11, 16)
      : "09:00",
    status: mapEncounterStatus(encounter.encounter_status),
    clientId: String(client.id),
    clientFullName: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
    clientDob: String(client.date_of_birth || ""),
    providerId: String(encounter.rendering_provider_id || ""),
    providerName: String(encounter.rendering_provider_id || "Assigned Provider"),
    appointmentType: payload.appointment?.appointment_type || null,
    payerName: String(policy?.payer_name || "Unknown Payer"),
    payerId: policy?.payer_id || undefined,
    memberId: policy?.member_id || undefined,
    eligibility: {
      checkedAt: latestEligibility?.checked_at || undefined,
      isActive:
        latestEligibility?.eligibility_status === "active"
          ? true
          : latestEligibility?.eligibility_status === "inactive"
            ? false
            : undefined,
    },
    billing: {
      clientBalance: toNumber(billingSnapshot.client_balance),
      insuranceBalance: toNumber(billingSnapshot.payer_balance),
      lastPaymentDate: billingSnapshot.last_payment_posted_at || undefined,
      alerts: (payload.open_alerts || []).map((alert: any) => ({
        id: String(alert.id),
        severity: alert.severity === "blocker" ? "error" : "warning",
        category: "coding",
        message: String(alert.message || alert.title || "Billing alert"),
        createdAt: String(alert.created_at || new Date().toISOString()),
      })),
    },
    note: note
      ? {
          id: String(note.id),
          noteType: (note.note_type || "progress_note") as "progress_note",
          status: note.note_status || encounter.note_status,
          lastModified: note.updated_at || undefined,
          signedAt: note.signed_at || undefined,
          signedBy: note.signed_by_provider_id || undefined,
          requiredFieldsComplete: Boolean(encounter.required_billing_fields_complete),
          diagnosesCount: Array.isArray(payload.diagnoses) ? payload.diagnoses.length : 0,
          hasServiceCodes: Array.isArray(payload.service_lines) ? payload.service_lines.length > 0 : false,
        }
      : null,
    coding: {
      status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
      diagnoses: (payload.diagnoses || []).map((dx: any) => ({
        id: String(dx.id),
        code: String(dx.diagnosis_code || ""),
        description: String(dx.diagnosis_description || ""),
        isPrimary: Boolean(dx.is_primary),
      })),
      serviceCodes: (payload.service_lines || []).map((line: any) => ({
        code: String(line.cpt_hcpcs_code || ""),
        description: String(line.cpt_hcpcs_code || "Service"),
        units: toNumber(line.units, 1),
        modifiers: [line.modifier_1, line.modifier_2, line.modifier_3, line.modifier_4].filter(Boolean),
        isSuggested: true,
      })),
      renderingProvider: {
        id: String(encounter.rendering_provider_id || ""),
        name: String(encounter.rendering_provider_id || "Assigned Provider"),
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
          id: String(payload.claim.id),
          claimNumber: String(payload.claim.claim_number || payload.claim.id),
          status: mapClaimStatus(payload.claim.claim_status),
          createdAt: String(payload.claim.created_at || new Date().toISOString()),
          submittedAt: payload.claim.submitted_at || undefined,
          billedAmount: toNumber(payload.claim.total_charge_amount),
        }
      : null,
  };
}

export async function createClaimViaApi(encounterId: string): Promise<{ claimId?: string; blockers?: string[] }> {
  const body = {
    organization_id: getOrganizationId(),
    encounter_id: encounterId,
    requested_by_user_id: getRequestedByUserId(),
    force_rebuild_service_lines: false,
  };

  const response = await apiRequest<any>("/api/claims", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const blockers = (response?.readiness?.blockers || []).map((entry: any) => entry.message || entry.rule_code);
  return {
    claimId: response?.claim_id || undefined,
    blockers: blockers.length > 0 ? blockers : undefined,
  };
}

export async function routeToBillerViaApi(args: {
  sourceObjectType: "encounter" | "claim";
  sourceObjectId: string;
  title?: string;
  description?: string;
}): Promise<{ workqueueItemId?: string }> {
  const body = {
    organization_id: getOrganizationId(),
    source_object_type: args.sourceObjectType,
    source_object_id: args.sourceObjectId,
    requested_by_user_id: getRequestedByUserId(),
    priority: "normal",
    title: args.title || "Route to biller",
    description: args.description || null,
  };

  const response = await apiRequest<any>("/api/workqueue/route-to-biller", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    workqueueItemId: response?.workqueue_item?.id || undefined,
  };
}

export async function fetchClaimDetailFromApi(claimId: string): Promise<Claim> {
  const organizationId = getOrganizationId();
  const payload = await apiRequest<any>(
    `/api/claims/${encodeURIComponent(claimId)}?organization_id=${encodeURIComponent(organizationId)}`,
  );

  const claimRecord = payload.claim || {};
  const client = payload.client || {};
  const encounter = payload.encounter || {};
  const policy = payload.insurance_policy || {};
  const serviceLines = (payload.service_lines || []) as any[];
  const alerts = (payload.alerts || []) as any[];
  const submissions = (payload.submissions || []) as any[];
  const inquiries = (payload.status_inquiries || []) as any[];
  const tickets = (payload.support_tickets || []) as any[];

  const mappedServiceLines: ServiceLine[] = serviceLines.map((line, index) => ({
    id: String(line.id),
    dos_from: String(line.service_date || claimRecord.date_of_service_from || ""),
    dos_to: String(line.service_date || claimRecord.date_of_service_to || ""),
    place_of_service: "11",
    cpt_code: String(line.cpt_hcpcs_code || ""),
    modifier_1: line.modifier_1 || undefined,
    modifier_2: line.modifier_2 || undefined,
    modifier_3: line.modifier_3 || undefined,
    modifier_4: line.modifier_4 || undefined,
    diagnosis_pointers: Array.isArray(line.diagnosis_pointers) ? line.diagnosis_pointers : ["A"],
    units: toNumber(line.units, 1),
    charge_amount: toNumber(line.charge_amount),
    allowed_amount: line.allowed_amount ? toNumber(line.allowed_amount) : undefined,
    paid_amount: line.paid_amount ? toNumber(line.paid_amount) : undefined,
    claim_line_status: line.claim_line_status || undefined,
    claim_line_balance: line.claim_line_balance ? toNumber(line.claim_line_balance) : undefined,
  }));

  const mappedAlerts: ClaimAlert[] = alerts.map((alert) => ({
    id: String(alert.id),
    type: "era_not_posted",
    severity: alert.severity === "blocker" ? "error" : "warning",
    message: String(alert.message || alert.title || "Claim alert"),
  }));

  const notes: ClaimNote[] = tickets.map((ticket: any) => ({
    id: String(ticket.id),
    user_id: String(ticket.assigned_to_user_id || "system"),
    user_name: String(ticket.assigned_to_user_id || "System"),
    timestamp: String(ticket.created_at || new Date().toISOString()),
    note: String(ticket.description || ticket.title || "Ticket created"),
    note_type: "ticket",
  }));

  const history: ClaimHistoryEvent[] = [
    ...submissions.map((submission: any) => ({
      id: String(submission.id),
      timestamp: String(submission.created_at || new Date().toISOString()),
      event_type: String(submission.submission_status || "submitted"),
      description: `Submission ${submission.submission_status || "created"}`,
      user_id: submission.created_by_user_id || undefined,
      user_name: submission.created_by_user_id || undefined,
      details: submission.response_summary || undefined,
    })),
    ...inquiries.map((inquiry: any) => ({
      id: String(inquiry.id),
      timestamp: String(inquiry.created_at || new Date().toISOString()),
      event_type: "status_inquiry",
      description: `Status inquiry ${inquiry.inquiry_status || "queued"}`,
      user_id: inquiry.created_by_user_id || undefined,
      user_name: inquiry.created_by_user_id || undefined,
      details: inquiry.response_summary || undefined,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    id: String(claimRecord.id || claimId),
    claim_number: String(claimRecord.claim_number || claimId),
    original_claim_number: undefined,
    frequency_type: (claimRecord.claim_frequency_code || "1") as "1" | "7" | "8",
    status: mapClaimStatus(claimRecord.claim_status),
    source: "ehr",
    priority: "routine",
    submission_date: claimRecord.submitted_at ? String(claimRecord.submitted_at).slice(0, 10) : undefined,
    dos_from: String(claimRecord.date_of_service_from || ""),
    dos_to: String(claimRecord.date_of_service_to || ""),
    created_at: String(claimRecord.created_at || new Date().toISOString()),
    updated_at: String(claimRecord.updated_at || new Date().toISOString()),
    last_activity: String(claimRecord.updated_at || new Date().toISOString()),
    patient: {
      id: String(client.id || ""),
      first_name: String(client.first_name || ""),
      last_name: String(client.last_name || ""),
      dob: String(client.date_of_birth || ""),
      sex: "U",
      address: {
        street: String(client.address_line_1 || ""),
        city: String(client.city || ""),
        state: String(client.state || ""),
        zip: String(client.postal_code || ""),
      },
      phone: client.phone || undefined,
      email: client.email || undefined,
      relationship_to_subscriber: "self",
    },
    primary_insurance: {
      id: String(policy.id || ""),
      payer_name: String(policy.payer_name || "Unknown Payer"),
      payer_id: String(policy.payer_id || ""),
      member_id: String(policy.member_id || ""),
      group_number: policy.group_number || undefined,
      plan_type: policy.plan_name || undefined,
      effective_date: policy.effective_date || undefined,
      termination_date: policy.termination_date || undefined,
      eligibility_status: "unknown",
    },
    billing_provider: {
      id: organizationId,
      npi: "0000000000",
      name: "Billing Provider",
      taxonomy_code: undefined,
      ein: undefined,
    },
    rendering_provider: {
      id: String(encounter.rendering_provider_id || ""),
      npi: "0000000000",
      name: String(encounter.rendering_provider_id || "Rendering Provider"),
    },
    diagnosis_codes: [],
    service_lines: mappedServiceLines,
    total_charges: toNumber(claimRecord.total_charge_amount),
    total_allowed_amount: claimRecord.total_allowed_amount ? toNumber(claimRecord.total_allowed_amount) : undefined,
    total_insurance_paid: claimRecord.total_insurance_paid_amount ? toNumber(claimRecord.total_insurance_paid_amount) : undefined,
    total_patient_paid: claimRecord.total_patient_paid_amount ? toNumber(claimRecord.total_patient_paid_amount) : undefined,
    remaining_insurance_balance: claimRecord.remaining_insurance_balance ? toNumber(claimRecord.remaining_insurance_balance) : undefined,
    remaining_patient_balance: claimRecord.remaining_patient_balance ? toNumber(claimRecord.remaining_patient_balance) : undefined,
    write_off_amount: claimRecord.write_off_amount ? toNumber(claimRecord.write_off_amount) : undefined,
    adjustment_amount: claimRecord.adjustment_amount ? toNumber(claimRecord.adjustment_amount) : undefined,
    payment_source: undefined,
    linked_era_number: undefined,
    assigned_biller_name: undefined,
    aging_bucket: claimRecord.aging_bucket || undefined,
    open_tickets: tickets.length,
    notes,
    history,
    alerts: mappedAlerts,
  };
}
