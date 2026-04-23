"use client";

import { useParams } from "next/navigation";
import TabNavigation from "@/components/ui/TabNavigation";

export default function PatientDocumentsPage() {
  const params = useParams();
  const patientId = params.id as string;

  const tabs = [
    { id: "overview", label: "Overview", href: `/patients/${patientId}` },
    { id: "demographics", label: "Demographics", href: `/patients/${patientId}/demographics` },
    { id: "insurance", label: "Insurance", href: `/patients/${patientId}/insurance` },
    { id: "appointments", label: "Appointments", href: `/patients/${patientId}/appointments` },
    { id: "notes", label: "Notes", href: `/patients/${patientId}/notes` },
    { id: "claims", label: "Claims", href: `/patients/${patientId}/claims` },
    { id: "balances", label: "Balances", href: `/patients/${patientId}/balances` },
    { id: "documents", label: "Documents", href: `/patients/${patientId}/documents` },
    { id: "communications", label: "Communications", href: `/patients/${patientId}/communications` },
    { id: "tasks", label: "Tasks", href: `/patients/${patientId}/tasks` }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-6">
          <TabNavigation tabs={tabs} activeTab="documents" />
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Upload Document
          </button>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-600">Documents list coming soon</p>
        </div>
      </div>
    </div>
  );
}
