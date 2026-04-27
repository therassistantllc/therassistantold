// File: app/page.tsx
"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import HomeCommandCenter from "@/components/dashboard/HomeCommandCenter";

type Role = "admin_biller" | "clinician" | "credentialing" | "owner_executive";

interface DashboardPayload {
  role: string;
  organization: { id?: string; name?: string };
  commandBarMetrics: any[];
  todaySchedule: any[];
  revenueCycleSnapshot: any[];
  claimsNeedingAttention: any[];
  documentationQueue: any[];
  eligibilityWatchlist: any[];
  patientBalanceQueue: any[];
  tickets: any[];
  credentialingTasks: any[];
  clearinghouseActivity: any[];
}

export default function HomePage() {
  const [role, setRole] = useState<Role>("admin_biller");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextRole: Role) {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/dashboard/home?role=${nextRole}`);
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not load home command center.");
      setLoading(false);
      return;
    }

    setData(payload as DashboardPayload);
    setLoading(false);
  }

  useEffect(() => {
    void load(role);
  }, [role]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">THERASSISTANT Home Command Center</h1>
              <p className="mt-2 text-sm text-gray-600">
                Therapy-first, role-aware, and workflow-driven.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search patient, claim, ticket, or provider"
                className="w-72 rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
              >
                <option value="admin_biller">Admin / biller</option>
                <option value="clinician">Clinician</option>
                <option value="credentialing">Credentialing user</option>
                <option value="owner_executive">Owner / executive</option>
              </select>
              <div className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm">
                Demo User
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading home command center...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : data ? (
            <HomeCommandCenter data={data} />
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
