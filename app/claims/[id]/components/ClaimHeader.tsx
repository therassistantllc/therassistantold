import { Claim } from "@/lib/types/claim";

interface ClaimHeaderProps {
  claim: Claim;
}

export default function ClaimHeader({ claim }: ClaimHeaderProps) {
  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    ready_to_submit: "bg-blue-100 text-blue-800",
    submitted: "bg-purple-100 text-purple-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    denied: "bg-red-100 text-red-800",
    paid: "bg-green-100 text-green-800",
    partially_paid: "bg-yellow-100 text-yellow-800",
    appealed: "bg-orange-100 text-orange-800",
    void: "bg-gray-100 text-gray-800",
    corrected: "bg-blue-100 text-blue-800",
    pending_review: "bg-yellow-100 text-yellow-800"
  };

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Claim Info */}
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{claim.claim_number}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[claim.status]}`}>
                  {claim.status.replace(/_/g, " ").toUpperCase()}
                </span>
                <span>Submitted: {claim.submission_date || "Not submitted"}</span>
                <span>DOS: {claim.dos_from} - {claim.dos_to}</span>
              </div>
            </div>
            
            <div className="border-l border-gray-200 pl-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Insurance</div>
              <div className="font-medium text-gray-900">{claim.primary_insurance.payer_name}</div>
            </div>
            
            <div className="border-l border-gray-200 pl-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Patient</div>
              <div className="font-medium text-gray-900">{claim.patient.first_name} {claim.patient.last_name}</div>
            </div>
            
            <div className="border-l border-gray-200 pl-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Provider</div>
              <div className="font-medium text-gray-900">{claim.billing_provider.name}</div>
            </div>
          </div>
          
          {/* Right: Quick Actions */}
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Save Draft
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Submit Claim
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Mark as Corrected
            </button>
            <button className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50">
              Void Claim
            </button>
            
            <div className="border-l border-gray-200 h-8 mx-2"></div>
            
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Print CMS-1500
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Export PDF
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Add Note
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Route to Biller
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              View ERA
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Claim History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
