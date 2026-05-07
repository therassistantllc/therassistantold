// File: app/page.tsx
"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import HomeCommandCenter from "@/components/dashboard/HomeCommandCenter";
import { useUserRole } from "@/lib/store/userRole";
import type { AppRole } from "@/lib/navigation/roles";

type Role = AppRole;

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
  const persistedRole = useUserRole((state) => state.role);
  const setPersistedRole = useUserRole((state) => state.setRole);
  const [role, setRole] = useState<Role>(persistedRole);
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
    setRole(persistedRole);
  }, [persistedRole]);

  useEffect(() => {
    setPersistedRole(role);
    void load(role);
  }, [role, setPersistedRole]);

  return (
    <AppShell>
      <main className="min-h-screen" style={{ background: "var(--neutral-50)" }}>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--brand-navy)" }}>THERASSISTANT Home Command Center</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--neutral-600)" }}>
                Therapy-first, role-aware, and workflow-driven.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search patient, claim, ticket, or provider"
                className="input-field w-72"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="input-field"
              >
                <option value="admin_biller">Admin / biller</option>
                <option value="clinician">Clinician</option>
                <option value="credentialing">Credentialing user</option>
                <option value="owner_executive">Owner / executive</option>
              </select>
              <div className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--neutral-300)", background: "white" }}>
                Demo User
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card">
              <p className="text-sm" style={{ color: "var(--neutral-600)" }}>
                Loading home command center...
              </p>
            </div>
          ) : error ? (
            <div className="card" style={{ background: "var(--error-bg)", borderColor: "var(--error-border)", color: "var(--error-text)" }}>
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
