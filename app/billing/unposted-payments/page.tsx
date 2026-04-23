"use client";

import { useState } from "react";
import { getMockUnpostedPayments } from "@/lib/data/mock-billing";
import { UnpostedPayment } from "@/lib/types/billing";
import PaymentDetailDrawer from "./components/PaymentDetailDrawer";

export default function UnpostedPaymentsPage() {
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<UnpostedPayment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const payments = getMockUnpostedPayments();
  
  const togglePayment = (paymentId: string) => {
    setSelectedPayments(prev =>
      prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };
  
  const toggleAll = () => {
    if (selectedPayments.length === payments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(payments.map(p => p.id));
    }
  };
  
  const openPaymentDetail = (payment: UnpostedPayment) => {
    setSelectedPayment(payment);
    setDrawerOpen(true);
  };
  
  const statusColors: Record<string, string> = {
    unposted: "bg-yellow-100 text-yellow-800",
    partially_posted: "bg-blue-100 text-blue-800",
    fully_posted: "bg-green-100 text-green-800",
    needs_review: "bg-red-100 text-red-800",
    missing_claim_match: "bg-orange-100 text-orange-800",
    missing_patient_match: "bg-orange-100 text-orange-800",
    overpayment_detected: "bg-purple-100 text-purple-800",
    underpayment_detected: "bg-purple-100 text-purple-800",
    recoupment_detected: "bg-red-100 text-red-800"
  };
  
  const totalUnposted = payments.reduce((sum, p) => sum + p.remaining_amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Unposted Payments</h1>
              <p className="text-sm text-gray-600 mt-1">
                {payments.length} payments awaiting posting • ${totalUnposted.toFixed(2)} total
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Import ERA
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Manual Payment
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Post Selected
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
                    Payment Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">ERA</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">Check</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">EFT</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">Virtual Card</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Posting Status
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">Unposted</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-700">Partially Posted</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-700">Needs Review</span>
                    </label>
                  </div>
                </div>
                
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
                    Deposit Date
                  </label>
                  <input type="date" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
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
                    checked={selectedPayments.length === payments.length}
                    onChange={toggleAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedPayments.length} selected
                  </span>
                </div>
                
                {selectedPayments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                      Post Selected
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Match Claims
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Assign Staff
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Mark for Review
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Export Data
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Payments Table */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left"><input type="checkbox" checked={selectedPayments.length === payments.length} onChange={toggleAll} className="w-4 h-4" /></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ERA/Check #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deposit Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posted</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matched</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => openPaymentDetail(payment)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedPayments.includes(payment.id)}
                            onChange={() => togglePayment(payment.id)}
                            className="w-4 h-4 text-blue-600"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 font-mono">{payment.payment_id}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">{payment.era_number || payment.check_number || payment.eft_number || "N/A"}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            {payment.payment_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{payment.insurance_company}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{payment.deposit_date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">${payment.payment_amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">${payment.posted_amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono font-medium">${payment.remaining_amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {payment.claims_matched > 0 ? (
                            <span className="text-green-600 font-medium">{payment.claims_matched}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                          {payment.claims_unmatched > 0 && (
                            <span className="text-red-600 ml-1">({payment.claims_unmatched} unmatched)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[payment.posting_status]}`}>
                            {payment.posting_status.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{payment.assigned_staff_name || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Right Summary Panel */}
          <div className="w-80 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Payment Summary</h3>
              
              <div className="space-y-4">
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="text-xs font-medium text-yellow-700 uppercase tracking-wide mb-1">
                    Unposted Amount
                  </div>
                  <div className="text-2xl font-bold text-yellow-900">
                    ${totalUnposted.toFixed(2)}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Payments</span>
                  <span className="text-lg font-bold text-gray-900">{payments.length}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Needs Review</span>
                  <span className="text-lg font-bold text-red-900">
                    {payments.filter(p => p.posting_status === "needs_review").length}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Missing Matches</span>
                  <span className="text-lg font-bold text-orange-900">
                    {payments.filter(p => p.posting_status.includes("missing")).length}
                  </span>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-2">By Payment Type</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ERA</span>
                      <span className="text-gray-900">{payments.filter(p => p.payment_type === "ERA").length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Check</span>
                      <span className="text-gray-900">{payments.filter(p => p.payment_type === "CHK").length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Payment Detail Drawer */}
      {selectedPayment && (
        <PaymentDetailDrawer
          payment={selectedPayment}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
