// File: components/clearinghouse/ClaimStatusBadge.tsx
import type { ClaimStatusCheck } from "@/types/clearinghouse";

export default function ClaimStatusBadge({ status }: { status: ClaimStatusCheck["status"] | null | undefined }) {
  const value = status ?? "unknown";
  const className =
    value === "paid"
      ? "bg-green-100 text-green-800"
      : value === "denied" || value === "rejected"
      ? "bg-red-100 text-red-800"
      : value === "pending"
      ? "bg-amber-100 text-amber-800"
      : value === "accepted"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-700";

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>{value.replace("_", " ")}</span>;
}
