"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import TabNavigation from "@/components/ui/TabNavigation";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable, { Column } from "@/components/ui/DataTable";

interface Payment {
  id: string;
  paymentId: string;
  type: string;
  insurance: string;
  amount: number;
  posted: number;
  remaining: number;
  status: string;
  depositDate: string;
}

export default function PaymentCenterPage() {
  const [activeTab, setActiveTab] = useState("unposted");
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());

  // Mock data
  const mockPayments: Payment[] = [
    { id: "1", paymentId: "PAY-2024-0123", type: "ERA", insurance: "Anthem BCBS", amount: 1250, posted: 0, remaining: 1250, status: "unposted", depositDate: "2026-04-20" },
    { id: "2", paymentId: "PAY-2024-0122", type: "CHK", insurance: "UnitedHealthcare", amount: 800, posted: 0, remaining: 800, status: "unposted", depositDate: "2026-04-19" },
    { id: "3", paymentId: "PAY-2024-0121", type: "EFT", insurance: "Cigna", amount: 1500, posted: 1500, remaining: 0, status: "posted", depositDate: "2026-04-18" },
  ];

  const tabs = [
    { id: "unposted", label: "Unposted", href: "/billing/payments?tab=unposted", count: 23 },
    { id: "posted", label: "Posted", href: "/billing/payments?tab=posted", count: 345 },
    { id: "era-imports", label: "ERA Imports", href: "/billing/payments?tab=era-imports", count: 12 },
    { id: "eft-chk", label: "EFT/CHK", href: "/billing/payments?tab=eft-chk", count: 8 },
    { id: "refunds", label: "Refunds", href: "/billing/payments?tab=refunds", count: 5 },
    { id: "recoupments", label: "Recoupments", href: "/billing/payments?tab=recoupments", count: 3, badge: "!" },
    { id: "overpayments", label: "Overpayments", href: "/billing/payments?tab=overpayments", count: 7 }
  ];

  const columns: Column<Payment>[] = [
    { 
      header: "Payment ID", 
      accessor: "paymentId",
      cell: (row) => (
        <span className="text-blue-600 hover:text-blue-700 font-mono font-medium cursor-pointer">
          {row.paymentId}
        </span>
      )
    },
    { 
      header: "Type", 
      accessor: "type",
      cell: (row) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
          {row.type}
        </span>
      )
    },
    { header: "Insurance", accessor: "insurance" },
    { 
      header: "Amount", 
      accessor: "amount",
      cell: (row) => <span className="font-mono">${row.amount.toFixed(2)}</span>
    },
    { 
      header: "Posted", 
      accessor: "posted",
      cell: (row) => <span className="font-mono text-green-700">${row.posted.toFixed(2)}</span>
    },
    { 
      header: "Remaining", 
      accessor: "remaining",
      cell: (row) => <span className="font-mono font-medium text-yellow-700">${row.remaining.toFixed(2)}</span>
    },
    {
      header: "Status",
      accessor: "status",
      cell: (row) => (
        <StatusBadge 
          status={row.status.toUpperCase()} 
          variant={row.status === "posted" ? "success" : "warning"}
          size="sm"
        />
      )
    },
    { header: "Deposit Date", accessor: "depositDate" }
  ];

  const togglePayment = (id: string) => {
    const newSelected = new Set(selectedPayments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPayments(newSelected);
  };

  const toggleAll = () => {
    if (selectedPayments.size === mockPayments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(mockPayments.map(p => p.id)));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Payment Center"
        subtitle="Manage all payment posting and reconciliation"
        actions={
          <>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Import ERA
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Manual Payment
            </button>
          </>
        }
        breadcrumbs={[
          { label: "Billing", href: "/billing" },
          { label: "Payment Center" }
        ]}
      />

      {/* KPI Cards */}
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="grid grid-cols-6 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-yellow-600 uppercase tracking-wide">Unposted</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">23</div>
            <div className="text-xs text-gray-600 mt-1">$28,750</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-green-600 uppercase tracking-wide">Posted Today</div>
            <div className="text-2xl font-bold text-green-900 mt-1">45</div>
            <div className="text-xs text-gray-600 mt-1">$67,200</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-blue-600 uppercase tracking-wide">ERA Imports</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">12</div>
            <div className="text-xs text-gray-600 mt-1">Pending review</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-orange-600 uppercase tracking-wide">Needs Review</div>
            <div className="text-2xl font-bold text-orange-900 mt-1">15</div>
            <div className="text-xs text-gray-600 mt-1">Requires attention</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-purple-600 uppercase tracking-wide">Overpayments</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">7</div>
            <div className="text-xs text-gray-600 mt-1">$2,450</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-red-600 uppercase tracking-wide">Recoupments</div>
            <div className="text-2xl font-bold text-red-900 mt-1">3</div>
            <div className="text-xs text-gray-600 mt-1">$1,200</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-[1800px] mx-auto px-6">
        <TabNavigation tabs={tabs} activeTab={activeTab} />
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Filter Sidebar */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Filters</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Date Range</label>
                  <input type="date" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2" />
                  <input type="date" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Payment Type</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">ERA</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">EFT</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">Check</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm text-gray-700">Virtual Card</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Insurance</label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option>All Insurance</option>
                    <option>Anthem BCBS</option>
                    <option>UnitedHealthcare</option>
                    <option>Cigna</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Posting Status</label>
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
                      <span className="text-sm text-gray-700">Fully Posted</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-700">Needs Review</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Assigned Staff</label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option>All Staff</option>
                    <option>John Doe</option>
                    <option>Jane Smith</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  Apply Filters
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Payments Table */}
          <div className="flex-1 space-y-4">
            {/* Bulk Actions */}
            {selectedPayments.size > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedPayments.size} payments selected
                  </span>
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
                  </div>
                </div>
              </div>
            )}

            {/* Data Table */}
            <DataTable
              data={mockPayments}
              columns={columns}
              selectable
              selectedRows={selectedPayments}
              onSelectRow={togglePayment}
              onSelectAll={toggleAll}
            />
          </div>

          {/* Right Summary Sidebar */}
          <div className="w-80 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-24 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Payments</span>
                    <span className="text-lg font-bold text-gray-900">{mockPayments.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Amount</span>
                    <span className="text-lg font-bold text-gray-900">
                      ${mockPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Unposted</span>
                    <span className="text-lg font-bold text-yellow-900">
                      ${mockPayments.reduce((sum, p) => sum + p.remaining, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                    Auto-Match Payments
                  </button>
                  <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    Import ERA File
                  </button>
                  <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    Export Report
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Alerts</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-xs font-medium text-yellow-900">23 Unposted Payments</div>
                    <div className="text-xs text-yellow-700 mt-1">$28,750 pending</div>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-xs font-medium text-orange-900">15 Need Review</div>
                    <div className="text-xs text-orange-700 mt-1">Matching issues detected</div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Posting Activity</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Today</span>
                    <span className="font-medium text-gray-900">45 payments</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">This Week</span>
                    <span className="font-medium text-gray-900">234 payments</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">This Month</span>
                    <span className="font-medium text-gray-900">1,456 payments</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
