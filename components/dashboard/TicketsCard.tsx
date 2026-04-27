// File: components/dashboard/TicketsCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";
import EmptyState from "@/components/dashboard/EmptyState";
import SeverityBadge from "@/components/dashboard/SeverityBadge";

interface TicketRow {
  id: string;
  title: string;
  severity: string;
  status: string;
}

export default function TicketsCard({ rows }: { rows: TicketRow[] }) {
  return (
    <DashboardCard
      title="Tickets / Biller Messages"
      description="Open tickets, urgent issues, unread messages, and routed billing work."
      action={<Link href="/tickets" className="text-sm text-blue-700 hover:underline">Open tickets</Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No open tickets" description="Tickets and routed issues are clear." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{row.title}</div>
                  <div className="mt-1 text-sm text-gray-600">{row.status}</div>
                </div>
                <SeverityBadge severity={row.severity} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/tickets" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open ticket</Link>
                <Link href="/tickets" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Assign</Link>
                <Link href="/tickets" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Resolve</Link>
                <Link href="/tickets" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Defer</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
