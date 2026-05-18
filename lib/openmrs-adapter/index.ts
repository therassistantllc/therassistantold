/**
 * OpenMRS Adapter - Public API
 * 
 * Complete adapter for integrating OpenMRS ESM modules with TherAssistant EHR.
 * Handles data transformation, validation, and reconciliation between systems.
 */

export * from "./types";
export * from "./transform";

/**
 * Quick Reference: Mapping Strategy
 * 
 * OpenMRS → TherAssistant Mapping:
 * 
 * 1. PATIENT IDENTITY
 *    - OpenMRS Patient UUID → TherAssistant externalClientRef
 *    - MRN from identifiers → TherAssistant mrn
 *    - Demographics → TherAssistant client record
 * 
 * 2. VISIT & ENCOUNTER
 *    - OpenMRS Visit → TherAssistant Appointment
 *      (scheduledStartAt, scheduledEndAt, duration, status)
 *    - OpenMRS Encounter → TherAssistant Encounter
 *      (diagnoses, service lines, clinical notes)
 * 
 * 3. DOCUMENTS & ATTACHMENTS
 *    - OpenMRS Attachment → TherAssistant Mailroom Item
 *      (document classification, storage reference, status)
 * 
 * 4. OBSERVATIONS & ORDERS
 *    - Diagnosis observations → diagnoses array
 *    - Service order concepts → service lines for billing
 *    - Clinical note observations → clinicalNotes field
 * 
 * Design Principles:
 * - Preserve all OpenMRS UUIDs as external references (externalClientRef, openmrsPatientUuid, etc.)
 * - Maintain bidirectional mapping for reconciliation
 * - Keep TherAssistant data model intact (Supabase schema, billing logic)
 * - Validate all mapped data before insertion
 * - Support selective sync (only import needed modules/data)
 */
