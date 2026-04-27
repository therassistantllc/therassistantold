// File: components/dashboard/ClearinghouseActivityCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";
import EmptyState from "@/components/dashboard/EmptyState";
import SeverityBadge from "@/components/dashboard/SeverityBadge";

interface ActivityRow {
  id: string;
  title: string;
  detail: string;
  severity: string;
  patientId?: string | null;
  claimId?: string | null;
}

export default function ClearinghouseActivityCard({ rows }: { rows: ActivityRow[] }) {
  return (
    <DashboardCard
      title="Recent Clearinghouse Activity"
      description="Eligibility checks, claim status checks, submissions, acknowledgments, ERAs, and errors."
      action={<Link href="/clearinghouse/transactions" className="text-sm text-blue-700 hover:underline">Open transaction log</Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No recent clearinghouse activity" description="No recent transaction activity found." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{row.title}</div>
                  <div className="mt-1 text-sm text-gray-600">{row.detail}</div>
                </div>
                <SeverityBadge severity={row.severity} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/clearinghouse/transactions" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open transaction log</Link>
                {row.claimId ? <Link href={`/billing/claims/${row.claimId}`} className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open claim</Link> : null}
                {row.patientId ? <Link href={`/patients/${row.patientId}`} className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open patient</Link> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
