// File: app/billing/unposted-payments/page.tsx
"use client";

import { useEffect, useState } from "react";

type UnpostedPayment = {
  id: string;
  source_type?: string;
  payer_name?: string;
  patient_name?: string;
  received_at?: string;
  amount?: number;
  status?: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_CANONICAL_API_BASE || "http://localhost:4000";
const DEFAULT_ORGANIZATION_ID =
  process.env.NEXT_PUBLIC_ORGANIZATION_ID || "org-demo";

function getOrganizationId(): string {
  if (typeof window === "undefined") return DEFAULT_ORGANIZATION_ID;
  return (
    window.localStorage.getItem("organization_id") ||
    window.localStorage.getItem("org_id") ||
    DEFAULT_ORGANIZATION_ID
  );
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  const supabaseAuthKey = Object.keys(window.localStorage).find(
    (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
  );

  if (!supabaseAuthKey) return null;

  try {
    const raw = window.localStorage.getItem(supabaseAuthKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string };
    return parsed.access_token || null;
  } catch {
    return null;
  }
}

async function fetchUnpostedPayments(): Promise<UnpostedPayment[]> {
  const response = await fetch(
    `${API_BASE}/api/billing/unposted-payments?organization_id=${encodeURIComponent(getOrganizationId())}`,
    {
      headers: {
        ...(getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {}),
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    payments?: UnpostedPayment[];
    items?: UnpostedPayment[];
  };

  return payload.payments || payload.items || [];
}

export default function UnpostedPaymentsPage() {
  const [payments, setPayments] = useState<UnpostedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchUnpostedPayments();
        if (active) setPayments(data);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load unposted payments");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Unposted Payments</h1>
          <p className="mt-1 text-sm text-gray-600">
            Backend-backed imported payments awaiting posting.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            Loading unposted payments...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            No unposted payments found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Payment</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Payer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Patient</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Received</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-gray-900">{payment.id}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {payment.source_type || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {payment.payer_name || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {payment.patient_name || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {payment.received_at || "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      ${Number(payment.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {payment.status || "unposted"}
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