// File: components/dashboard/DashboardCard.tsx
import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function DashboardCard({ title, description, action, children }: DashboardCardProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
