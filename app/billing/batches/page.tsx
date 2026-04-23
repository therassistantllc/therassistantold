"use client";

import { getMockSubmissionBatches } from "@/lib/data/mock-billing";
import Link from "next/link";

export default function SubmissionBatchesPage() {
  const batches = getMockSubmissionBatches();
  
  const statusColors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-800",
    submitted: "bg-blue-100 text-blue-800",
    accepted: "bg-green-100 text-green-800",
    partially_rejected: "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800"
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Submission Batches</h1>
          <p className="text-sm text-gray-600 mt-1">
            View and manage claim submission batches
          </p>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submission Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claims</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failed</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/billing/batches/${batch.id}`} className="text-blue-600 hover:text-blue-800 font-mono text-sm">
                        {batch.batch_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(batch.submission_date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{batch.submitted_by_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{batch.claim_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">${batch.total_amount.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[batch.status]}`}>
                        {batch.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {batch.failed_claims_count > 0 ? (
                        <span className="text-red-600 font-medium">{batch.failed_claims_count}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100">
                          Download 837
                        </button>
                        <button className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                          View Claims
                        </button>
                        {batch.failed_claims_count > 0 && (
                          <button className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100">
                            Retry Failed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
