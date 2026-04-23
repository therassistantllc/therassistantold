import { UnpostedPayment } from "@/lib/types/billing";

interface PaymentDetailDrawerProps {
  payment: UnpostedPayment;
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentDetailDrawer({ payment, isOpen, onClose }: PaymentDetailDrawerProps) {
  if (!isOpen) return null;
  
  const matchConfidenceColors: Record<string, string> = {
    exact: "bg-green-100 text-green-800",
    high: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-orange-100 text-orange-800",
    no_match: "bg-red-100 text-red-800"
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[800px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
            <p className="text-sm text-gray-600 mt-1">{payment.payment_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Payment Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Payment Type</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{payment.payment_type}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">ERA Number</div>
                <div className="text-sm font-medium text-gray-900 mt-1 font-mono">{payment.era_number || "N/A"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Insurance Company</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{payment.insurance_company}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Payer ID</div>
                <div className="text-sm font-medium text-gray-900 mt-1 font-mono">{payment.payer_id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Deposit Date</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{payment.deposit_date}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Payment Method</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{payment.payment_method || "N/A"}</div>
              </div>
            </div>
          </div>
          
          {/* Financial Summary */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Financial Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-xs text-blue-700 uppercase tracking-wide">Payment Amount</div>
                <div className="text-xl font-bold text-blue-900 mt-1">${payment.payment_amount.toFixed(2)}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-xs text-green-700 uppercase tracking-wide">Posted</div>
                <div className="text-xl font-bold text-green-900 mt-1">${payment.posted_amount.toFixed(2)}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                <div className="text-xs text-yellow-700 uppercase tracking-wide">Remaining</div>
                <div className="text-xl font-bold text-yellow-900 mt-1">${payment.remaining_amount.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          {/* Matched Claims */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Matched Claims ({payment.matched_claims.length})</h3>
              <button className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100">
                Auto-Match More
              </button>
            </div>
            
            <div className="space-y-3">
              {payment.matched_claims.map((match) => (
                <div key={match.claim_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-gray-900">{match.claim_number}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${matchConfidenceColors[match.match_confidence]}`}>
                          {match.match_confidence.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{match.patient_name} • DOS: {match.dos}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Match Score</div>
                      <div className="text-sm font-bold text-gray-900">{match.match_score}%</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Billed</div>
                      <div className="text-sm font-medium text-gray-900">${match.billed_amount.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Allowed</div>
                      <div className="text-sm font-medium text-gray-900">${match.allowed_amount.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Paid</div>
                      <div className="text-sm font-medium text-green-900">${match.paid_amount.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Patient Resp.</div>
                      <div className="text-sm font-medium text-orange-900">${match.patient_responsibility.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  {match.adjustments.length > 0 && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">Adjustments</div>
                      <div className="space-y-1">
                        {match.adjustments.map((adj, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">
                              <span className="font-mono font-medium">{adj.carc_code}</span>
                              {adj.rarc_code && <span className="ml-1 font-mono">({adj.rarc_code})</span>}
                              {" - "}{adj.adjustment_reason}
                            </span>
                            <span className="font-medium text-gray-900">-${adj.adjustment_amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-3">
                    <button className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                      Post Payment
                    </button>
                    <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      View Claim
                    </button>
                    <button className="px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50">
                      Unmatch
                    </button>
                  </div>
                </div>
              ))}
              
              {payment.matched_claims.length === 0 && (
                <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                  <p className="text-sm text-gray-500">No claims matched yet</p>
                  <button className="mt-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100">
                    Search for Claims
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                Post All Matched
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Split Payment
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Add Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
