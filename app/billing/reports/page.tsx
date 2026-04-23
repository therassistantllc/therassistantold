"use client";

import PageHeader from "@/components/ui/PageHeader";

export default function BillingReportsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Billing Reports"
          subtitle="Financial and operational billing reports"
        />
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-semibold text-gray-900 mb-2">Revenue Report</h3>
              <p className="text-sm text-gray-600">Track revenue by provider, payer, and service type</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-semibold text-gray-900 mb-2">Production Report</h3>
              <p className="text-sm text-gray-600">Provider productivity and billing metrics</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-semibold text-gray-900 mb-2">Aging Report</h3>
              <p className="text-sm text-gray-600">Outstanding claims by age bucket</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
