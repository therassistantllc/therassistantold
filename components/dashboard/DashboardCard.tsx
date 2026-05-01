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
    <section className="card">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--brand-navy)" }}>{title}</h2>
          {description ? <p className="mt-1 text-sm" style={{ color: "var(--neutral-600)" }}>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
