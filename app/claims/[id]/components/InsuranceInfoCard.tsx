import { Insurance } from "@/lib/types/claim";

interface InsuranceInfoCardProps {
  primaryInsurance: Insurance;
  secondaryInsurance?: Insurance;
}

export default function InsuranceInfoCard({ primaryInsurance, secondaryInsurance }: InsuranceInfoCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Subscriber / Insurance Information</h2>
      </div>
      
      <div className="p-6">
        {/* Primary Insurance */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Primary Insurance</h3>
          <div className="grid grid-cols-3 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Insurance Name
                </label>
                <input
                  type="text"
                  value={primaryInsurance.payer_name}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Payer ID
                </label>
                <input
                  type="text"
                  value={primaryInsurance.payer_id}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Member ID
                </label>
                <input
                  type="text"
                  value={primaryInsurance.member_id}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Group Number
                </label>
                <input
                  type="text"
                  value={primaryInsurance.group_number || ""}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Plan Type
                </label>
                <input
                  type="text"
                  value={primaryInsurance.plan_type || ""}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
            </div>
            
            {/* Column 2 */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Policy Holder Name
                </label>
                <input
                  type="text"
                  value={primaryInsurance.policy_holder_name || ""}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Policy Holder DOB
                </label>
                <input
                  type="date"
                  value={primaryInsurance.policy_holder_dob || ""}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Policy Holder Relationship
                </label>
                <select
                  value={primaryInsurance.policy_holder_relationship || ""}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Select</option>
                  <option value="self">Self</option>
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={primaryInsurance.effective_date || ""}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Termination Date
                </label>
                <input
                  type="date"
                  value={primaryInsurance.termination_date || ""}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
            </div>
            
            {/* Column 3 */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Copay
                </label>
                <input
                  type="number"
                  value={primaryInsurance.copay || ""}
                  readOnly
                  placeholder="$0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Coinsurance (%)
                </label>
                <input
                  type="number"
                  value={primaryInsurance.coinsurance || ""}
                  readOnly
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Deductible
                </label>
                <input
                  type="number"
                  value={primaryInsurance.deductible || ""}
                  readOnly
                  placeholder="$0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Eligibility Status
                </label>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-2 rounded-lg text-sm font-medium flex-1 text-center ${
                    primaryInsurance.eligibility_status === "active" 
                      ? "bg-green-100 text-green-800"
                      : primaryInsurance.eligibility_status === "inactive"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {primaryInsurance.eligibility_status?.toUpperCase() || "UNKNOWN"}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Eligibility Last Verified
                </label>
                <input
                  type="date"
                  value={primaryInsurance.eligibility_last_verified || ""}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              
              <div>
                <button className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200">
                  View Eligibility Report
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Secondary Insurance (Optional) */}
        {secondaryInsurance && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Secondary Insurance</h3>
            <div className="text-sm text-gray-500">Secondary insurance configuration coming soon.</div>
          </div>
        )}
      </div>
    </div>
  );
}
