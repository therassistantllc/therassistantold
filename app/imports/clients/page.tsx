"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface ImportJob {
  id: string;
  organizationId: string | null;
  sourceSystem: string;
  fileName: string | null;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  duplicateRows: number;
  createdAt: string;
  updatedAt: string;
}

interface ImportRow {
  id: string;
  rowNumber: number;
  importStatus: string;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  mappedValues: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  validatedAt: string;
}

export default function ClientDataImportPage() {
  const [step, setStep] = useState<"upload" | "mapping" | "validation" | "complete">("upload");
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sourceSystem, setSourceSystem] = useState("SimplePractice");
  const [jobId, setJobId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [proposedMapping, setProposedMapping] = useState<Record<string, string | null>>({});
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [job, setJob] = useState<ImportJob | null>(null);
  const [jobRows, setJobRows] = useState<ImportRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Fetch job details when jobId changes
  useEffect(() => {
    if (!jobId) return;

    async function loadJob() {
      try {
        const response = await fetch(`/api/imports/clients/${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to load job");
        }
        const data = await response.json();
        setJob(data.job);
        setJobRows(data.rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load job details");
      }
    }

    loadJob();
  }, [jobId]);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      if (!file) {
        throw new Error("Please select a file");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("source_system", sourceSystem);
      formData.append("organization_id", process.env.NEXT_PUBLIC_ORGANIZATION_ID || "");

      const response = await fetch("/api/imports/clients/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      setJobId(data.jobId);
      setHeaders(data.headers);
      setProposedMapping(data.proposedMapping);
      setMapping(data.proposedMapping);
      setSuccess(`Uploaded ${data.totalRows} rows`);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleValidate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!jobId) throw new Error("No job ID");

      const response = await fetch(`/api/imports/clients/${jobId}/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Validation failed");
      }

      const data = await response.json();
      setValidationSummary(data.validationSummary);
      setStep("validation");
      setSuccess("Validation complete");

      // Refresh job details
      if (jobId) {
        const jobResponse = await fetch(`/api/imports/clients/${jobId}`);
        if (jobResponse.ok) {
          const jobData = await jobResponse.json();
          setJob(jobData.job);
          setJobRows(jobData.rows);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    }
  }

  async function handleImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setImporting(true);

    try {
      if (!jobId) throw new Error("No job ID");

      const response = await fetch(`/api/imports/clients/${jobId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importDuplicates: false }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Import failed");
      }

      const data = await response.json();
      setImportResult(data.import);
      setStep("complete");
      setSuccess("Import completed successfully");

      // Refresh job details
      if (jobId) {
        const jobResponse = await fetch(`/api/imports/clients/${jobId}`);
        if (jobResponse.ok) {
          const jobData = await jobResponse.json();
          setJob(jobData.job);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function updateMapping(header: string, newValue: string | null) {
    setMapping((prev) => ({
      ...prev,
      [header]: newValue,
    }));
  }

  const validRowCount = useMemo(
    () => jobRows.filter((r) => r.importStatus === "valid").length,
    [jobRows]
  );
  const invalidRowCount = useMemo(
    () => jobRows.filter((r) => r.importStatus === "invalid").length,
    [jobRows]
  );
  const duplicateRowCount = useMemo(
    () => jobRows.filter((r) => r.importStatus === "duplicate").length,
    [jobRows]
  );

  const showPreview = jobRows.length > 0 && step === "validation";

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Client Data Import</h1>
            <p className="mt-2 text-gray-600">
              Upload and validate client data from external sources
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
              {success}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Step 1: Upload CSV File
              </h2>

              <form onSubmit={handleUpload} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Source System
                  </label>
                  <select
                    value={sourceSystem}
                    onChange={(e) => setSourceSystem(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
                  >
                    <option value="SimplePractice">SimplePractice</option>
                    <option value="TherapyNotes">TherapyNotes</option>
                    <option value="OfficeAlly">Office Ally</option>
                    <option value="OtherCSV">Other CSV</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    CSV files only. Include headers in the first row.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload & Parse"}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === "mapping" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Step 2: Review Column Mapping
              </h2>

              <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
                System detected {headers.length} columns. Review and adjust mapping as needed.
              </div>

              <form onSubmit={handleValidate} className="space-y-6">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {headers.map((header) => (
                    <div key={header} className="rounded-lg border border-gray-200 p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Source column: <span className="font-semibold">{header}</span>
                      </label>
                      <input
                        type="text"
                        placeholder="maps to client field (or leave empty to skip)"
                        value={mapping[header] ?? ""}
                        onChange={(e) => updateMapping(header, e.target.value || null)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
                >
                  Validate Rows
                </button>
              </form>
            </div>
          )}

          {/* Step 3: Validation Results */}
          {step === "validation" && job && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Step 3: Validation Results
                </h2>

                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <div className="text-2xl font-bold text-green-700">{validRowCount}</div>
                    <div className="text-xs text-green-600">Valid</div>
                  </div>
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                    <div className="text-2xl font-bold text-orange-700">{invalidRowCount}</div>
                    <div className="text-xs text-orange-600">Invalid</div>
                  </div>
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                    <div className="text-2xl font-bold text-yellow-700">{duplicateRowCount}</div>
                    <div className="text-xs text-yellow-600">Possible Duplicates</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                    <div className="text-2xl font-bold text-blue-700">{job.totalRows}</div>
                    <div className="text-xs text-blue-600">Total</div>
                  </div>
                </div>

                {invalidRowCount > 0 && (
                  <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900">
                    <div className="font-medium mb-2">Invalid rows (will be skipped):</div>
                    <div className="text-xs space-y-1">
                      {jobRows
                        .filter((r) => r.importStatus === "invalid")
                        .slice(0, 5)
                        .map((row) => (
                          <div key={row.id}>
                            Row {row.rowNumber}: {row.errors.join(", ")}
                          </div>
                        ))}
                      {invalidRowCount > 5 && (
                        <div>... and {invalidRowCount - 5} more</div>
                      )}
                    </div>
                  </div>
                )}

                {duplicateRowCount > 0 && (
                  <div className="mb-6 rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-900">
                    <div className="font-medium mb-2">
                      Possible duplicates (will be skipped unless explicitly imported):
                    </div>
                    <div className="text-xs">
                      Review these rows to ensure they don't already exist.
                    </div>
                  </div>
                )}

                {showPreview && jobRows.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Row Preview</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">
                              Row
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">
                              Issues
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {jobRows.slice(0, 10).map((row) => (
                            <tr key={row.id}>
                              <td className="px-4 py-3 text-gray-600">{row.rowNumber}</td>
                              <td className="px-4 py-3 text-gray-900">
                                {row.mappedValues?.first_name} {row.mappedValues?.last_name}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {row.mappedValues?.email}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                    row.importStatus === "valid"
                                      ? "bg-green-100 text-green-700"
                                      : row.importStatus === "invalid"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {row.importStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-red-600">
                                {row.errors.length > 0 && row.errors[0]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {jobRows.length > 10 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Showing 10 of {jobRows.length} rows
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleImport}>
                  <button
                    type="submit"
                    disabled={validRowCount === 0 || importing}
                    className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {importing
                      ? "Importing..."
                      : `Import ${validRowCount} Valid Row${validRowCount === 1 ? "" : "s"}`}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === "complete" && importResult && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-6 text-center">
                <div className="text-lg font-semibold text-green-900">Import Completed</div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {importResult.importedCount}
                  </div>
                  <div className="text-xs text-green-600">Imported</div>
                </div>
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <div className="text-2xl font-bold text-yellow-700">
                    {importResult.duplicateCount}
                  </div>
                  <div className="text-xs text-yellow-600">Skipped (Duplicate)</div>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <div className="text-2xl font-bold text-red-700">{importResult.invalidCount}</div>
                  <div className="text-xs text-red-600">Skipped (Invalid)</div>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <div className="text-2xl font-bold text-gray-700">{importResult.failedCount}</div>
                  <div className="text-xs text-gray-600">Failed</div>
                </div>
              </div>

              <button
                onClick={() => {
                  setStep("upload");
                  setJobId(null);
                  setFile(null);
                  setError(null);
                  setSuccess(null);
                  setImportResult(null);
                }}
                className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                Import Another File
              </button>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
