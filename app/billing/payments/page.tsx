"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import TabNavigation from "@/components/ui/TabNavigation";
import DataTable, { Column } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

interface Payment {
  id: string;
  paymentDate: string;
  paymentNumber: string;
  payer: string;
  paymentType: string;
  amount: number;
  status: string;
  claimsCount: number;
}

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "all");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Mock payment data
  const mockPayments: Payment[] = [
    {
      id: "PMT-001",
      paymentDate: "2026-04-20",
      paymentNumber: "EFT-20260420-001",
      payer: "Anthem BCBS",
      paymentType: "EFT",
      amount: 2450.00,
      status: "posted",
      claimsCount: 12
    },
    {
      id: "PMT-002",
      paymentDate: "2026-04-19",
      paymentNumber: "CHK-20260419-789",
      payer: "UnitedHealthcare",
      paymentType: "Check",
      amount: 1850.50,
      status: "unposted",
      claimsCount: 8
    },
    {
      id: "PMT-003",
      paymentDate: "2026-04-18",
      paymentNumber: "EFT-20260418-002",
      payer: "Cigna",
      paymentType: "EFT",
      amount: 3200.00,
      status: "posted",
      claimsCount: 15
    },
    {
      id: "PMT-004",
      paymentDate: "2026-04-17",
      paymentNumber: "CHK-20260417-456",
      payer: "Aetna",
      paymentType: "Check",
      amount: 920.00,
      status: "unposted",
      claimsCount: 5
    },
    {
      id: "PMT-005",
      paymentDate: "2026-04-16",
      paymentNumber: "EFT-20260416-003",
      payer: "Colorado Medicaid",
      paymentType: "EFT",
      amount: 1650.75,
      status: "posted",
      claimsCount: 10
    }
  ];

  const tabs = [
    { id: "all", label: "All Payments", href: "/billing/payments?tab=all", count: mockPayments.length },
    { id: "eft-chk", label: "EFT/Check", href: "/billing/payments?tab=eft-chk", count: mockPayments.filter(p => p.paymentType === "EFT" || p.paymentType === "Check").length },
    { id: "unposted", label: "Unposted", href: "/billing/payments?tab=unposted", count: mockPayments.filter(p => p.status === "unposted").length },
    { id: "posted", label: "Posted", href: "/billing/payments?tab=posted", count: mockPayments.filter(p => p.status === "posted").length },
    { id: "patient", label: "Patient Payments", href: "/billing/payments?tab=patient", count: 0 }
  ];

  const columns: Column<Payment>[] = [
    {
      header: "Payment Number",
      accessor: "paymentNumber",
      cell: (row) => (
        <a href={`/billing/payments/${row.id}`} className="text-blue-600 hover:text-blue-700 font-mono font-medium">
          {row.paymentNumber}
        </a>
      )
    },
    { header: "Payment Date", accessor: "paymentDate" },
    { header: "Payer", accessor: "payer" },
    { 
      header: "Type", 
      accessor: "paymentType",
      cell: (row) => (
        <span className={`px-2 py-1 text-xs font-medium rounded ${
          row.paymentType === "EFT" 
            ? "bg-purple-100 text-purple-700" 
            : "bg-blue-100 text-blue-700"
        }`}>
          {row.paymentType}
        </span>
      )
    },
    {
      header: "Amount",
      accessor: "amount",
      cell: (row) => <span className="font-mono font-semibold text-green-700">${row.amount.toFixed(2)}</span>
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
    {
      header: "Claims",
      accessor: "claimsCount",
      cell: (row) => <span className="text-gray-700">{row.claimsCount}</span>
    }
  ];

  // Filter payments based on active tab
  const filteredPayments = mockPayments.filter(payment => {
    if (activeTab === "all") return true;
    if (activeTab === "eft-chk") return payment.paymentType === "EFT" || payment.paymentType === "Check";
    if (activeTab === "unposted") return payment.status === "unposted";
    if (activeTab === "posted") return payment.status === "posted";
    if (activeTab === "patient") return false; // No patient payments in mock data
    return true;
  });

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Payments"
          subtitle={`${filteredPayments.length} payment${filteredPayments.length !== 1 ? 's' : ''} • Total: $${totalAmount.toFixed(2)}`}
          actions={
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
                Import ERA
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                + Record Payment
              </button>
            </div>
          }
        />

        <TabNavigation tabs={tabs} activeTab={activeTab} />

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Total Received
            </div>
            <div className="text-2xl font-bold text-green-700">
              ${totalAmount.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Unposted
            </div>
            <div className="text-2xl font-bold text-orange-700">
              ${mockPayments.filter(p => p.status === "unposted").reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Posted
            </div>
            <div className="text-2xl font-bold text-blue-700">
              ${mockPayments.filter(p => p.status === "posted").reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Claims Paid
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {mockPayments.reduce((sum, p) => sum + p.claimsCount, 0)}
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <DataTable
          columns={columns}
          data={filteredPayments}
          selectable
          onSelectionChange={(selected) => console.log("Selected payments:", selected)}
        />
      </div>
    </div>
  );
}
