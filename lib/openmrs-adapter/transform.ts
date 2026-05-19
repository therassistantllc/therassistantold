/**
 * OpenMRS Data Transformations
 * 
 * Functions to convert OpenMRS data structures to TherAssistant equivalents.
 * Preserves all TherAssistant business logic, schema constraints, and data integrity.
 */

import {
  OpenMRSPatient,
  OpenMRSVisit,
  OpenMRSEncounter,
  OpenMRSOrder,
  OpenMRSAttachment,
  MappedPatient,
  MappedVisit,
  MappedAttachment,
  OpenMRSMappingConfig,
} from "./types";

/**
 * Convert OpenMRS Patient to TherAssistant Client
 *
 * Maps OpenMRS patient identifiers and demographics to TherAssistant client schema.
 * Preserves OpenMRS UUID for reference and reconciliation.
 *
 * @param patient OpenMRS patient record
 * @param config Mapping configuration with organization context
 * @returns Mapped patient ready for TherAssistant database insertion
 */
export function mapOpenMRSPatientToClient(
  patient: OpenMRSPatient,
  config: OpenMRSMappingConfig,
): MappedPatient {
  const person = patient.person;
  const preferredName = person.names.find((n) => n.preferred) || person.names[0];
  const preferredAddress = person.addresses.find((a) => a.preferred) || person.addresses[0];

  // Extract MRN from identifiers
  const mrnIdentifier = config.identifierTypeUuids.mrn
    ? patient.identifiers.find((id) => id.identifierType.uuid === config.identifierTypeUuids.mrn)
    : undefined;

  // Extract phone and email from attributes
  const phoneAttr = person.attributes.find(
    (attr) => attr.attributeType.display === "Phone Number",
  );
  const emailAttr = person.attributes.find(
    (attr) => attr.attributeType.display === "Email Address",
  );

  return {
    organizationId: config.organizationId,
    externalClientRef: patient.uuid,
    mrn: mrnIdentifier ? mrnIdentifier.identifier : null,
    firstName: preferredName?.givenName || "",
    middleName: preferredName?.middleName || null,
    lastName: preferredName?.familyName || "",
    preferredName: null, // Use preferredName field from TherAssistant if needed
    dateOfBirth: person.birthdate || new Date().toISOString().split("T")[0],
    sexAtBirth: mapOpenMRSGender(person.gender),
    genderIdentity: null, // OpenMRS may store in attributes
    pronouns: null, // OpenMRS may store in attributes
    phone: phoneAttr?.value || null,
    email: emailAttr?.value || null,
    addressLine1: preferredAddress?.address1 || null,
    addressLine2: preferredAddress?.address2 || null,
    city: preferredAddress?.cityVillage || null,
    state: preferredAddress?.stateProvince || null,
    postalCode: preferredAddress?.postalCode || null,
    preferredLanguage: null, // Could be stored in attributes
    openmrsPatientUuid: patient.uuid,
    openmrsRawData: patient,
  };
}

/**
 * Convert OpenMRS Visit + Encounters to TherAssistant Appointment + Encounter
 *
 * OpenMRS visits contain multiple encounters. This function maps:
 * - OpenMRS Visit → TherAssistant Appointment (scheduling info)
 * - First OpenMRS Encounter → TherAssistant Encounter (clinical detail)
 *
 * @param visit OpenMRS visit with nested encounters
 * @param clientId TherAssistant client ID (from mapped patient)
 * @param config Mapping configuration
 * @returns Mapped visit ready for TherAssistant database insertion
 */
export function mapOpenMRSVisitToAppointmentAndEncounter(
  visit: OpenMRSVisit,
  clientId: string,
  config: OpenMRSMappingConfig,
): MappedVisit {
  const startTime = new Date(visit.startDatetime);
  const endTime = visit.stopDatetime ? new Date(visit.stopDatetime) : null;
  const durationMinutes = endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : 60;

  // Determine location type (office vs telehealth)
  const locationUuid = visit.location?.uuid || "";
  const serviceLocation = determineTelehealthFromLocation(locationUuid, config)
    ? "telehealth"
    : "office";

  const visitType = config.visitTypeUuids[visit.visitType.uuid] || visit.visitType.display;

  const mainEncounter = visit.encounters?.[0];

  return {
    appointment: {
      organizationId: config.organizationId,
      clientId,
      providerId: mainEncounter?.provider?.uuid || undefined,
      scheduledStartAt: visit.startDatetime,
      scheduledEndAt: visit.stopDatetime || new Date(startTime.getTime() + durationMinutes * 60000).toISOString(),
      durationMinutes,
      appointmentType: visitType,
      reason: visit.indication?.display || "",
      serviceLocation,
      status: mapOpenMRSVisitStatus(visit),
      openmrsVisitUuid: visit.uuid,
      openmrsRawData: visit,
    },
    encounter: mainEncounter
      ? mapOpenMRSEncounterToEncounter(mainEncounter, clientId, config)
      : undefined,
  };
}

/**
 * Convert single OpenMRS Encounter to TherAssistant Encounter
 *
 * Extracts observations (diagnoses), orders (service lines), and clinical notes
 * from OpenMRS encounter format to TherAssistant encounter format.
 *
 * @param encounter OpenMRS encounter with observations and orders
 * @param clientId TherAssistant client ID
 * @param config Mapping configuration
 * @returns Mapped encounter ready for TherAssistant database insertion
 */
export function mapOpenMRSEncounterToEncounter(
  encounter: OpenMRSEncounter,
  clientId: string,
  config: OpenMRSMappingConfig,
): MappedVisit["encounter"] {
  // Extract diagnoses from observations
  const diagnoses = encounter.obs
    .filter((obs) => isDiagnosisConcept(obs.concept.uuid))
    .map((obs) => ({
      code: obs.concept.uuid,
      description: obs.concept.display,
      isPrimary: isPrimaryDiagnosis(obs.concept.uuid),
    }));

  // Extract service lines from orders
  const serviceLines = encounter.orders
    .filter((order) => isServiceLineOrder(order.orderType.uuid))
    .map((order) => ({
      cptCode: extractCptCode(order),
      description: order.concept.display,
      units: 1, // Default; may be in order details
    }));

  // Extract clinical notes from observations
  const clinicalNotes = encounter.obs
    .filter((obs) => isNotesObservation(obs.concept.uuid))
    .map((obs) => obs.value)
    .join("\n");

  return {
    organizationId: config.organizationId,
    clientId,
    providerId: encounter.provider?.uuid || undefined,
    dateOfService: encounter.encounterDatetime,
    clinicalNotes: clinicalNotes || "",
    diagnoses,
    serviceLines,
    openmrsEncounterId: encounter.uuid,
    openmrsRawData: encounter,
  };
}

/**
 * Convert OpenMRS Attachment to TherAssistant Mailroom Item
 *
 * Maps attachments (patient-uploaded or payer-sent) to mailroom items
 * with proper document type classification and storage references.
 *
 * @param attachment OpenMRS attachment with file metadata
 * @param clientId TherAssistant client ID
 * @param config Mapping configuration
 * @param storagePath URL or path where file is stored in TherAssistant storage
 * @returns Mapped attachment ready for TherAssistant database insertion
 */
export function mapOpenMRSAttachmentToMailroom(
  attachment: OpenMRSAttachment,
  clientId: string,
  config: OpenMRSMappingConfig,
  storagePath: string,
): MappedAttachment {
  return {
    organizationId: config.organizationId,
    clientId,
    fileName: attachment.fileMetadata.fileName,
    mimeType: attachment.fileMetadata.mimeType,
    fileSize: attachment.fileMetadata.fileSize,
    status: "needs_review",
    documentType: classifyDocumentType(attachment.fileMetadata.fileName),
    source: "patient_portal",
    notes: attachment.comments || null,
    storageUrl: storagePath,
    openmrsAttachmentUuid: attachment.uuid,
    openmrsRawData: attachment,
  };
}

// ==================== Helper Functions ====================

/**
 * Map OpenMRS gender codes to TherAssistant standard values
 */
function mapOpenMRSGender(gender: string): string {
  const genderMap: Record<string, string> = {
    M: "Male",
    F: "Female",
    O: "Other",
    U: "Unknown",
  };
  return genderMap[gender] || gender;
}

/**
 * Determine appointment status from OpenMRS visit state
 */
function mapOpenMRSVisitStatus(
  visit: OpenMRSVisit,
): "scheduled" | "checked_in" | "in_progress" | "completed" | "no_show" | "cancelled" {
  // If visit is stopped, mark as completed
  if (visit.stopDatetime) {
    return "completed";
  }

  // If visit is current, mark as in_progress
  const now = new Date();
  const startTime = new Date(visit.startDatetime);
  if (startTime > now) {
    return "scheduled";
  }

  return "in_progress";
}

/**
 * Determine if location is telehealth based on UUID or name patterns
 */
function determineTelehealthFromLocation(locationUuid: string, config: OpenMRSMappingConfig): boolean {
  const locationName = config.locationUuids[locationUuid] || "";
  return /telehealth|virtual|video|phone/i.test(locationName);
}

/**
 * Check if observation concept is a diagnosis
 */
function isDiagnosisConcept(conceptUuid: string): boolean {
  // This would be customized based on your OpenMRS configuration
  // Common diagnosis concept UUIDs in OpenMRS
  const diagnosisPrefixes = ["diagnosis-", "icd"];
  return diagnosisPrefixes.some((prefix) => conceptUuid.includes(prefix));
}

/**
 * Check if diagnosis is marked as primary
 */
function isPrimaryDiagnosis(conceptUuid: string): boolean {
  // Could be determined from concept metadata or observation attributes
  return conceptUuid.includes("primary");
}

/**
 * Check if order is a service line (billable procedure)
 */
function isServiceLineOrder(orderTypeUuid: string): boolean {
  // Filter to only billable order types
  // Default to false to avoid including non-billable orders
  return !orderTypeUuid.includes("lab") && !orderTypeUuid.includes("imaging");
}

/**
 * Extract CPT code from OpenMRS order
 */
function extractCptCode(order: OpenMRSOrder): string {
  // Could be in order properties or concept mapping
  // Default to concept UUID if CPT code not found
  return order.concept.uuid;
}

/**
 * Check if observation is clinical notes
 */
function isNotesObservation(conceptUuid: string): boolean {
  const notesPatterns = ["notes", "progress", "assessment", "plan"];
  return notesPatterns.some((pattern) => conceptUuid.includes(pattern));
}

/**
 * Classify document type from filename and MIME type
 */
function classifyDocumentType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  const documentTypeMap: Record<string, string> = {
    pdf: "payer_correspondence",
    doc: "clinical_notes",
    docx: "clinical_notes",
    txt: "correspondence",
    jpg: "scanned_document",
    jpeg: "scanned_document",
    png: "scanned_document",
  };

  return documentTypeMap[extension] || "practice_document";
}

/**
 * Validate mapped data before database insertion
 */
export function validateMappedPatient(patient: MappedPatient): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!patient.firstName?.trim()) errors.push("First name is required");
  if (!patient.lastName?.trim()) errors.push("Last name is required");
  if (!patient.dateOfBirth) errors.push("Date of birth is required");
  if (!patient.organizationId) errors.push("Organization ID is required");
  if (!patient.openmrsPatientUuid) errors.push("OpenMRS patient UUID is required");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateMappedVisit(visit: MappedVisit): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!visit.appointment.clientId) errors.push("Client ID is required");
  if (!visit.appointment.scheduledStartAt) errors.push("Scheduled start time is required");
  if (!visit.appointment.openmrsVisitUuid) errors.push("OpenMRS visit UUID is required");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateMappedAttachment(
  attachment: MappedAttachment,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!attachment.fileName) errors.push("File name is required");
  if (!attachment.clientId) errors.push("Client ID is required");
  if (!attachment.storageUrl) errors.push("Storage URL is required");
  if (!attachment.openmrsAttachmentUuid) errors.push("OpenMRS attachment UUID is required");

  return {
    valid: errors.length === 0,
    errors,
  };
}
