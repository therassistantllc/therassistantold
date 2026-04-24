import type { ClaimStatus } from "@/lib/types/claim";
import type {
  AppointmentCreateInput,
  BillerTicket,
  DailyScheduleQuery,
  DailyScheduleResult,
  ScheduleAppointment,
  ScheduleDataSource,
  ScheduleProvider,
} from "@/lib/types/schedule";
import {
  fetchScheduleDayFromApi,
  resolveEncounterForAppointmentViaApi,
} from "@/lib/api/canonical";
import type { NoteStatus } from "@/shared/contracts";

function toTime(isoDateTime: string): string {
  return new Date(isoDateTime).toISOString().slice(11, 16);
}

function mapNoteStatus(value: NoteStatus | null | undefined): "not_started" | "in_progress" | "signed" {
  if (value === "signed") return "signed";
  if (value === "in_progress" || value === "amended") return "in_progress";
  return "not_started";
}

function mapClaimStatus(value: string | null | undefined): ClaimStatus {
  if (!value) return "draft";
  if (value === "voided") return "void";
  return value as ClaimStatus;
}

function mapAppointment(row: any): ScheduleAppointment {
  return {
    id: String(row.appointment_id),
    encounterId: row.encounter_id ? String(row.encounter_id) : null,
    appointmentDate: String(row.scheduled_start_at).slice(0, 10),
    appointmentTime: toTime(String(row.scheduled_start_at)),
    clientId: String(row.client_id),
    clientFullName: String(row.client_full_name || "Unknown Client"),
    providerId: String(row.provider_id),
    providerName: String(row.provider_full_name || "Unknown Provider"),
    appointmentType: row.appointment_type || undefined,
    payerName: String(row.payer_name || "Self Pay"),
    eligibility: {
      checkedAt: row.eligibility_checked_at || undefined,
      isActive:
        row.eligibility_status === "active"
          ? true
          : row.eligibility_status === "inactive"
            ? false
            : undefined,
    },
    clientBalance: Number(row.client_balance || 0),
    billingAlertsCount: Number(row.open_alert_count || 0),
    noteStatus: mapNoteStatus(row.note_status),
    requiredBillingFieldsComplete: mapNoteStatus(row.note_status) === "signed",
    claim: row.claim_id
      ? {
          id: String(row.claim_id),
          claimNumber: String(row.claim_id),
          status: mapClaimStatus(row.claim_status),
        }
      : undefined,
  };
}

async function fetchDailyScheduleInternal(query: DailyScheduleQuery): Promise<DailyScheduleResult> {
  const response = await fetchScheduleDayFromApi({
    date: query.date,
    providerId: query.providerId,
  });

  const appointments = (response.rows || []).map(mapAppointment);
  const providerMap = new Map<string, ScheduleProvider>();
  for (const row of response.rows || []) {
    if (!row.provider_id) continue;
    providerMap.set(String(row.provider_id), {
      id: String(row.provider_id),
      name: String(row.provider_full_name || "Unknown Provider"),
    });
  }

  return {
    date: query.date,
    providers: Array.from(providerMap.values()),
    appointments,
  };
}

async function fetchAppointmentByIdInternal(appointmentId: string): Promise<ScheduleAppointment | null> {
  const date = new Date().toISOString().slice(0, 10);
  const schedule = await fetchDailyScheduleInternal({ date });
  const found = schedule.appointments.find((entry) => entry.id === appointmentId);
  return found || null;
}

async function createAppointmentInternal(_input: AppointmentCreateInput): Promise<ScheduleAppointment> {
  throw new Error(
    "Appointment creation from schedule is not wired to canonical backend yet. Use the existing appointment intake workflow.",
  );
}

async function runEligibilityCheckInternal(_appointmentId: string): Promise<ScheduleAppointment> {
  throw new Error(
    "Eligibility check from schedule is not wired to canonical backend yet. Open encounter and run eligibility there.",
  );
}

async function createClaimFromAppointmentInternal(appointmentId: string): Promise<ScheduleAppointment> {
  await resolveEncounterForAppointmentViaApi(appointmentId);
  throw new Error("Use canonical create-claim action from schedule page.");
}

async function createOrOpenBillerTicketInternal(appointmentId: string): Promise<BillerTicket> {
  await resolveEncounterForAppointmentViaApi(appointmentId);
  throw new Error("Use canonical route-to-biller action from schedule page.");
}

export const scheduleDataSource: ScheduleDataSource = {
  fetchDailySchedule: fetchDailyScheduleInternal,
  fetchAppointmentById: fetchAppointmentByIdInternal,
  createAppointment: createAppointmentInternal,
  runEligibilityCheck: runEligibilityCheckInternal,
  createClaimFromAppointment: createClaimFromAppointmentInternal,
  createOrOpenBillerTicket: createOrOpenBillerTicketInternal,
};

export const fetchDailySchedule = scheduleDataSource.fetchDailySchedule;
export const fetchAppointmentById = scheduleDataSource.fetchAppointmentById;
export const createAppointment = scheduleDataSource.createAppointment;
export const runEligibilityCheck = scheduleDataSource.runEligibilityCheck;
export const createClaimFromAppointment = scheduleDataSource.createClaimFromAppointment;
export const createOrOpenBillerTicket = scheduleDataSource.createOrOpenBillerTicket;
