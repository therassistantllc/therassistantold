import { ClaimStatus } from "@/lib/types/claim";
import { EligibilityRecord, NoteStatus, ScheduleAppointment } from "@/lib/types/schedule";

export const ELIGIBILITY_FRESHNESS_DAYS = 30;

export type EligibilityDisplayStatus = "Active" | "Inactive" | "Not Checked";

export interface ClaimCreationGate {
  canCreate: boolean;
  blockers: string[];
}

export function getTodayIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, offsetDays: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return getTodayIsoDate(date);
}

export function formatDisplayDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDisplayTime(time24h: string): string {
  const [hourRaw, minuteRaw] = time24h.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function isEligibilityFresh(checkedAt?: string, now = new Date()): boolean {
  if (!checkedAt) return false;
  const checkedDate = new Date(checkedAt);
  const diffMs = now.getTime() - checkedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= ELIGIBILITY_FRESHNESS_DAYS;
}

export function getEligibilityStatus(
  eligibility: EligibilityRecord,
  now = new Date(),
): EligibilityDisplayStatus {
  if (eligibility.checkedAt && eligibility.isActive === false) {
    return "Inactive";
  }

  if (eligibility.checkedAt && eligibility.isActive && isEligibilityFresh(eligibility.checkedAt, now)) {
    return "Active";
  }

  return "Not Checked";
}

export function getClaimStatusLabel(status: ClaimStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getNoteStatusLabel(status: NoteStatus): string {
  switch (status) {
    case "signed":
      return "Signed";
    case "in_progress":
      return "In Progress";
    default:
      return "Not Started";
  }
}

export function getClaimCreationGate(appointment: ScheduleAppointment): ClaimCreationGate {
  const blockers: string[] = [];

  if (appointment.claim) {
    blockers.push("Claim already exists for this encounter.");
  }

  if (appointment.noteStatus !== "signed") {
    blockers.push("Documentation must be signed before claim creation.");
  }

  if (!appointment.requiredBillingFieldsComplete) {
    blockers.push("Required billing fields are missing.");
  }

  return {
    canCreate: blockers.length === 0,
    blockers,
  };
}
