"use client";

import PageHeader from "@/components/ui/PageHeader";

export default function OperationsTemplatesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Templates"
          subtitle="Manage document and email templates"
          actions={
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              + New Template
            </button>
          }
        />
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <p className="text-gray-600">Templates coming soon</p>
        </div>
      </div>
    </div>
  );
}
