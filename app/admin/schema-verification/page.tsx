// File: app/admin/schema-verification/page.tsx
"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface VerificationResult {
  tableName: string;
  expectedColumns: string[];
  foundColumns: string[];
  missingColumns: string[];
  extraColumns: string[];
  rowCount: number | null;
  error?: string;
}

const schemaTargets: Array<{ tableName: string; expectedColumns: string[] }> = [
  {
    tableName: "clients",
    expectedColumns: [
      "id",
      "organization_id",
      "first_name",
      "last_name",
      "middle_name",
      "preferred_name",
      "date_of_birth",
      "email",
      "phone",
      "mrn",
      "sex_at_birth",
      "gender_identity",
      "pronouns",
      "preferred_language",
      "address_line_1",
      "address_line_2",
      "city",
      "state",
      "postal_code",
      "external_client_ref",
      "primary_clinician_user_id",
      "deceased_at",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "insurance_policies",
    expectedColumns: [
      "id",
      "organization_id",
      "client_id",
      "payer_id",
      "policy_number",
      "subscriber_id",
      "priority",
      "plan_name",
      "effective_date",
      "termination_date",
      "active_flag",
      "deductible_amount",
      "copay_amount",
      "coinsurance_percent",
      "out_of_pocket_max",
      "legacy_availity_plan_code",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "appointments",
    expectedColumns: [
      "id",
      "organization_id",
      "client_id",
      "provider_id",
      "provider_location_id",
      "insurance_policy_id",
      "scheduled_start_at",
      "scheduled_end_at",
      "appointment_status",
      "appointment_type",
      "reason",
      "check_in_at",
      "cancelled_at",
      "cancellation_reason",
      "telehealth_url",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "encounters",
    expectedColumns: [
      "id",
      "organization_id",
      "appointment_id",
      "client_id",
      "provider_id",
      "encounter_status",
      "started_at",
      "ended_at",
      "service_date",
      "required_billing_fields_complete",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "encounter_diagnoses",
    expectedColumns: [
      "id",
      "organization_id",
      "encounter_id",
      "diagnosis_code",
      "diagnosis_description",
      "is_primary",
      "sequence_number",
      "present_on_claim",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "encounter_service_lines",
    expectedColumns: [
      "id",
      "organization_id",
      "encounter_id",
      "service_date",
      "sequence_number",
      "cpt_hcpcs_code",
      "modifier_1",
      "modifier_2",
      "modifier_3",
      "modifier_4",
      "units",
      "charge_amount",
      "place_of_service_code",
      "rendering_provider_id",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "claims",
    expectedColumns: [
      "id",
      "organization_id",
      "encounter_id",
      "client_id",
      "insurance_policy_id",
      "claim_number",
      "claim_status",
      "total_charge_amount",
      "date_of_service_from",
      "date_of_service_to",
      "claim_frequency_code",
      "duplicate_detection_key",
      "last_blocker_codes",
      "ready_to_submit_at",
      "submitted_at",
      "accepted_at",
      "denied_at",
      "paid_at",
      "patient_responsibility_amount",
      "payer_responsibility_amount",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "claim_service_lines",
    expectedColumns: [
      "id",
      "organization_id",
      "claim_id",
      "encounter_service_line_id",
      "service_date",
      "sequence_number",
      "cpt_hcpcs_code",
      "modifier_1",
      "modifier_2",
      "modifier_3",
      "modifier_4",
      "units",
      "charge_amount",
      "allowed_amount",
      "paid_amount",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "claim_submissions",
    expectedColumns: [
      "id",
      "organization_id",
      "claim_id",
      "submission_status",
      "clearinghouse_reference",
      "external_transaction_id",
      "payer_claim_reference",
      "submission_sequence",
      "duplicate_detection_key",
      "response_summary",
      "submitted_at",
      "acknowledged_at",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "claim_status_inquiries",
    expectedColumns: [
      "id",
      "organization_id",
      "claim_id",
      "inquiry_status",
      "external_transaction_id",
      "duplicate_detection_key",
      "payer_status_code",
      "payer_status_text",
      "response_summary",
      "requested_at",
      "responded_at",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "payment_postings",
    expectedColumns: [
      "id",
      "organization_id",
      "payment_import_item_id",
      "posting_status",
      "posting_reference",
      "total_posted_amount",
      "note",
      "posted_at",
      "reversed_at",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "eligibility_checks",
    expectedColumns: [
      "id",
      "organization_id",
      "client_id",
      "insurance_policy_id",
      "appointment_id",
      "encounter_id",
      "eligibility_status",
      "checked_at",
      "coverage_start_date",
      "coverage_end_date",
      "copay_amount",
      "deductible_remaining",
      "out_of_pocket_remaining",
      "external_transaction_id",
      "raw_status_text",
      "response_summary",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "workqueue_items",
    expectedColumns: [
      "id",
      "organization_id",
      "source_object_type",
      "source_object_id",
      "client_id",
      "encounter_id",
      "claim_id",
      "priority",
      "status",
      "work_type",
      "title",
      "description",
      "assigned_to_user_id",
      "due_at",
      "resolved_at",
      "closed_at",
      "context_payload",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
  {
    tableName: "support_tickets",
    expectedColumns: [
      "id",
      "organization_id",
      "workqueue_item_id",
      "source_object_type",
      "source_object_id",
      "requestor_user_id",
      "assigned_to_user_id",
      "status",
      "category",
      "priority",
      "title",
      "description",
      "due_at",
      "resolved_at",
      "closed_at",
      "created_at",
      "updated_at",
      "created_by_user_id",
      "updated_by_user_id",
      "archived_at",
    ],
  },
];

async function fetchColumnsForTable(tableName: string) {
  const safeTableName = tableName.replace(/'/g, "''");
  const queryText = [
    "select column_name",
    "from information_schema.columns",
    "where table_schema = 'public'",
    `  and table_name = '${safeTableName}'`,
    "order by ordinal_position",
  ].join("\n");

  const { data, error } = await supabase.rpc("run_sql", {
    query_text: queryText,
  });

  if (error) {
    return { columns: [], error: error.message };
  }

  const rows = Array.isArray(data) ? data : [];
  const columns = rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const value =
        "result" in row
          ? (row as { result?: { column_name?: unknown } }).result?.column_name
          : undefined;
      return value ? String(value) : null;
    })
    .filter((value): value is string => Boolean(value));

  return { columns, error: null };
}

async function fetchRowCount(tableName: string) {
  const { count, error } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (error) {
    return { count: null, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

export default function SchemaVerificationPage() {
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = results.length;
    const passing = results.filter(
      (item) => !item.error && item.missingColumns.length === 0
    ).length;
    const failing = results.filter(
      (item) => item.error || item.missingColumns.length > 0
    ).length;

    return { total, passing, failing };
  }, [results]);

  async function verifyTable(tableName: string, expectedColumns: string[]) {
    const [columnResult, countResult] = await Promise.all([
      fetchColumnsForTable(tableName),
      fetchRowCount(tableName),
    ]);

    const foundColumns = [...columnResult.columns].sort();
    const missingColumns = expectedColumns.filter((column) => !foundColumns.includes(column));
    const extraColumns = foundColumns.filter((column) => !expectedColumns.includes(column));
    const combinedError = columnResult.error || countResult.error || undefined;

    return {
      tableName,
      expectedColumns,
      foundColumns,
      missingColumns,
      extraColumns,
      rowCount: countResult.count,
      error: combinedError,
    } satisfies VerificationResult;
  }

  async function runVerification() {
    setLoading(true);
    setError(null);

    try {
      const nextResults = await Promise.all(
        schemaTargets.map((target) => verifyTable(target.tableName, target.expectedColumns))
      );
      setResults(nextResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schema verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Schema Verification</h1>
              <p className="mt-2 text-sm text-gray-600">
                Verification expectations aligned to your real Supabase schema.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void runVerification()}
              disabled={loading}
              className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Checking..." : "Run Verification"}
            </button>
          </div>

          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-sm">
            This version updates the verifier's expected columns to match the schema alignment work already applied.
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3">
            <div>
              <div className="text-sm text-gray-500">Tables checked</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{summary.total}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Passing</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{summary.passing}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Needs attention</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{summary.failing}</div>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : null}

          {results.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Click <span className="font-medium">Run Verification</span> to compare the aligned expectations against your live Supabase tables.
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => {
                const hasIssue = Boolean(result.error) || result.missingColumns.length > 0;
                return (
                  <section
                    key={result.tableName}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{result.tableName}</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          Row count: {result.rowCount === null ? "Unavailable" : result.rowCount}
                        </p>
                      </div>

                      <div
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          hasIssue ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {hasIssue ? "Review" : "Pass"}
                      </div>
                    </div>

                    {result.error ? (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {result.error}
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="mb-2 text-sm font-medium text-gray-700">Missing columns</div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                          {result.missingColumns.length === 0 ? "None" : result.missingColumns.join(", ")}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-sm font-medium text-gray-700">Extra columns</div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                          {result.extraColumns.length === 0 ? "None" : result.extraColumns.join(", ")}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-sm font-medium text-gray-700">Found columns</div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                          {result.foundColumns.length === 0 ? "None returned" : result.foundColumns.join(", ")}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
