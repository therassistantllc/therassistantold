import { ClaimStatus } from "@/lib/types/claim";
import {
  AppointmentCreateInput,
  BillerTicket,
  DailyScheduleQuery,
  DailyScheduleResult,
  ScheduleDataSource,
  ScheduleAppointment,
  ScheduleProvider,
} from "@/lib/types/schedule";
import { getClaimCreationGate, getTodayIsoDate } from "@/lib/utils/schedule";

const providers: ScheduleProvider[] = [
  { id: "prov-chen", name: "Dr. Michael Chen" },
  { id: "prov-johnson", name: "Dr. Sarah Johnson" },
  { id: "prov-martinez", name: "Dr. Emily Martinez" },
];

function makeClaim(appointmentId: string, status: ClaimStatus) {
  return {
    id: `claim-${appointmentId}`,
    claimNumber: `CLM-2026-${appointmentId.toUpperCase().replace(/-/g, "").slice(0, 8)}`,
    status,
  };
}

function seedAppointments(): ScheduleAppointment[] {
  const today = getTodayIsoDate();
  return [
    {
      id: "apt-001",
      encounterId: "enc-001",
      appointmentDate: today,
      appointmentTime: "09:00",
      clientId: "PAT-001",
      clientFullName: "Sarah Johnson",
      providerId: "prov-chen",
      providerName: "Dr. Michael Chen",
      appointmentType: "Initial Assessment",
      payerName: "Anthem BCBS",
      eligibility: { checkedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), isActive: true },
      clientBalance: 245.5,
      billingAlertsCount: 2,
      noteStatus: "signed",
      requiredBillingFieldsComplete: true,
      claim: makeClaim("apt-001", "submitted"),
    },
    {
      id: "apt-002",
      encounterId: "enc-002",
      appointmentDate: today,
      appointmentTime: "10:00",
      clientId: "PAT-002",
      clientFullName: "Michael Smith",
      providerId: "prov-chen",
      providerName: "Dr. Michael Chen",
      appointmentType: "Psychotherapy",
      payerName: "UnitedHealthcare",
      eligibility: { checkedAt: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString(), isActive: true },
      clientBalance: 0,
      billingAlertsCount: 1,
      noteStatus: "in_progress",
      requiredBillingFieldsComplete: true,
    },
    {
      id: "apt-003",
      encounterId: "enc-003",
      appointmentDate: today,
      appointmentTime: "11:30",
      clientId: "PAT-003",
      clientFullName: "Emily Davis",
      providerId: "prov-johnson",
      providerName: "Dr. Sarah Johnson",
      appointmentType: "Follow-up",
      payerName: "Cigna",
      eligibility: { checkedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), isActive: false },
      clientBalance: 82,
      billingAlertsCount: 3,
      noteStatus: "signed",
      requiredBillingFieldsComplete: false,
    },
    {
      id: "apt-004",
      encounterId: "enc-004",
      appointmentDate: today,
      appointmentTime: "14:00",
      clientId: "PAT-004",
      clientFullName: "Robert Brown",
      providerId: "prov-martinez",
      providerName: "Dr. Emily Martinez",
      appointmentType: "Medication Management",
      payerName: "Aetna",
      eligibility: {},
      clientBalance: 140,
      billingAlertsCount: 0,
      noteStatus: "not_started",
      requiredBillingFieldsComplete: true,
    },
    {
      id: "apt-005",
      encounterId: "enc-005",
      appointmentDate: today,
      appointmentTime: "15:30",
      clientId: "PAT-005",
      clientFullName: "Lisa Wilson",
      providerId: "prov-johnson",
      providerName: "Dr. Sarah Johnson",
      appointmentType: "Group Therapy",
      payerName: "Medicaid Colorado",
      eligibility: { checkedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), isActive: true },
      clientBalance: 25,
      billingAlertsCount: 4,
      noteStatus: "signed",
      requiredBillingFieldsComplete: true,
    },
    {
      id: "apt-006",
      encounterId: "enc-006",
      appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      appointmentTime: "09:30",
      clientId: "PAT-006",
      clientFullName: "John Anderson",
      providerId: "prov-chen",
      providerName: "Dr. Michael Chen",
      appointmentType: "Follow-up",
      payerName: "Anthem BCBS",
      eligibility: {},
      clientBalance: 0,
      billingAlertsCount: 0,
      noteStatus: "not_started",
      requiredBillingFieldsComplete: true,
    },
  ];
}

let appointmentsStore: ScheduleAppointment[] = seedAppointments();
const ticketByEncounter = new Map<string, BillerTicket>();
let appointmentCounter = appointmentsStore.length + 1;
let ticketCounter = 1;

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDailyScheduleInternal(query: DailyScheduleQuery): Promise<DailyScheduleResult> {
  await delay(200);

  const filtered = appointmentsStore
    .filter((appointment) => appointment.appointmentDate === query.date)
    .filter((appointment) => !query.providerId || query.providerId === "all" || appointment.providerId === query.providerId)
    .sort((left, right) => left.appointmentTime.localeCompare(right.appointmentTime));

  return {
    date: query.date,
    providers,
    appointments: filtered,
  };
}

async function createAppointmentInternal(input: AppointmentCreateInput): Promise<ScheduleAppointment> {
  await delay(250);

  const provider = providers.find((entry) => entry.id === input.providerId);
  const appointmentId = `apt-${String(appointmentCounter).padStart(3, "0")}`;
  const encounterId = `enc-${String(appointmentCounter).padStart(3, "0")}`;
  appointmentCounter += 1;

  const created: ScheduleAppointment = {
    id: appointmentId,
    encounterId,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    clientId: input.clientId ?? `PAT-${String(appointmentCounter).padStart(3, "0")}`,
    clientFullName: input.clientFullName,
    providerId: input.providerId,
    providerName: provider?.name ?? "Unknown Provider",
    appointmentType: input.appointmentType,
    payerName: input.payerName,
    eligibility: {},
    clientBalance: 0,
    billingAlertsCount: 0,
    noteStatus: "not_started",
    requiredBillingFieldsComplete: true,
  };

  appointmentsStore = [...appointmentsStore, created];
  return created;
}

function findAppointmentIndex(appointmentId: string): number {
  return appointmentsStore.findIndex((appointment) => appointment.id === appointmentId);
}

async function fetchAppointmentByIdInternal(appointmentId: string): Promise<ScheduleAppointment | null> {
  await delay(150);
  // Support lookup by appointment ID or encounter ID
  const appointment = appointmentsStore.find(
    (entry) => entry.id === appointmentId || entry.encounterId === appointmentId
  );
  return appointment ?? null;
}

async function runEligibilityCheckInternal(appointmentId: string): Promise<ScheduleAppointment> {
  await delay(450);
  const index = findAppointmentIndex(appointmentId);
  if (index < 0) {
    throw new Error("Appointment not found.");
  }

  const appointment = appointmentsStore[index];
  const isActive = !appointment.payerName.toLowerCase().includes("medicaid");
  const updated: ScheduleAppointment = {
    ...appointment,
    eligibility: {
      checkedAt: new Date().toISOString(),
      isActive,
    },
  };

  appointmentsStore = [
    ...appointmentsStore.slice(0, index),
    updated,
    ...appointmentsStore.slice(index + 1),
  ];
  return updated;
}

async function createClaimFromAppointmentInternal(appointmentId: string): Promise<ScheduleAppointment> {
  await delay(500);
  const index = findAppointmentIndex(appointmentId);
  if (index < 0) {
    throw new Error("Appointment not found.");
  }

  const appointment = appointmentsStore[index];
  const gate = getClaimCreationGate(appointment);
  if (!gate.canCreate) {
    throw new Error(gate.blockers.join(" "));
  }

  const updated: ScheduleAppointment = {
    ...appointment,
    claim: makeClaim(appointment.id, "draft"),
  };

  appointmentsStore = [
    ...appointmentsStore.slice(0, index),
    updated,
    ...appointmentsStore.slice(index + 1),
  ];
  return updated;
}

async function createOrOpenBillerTicketInternal(appointmentId: string): Promise<BillerTicket> {
  await delay(300);
  const appointment = appointmentsStore.find((entry) => entry.id === appointmentId);
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const existing = ticketByEncounter.get(appointment.encounterId);
  if (existing) {
    return existing;
  }

  const ticket: BillerTicket = {
    id: `TKT-${String(ticketCounter).padStart(4, "0")}`,
    appointmentId: appointment.id,
    encounterId: appointment.encounterId,
    clientId: appointment.clientId,
    clientFullName: appointment.clientFullName,
    providerName: appointment.providerName,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    payerName: appointment.payerName,
    billingAlertsCount: appointment.billingAlertsCount,
  };
  ticketCounter += 1;
  ticketByEncounter.set(appointment.encounterId, ticket);
  return ticket;
}

export const scheduleDataSource: ScheduleDataSource = {
  fetchDailySchedule: fetchDailyScheduleInternal,
  fetchAppointmentById: fetchAppointmentByIdInternal,
  createAppointment: createAppointmentInternal,
  runEligibilityCheck: runEligibilityCheckInternal,
  createClaimFromAppointment: createClaimFromAppointmentInternal,
  createOrOpenBillerTicket: createOrOpenBillerTicketInternal,
};

// Backward-compatible function exports.
export const fetchDailySchedule = scheduleDataSource.fetchDailySchedule;
export const fetchAppointmentById = scheduleDataSource.fetchAppointmentById;
export const createAppointment = scheduleDataSource.createAppointment;
export const runEligibilityCheck = scheduleDataSource.runEligibilityCheck;
export const createClaimFromAppointment = scheduleDataSource.createClaimFromAppointment;
export const createOrOpenBillerTicket = scheduleDataSource.createOrOpenBillerTicket;
