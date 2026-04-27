// File: components/clearinghouse/ClearinghouseEventsPanel.tsx
import type { ClearinghouseResponseEvent } from "@/types/clearinghouse";

export default function ClearinghouseEventsPanel({ rows }: { rows: ClearinghouseResponseEvent[] }) {
  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
          No clearinghouse events yet.
        </div>
      ) : (
        rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">{row.title}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {row.event_type} • {row.severity ?? "info"} • {row.source ?? "system"}
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs ${row.is_resolved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                {row.is_resolved ? "Resolved" : "Open"}
              </span>
            </div>
            <div className="mt-3 text-sm text-gray-700">{row.message ?? "—"}</div>
          </div>
        ))
      )}
    </div>
  );
}
