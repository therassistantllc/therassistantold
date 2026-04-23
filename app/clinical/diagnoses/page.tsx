"use client";

import PageHeader from "@/components/ui/PageHeader";

export default function ClinicalDiagnosesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <PageHeader
          title="Diagnosis History"
          subtitle="Patient diagnosis tracking and history"
        />
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <p className="text-gray-600">Diagnosis history coming soon</p>
        </div>
      </div>
    </div>
  );
}
