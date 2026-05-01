// File: components/dashboard/DocumentationQueueCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";
import EmptyState from "@/components/dashboard/EmptyState";

interface DocumentationRow {
  id: string;
  title: string;
  status: string;
  patientId?: string | null;
}

export default function DocumentationQueueCard({ rows }: { rows: DocumentationRow[] }) {
  return (
    <DashboardCard
      title="Documentation Queue"
      description="Completed appointments missing notes, drafts, unsigned notes, and coding gaps."
      action={<Link href="/workqueue?queue=ready_to_bill" className="text-sm text-blue-700 hover:underline">Open doc queue →</Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="Documentation clear" description="All encounters are documented and ready for billing." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">{row.title}</div>
              <div className="mt-1 text-sm text-gray-600">{row.status}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={row.patientId ? `/patients/${row.patientId}` : "/patients"} className="rounded-xl bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700">Open patient</Link>
                <Link href="/encounters/new" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Create note</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
