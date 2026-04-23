"use client";

import PageHeader from "@/components/ui/PageHeader";

export default function BillingSubmittedPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Submitted Claims"
          subtitle="Claims that have been submitted to payers"
        />
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <p className="text-gray-600">Submitted claims view coming soon</p>
        </div>
      </div>
    </div>
  );
}
