// File: components/dashboard/RevenueCycleSnapshotCard.tsx
import Link from "next/link";
import DashboardCard from "@/components/dashboard/DashboardCard";

interface SnapshotMetric {
  label: string;
  value: string;
  href: string;
}

export default function RevenueCycleSnapshotCard({ metrics }: { metrics: SnapshotMetric[] }) {
  return (
    <DashboardCard
      title="Revenue Cycle Snapshot"
      description="Operational finance metrics with direct links into billing queues."
      action={<Link href="/billing" className="text-sm text-blue-700 hover:underline">Open billing</Link>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 hover:bg-white">
            <div className="text-sm text-gray-500">{metric.label}</div>
            <div className="mt-2 text-xl font-semibold text-gray-900">{metric.value}</div>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
