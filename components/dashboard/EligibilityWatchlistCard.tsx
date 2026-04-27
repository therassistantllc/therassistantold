// File: components/dashboard/EligibilityWatchlistCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";
import EmptyState from "@/components/dashboard/EmptyState";
import SeverityBadge from "@/components/dashboard/SeverityBadge";

interface EligibilityWatchRow {
  id: string;
  patient: string;
  reason: string;
  patientId?: string | null;
}

export default function EligibilityWatchlistCard({ rows }: { rows: EligibilityWatchRow[] }) {
  return (
    <DashboardCard
      title="Eligibility Watchlist"
      description="Coverage gaps, not checked appointments, and insurance data issues."
      action={<Link href="/scheduling?filter=eligibility_not_checked" className="text-sm text-blue-700 hover:underline">Open watchlist</Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No eligibility alerts" description="Eligibility watchlist is clear." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{row.patient}</div>
                  <div className="mt-1 text-sm text-gray-600">{row.reason}</div>
                </div>
                <SeverityBadge severity="high" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/scheduling?run=eligibility" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Run eligibility</Link>
                {row.patientId ? <Link href={`/patients/${row.patientId}/billing-settings`} className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open patient insurance</Link> : null}
                <Link href="/tickets" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Route to biller</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
