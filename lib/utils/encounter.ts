// Encounter Workspace Utility Functions

import { EncounterStatus, ReadinessStatus } from "@/lib/types/encounter";

/**
 * Get display-friendly label for encounter status
 */
export function getEncounterStatusLabel(status: EncounterStatus): string {
  const labels: Record<EncounterStatus, string> = {
    scheduled: "Scheduled",
    checked_in: "Checked In",
    in_progress: "In Progress",
    completed: "Completed",
    ready_to_bill: "Ready to Bill",
    billed: "Billed",
    cancelled: "Cancelled",
    no_show: "No Show",
  };
  return labels[status];
}

/**
 * Get color tone for encounter status badge
 */
export function getEncounterStatusTone(
  status: EncounterStatus
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "billed":
    case "ready_to_bill":
      return "success";
    case "completed":
      return "info";
    case "in_progress":
    case "checked_in":
      return "warning";
    case "cancelled":
    case "no_show":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Get display-friendly label for readiness status
 */
export function getReadinessStatusLabel(status: ReadinessStatus): string {
  const labels: Record<ReadinessStatus, string> = {
    ready: "Ready to Bill",
    warning: "Ready with Warnings",
    blocked: "Blocked",
  };
  return labels[status];
}

/**
 * Get color tone for readiness status badge
 */
export function getReadinessStatusTone(
  status: ReadinessStatus
): "success" | "warning" | "danger" {
  switch (status) {
    case "ready":
      return "success";
    case "warning":
      return "warning";
    case "blocked":
      return "danger";
  }
}

/**
 * Format diagnosis code for display
 */
export function formatDiagnosisCode(code: string): string {
  // ICD-10 codes typically have a dot after the third character
  if (code.length > 3 && !code.includes(".")) {
    return `${code.substring(0, 3)}.${code.substring(3)}`;
  }
  return code;
}

/**
 * Get severity color classes for billing alerts
 */
export function getAlertSeverityClasses(
  severity: "error" | "warning" | "info"
): string {
  switch (severity) {
    case "error":
      return "text-red-800 bg-red-50 border-red-200";
    case "warning":
      return "text-yellow-800 bg-yellow-50 border-yellow-200";
    case "info":
      return "text-blue-800 bg-blue-50 border-blue-200";
  }
}

/**
 * Calculate prior authorization usage percentage
 */
export function calculateAuthUsagePercentage(
  unitsUsed: number,
  unitsAuthorized: number
): number {
  if (unitsAuthorized === 0) return 0;
  return Math.round((unitsUsed / unitsAuthorized) * 100);
}

/**
 * Check if prior authorization is nearing expiration
 */
export function isAuthNearingExpiration(
  endDate: string,
  daysThreshold = 30
): boolean {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 && diffDays <= daysThreshold;
}

/**
 * Format service code with modifiers for display
 */
export function formatServiceCodeDisplay(
  code: string,
  modifiers?: string[]
): string {
  if (!modifiers || modifiers.length === 0) {
    return code;
  }
  return `${code}-${modifiers.join("-")}`;
}

/**
 * Determine if encounter can transition to a new status
 */
export function canTransitionStatus(
  currentStatus: EncounterStatus,
  targetStatus: EncounterStatus
): boolean {
  const validTransitions: Record<EncounterStatus, EncounterStatus[]> = {
    scheduled: ["checked_in", "in_progress", "cancelled", "no_show"],
    checked_in: ["in_progress", "no_show"],
    in_progress: ["completed", "cancelled"],
    completed: ["ready_to_bill"],
    ready_to_bill: ["billed"],
    billed: [],
    cancelled: [],
    no_show: [],
  };

  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

/**
 * Get next logical status for encounter
 */
export function getNextEncounterStatus(
  currentStatus: EncounterStatus
): EncounterStatus | null {
  const nextStatus: Record<EncounterStatus, EncounterStatus | null> = {
    scheduled: "checked_in",
    checked_in: "in_progress",
    in_progress: "completed",
    completed: "ready_to_bill",
    ready_to_bill: "billed",
    billed: null,
    cancelled: null,
    no_show: null,
  };

  return nextStatus[currentStatus];
}
