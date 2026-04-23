import { Claim } from "@/lib/types/claim";

interface StickyClaimSidebarProps {
  claim: Claim;
}

export default function StickyClaimSidebar({ claim }: StickyClaimSidebarProps) {
  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    ready_to_submit: "bg-blue-100 text-blue-800",
    submitted: "bg-purple-100 text-purple-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    denied: "bg-red-100 text-red-800",
    paid: "bg-green-100 text-green-800",
    partially_paid: "bg-yellow-100 text-yellow-800"
  };
  
  const agingColors: Record<string, string> = {
    "0-30": "text-green-700",
    "31-60": "text-yellow-700",
    "61-90": "text-orange-700",
    "91-120": "text-red-700",
    "120+": "text-red-900"
  };

  return (
    <div className="w-80 shrink-0">
      <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-24 space-y-6">
        {/* Claim Status */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Claim Status
          </h3>
          <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${statusColors[claim.status]}`}>
            {claim.status.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
        
        {/* Aging */}
        {claim.aging_bucket && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Aging Bucket
            </h3>
            <span className={`text-2xl font-bold ${agingColors[claim.aging_bucket]}`}>
              {claim.aging_bucket} days
            </span>
          </div>
        )}
        
        {/* Balance */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Balance
          </h3>
          <div className="text-2xl font-bold text-gray-900">
            ${(claim.remaining_insurance_balance || 0) + (claim.remaining_patient_balance || 0)}
          </div>
        </div>
        
        {/* Last Activity */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Last Activity
          </h3>
          <div className="text-sm text-gray-900">
            {claim.last_activity ? new Date(claim.last_activity).toLocaleDateString() : "N/A"}
          </div>
        </div>
        
        {/* Assigned Biller */}
        {claim.assigned_biller_name && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Assigned Biller
            </h3>
            <div className="text-sm text-gray-900">{claim.assigned_biller_name}</div>
          </div>
        )}
        
        {/* Due Date */}
        {claim.due_date && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Due Date
            </h3>
            <div className="text-sm text-gray-900">{claim.due_date}</div>
          </div>
        )}
        
        {/* Open Tickets */}
        {claim.open_tickets !== undefined && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Open Tickets
            </h3>
            <div className="text-2xl font-bold text-gray-900">{claim.open_tickets}</div>
          </div>
        )}
        
        {/* Eligibility Status */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Eligibility Status
          </h3>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            claim.primary_insurance.eligibility_status === "active" 
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}>
            {claim.primary_insurance.eligibility_status?.toUpperCase() || "UNKNOWN"}
          </span>
        </div>
        
        {/* Alerts */}
        {claim.alerts && claim.alerts.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Alerts
            </h3>
            <div className="space-y-2">
              {claim.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`px-3 py-2 rounded-lg text-xs ${
                    alert.severity === "error"
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : alert.severity === "warning"
                      ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                      : "bg-blue-50 text-blue-800 border border-blue-200"
                  }`}
                >
                  <div className="font-medium mb-1">
                    {alert.type.replace(/_/g, " ").toUpperCase()}
                  </div>
                  <div>{alert.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Quick Actions */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
              Verify Eligibility
            </button>
            <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Call Payer
            </button>
            <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Create Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
