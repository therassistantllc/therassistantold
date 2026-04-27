// File: components/dashboard/CredentialingTasksCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";
import EmptyState from "@/components/dashboard/EmptyState";
import SeverityBadge from "@/components/dashboard/SeverityBadge";

interface CredentialingRow {
  id: string;
  title: string;
  dueAt?: string | null;
  severity: string;
}

export default function CredentialingTasksCard({ rows }: { rows: CredentialingRow[] }) {
  return (
    <DashboardCard
      title="Credentialing / Enrollment Tasks"
      description="CAQH attestations, recredentialing, payer follow-ups, and missing documents."
      action={<Link href="/credentialing/tasks?status=due" className="text-sm text-blue-700 hover:underline">Open credentialing</Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No credentialing tasks" description="No due credentialing work right now." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{row.title}</div>
                  <div className="mt-1 text-sm text-gray-600">Due: {row.dueAt ?? "—"}</div>
                </div>
                <SeverityBadge severity={row.severity} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/settings" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open provider</Link>
                <Link href="/credentialing/tasks?status=due" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open task</Link>
                <Link href="/credentialing/tasks?status=due" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Mark complete</Link>
                <Link href="/credentialing/tasks?status=due" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Add follow-up</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
