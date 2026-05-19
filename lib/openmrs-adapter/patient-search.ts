/**
 * OpenMRS Patient Search Adapter
 * 
 * Integrates OpenMRS patient search with TherAssistant API response format.
 * Designed as optional secondary source (hybrid mode) alongside Supabase.
 * 
 * Usage:
 *   // In app/api/clients/route.ts
 *   if (useOpenMrsPatients) {
 *     const openMrsClients = await searchOpenMRSPatients(query, organizationId, limit);
 *     return [...supabaseClients, ...openMrsClients];
 *   }
 */

import { mapOpenMRSPatientToClient, validateMappedPatient } from "./transform";
import type { OpenMRSPatient } from "./types";

export interface OpenMRSSearchOptions {
  /** Search query (name, email, phone, MRN) */
  query?: string;

  /** Maximum results to return */
  limit?: number;

  /** OpenMRS API base URL (e.g., https://demo.openmrs.org/openmrs) */
  baseUrl: string;

  /** REST API username (env: OPENMRS_API_USERNAME) */
  username?: string;

  /** REST API password (env: OPENMRS_API_PASSWORD) */
  password?: string;

  /** Representation level: simple | default | full */
  representation?: "simple" | "default" | "full";
}

export interface TherAssistantClientRosterItem {
  id: string;
  name: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "deceased";
  intakeStatus: null; // OpenMRS patients don't have intake status
  openBalance: number; // OpenMRS defaults to 0; Supabase may have balances
  updatedAt: string | null;
  externalSource: "openmrs" | "supabase"; // Marker for where data came from
  externalPatientUuid: string | null; // Cross-system reference
}

/**
 * Search OpenMRS patients and map to TherAssistant roster format
 *
 * @param query Name, email, phone, or MRN to search for
 * @param organizationId TherAssistant organization (for context)
 * @param options OpenMRS connection details
 * @returns Array of clients in TherAssistant format
 */
export async function searchOpenMRSPatients(
  query: string,
  organizationId: string,
  options: OpenMRSSearchOptions,
): Promise<TherAssistantClientRosterItem[]> {
  try {
    // Build OpenMRS API URL
    const url = new URL(`${options.baseUrl}/ws/rest/v1/patient`);
    url.searchParams.set("v", options.representation || "full");
    url.searchParams.set("limit", String(options.limit || 250));

    // Add search query if provided
    if (query && query.trim()) {
      url.searchParams.set("q", query);
    }

    // Prepare authentication
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    if (options.username && options.password) {
      const auth = Buffer.from(`${options.username}:${options.password}`).toString("base64");
      headers.set("Authorization", `Basic ${auth}`);
    }

    // Fetch from OpenMRS
    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `OpenMRS patient search failed: ${response.status} ${response.statusText}`,
      );
      return [];
    }

    const data = (await response.json()) as {
      results?: OpenMRSPatient[];
      error?: { message: string };
    };

    if (data.error) {
      console.error("OpenMRS API error:", data.error.message);
      return [];
    }

    // Map to TherAssistant format
    const clients = (data.results || [])
      .map((patient) => mapOpenMRSPatientToRosterItem(patient, organizationId))
      .filter((client) => client !== null) as TherAssistantClientRosterItem[];

    return clients;
  } catch (error) {
    console.error(
      "OpenMRS patient search error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Map single OpenMRS patient to TherAssistant roster item
 *
 * @param patient OpenMRS patient record
 * @param organizationId TherAssistant organization context
 * @returns Roster item in TherAssistant format, or null if mapping fails
 */
function mapOpenMRSPatientToRosterItem(
  patient: OpenMRSPatient,
  organizationId: string,
): TherAssistantClientRosterItem | null {
  try {
    // First map to MappedPatient (validation included)
    const mappedPatient = mapOpenMRSPatientToClient(patient, {
      organizationId,
      identifierTypeUuids: {
        mrn: process.env.OPENMRS_MRN_IDENTIFIER_UUID,
        externalRef: process.env.OPENMRS_EXTERNAL_ID_IDENTIFIER_UUID,
      },
      visitTypeUuids: {},
      encounterTypeUuids: {},
      conceptUuids: {},
      locationUuids: {},
    });

    // Validate
    const validation = validateMappedPatient(mappedPatient);
    if (!validation.valid) {
      console.warn(`OpenMRS patient validation failed:`, validation.errors);
      return null;
    }

    // Convert to roster format
    return {
      id: mappedPatient.id || patient.uuid,
      name: buildName(mappedPatient),
      preferredName: mappedPatient.preferredName || null,
      email: mappedPatient.email || null,
      phone: mappedPatient.phone || null,
      status: mappedPatient.sexAtBirth === "Deceased" ? "deceased" : "active",
      intakeStatus: null,
      openBalance: 0,
      updatedAt: patient.person?.birthdate || null,
      externalSource: "openmrs",
      externalPatientUuid: patient.uuid,
    };
  } catch (error) {
    console.error(
      `Failed to map OpenMRS patient ${patient.uuid}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Build display name from mapped patient
 */
function buildName(patient: { firstName: string; middleName?: string | null; lastName: string }): string {
  const parts = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unnamed Patient";
}

/**
 * Query OpenMRS for a specific patient by UUID
 *
 * @param patientUuid OpenMRS patient UUID
 * @param options Connection options
 * @returns Full OpenMRS patient record, or null if not found
 */
export async function getOpenMRSPatient(
  patientUuid: string,
  options: OpenMRSSearchOptions,
): Promise<OpenMRSPatient | null> {
  try {
    const url = new URL(`${options.baseUrl}/ws/rest/v1/patient/${patientUuid}`);
    url.searchParams.set("v", options.representation || "full");

    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    if (options.username && options.password) {
      const auth = Buffer.from(`${options.username}:${options.password}`).toString("base64");
      headers.set("Authorization", `Basic ${auth}`);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      console.error(`OpenMRS patient fetch failed: ${response.status}`);
      return null;
    }

    return (await response.json()) as OpenMRSPatient;
  } catch (error) {
    console.error(
      "OpenMRS patient fetch error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Configuration object for hybrid patient search
 * 
 * This allows progressive switching between Supabase-only and OpenMRS-hybrid modes
 * without changing the API response format.
 */
export function getOpenMRSConfig(): OpenMRSSearchOptions | null {
  // Only enable if explicitly configured
  const enabled = process.env.USE_OPENMRS_PATIENTS === "true";
  if (!enabled) return null;

  const baseUrl = process.env.OPENMRS_API_URL;
  if (!baseUrl) {
    console.warn("USE_OPENMRS_PATIENTS=true but OPENMRS_API_URL not set");
    return null;
  }

  return {
    baseUrl,
    username: process.env.OPENMRS_API_USERNAME,
    password: process.env.OPENMRS_API_PASSWORD,
    representation: "full",
    limit: 250,
  };
}

/**
 * Hybrid patient roster: Combine Supabase + OpenMRS results
 *
 * Usage in app/api/clients/route.ts:
 *   const { data: supabaseClients } = await supabase.from("clients").select(...);
 *   const openMrsConfig = getOpenMRSConfig();
 *   const openMrsClients = openMrsConfig ? await searchOpenMRSPatients(q, orgId, openMrsConfig) : [];
 *   const allClients = deduplicateClients([...supabaseClients, ...openMrsClients]);
 *   return allClients;
 */
export function deduplicateClients(
  clients: TherAssistantClientRosterItem[],
): TherAssistantClientRosterItem[] {
  const seen = new Set<string>();
  return clients.filter((client) => {
    if (seen.has(client.id)) return false;
    seen.add(client.id);
    return true;
  });
}
