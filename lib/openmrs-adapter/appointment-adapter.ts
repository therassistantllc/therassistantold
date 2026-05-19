/**
 * OpenMRS Appointment & Visit Scheduling Adapter
 *
 * Handles conversion between TherAssistant appointment models
 * and OpenMRS visit/appointment scheduling models.
 *
 * Currently stubbed for integration with existing Supabase routes.
 * Full implementation pending OpenMRS API integration.
 */

export type CreateAppointmentInput = {
  organizationId: string;
  clientId: string;
  providerId: string;
  scheduledStartAt: string;
  durationMinutes: number;
  appointmentType: string;
  reason: string;
  serviceLocation: "office" | "telehealth";
  internalNote?: string;
  reminderLeadHours?: number;
  recurrence?: {
    frequency: "none" | "weekly" | "biweekly" | "monthly";
    endMode: "by_date" | "by_count";
    endDate?: string | null;
    sessionCount?: number | null;
  };
};

export type UpdateAppointmentInput = {
  organizationId: string;
  appointmentId: string;
  scope: "single" | "series";
  updates: {
    appointmentStatus?: string;
    reason?: string;
    appointmentType?: string;
    serviceLocation?: string;
    internalNote?: string | null;
  };
};

export type ListAppointmentsInput = {
  organizationId: string;
  clientId: string;
  limit?: number;
};

/**
 * Create OpenMRS Visit from TherAssistant Appointment
 *
 * Maps appointment data to OpenMRS visit model:
 * - Appointment → Visit
 * - Scheduled start/end → Visit start/stop dates
 * - Provider → Visit encounter provider
 * - Recurrence → Multiple visits (one per occurrence)
 * - Service location → Visit location or telehealth marker
 *
 * @param _input Appointment context for visit creation
 * @returns OpenMRS visit UUIDs (array for recurrence support) or null if disabled
 */
export async function createOpenMrsVisitFromAppointment(
  _input: CreateAppointmentInput,
): Promise<string[] | null> {
  // TODO: Check if OpenMRS sync is enabled
  // TODO: Fetch provider and client details from Supabase
  // TODO: Map to OpenMRS visit payload
  // TODO: Handle recurrence by creating multiple visits
  // TODO: POST /visit to OpenMRS API for each occurrence
  // TODO: Return array of visit UUIDs for cross-reference
  return null;
}

/**
 * Update OpenMRS Visit from TherAssistant Appointment Update
 *
 * Maps appointment updates to OpenMRS visit model:
 * - status changes → Visit stop date or cancellation
 * - reason updates → Visit visit_type or indication
 * - location changes → Visit location update
 *
 * Supports both single and series updates (reschedule all).
 *
 * @param _input Appointment update context
 * @returns Updated visit UUIDs or null if disabled
 */
export async function updateOpenMrsVisitFromAppointment(
  _input: UpdateAppointmentInput,
): Promise<string[] | null> {
  // TODO: Check if OpenMRS sync is enabled
  // TODO: Look up OpenMRS visit UUID from appointment cross-reference
  // TODO: If scope="single": PUT /visit/{uuid} with updates
  // TODO: If scope="series": GET series visits, update all with PUT
  // TODO: Handle status changes (e.g., cancelled → set stop date)
  // TODO: Return array of updated visit UUIDs
  return null;
}

/**
 * List OpenMRS Visits for Patient
 *
 * Maps patient appointment queries to OpenMRS visit queries:
 * - Patient → Patient UUID
 * - Limit → Query limit
 * - Date range → Visit date range (if provided)
 *
 * Used for hybrid roster views combining Supabase + OpenMRS.
 *
 * @param _input Patient appointment query context
 * @returns Array of visits or null if disabled
 */
export async function listOpenMrsVisitsForPatient(
  _input: ListAppointmentsInput,
): Promise<Array<{ uuid: string; startDate: string; stopDate?: string }> | null> {
  // TODO: Check if OpenMRS sync is enabled
  // TODO: Map client_id to OpenMRS patient UUID
  // TODO: GET /visit?patient={uuid} from OpenMRS API
  // TODO: Parse response and map to TherAssistant roster format
  // TODO: Return visit array or empty array if none found
  return null;
}
