"use client";

import PageHeader from "@/components/ui/PageHeader";

export default function AdminIntegrationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Integrations"
          subtitle="Manage third-party integrations"
        />
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Clearinghouse</h3>
              <p className="text-sm text-gray-600">Claims submission integration</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Eligibility</h3>
              <p className="text-sm text-gray-600">Real-time eligibility checks</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">EHR</h3>
              <p className="text-sm text-gray-600">Electronic health records sync</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
