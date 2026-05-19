/**
 * OpenMRS Encounter & Visit Adapter
 *
 * Handles conversion between TherAssistant encounter/appointment models
 * and OpenMRS visit/encounter/observation models.
 *
 * Currently stubbed for integration with existing Supabase routes.
 * Full implementation pending OpenMRS API integration.
 */

export type CreateEncounterFromAppointmentInput = {
  organizationId: string;
  appointmentId: string;
};

export type SaveEncounterNoteInput = {
  organizationId: string;
  encounterId: string;
  action: "save" | "sign";
  subjective?: string;
  interventions?: string;
  plan?: string;
};

/**
 * Create OpenMRS Visit from TherAssistant Appointment
 *
 * Maps appointment data to OpenMRS visit model:
 * - Appointment → Visit
 * - Appointment start/end times → Visit start/stop dates
 * - Provider → Visit encounter provider
 *
 * @param input Appointment context for visit creation
 * @returns OpenMRS visit UUID or null if disabled
 */
export async function createOpenMrsVisitFromAppointment(
  _input: CreateEncounterFromAppointmentInput,
): Promise<string | null> {
  // TODO: Check if OpenMRS sync is enabled
  // TODO: Fetch appointment details from Supabase
  // TODO: Map to OpenMRS visit payload
  // TODO: POST /visit to OpenMRS API
  // TODO: Create nested encounter
  // TODO: Return visit UUID for cross-reference
  return null;
}

/**
 * Save OpenMRS Encounter Note and Observations
 *
 * Maps TherAssistant clinical notes to OpenMRS observations:
 * - subjective → Obs (Assessment & Plan concept)
 * - interventions → Obs (Interventions concept)
 * - plan → Obs (Plan concept)
 *
 * On sign action:
 * - Mark encounter as completed
 * - Create observations with signed metadata
 *
 * @param input Note content and metadata
 * @returns OpenMRS encounter UUID or null if disabled
 */
export async function saveOpenMrsEncounterNote(
  _input: SaveEncounterNoteInput,
): Promise<string | null> {
  // TODO: Check if OpenMRS sync is enabled
  // TODO: Validate encounter exists in OpenMRS (via cross-reference)
  // TODO: Create Obs for subjective, interventions, plan
  // TODO: If signed: mark encounter as completed
  // TODO: Return encounter UUID
  return null;
}
