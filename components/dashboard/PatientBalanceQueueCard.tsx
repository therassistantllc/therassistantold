// File: components/dashboard/PatientBalanceQueueCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";
import EmptyState from "@/components/dashboard/EmptyState";

interface PatientBalanceRow {
  id: string;
  patient: string;
  balance: string;
  reason: string;
  patientId?: string | null;
}

export default function PatientBalanceQueueCard({ rows }: { rows: PatientBalanceRow[] }) {
  return (
    <DashboardCard
      title="Patient Balance Queue"
      description="High balances, unpaid copays, and older patient balances requiring collection."
      action={<Link href="/billing" className="text-sm text-blue-700 hover:underline">Open billing →</Link>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No patient balance alerts" description="Patient collections are up to date." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">{row.patient}</div>
              <div className="mt-1 text-sm text-gray-600">{row.balance} • {row.reason}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {row.patientId ? <Link href={`/patients/${row.patientId}/patient-billing`} className="rounded-xl bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700">Open billing</Link> : null}
                <Link href="/billing" className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-white">Send statement</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
