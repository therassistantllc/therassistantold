"use client";

import { useParams } from "next/navigation";
import TabNavigation from "@/components/ui/TabNavigation";

export default function PatientBalancesPage() {
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
          <TabNavigation tabs={tabs} activeTab="balances" />
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Patient Balances</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center py-12">
            <div className="text-4xl font-bold text-green-700 mb-2">$245.50</div>
            <div className="text-gray-600">Current Balance</div>
          </div>
        </div>
      </div>
    </div>
  );
}
