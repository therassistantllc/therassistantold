import { Claim } from "@/lib/types/claim";

interface ClaimOverviewCardProps {
  claim: Claim;
}

export default function ClaimOverviewCard({ claim }: ClaimOverviewCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Claim Overview</h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Column 1 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Claim Number
              </label>
              <input
                type="text"
                value={claim.claim_number}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Original Claim Number
              </label>
              <input
                type="text"
                value={claim.original_claim_number || ""}
                readOnly
                placeholder="N/A"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Claim Frequency Type
              </label>
              <select
                value={claim.frequency_type}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="1">1 - Original</option>
                <option value="7">7 - Replacement</option>
                <option value="8">8 - Void</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Claim Status
              </label>
              <select
                value={claim.status}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="draft">Draft</option>
                <option value="ready_to_submit">Ready to Submit</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="denied">Denied</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Claim Source
              </label>
              <input
                type="text"
                value={claim.source}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Claim Priority
              </label>
              <select
                value={claim.priority}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
            </div>
          </div>
          
          {/* Column 2 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Place of Service
              </label>
              <select
                value={claim.service_lines[0]?.place_of_service || "02"}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="02">02 - Telehealth</option>
                <option value="11">11 - Office</option>
                <option value="12">12 - Home</option>
                <option value="21">21 - Inpatient Hospital</option>
                <option value="22">22 - Outpatient Hospital</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Billing Provider
              </label>
              <input
                type="text"
                value={claim.billing_provider.name}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Rendering Provider
              </label>
              <input
                type="text"
                value={claim.rendering_provider?.name || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Referring Provider
              </label>
              <input
                type="text"
                value={claim.referring_provider?.name || ""}
                readOnly
                placeholder="N/A"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Supervising Provider
              </label>
              <input
                type="text"
                value={claim.supervising_provider?.name || ""}
                readOnly
                placeholder="N/A"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Service Location
              </label>
              <input
                type="text"
                value={claim.service_location?.street || claim.billing_provider.address?.street || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
          </div>
          
          {/* Column 3 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Taxonomy Code
              </label>
              <input
                type="text"
                value={claim.billing_provider.taxonomy_code || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Billing Provider NPI
              </label>
              <input
                type="text"
                value={claim.billing_provider.npi}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                EIN / Tax ID
              </label>
              <input
                type="text"
                value={claim.billing_provider.ein || ""}
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
                value={claim.primary_insurance.group_number || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Authorization Number
              </label>
              <input
                type="text"
                value={claim.authorization_number || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Referral Number
              </label>
              <input
                type="text"
                value={claim.referral_number || ""}
                readOnly
                placeholder="N/A"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
