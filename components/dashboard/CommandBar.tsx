// File: components/dashboard/CommandBar.tsx
"use client";

import Link from "next/link";

interface CommandMetric {
  key: string;
  label: string;
  value: number | string;
  href: string;
}

export default function CommandBar({ metrics }: { metrics: CommandMetric[] }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Today’s Command Bar</h2>
        <p className="mt-1 text-sm text-gray-600">
          Click a metric to jump into the matching workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        {metrics.map((metric) => (
          <Link
            key={metric.key}
            href={metric.href}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-4 hover:bg-white"
          >
            <div className="text-sm text-gray-500">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{metric.value}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
