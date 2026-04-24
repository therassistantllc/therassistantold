"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import TabNavigation from "@/components/ui/TabNavigation";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable, { Column } from "@/components/ui/DataTable";

interface Claim {
  id: string;
  claimNumber: string;
  patient: string;
  dos: string;
  provider: string;
  insurance: string;
  amount: number;
  status: string;
  aging: number;
}

export default function ClaimCenterPage() {
  const [activeTab, setActiveTab] = useState("ready");
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set());

  // Mock data
  const mockClaims: Claim[] = [
    { id: "11111111-1111-1111-1111-111111111111", claimNumber: "CLM-2024-0045", patient: "Sarah Johnson", dos: "2026-04-20", provider: "Dr. Chen", insurance: "Anthem BCBS", amount: 150, status: "ready", aging: 0 },
    { id: "22222222-2222-2222-2222-222222222222", claimNumber: "CLM-2024-0044", patient: "Michael Smith", dos: "2026-04-19", provider: "Dr. Johnson", insurance: "UnitedHealthcare", amount: 200, status: "ready", aging: 1 },
    { id: "33333333-3333-3333-3333-333333333333", claimNumber: "CLM-2024-0043", patient: "Emily Davis", dos: "2026-04-18", provider: "Dr. Chen", insurance: "Cigna", amount: 150, status: "submitted", aging: 2 },
  ];

  const tabs = [
    { id: "ready", label: "Ready to Submit", href: "/billing/claims?tab=ready", count: 47 },
    { id: "submitted", label: "Submitted", href: "/billing/claims?tab=submitted", count: 156 },
    { id: "rejected", label: "Rejected", href: "/billing/claims?tab=rejected", count: 8, badge: "!" },
    { id: "denied", label: "Denied", href: "/billing/claims?tab=denied", count: 12, badge: "!" },
    { id: "appeals", label: "Appeals", href: "/billing/claims?tab=appeals", count: 5 },
    { id: "aging", label: "Aging", href: "/billing/claims?tab=aging", count: 23 },
    { id: "closed", label: "Closed", href: "/billing/claims?tab=closed" }
  ];

  const columns: Column<Claim>[] = [
    { 
      header: "Claim Number", 
      accessor: "claimNumber",
      cell: (row) => (
        <a href={`/claims/${row.id}`} className="text-blue-600 hover:text-blue-700 font-mono font-medium">
          {row.claimNumber}
        </a>
      )
    },
    { header: "Patient", accessor: "patient" },
    { header: "DOS", accessor: "dos" },
    { header: "Provider", accessor: "provider" },
    { header: "Insurance", accessor: "insurance" },
    { 
      header: "Amount", 
      accessor: "amount",
      cell: (row) => <span className="font-mono">${row.amount.toFixed(2)}</span>
    },
    {
      header: "Status",
      accessor: "status",
      cell: (row) => (
        <StatusBadge 
          status={row.status.toUpperCase()} 
          variant={
            row.status === "ready" ? "info" :
            row.status === "submitted" ? "warning" :
            row.status === "rejected" ? "error" :
            "default"
          }
          size="sm"
        />
      )
    },
    {
      header: "Aging",
      accessor: "aging",
      cell: (row) => (
        <span className={`font-medium ${
          row.aging <= 30 ? "text-green-700" :
          row.aging <= 60 ? "text-yellow-700" :
          row.aging <= 90 ? "text-orange-700" :
          "text-red-700"
        }`}>
          {row.aging} days
        </span>
      )
    }
  ];

  const toggleClaim = (id: string) => {
    const newSelected = new Set(selectedClaims);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedClaims(newSelected);
  };

  const toggleAll = () => {
    if (selectedClaims.size === mockClaims.length) {
      setSelectedClaims(new Set());
    } else {
      setSelectedClaims(new Set(mockClaims.map(c => c.id)));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Claim Center"
        subtitle="Manage all claims from submission to payment"
        actions={
          <>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Export
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Create Claim
            </button>
          </>
        }
        breadcrumbs={[
          { label: "Billing", href: "/billing" },
          { label: "Claim Center" }
        ]}
      />

      {/* KPI Cards */}
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="grid grid-cols-6 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-blue-600 uppercase tracking-wide">Ready to Submit</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">47</div>
            <div className="text-xs text-gray-600 mt-1">$12,450</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-purple-600 uppercase tracking-wide">Submitted</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">156</div>
            <div className="text-xs text-gray-600 mt-1">$52,800</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-red-600 uppercase tracking-wide">Rejected</div>
            <div className="text-2xl font-bold text-red-900 mt-1">8</div>
            <div className="text-xs text-gray-600 mt-1">Needs attention</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-red-600 uppercase tracking-wide">Denied</div>
            <div className="text-2xl font-bold text-red-900 mt-1">12</div>
            <div className="text-xs text-gray-600 mt-1">$3,200</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-orange-600 uppercase tracking-wide">Appeals</div>
            <div className="text-2xl font-bold text-orange-900 mt-1">5</div>
            <div className="text-xs text-gray-600 mt-1">In progress</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-yellow-600 uppercase tracking-wide">Aging 90+</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">23</div>
            <div className="text-xs text-gray-600 mt-1">$8,950</div>
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
                  <label className="block text-xs font-medium text-gray-700 mb-2">Provider</label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option>All Providers</option>
                    <option>Dr. Chen</option>
                    <option>Dr. Johnson</option>
                  </select>
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
                  <label className="block text-xs font-medium text-gray-700 mb-2">Aging</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-700">0-30 days</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-700">31-60 days</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-700">61-90 days</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-700">90+ days</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Biller</label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option>All Billers</option>
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

          {/* Claims Table */}
          <div className="flex-1 space-y-4">
            {/* Bulk Actions */}
            {selectedClaims.size > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedClaims.size} claims selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                      Submit Selected
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Assign Biller
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Export Selected
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Data Table */}
            <DataTable
              data={mockClaims}
              columns={columns}
              selectable
              selectedRows={selectedClaims}
              onSelectRow={toggleClaim}
              onSelectAll={toggleAll}
              onRowClick={(claim) => window.location.href = `/claims/${claim.id}`}
            />
          </div>

          {/* Right Summary Sidebar */}
          <div className="w-80 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-24 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Claims</span>
                    <span className="text-lg font-bold text-gray-900">{mockClaims.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Amount</span>
                    <span className="text-lg font-bold text-gray-900">
                      ${mockClaims.reduce((sum, c) => sum + c.amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                    Submit Batch
                  </button>
                  <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    Generate Report
                  </button>
                  <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    Export to CSV
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Alerts</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-xs font-medium text-red-900">8 Rejected Claims</div>
                    <div className="text-xs text-red-700 mt-1">Require immediate attention</div>
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-xs font-medium text-yellow-900">23 Claims Aging 90+</div>
                    <div className="text-xs text-yellow-700 mt-1">Risk of denial</div>
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
