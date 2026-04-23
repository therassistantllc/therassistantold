import { Claim } from "@/lib/types/claim";

interface FinancialSummaryProps {
  claim: Claim;
}

export default function FinancialSummary({ claim }: FinancialSummaryProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Claim Financial Summary</h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4">
          {/* Total Charges */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
              Total Charges
            </div>
            <div className="text-2xl font-bold text-blue-900">
              ${claim.total_charges.toFixed(2)}
            </div>
          </div>
          
          {/* Total Allowed */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">
              Total Allowed
            </div>
            <div className="text-2xl font-bold text-purple-900">
              ${claim.total_allowed_amount?.toFixed(2) || "0.00"}
            </div>
          </div>
          
          {/* Insurance Paid */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">
              Insurance Paid
            </div>
            <div className="text-2xl font-bold text-green-900">
              ${claim.total_insurance_paid?.toFixed(2) || "0.00"}
            </div>
          </div>
          
          {/* Patient Paid */}
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1">
              Patient Paid
            </div>
            <div className="text-2xl font-bold text-orange-900">
              ${claim.total_patient_paid?.toFixed(2) || "0.00"}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-4 mt-4">
          {/* Insurance Balance */}
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-xs font-medium text-yellow-700 uppercase tracking-wide mb-1">
              Insurance Balance
            </div>
            <div className="text-2xl font-bold text-yellow-900">
              ${claim.remaining_insurance_balance?.toFixed(2) || "0.00"}
            </div>
          </div>
          
          {/* Patient Balance */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">
              Patient Balance
            </div>
            <div className="text-2xl font-bold text-red-900">
              ${claim.remaining_patient_balance?.toFixed(2) || "0.00"}
            </div>
          </div>
          
          {/* Write-Off */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
              Write-Off
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${claim.write_off_amount?.toFixed(2) || "0.00"}
            </div>
          </div>
          
          {/* Adjustments */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
              Adjustments
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${claim.adjustment_amount?.toFixed(2) || "0.00"}
            </div>
          </div>
        </div>
        
        {/* Additional Financial Details */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Overpayment Amount
              </label>
              <input
                type="number"
                value={claim.overpayment_amount || ""}
                readOnly
                placeholder="$0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Refund Due
              </label>
              <input
                type="number"
                value={claim.refund_due || ""}
                readOnly
                placeholder="$0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Recoupment Status
              </label>
              <select
                value={claim.recoupment_status ? "yes" : "no"}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Last Payment Date
              </label>
              <input
                type="date"
                value={claim.last_payment_date || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Payment Source
              </label>
              <input
                type="text"
                value={claim.payment_source || ""}
                readOnly
                placeholder="e.g., ERA, Manual"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Linked ERA Number
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={claim.linked_era_number || ""}
                  readOnly
                  placeholder="N/A"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
                <button className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200">
                  View ERA
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
