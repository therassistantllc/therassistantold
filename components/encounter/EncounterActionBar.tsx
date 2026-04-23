interface EncounterActionBarProps {
  onOpenClient: () => void;
  onOpenNote: () => void;
  onCheckEligibility: () => void;
  onRouteToBiller: () => void;
  onCollect: () => void;
  onClaimAction: () => void;
  claimExists: boolean;
  isLoading?: boolean;
  loadingAction?: string;
}

export default function EncounterActionBar({
  onOpenClient,
  onOpenNote,
  onCheckEligibility,
  onRouteToBiller,
  onCollect,
  onClaimAction,
  claimExists,
  isLoading,
  loadingAction,
}: EncounterActionBarProps) {
  return (
    <div className="bg-white border-t border-gray-200 px-6 py-4 sticky bottom-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onOpenClient}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Open Client
        </button>

        <button
          onClick={onOpenNote}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Open Note
        </button>

        <button
          onClick={onCheckEligibility}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingAction === "eligibility" ? "Checking..." : "Check Eligibility"}
        </button>

        <button
          onClick={onRouteToBiller}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingAction === "ticket" ? "Creating Ticket..." : "Route to Biller"}
        </button>

        <button
          onClick={onCollect}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100 disabled:opacity-50"
        >
          Collect Payment
        </button>

        <div className="ml-auto">
          <button
            onClick={onClaimAction}
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loadingAction === "claim" 
              ? claimExists 
                ? "Opening..." 
                : "Creating..."
              : claimExists 
                ? "Open Claim" 
                : "Create Claim"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
