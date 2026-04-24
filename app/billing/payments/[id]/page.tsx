"use client";

import { use } from "react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

interface PaymentDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const { id } = use(params);

  // Mock payment data - in real app, fetch based on id
  const payment = {
    id: id,
    checkNumber: "CHK-123456",
    amount: 1250.00,
    receivedDate: "2026-04-15",
    paymentMethod: "EFT",
    payer: "Anthem BCBS",
    deposited: true,
    depositDate: "2026-04-16",
    bankAccount: "****4567",
    claimsPaid: [
      {
        claimNumber: "CLM-2024-0042",
        patient: "Sarah Johnson",
        dos: "2026-03-15",
        billed: 150.00,
        paid: 120.00,
        adjustment: 30.00
      },
      {
        claimNumber: "CLM-2024-0038",
        patient: "Michael Davis",
        dos: "2026-03-12",
        billed: 200.00,
        paid: 180.00,
        adjustment: 20.00
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title={`Payment ${payment.checkNumber}`}
          subtitle={`Received ${payment.receivedDate}`}
          actions={
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
                Export
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Edit Payment
              </button>
            </div>
          }
        />

        {/* Payment Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Payment Amount
              </label>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                ${payment.amount.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Payment Method
              </label>
              <div className="text-lg font-semibold text-gray-700 mt-1">
                {payment.paymentMethod}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Payer
              </label>
              <div className="text-lg font-semibold text-gray-700 mt-1">
                {payment.payer}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Status
              </label>
              <div className="mt-1">
                <StatusBadge 
                  status={payment.deposited ? "DEPOSITED" : "PENDING"} 
                  variant={payment.deposited ? "success" : "warning"}
                />
              </div>
            </div>
          </div>

          {payment.deposited && (
            <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-200">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Deposit Date
                </label>
                <div className="text-sm text-gray-900 mt-1">
                  {payment.depositDate}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Bank Account
                </label>
                <div className="text-sm font-mono text-gray-900 mt-1">
                  {payment.bankAccount}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Claims Paid */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Claims Paid ({payment.claimsPaid.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Claim Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    DOS
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Billed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Adjustment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payment.claimsPaid.map((claim, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-gray-900">
                        {claim.claimNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{claim.patient}</td>
                    <td className="px-4 py-3 text-gray-900">{claim.dos}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900">
                      ${claim.billed.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">
                      ${claim.paid.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      ${claim.adjustment.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900">
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                    ${payment.claimsPaid.reduce((sum, c) => sum + c.billed, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">
                    ${payment.claimsPaid.reduce((sum, c) => sum + c.paid, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                    ${payment.claimsPaid.reduce((sum, c) => sum + c.adjustment, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
