// File: components/dashboard/HomeCommandCenter.tsx
"use client";

import CommandBar from "@/components/dashboard/CommandBar";
import QuickActionsMenu from "@/components/dashboard/QuickActionsMenu";
import TodayScheduleCard from "@/components/dashboard/TodayScheduleCard";
import RevenueCycleSnapshotCard from "@/components/dashboard/RevenueCycleSnapshotCard";
import ClaimsAttentionCard from "@/components/dashboard/ClaimsAttentionCard";
import DocumentationQueueCard from "@/components/dashboard/DocumentationQueueCard";
import EligibilityWatchlistCard from "@/components/dashboard/EligibilityWatchlistCard";
import PatientBalanceQueueCard from "@/components/dashboard/PatientBalanceQueueCard";
import TicketsCard from "@/components/dashboard/TicketsCard";
import CredentialingTasksCard from "@/components/dashboard/CredentialingTasksCard";
import ClearinghouseActivityCard from "@/components/dashboard/ClearinghouseActivityCard";
import EmptyState from "@/components/dashboard/EmptyState";

interface DashboardData {
  role: string;
  organization: { id?: string; name?: string };
  commandBarMetrics: Array<{ key: string; label: string; value: number | string; href: string }>;
  todaySchedule: Array<any>;
  revenueCycleSnapshot: Array<any>;
  claimsNeedingAttention: Array<any>;
  documentationQueue: Array<any>;
  eligibilityWatchlist: Array<any>;
  patientBalanceQueue: Array<any>;
  tickets: Array<any>;
  credentialingTasks: Array<any>;
  clearinghouseActivity: Array<any>;
}

export default function HomeCommandCenter({ data }: { data: DashboardData }) {
  const role = String(data.role ?? "admin_biller");

  const isAdmin = role === "admin_biller";
  const isClinician = role === "clinician";
  const isCredentialing = role === "credentialing";
  const isExecutive = role === "owner_executive";

  return (
    <div className="space-y-6">
      <CommandBar metrics={data.commandBarMetrics} />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {(isAdmin || isClinician || isExecutive) ? <TodayScheduleCard rows={data.todaySchedule} /> : null}
          {(isAdmin || isExecutive) ? <RevenueCycleSnapshotCard metrics={data.revenueCycleSnapshot} /> : null}
          {(isAdmin || isExecutive) ? <ClaimsAttentionCard rows={data.claimsNeedingAttention} /> : null}
          {(isAdmin || isClinician) ? <DocumentationQueueCard rows={data.documentationQueue} /> : null}
          {(isAdmin || isClinician) ? <EligibilityWatchlistCard rows={data.eligibilityWatchlist} /> : null}
          {(isAdmin || isClinician || isExecutive) ? <PatientBalanceQueueCard rows={data.patientBalanceQueue} /> : null}
          {(isAdmin || isClinician) ? <TicketsCard rows={data.tickets} /> : null}
          {(isCredentialing || isExecutive) ? <CredentialingTasksCard rows={data.credentialingTasks} /> : null}
          {(isAdmin || isExecutive) ? <ClearinghouseActivityCard rows={data.clearinghouseActivity} /> : null}

          {!isAdmin && !isClinician && !isCredentialing && !isExecutive ? (
            <EmptyState title="Role not configured" description="No dashboard widgets are enabled for this role." />
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            <p className="mt-1 text-sm text-gray-600">Start common workflows fast.</p>
            <div className="mt-4">
              <QuickActionsMenu />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Active Role</h2>
            <div className="mt-2 text-sm text-gray-700">{role}</div>
            <div className="mt-1 text-sm text-gray-500">{data.organization?.name ?? "Organization"}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
