"use client";

import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

interface Provider {
  id: string;
  name: string;
  npi: string;
  specialty: string;
  credentialingStatus: string;
  payerCount: number;
  lastUpdated: string;
}

export default function CredentialingProvidersPage() {
  const mockProviders: Provider[] = [
    {
      id: "PROV-001",
      name: "Dr. Sarah Chen",
      npi: "1234567890",
      specialty: "Clinical Psychology",
      credentialingStatus: "Active",
      payerCount: 12,
      lastUpdated: "2026-03-15"
    },
    {
      id: "PROV-002",
      name: "Dr. Michael Johnson",
      npi: "0987654321",
      specialty: "Licensed Clinical Social Worker",
      credentialingStatus: "Active",
      payerCount: 10,
      lastUpdated: "2026-03-12"
    },
    {
      id: "PROV-003",
      name: "Dr. Emily Martinez",
      npi: "1122334455",
      specialty: "Marriage and Family Therapist",
      credentialingStatus: "Pending",
      payerCount: 5,
      lastUpdated: "2026-03-10"
    }
  ];

  const columns: Column<Provider>[] = [
    {
      header: "Provider",
      accessor: "name",
      cell: (row) => (
        <a href={`/credentialing/providers/${row.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
          {row.name}
        </a>
      )
    },
    { 
      header: "NPI", 
      accessor: "npi",
      cell: (row) => <span className="font-mono text-sm">{row.npi}</span>
    },
    { header: "Specialty", accessor: "specialty" },
    {
      header: "Status",
      accessor: "credentialingStatus",
      cell: (row) => (
        <StatusBadge 
          status={row.credentialingStatus.toUpperCase()} 
          variant={row.credentialingStatus === "Active" ? "success" : "warning"}
          size="sm"
        />
      )
    },
    {
      header: "Payers",
      accessor: "payerCount",
      cell: (row) => <span className="text-gray-900">{row.payerCount}</span>
    },
    { header: "Last Updated", accessor: "lastUpdated" }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Provider Credentialing"
          subtitle={`${mockProviders.length} providers`}
          actions={
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              + Add Provider
            </button>
          }
        />

        <div className="grid grid-cols-3 gap-4 mt-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Active Providers
            </div>
            <div className="text-2xl font-bold text-green-700">
              {mockProviders.filter(p => p.credentialingStatus === "Active").length}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Pending Credentialing
            </div>
            <div className="text-2xl font-bold text-orange-700">
              {mockProviders.filter(p => p.credentialingStatus === "Pending").length}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Total Payer Relationships
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {mockProviders.reduce((sum, p) => sum + p.payerCount, 0)}
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={mockProviders}
          selectable
          onSelectionChange={(selected) => console.log("Selected providers:", selected)}
        />
      </div>
    </div>
  );
}
