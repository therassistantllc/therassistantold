"use client";

import { useState } from "react";
import { getReadyClaimsList } from "@/lib/data/mock-billing";
import { getMockClaim } from "@/lib/data/mock-claims";
import Link from "next/link";

export default function ReadyToSubmitPage() {
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const readyClaims = getReadyClaimsList();
  
  const toggleClaim = (claimId: string) => {
    setSelectedClaims(prev => 
      prev.includes(claimId) 
        ? prev.filter(id => id !== claimId)
        : [...prev, claimId]
    );
  };
  
  const toggleAll = () => {
    if (selectedClaims.length === readyClaims.length) {
      setSelectedClaims([]);
    } else {
      setSelectedClaims(readyClaims.map(c => c.claim_id));
    }
  };
  
  const totalSelectedAmount = selectedClaims.length * 350; // Mock calculation

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ready to Submit</h1>
              <p className="text-sm text-gray-600 mt-1">
                {readyClaims.length} claims ready for submission
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Export Selected
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Submit {selectedClaims.length} Claims
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Left Filter Panel */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Filters</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Insurance Company
                  </label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option>All</option>
                    <option>Anthem BCBS</option>
                    <option>UnitedHealthcare</option>
                    <option>Cigna</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Provider
                  </label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option>All Providers</option>
                    <option>Dr. Martinez</option>
                    <option>Dr. Chen</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Validation Status
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">Ready (No Issues)</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">Has Warnings</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Aging Days
                  </label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option>All</option>
                    <option>0-7 days</option>
                    <option>8-14 days</option>
                    <option>15+ days</option>
                  </select>
                </div>
                
                <button className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                  Apply Filters
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Reset
                </button>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="flex-1 space-y-4">
            {/* Bulk Actions Toolbar */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedClaims.length === readyClaims.length}
                    onChange={toggleAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedClaims.length} selected
                  </span>
                </div>
                
                {selectedClaims.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Route to Biller
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Mark as Hold
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Add Note
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Assign Staff
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Claims Table */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left"><input type="checkbox" checked={selectedClaims.length === readyClaims.length} onChange={toggleAll} className="w-4 h-4" /></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claim ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DOS</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPT</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charge</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aging</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {readyClaims.map((validation) => {
                      const claim = getMockClaim(validation.claim_id);
                      return (
                        <tr key={validation.claim_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedClaims.includes(validation.claim_id)}
                              onChange={() => toggleClaim(validation.claim_id)}
                              className="w-4 h-4 text-blue-600"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/claims/${validation.claim_id}`} className="text-blue-600 hover:text-blue-800 font-mono text-sm">
                              {claim.claim_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{claim.patient.first_name} {claim.patient.last_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{claim.dos_from}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{claim.primary_insurance.payer_name.slice(0, 20)}...</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{claim.rendering_provider?.name.slice(0, 15)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-mono">{claim.service_lines.map(l => l.cpt_code).join(", ")}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-mono">${claim.total_charges.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            {validation.has_errors ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Error</span>
                            ) : validation.has_warnings ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Warning</span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Ready</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{validation.validation_score}%</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{validation.aging_days}d</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Right Summary Panel */}
          <div className="w-80 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Submission Summary</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Claims Selected</span>
                  <span className="text-lg font-bold text-gray-900">{selectedClaims.length}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="text-lg font-bold text-gray-900">${totalSelectedAmount.toFixed(2)}</span>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-2">Insurance Breakdown</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Anthem BCBS</span>
                      <span className="text-gray-900">{selectedClaims.length}</span>
                    </div>
                  </div>
                </div>
                
                {selectedClaims.length > 0 && (
                  <>
                    <button className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                      Submit {selectedClaims.length} Claims
                    </button>
                    
                    <div className="text-xs text-gray-500 text-center">
                      Claims will be submitted to Office Ally clearinghouse
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
