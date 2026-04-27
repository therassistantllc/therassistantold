// File: components/clearinghouse/EligibilityBadge.tsx
import type { EligibilityCheck } from "@/types/clearinghouse";

export default function EligibilityBadge({
  eligibility,
  lastCheckedWithin30Days,
}: {
  eligibility: EligibilityCheck | null;
  lastCheckedWithin30Days?: boolean;
}) {
  const status = eligibility?.status ?? (lastCheckedWithin30Days === false ? "not_checked" : "not_checked");
  const className =
    status === "active"
      ? "bg-green-100 text-green-800"
      : status === "inactive"
      ? "bg-red-100 text-red-800"
      : status === "error"
      ? "bg-amber-100 text-amber-800"
      : "bg-gray-100 text-gray-700";

  const label =
    status === "active"
      ? "Active"
      : status === "inactive"
      ? "Inactive"
      : status === "error"
      ? "Error"
      : "Not Checked";

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>{label}</span>;
}
