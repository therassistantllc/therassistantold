"use client";

import PageHeader from "@/components/ui/PageHeader";

export default function OperationsAuditPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Audit Logs"
          subtitle="System audit logs and user activity"
        />
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <p className="text-gray-600">Audit logs coming soon</p>
        </div>
      </div>
    </div>
  );
}
