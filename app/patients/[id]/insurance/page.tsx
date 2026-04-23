"use client";

import { useParams } from "next/navigation";
import TabNavigation from "@/components/ui/TabNavigation";
import StatusBadge from "@/components/ui/StatusBadge";

export default function PatientInsurancePage() {
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
          <TabNavigation tabs={tabs} activeTab="insurance" />
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Primary Insurance */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Primary Insurance</h2>
              <StatusBadge status="ACTIVE" variant="success" />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-500">Insurance Company</div>
                  <div className="text-gray-900 font-medium mt-1">Anthem Blue Cross Blue Shield</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Member ID</div>
                  <div className="text-gray-900 font-mono mt-1">ABC123456789</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Group Number</div>
                  <div className="text-gray-900 font-mono mt-1">GRP-987654</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Plan Type</div>
                  <div className="text-gray-900 mt-1">PPO</div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-500">Effective Date</div>
                  <div className="text-gray-900 mt-1">January 1, 2024</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Copay</div>
                  <div className="text-gray-900 mt-1">$25.00</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Deductible</div>
                  <div className="text-gray-900 mt-1">$1,500 / $3,000 remaining</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Last Eligibility Check</div>
                  <div className="text-gray-900 mt-1">April 20, 2026</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Verify Eligibility
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                View Benefits
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Edit
              </button>
            </div>
          </div>

          {/* Secondary Insurance */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Secondary Insurance</h2>
            <p className="text-gray-600">No secondary insurance on file</p>
            <button className="mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              + Add Secondary Insurance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
