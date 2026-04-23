import { EncounterWorkspace } from "@/lib/types/encounter";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils/schedule";
import ScheduleStatusBadge from "@/components/scheduling/ScheduleStatusBadge";

interface EncounterHeaderProps {
  encounter: EncounterWorkspace;
}

function getStatusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "billed":
    case "ready_to_bill":
      return "success";
    case "completed":
      return "info";
    case "in_progress":
    case "checked_in":
      return "warning";
    case "cancelled":
    case "no_show":
      return "danger";
    default:
      return "neutral";
  }
}

function getEligibilityBadge(eligibility: EncounterWorkspace["eligibility"]) {
  if (eligibility.isActive) {
    return { label: "Eligible", tone: "success" as const };
  }
  if (eligibility.isActive === false) {
    return { label: "Inactive", tone: "danger" as const };
  }
  return { label: "Not Verified", tone: "warning" as const };
}

function getClaimStatusBadge(claim: EncounterWorkspace["claim"]) {
  if (!claim) {
    return { label: "No Claim", tone: "neutral" as const };
  }

  const statusLabel = claim.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  
  switch (claim.status) {
    case "paid":
    case "accepted":
      return { label: statusLabel, tone: "success" as const };
    case "submitted":
    case "ready_to_submit":
      return { label: statusLabel, tone: "info" as const };
    case "rejected":
    case "denied":
      return { label: statusLabel, tone: "danger" as const };
    default:
      return { label: statusLabel, tone: "neutral" as const };
  }
}

export default function EncounterHeader({ encounter }: EncounterHeaderProps) {
  const eligibilityBadge = getEligibilityBadge(encounter.eligibility);
  const claimBadge = getClaimStatusBadge(encounter.claim);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{encounter.clientFullName}</h1>
            <ScheduleStatusBadge
              label={encounter.status.replace(/_/g, " ").toUpperCase()}
              tone={getStatusTone(encounter.status)}
            />
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">Date:</span> {formatDisplayDate(encounter.appointmentDate)} at{" "}
              {formatDisplayTime(encounter.appointmentTime)}
            </p>
            <p>
              <span className="font-medium">Provider:</span> {encounter.providerName}
            </p>
            {encounter.appointmentType && (
              <p>
                <span className="font-medium">Type:</span> {encounter.appointmentType}
              </p>
            )}
            <p>
              <span className="font-medium">Encounter ID:</span>{" "}
              <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">{encounter.encounterId}</code>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Payer</p>
            <p className="text-sm font-medium text-gray-900">{encounter.payerName}</p>
            {encounter.memberId && (
              <p className="text-xs text-gray-600 font-mono">{encounter.memberId}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Eligibility</p>
            <ScheduleStatusBadge label={eligibilityBadge.label} tone={eligibilityBadge.tone} />
            {encounter.eligibility.checkedAt && (
              <p className="text-xs text-gray-600 mt-1">
                Checked {new Date(encounter.eligibility.checkedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Claim Status</p>
            <ScheduleStatusBadge label={claimBadge.label} tone={claimBadge.tone} />
            {encounter.claim && (
              <p className="text-xs text-gray-600 font-mono mt-1">{encounter.claim.claimNumber}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
