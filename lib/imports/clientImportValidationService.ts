import "server-only";

import { createServerSupabaseAdminClientTyped } from "@/lib/supabase/server";

interface ExistingClientLookup {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
}

export interface ClientImportRowForValidation {
  id: string;
  row_number: number;
  mapped_data: Record<string, unknown> | null;
}

export interface ValidatedImportRow {
  id: string;
  rowNumber: number;
  mappedData: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  duplicateMatchClientId: string | null;
  importStatus: "valid" | "invalid" | "duplicate";
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value: unknown): string {
  return normalizeText(value).replace(/[^0-9]/g, "");
}

function normalizeDob(value: unknown): string {
  return normalizeText(value);
}

function isValidEmail(value: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDate(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  const date = new Date(`${normalized}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

async function loadExistingClients(): Promise<ExistingClientLookup[]> {
  const supabase = createServerSupabaseAdminClientTyped();
  if (!supabase) {
    throw new Error("Database connection not available");
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, date_of_birth, email, phone")
    .is("archived_at", null)
    .limit(50000);

  if (error) {
    throw new Error("Failed to load clients for duplicate checks");
  }

  return (data ?? []) as ExistingClientLookup[];
}

export async function validateClientImportRows(
  rows: ClientImportRowForValidation[]
): Promise<ValidatedImportRow[]> {
  const existingClients = await loadExistingClients();

  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byNameDob = new Map<string, string>();

  for (const client of existingClients) {
    const email = normalizeEmail(client.email);
    if (email) byEmail.set(email, client.id);

    const phone = normalizePhone(client.phone);
    if (phone) byPhone.set(phone, client.id);

    const nameDob = `${normalizeText(client.first_name).toLowerCase()}|${normalizeText(client.last_name).toLowerCase()}|${normalizeDob(client.date_of_birth)}`;
    if (!nameDob.startsWith("||")) {
      byNameDob.set(nameDob, client.id);
    }
  }

  return rows.map((row) => {
    const mapped = (row.mapped_data ?? {}) as Record<string, unknown>;
    const errors: string[] = [];
    const warnings: string[] = [];

    const firstName = normalizeText(mapped.first_name);
    const lastName = normalizeText(mapped.last_name);
    const dob = normalizeDob(mapped.date_of_birth);
    const email = normalizeEmail(mapped.email);
    const phone = normalizePhone(mapped.phone);
    const primaryInsurance = normalizeText(mapped.primary_insurance_name);

    if (!firstName) errors.push("Missing required first name");
    if (!lastName) errors.push("Missing required last name");

    if (!dob) {
      warnings.push("Missing date of birth");
    } else if (!isValidDate(dob)) {
      errors.push("Invalid date format for date of birth (expected YYYY-MM-DD)");
    }

    if (!email && !phone) {
      warnings.push("Missing both email and phone");
    }

    if (email && !isValidEmail(email)) {
      warnings.push("Invalid email format");
    }

    if (!primaryInsurance) {
      warnings.push("Missing primary insurance");
    }

    let duplicateMatchClientId: string | null = null;

    if (email && byEmail.has(email)) {
      duplicateMatchClientId = byEmail.get(email) ?? null;
    }

    if (!duplicateMatchClientId && phone && byPhone.has(phone)) {
      duplicateMatchClientId = byPhone.get(phone) ?? null;
    }

    if (!duplicateMatchClientId && firstName && lastName && dob) {
      const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dob}`;
      if (byNameDob.has(key)) {
        duplicateMatchClientId = byNameDob.get(key) ?? null;
      }
    }

    if (duplicateMatchClientId) {
      warnings.push("Possible duplicate match found");
    }

    const importStatus: ValidatedImportRow["importStatus"] =
      errors.length > 0
        ? "invalid"
        : duplicateMatchClientId
          ? "duplicate"
          : "valid";

    return {
      id: row.id,
      rowNumber: row.row_number,
      mappedData: mapped,
      errors,
      warnings,
      duplicateMatchClientId,
      importStatus,
    };
  });
}
