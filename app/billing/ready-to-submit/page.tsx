// File: app/billing/ready-to-submit/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReadyClaimItem = {
  claim_id: string;
  claim_number?: string;
  client_name?: string;
  payer_name?: string;
  date_of_service_from?: string;
  total_charge_amount?: number;
  readiness_status?: "ready" | "warning" | "blocked";
  blockers?: string[];
  warnings?: string[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_CANONICAL_API_BASE || "http://localhost:4000";

const DEFAULT_ORGANIZATION_ID =
  process.env.NEXT_PUBLIC_ORGANIZATION_ID || "org-demo";

function getOrganizationId(): string {
  if (typeof window === "undefined") {
    return DEFAULT_ORGANIZATION_ID;
  }

  return (
    window.localStorage.getItem("organization_id") ||
    window.localStorage.getItem("org_id") ||
    DEFAULT_ORGANIZATION_ID
  );
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const supabaseAuthKey = Object.keys(window.localStorage).find(
    (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
  );

  if (!supabaseAuthKey) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(supabaseAuthKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { access_token?: string };
    return parsed.access_token || null;
  } catch {
    return null;
  }
}

async function fetchReadyClaims(): Promise<ReadyClaimItem[]> {
  const organizationId = getOrganizationId();
  const token = getAccessToken();

  const response = await fetch(
    `${API_BASE}/api/billing/ready-to-submit?organization_id=${encodeURIComponent(organizationId)}`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    claims?: ReadyClaimItem[];
    items?: ReadyClaimItem[];
  };

  return payload.claims || payload.items || [];
}

export default function ReadyToSubmitPage() {
  const [claims, setClaims] = useState<ReadyClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchReadyClaims();
        if (active) {
          setClaims(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load claims");
          setClaims([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const readyCount = useMemo(
    () => claims.filter((claim) => claim.readiness_status === "ready").length,
    [claims],
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ready to Submit</h1>
            <p className="mt-1 text-sm text-gray-600">
              Backend-backed claims ready for billing submission.
            </p>
          </div>
          <div className="rounded-lg border bg-white px-4 py-2 text-sm">
            Ready claims: <span className="font-semibold">{readyCount}</span>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            Loading claims...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : claims.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            No claims ready to submit.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Claim</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Payer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">DOS</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Charge</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {claims.map((claim) => (
                  <tr key={claim.claim_id}>
                    <td className="px-4 py-3 text-gray-900">
                      {claim.claim_number || claim.claim_id}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {claim.client_name || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {claim.payer_name || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {claim.date_of_service_from || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {typeof claim.total_charge_amount === "number"
                        ? `$${claim.total_charge_amount.toFixed(2)}`
                        : "--"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border px-2 py-1 text-xs font-medium capitalize">
                        {claim.readiness_status || "ready"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/claims/${claim.claim_id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        Open Claim
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}