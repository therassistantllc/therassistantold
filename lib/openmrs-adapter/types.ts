/**
 * OpenMRS Adapter Types
 * 
 * Defines OpenMRS data structures and their mappings to TherAssistant equivalents.
 * This adapter enables integration of OpenMRS ESM modules while preserving TherAssistant
 * business logic, data model, and Supabase persistence.
 */

// ==================== OpenMRS Core Types ====================

/** OpenMRS Patient - Maps to TherAssistant Client */
export interface OpenMRSPatient {
  uuid: string;
  display: string;
  identifiers: Array<{
    identifier: string;
    identifierType: {
      uuid: string;
      display: string;
    };
  }>;
  person: {
    uuid: string;
    display: string;
    gender: "M" | "F" | "O" | string;
    birthdate: string | null;
    birthdateEstimated: boolean;
    dead: boolean;
    deathDate: string | null;
    names: Array<{
      uuid: string;
      display: string;
      givenName: string;
      middleName?: string;
      familyName: string;
      preferred: boolean;
    }>;
    addresses: Array<{
      uuid: string;
      display: string;
      address1: string;
      address2?: string;
      cityVillage: string;
      stateProvince: string;
      postalCode: string;
      country: string;
      preferred: boolean;
    }>;
    attributes: Array<{
      uuid: string;
      attributeType: {
        uuid: string;
        display: string;
      };
      value: string;
    }>;
  };
  links?: Array<{ rel: string; uri: string }>;
}

/** OpenMRS Visit - Maps to TherAssistant Appointment + Encounter */
export interface OpenMRSVisit {
  uuid: string;
  display: string;
  patient: {
    uuid: string;
    display: string;
  };
  visitType: {
    uuid: string;
    display: string;
  };
  indication: {
    uuid: string;
    display: string;
  } | null;
  location: {
    uuid: string;
    display: string;
  };
  startDatetime: string;
  stopDatetime: string | null;
  encounters: OpenMRSEncounter[];
  attributes: Array<{
    uuid: string;
    attributeType: {
      uuid: string;
      display: string;
    };
    value: string;
  }>;
}

/** OpenMRS Encounter - Maps to TherAssistant Encounter with service detail */
export interface OpenMRSEncounter {
  uuid: string;
  display: string;
  encounterType: {
    uuid: string;
    display: string;
  };
  patient: {
    uuid: string;
    display: string;
  };
  provider?: {
    uuid: string;
    display: string;
  };
  visit?: {
    uuid: string;
    display: string;
  };
  location?: {
    uuid: string;
    display: string;
  };
  encounterDatetime: string;
  obs: OpenMRSObservation[];
  orders: OpenMRSOrder[];
}

/** OpenMRS Observation - Clinical data point */
export interface OpenMRSObservation {
  uuid: string;
  display: string;
  concept: {
    uuid: string;
    display: string;
  };
  value: string | number | boolean | OpenMRSCodedConcept | null;
  obsDatetime: string;
  voided: boolean;
}

/** OpenMRS Coded Concept - Enumeration value */
export interface OpenMRSCodedConcept {
  uuid: string;
  display: string;
}

/** OpenMRS Order - Prescription/service order */
export interface OpenMRSOrder {
  uuid: string;
  display: string;
  orderType: {
    uuid: string;
    display: string;
  };
  concept: {
    uuid: string;
    display: string;
  };
  patient: {
    uuid: string;
    display: string;
  };
  orderer?: {
    uuid: string;
    display: string;
  };
  dateActivated: string;
  dateStopped?: string;
  autoExpireDate?: string;
}

/** OpenMRS Attachment - Maps to TherAssistant Mailroom Item */
export interface OpenMRSAttachment {
  uuid: string;
  patient: {
    uuid: string;
    display: string;
  };
  visit?: {
    uuid: string;
    display: string;
  };
  encounter?: {
    uuid: string;
    display: string;
  };
  fileMetadata: {
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    dateUploaded: string;
    uploadedBy: {
      uuid: string;
      display: string;
    };
  };
  comments?: string;
}

// ==================== Mapping Configuration ====================

/** Configuration for mapping OpenMRS data to TherAssistant */
export interface OpenMRSMappingConfig {
  organizationId: string;
  identifierTypeUuids: {
    mrn?: string;
    externalRef?: string;
  };
  visitTypeUuids: Record<string, string>; // { openMRS_uuid: TherAssistant_label }
  encounterTypeUuids: Record<string, string>; // { openMRS_uuid: TherAssistant_type }
  conceptUuids: Record<string, string>; // { openMRS_uuid: TherAssistant_code }
  locationUuids: Record<string, string>; // { openMRS_uuid: TherAssistant_location }
}

// ==================== Mapped Entity Types ====================

/** Mapped OpenMRS Patient to TherAssistant Client */
export interface MappedPatient {
  // TherAssistant ID (generated)
  id?: string;
  organizationId: string;
  externalClientRef: string; // OpenMRS patient UUID
  mrn: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  preferredName: string | null;
  dateOfBirth: string;
  sexAtBirth: string;
  genderIdentity: string | null;
  pronouns: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  preferredLanguage: string | null;
  
  // OpenMRS source references
  openmrsPatientUuid: string;
  openmrsRawData?: OpenMRSPatient;
}

/** Mapped OpenMRS Visit + Encounter to TherAssistant Appointment + Encounter */
export interface MappedVisit {
  appointment: {
    id?: string;
    organizationId: string;
    clientId: string;
    providerId?: string;
    scheduledStartAt: string;
    scheduledEndAt: string;
    durationMinutes: number;
    appointmentType: string; // Visit type
    reason: string;
    serviceLocation: "office" | "telehealth";
    status: "scheduled" | "checked_in" | "in_progress" | "completed" | "no_show" | "cancelled";
    openmrsVisitUuid: string;
    openmrsRawData?: OpenMRSVisit;
  };
  encounter?: {
    id?: string;
    organizationId: string;
    appointmentId?: string;
    clientId: string;
    providerId?: string;
    dateOfService: string;
    clinicalNotes: string;
    diagnoses: Array<{
      code: string;
      description: string;
      isPrimary: boolean;
    }>;
    serviceLines: Array<{
      cptCode: string;
      description: string;
      units: number;
    }>;
    openmrsEncounterId: string;
    openmrsRawData?: OpenMRSEncounter;
  };
}

/** Mapped OpenMRS Attachment to TherAssistant Mailroom Item */
export interface MappedAttachment {
  id?: string;
  organizationId: string;
  clientId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: "needs_review" | "in_review" | "approved" | "archived";
  documentType: string;
  source: "patient_portal" | "payer" | "provider" | "mailroom";
  notes: string | null;
  storageUrl: string;
  openmrsAttachmentUuid: string;
  openmrsRawData?: OpenMRSAttachment;
}
