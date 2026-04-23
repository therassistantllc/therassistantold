"use client";

import PageHeader from "@/components/ui/PageHeader";

export default function SchedulingNoShowsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="No Shows"
          subtitle="Track no-show appointments and patterns"
        />
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <p className="text-gray-600">No-show tracking coming soon</p>
        </div>
      </div>
    </div>
  );
}
