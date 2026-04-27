// File: components/dashboard/SeverityBadge.tsx
interface SeverityBadgeProps {
  severity?: string | null;
  label?: string | null;
}

export default function SeverityBadge({ severity = "medium", label }: SeverityBadgeProps) {
  const value = String(severity).toLowerCase();
  const className =
    value === "critical"
      ? "bg-red-100 text-red-800"
      : value === "high"
      ? "bg-orange-100 text-orange-800"
      : value === "low"
      ? "bg-blue-100 text-blue-800"
      : "bg-amber-100 text-amber-800";

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {label ?? value}
    </span>
  );
}
