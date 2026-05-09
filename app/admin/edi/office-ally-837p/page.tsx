"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { OfficeAlly837PValidationError } from "@/lib/edi/officeAlly837p/types";

type GenerateResponse = {
  batchId?: string;
  fileName?: string;
  fileContent?: string;
  notes?: string;
  warnings?: OfficeAlly837PValidationError[];
  errors?: OfficeAlly837PValidationError[];
  error?: string;
};

export default function AdminOfficeAlly837PPage() {
  const [claimId, setClaimId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  async function handleGenerate() {
    const trimmed = claimId.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/edi/office-ally/837p/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: trimmed }),
      });

      const payload = (await response.json()) as GenerateResponse;
      setResult(payload);
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Failed to generate Office Ally 837P batch",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyContent() {
    if (!result?.fileContent) return;
    await navigator.clipboard.writeText(result.fileContent);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-black text-slate-950">Office Ally 837P Generator (Admin)</h1>
          <p className="mt-2 text-sm text-slate-600">
            First-pass generator pending Office Ally test validation.
          </p>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Professional claim ID
              <input
                value={claimId}
                onChange={(event) => setClaimId(event.target.value)}
                placeholder="Enter professional_claims.id"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !claimId.trim()}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate 837P"}
              </button>
            </div>
          </div>

          {result?.error ? (
            <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
              {result.error}
            </div>
          ) : null}

          {result?.errors && result.errors.length > 0 ? (
            <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5">
              <h2 className="text-base font-black text-red-800">Validation errors</h2>
              <ul className="mt-3 space-y-2 text-sm text-red-700">
                {result.errors.map((item, index) => (
                  <li key={`${item.field}-${index}`}>
                    <strong>{item.field}</strong>: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result?.warnings && result.warnings.length > 0 ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-base font-black text-amber-800">Validation warnings</h2>
              <ul className="mt-3 space-y-2 text-sm text-amber-700">
                {result.warnings.map((item, index) => (
                  <li key={`${item.field}-${index}`}>
                    <strong>{item.field}</strong>: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result?.fileContent ? (
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-950">Generated 837P</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    File: <strong>{result.fileName ?? "(unknown)"}</strong>
                  </p>
                  {result.batchId ? (
                    <p className="mt-1 text-xs text-slate-500">Batch ID: {result.batchId}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={copyContent}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Copy X12
                </button>
              </div>

              <textarea
                readOnly
                value={result.fileContent}
                className="mt-4 min-h-[360px] w-full rounded-2xl border border-slate-200 p-3 font-mono text-xs text-slate-800"
              />
            </section>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
