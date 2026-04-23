import { ClaimStatus } from "@/lib/types/claim";

export type ScheduleView = "day" | "week" | "month";

export type NoteStatus = "not_started" | "in_progress" | "signed";

export interface EligibilityRecord {
  checkedAt?: string;
  isActive?: boolean;
}

export interface ClaimSummary {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
}

export interface ScheduleAppointment {
  id: string;
  encounterId: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  clientId: string;
  clientFullName: string;
  providerId: string;
  providerName: string;
  appointmentType?: string;
  payerName: string;
  eligibility: EligibilityRecord;
  clientBalance: number;
  billingAlertsCount: number;
  noteStatus: NoteStatus;
  requiredBillingFieldsComplete: boolean;
  claim?: ClaimSummary;
}

export interface ScheduleProvider {
  id: string;
  name: string;
}

export interface DailyScheduleQuery {
  date: string;
  providerId?: string;
}

export interface DailyScheduleResult {
  date: string;
  providers: ScheduleProvider[];
  appointments: ScheduleAppointment[];
}

export interface AppointmentCreateInput {
  appointmentDate: string;
  appointmentTime: string;
  clientFullName: string;
  clientId?: string;
  providerId: string;
  appointmentType?: string;
  payerName: string;
}

export interface BillerTicket {
  id: string;
  appointmentId: string;
  encounterId: string;
  clientId: string;
  clientFullName: string;
  providerName: string;
  appointmentDate: string;
  appointmentTime: string;
  payerName: string;
  billingAlertsCount: number;
}

export type ScheduleActionName =
  | "open_client"
  | "collect"
  | "route_to_biller"
  | "open_note"
  | "check_eligibility"
  | "create_claim"
  | "open_claim";

export interface ScheduleActionContext {
  appointment: ScheduleAppointment;
  selectedDate: string;
  selectedProviderId: string;
}

export interface ScheduleDataSource {
  fetchDailySchedule(query: DailyScheduleQuery): Promise<DailyScheduleResult>;
  fetchAppointmentById(appointmentIdOrEncounterId: string): Promise<ScheduleAppointment | null>;
  createAppointment(input: AppointmentCreateInput): Promise<ScheduleAppointment>;
  runEligibilityCheck(appointmentId: string): Promise<ScheduleAppointment>;
  createClaimFromAppointment(appointmentId: string): Promise<ScheduleAppointment>;
  createOrOpenBillerTicket(appointmentId: string): Promise<BillerTicket>;
}
