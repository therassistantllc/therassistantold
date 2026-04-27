// File: components/dashboard/ClaimsAttentionCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";
import EmptyState from "@/components/dashboard/EmptyState";
import SeverityBadge from "@/components/dashboard/SeverityBadge";

interface ClaimsAttentionRow {
  id: string;
  client: string;
  payer: string;
  dos: string;
  amount: string;
  reason: string;
  queue: string;
}

export default function ClaimsAttentionCard({ rows }: { rows: ClaimsAttentionRow[] }) {
  return (
    <DashboardCard
      title="Claims Needing Attention"
      description="Highest priority claims across no response, rejected, denied, and stale pending work."
      action={<Link href="/billing" className="text-sm text-blue-700 hover:underline">Open workqueue</Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No urgent claims" description="Claim queues are clear right now." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{row.client}</div>
                  <div className="mt-1 text-sm text-gray-600">{row.payer} • DOS {row.dos} • {row.amount}</div>
                  <div className="mt-1 text-sm text-gray-700">{row.reason}</div>
                </div>
                <SeverityBadge severity="high" label={row.queue} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/billing/claims/${row.id}`} className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open claim</Link>
                <Link href={`/billing/claims/${row.id}`} className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Action</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
