// File: components/dashboard/TodayScheduleCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";
import EmptyState from "@/components/dashboard/EmptyState";
import SeverityBadge from "@/components/dashboard/SeverityBadge";

interface TodayScheduleRow {
  id: string;
  time: string;
  clientName: string;
  provider: string;
  appointmentType: string;
  eligibilityLabel: string;
  eligibilitySeverity: string;
  balanceLabel: string;
  noteStatus: string;
  patientId?: string | null;
}

export default function TodayScheduleCard({ rows }: { rows: TodayScheduleRow[] }) {
  return (
    <DashboardCard
      title="Today’s Schedule"
      description="What is happening today and what needs action before or after the visit."
      action={<Link href="/scheduling" className="text-sm text-blue-700 hover:underline">Open schedule</Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No appointments today" description="Today’s schedule is clear." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{row.time} • {row.clientName}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {row.provider} • {row.appointmentType}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SeverityBadge severity={row.eligibilitySeverity} label={row.eligibilityLabel} />
                  <SeverityBadge severity="low" label={row.balanceLabel} />
                  <SeverityBadge
                    severity={String(row.noteStatus ?? "").toLowerCase().includes("missing") ? "high" : "low"}
                    label={row.noteStatus ?? "Note status unknown"}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/scheduling" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open appointment</Link>
                {row.patientId ? <Link href={`/patients/${row.patientId}`} className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Open chart</Link> : null}
                <Link href="/scheduling?filter=eligibility_not_checked" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Run eligibility</Link>
                <Link href="/patients" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Collect payment</Link>
                <Link href="/encounters/new" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Create/open encounter</Link>
                <Link href="/tickets" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Route to biller</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
