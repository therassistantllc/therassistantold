// File: components/clearinghouse/EligibilityHistoryTable.tsx
import EligibilityBadge from "@/components/clearinghouse/EligibilityBadge";
import type { EligibilityCheck } from "@/types/clearinghouse";

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function EligibilityHistoryTable({ rows }: { rows: EligibilityCheck[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Checked</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Payer</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Copay</th>
            <th className="px-4 py-3">Deductible Remaining</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="text-sm text-gray-700">
              <td className="px-4 py-3">{row.checked_at ?? "—"}</td>
              <td className="px-4 py-3"><EligibilityBadge eligibility={row} /></td>
              <td className="px-4 py-3">{row.payer_name ?? "—"}</td>
              <td className="px-4 py-3">{row.plan_name ?? "—"}</td>
              <td className="px-4 py-3">{formatMoney(row.copay_amount)}</td>
              <td className="px-4 py-3">{formatMoney(row.deductible_remaining)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
