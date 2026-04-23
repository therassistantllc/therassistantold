import { ClaimInfo } from "@/lib/types/encounter";
import { formatCurrency } from "@/lib/utils/schedule";
import ScheduleStatusBadge from "@/components/scheduling/ScheduleStatusBadge";

interface ClaimPanelProps {
  claim: ClaimInfo | null;
  canCreateClaim: boolean;
  blockers: string[];
  onCreateClaim: () => void;
  onOpenClaim: () => void;
  isCreating: boolean;
}

function getClaimStatusBadge(status: string) {
  switch (status) {
    case "paid":
    case "accepted":
      return { label: status.replace(/_/g, " ").toUpperCase(), tone: "success" as const };
    case "submitted":
    case "ready_to_submit":
      return { label: status.replace(/_/g, " ").toUpperCase(), tone: "info" as const };
    case "rejected":
    case "denied":
      return { label: status.replace(/_/g, " ").toUpperCase(), tone: "danger" as const };
    default:
      return { label: status.replace(/_/g, " ").toUpperCase(), tone: "neutral" as const };
  }
}

export default function ClaimPanel({
  claim,
  canCreateClaim,
  blockers,
  onCreateClaim,
  onOpenClaim,
  isCreating,
}: ClaimPanelProps) {
  if (claim) {
    const statusBadge = getClaimStatusBadge(claim.status);

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Claim</h2>
          <ScheduleStatusBadge label={statusBadge.label} tone={statusBadge.tone} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Claim Number:</span>
            <span className="font-mono text-sm font-medium text-gray-900">{claim.claimNumber}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Created:</span>
            <span className="text-sm text-gray-900">
              {new Date(claim.createdAt).toLocaleString()}
            </span>
          </div>

          {claim.submittedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Submitted:</span>
              <span className="text-sm text-gray-900">
                {new Date(claim.submittedAt).toLocaleString()}
              </span>
            </div>
          )}

          {claim.billedAmount !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Billed Amount:</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(claim.billedAmount)}</span>
            </div>
          )}

          <div className="pt-3 border-t border-gray-200">
            <button
              onClick={onOpenClaim}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Open Claim Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Claim</h2>
        <ScheduleStatusBadge label="NO CLAIM" tone="neutral" />
      </div>

      <div className="space-y-4">
        {!canCreateClaim && blockers.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm font-semibold text-red-800 mb-2">Cannot create claim:</p>
            <ul className="space-y-1">
              {blockers.map((blocker, index) => (
                <li key={index} className="text-sm text-red-700 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canCreateClaim && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm font-semibold text-green-800">
              ✓ All requirements met. Ready to create claim.
            </p>
          </div>
        )}

        <button
          onClick={onCreateClaim}
          disabled={!canCreateClaim || isCreating}
          className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            canCreateClaim && !isCreating
              ? "text-white bg-blue-600 hover:bg-blue-700"
              : "text-gray-400 bg-gray-100 cursor-not-allowed"
          }`}
        >
          {isCreating ? "Creating Claim..." : "Create Claim"}
        </button>

        {!canCreateClaim && (
          <p className="text-xs text-center text-gray-500">
            Complete all requirements above to enable claim creation
          </p>
        )}
      </div>
    </div>
  );
}
