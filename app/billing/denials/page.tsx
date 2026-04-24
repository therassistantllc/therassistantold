"use client";

import PageHeader from "@/components/ui/PageHeader";
import TabNavigation from "@/components/ui/TabNavigation";
import DataTable, { Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

interface Denial {
  id: string;
  claimNumber: string;
  patient: string;
  dos: string;
  provider: string;
  insurance: string;
  amount: number;
  denialReason: string;
  denialCode: string;
  denialDate: string;
}

export default function DenialsPage() {
  const mockDenials: Denial[] = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      claimNumber: "CLM-2024-0032",
      patient: "Sarah Johnson",
      dos: "2026-03-15",
      provider: "Dr. Chen",
      insurance: "Anthem BCBS",
      amount: 150.00,
      denialReason: "Missing Authorization",
      denialCode: "CO-50",
      denialDate: "2026-04-10"
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      claimNumber: "CLM-2024-0028",
      patient: "Michael Davis",
      dos: "2026-03-12",
      provider: "Dr. Johnson",
      insurance: "UnitedHealthcare",
      amount: 200.00,
      denialReason: "Timely Filing Limit Exceeded",
      denialCode: "CO-29",
      denialDate: "2026-04-08"
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      claimNumber: "CLM-2024-0025",
      patient: "Jennifer Martinez",
      dos: "2026-03-08",
      provider: "Dr. Chen",
      insurance: "Cigna",
      amount: 150.00,
      denialReason: "Non-covered Service",
      denialCode: "CO-96",
      denialDate: "2026-04-05"
    }
  ];

  const tabs = [
    { id: "all", label: "All Denials", href: "/billing/denials?tab=all", count: 12 },
    { id: "pending", label: "Pending Review", href: "/billing/denials?tab=pending", count: 5 },
    { id: "appeal", label: "Ready for Appeal", href: "/billing/denials?tab=appeal", count: 4 },
    { id: "appealed", label: "Appealed", href: "/billing/denials?tab=appealed", count: 2 },
    { id: "closed", label: "Closed", href: "/billing/denials?tab=closed", count: 1 }
  ];

  const columns: Column<Denial>[] = [
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
      header: "Denial Reason",
      accessor: "denialReason",
      cell: (row) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{row.denialReason}</div>
          <div className="text-xs text-gray-500 font-mono">{row.denialCode}</div>
        </div>
      )
    },
    { header: "Denial Date", accessor: "denialDate" },
    {
      header: "Status",
      accessor: "denialReason",
      cell: () => (
        <StatusBadge status="DENIED" variant="error" size="sm" />
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Claim Denials"
          subtitle={`${mockDenials.length} denied claims requiring attention`}
          actions={
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
                Export
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Bulk Appeal
              </button>
            </div>
          }
        />

        <TabNavigation tabs={tabs} activeTab="all" />

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-6 mb-6">
          <div className="bg-white rounded-lg border border-red-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Total Denied Amount
            </div>
            <div className="text-2xl font-bold text-red-700">
              $6,450.00
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Avg Days to Review
            </div>
            <div className="text-2xl font-bold text-gray-900">
              8.5
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Appeal Success Rate
            </div>
            <div className="text-2xl font-bold text-green-700">
              72%
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Pending Appeals
            </div>
            <div className="text-2xl font-bold text-orange-700">
              4
            </div>
          </div>
        </div>

        {/* Denials Table */}
        <DataTable
          columns={columns}
          data={mockDenials}
          selectable
          onSelectionChange={(selected) => console.log("Selected denials:", selected)}
        />
      </div>
    </div>
  );
}
