"use client";

import { useParams } from "next/navigation";
import TabNavigation from "@/components/ui/TabNavigation";

export default function PatientDemographicsPage() {
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
          <TabNavigation tabs={tabs} activeTab="demographics" />
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Demographics</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input type="text" value="Sarah" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input type="text" value="Johnson" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input type="date" value="1985-06-15" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SSN</label>
                <input type="text" value="***-**-1234" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value="(555) 123-4567" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value="sarah.johnson@email.com" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value="123 Main St" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" value="Denver" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input type="text" value="CO" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                  <input type="text" value="80202" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                <input type="text" value="John Johnson - (555) 987-6543" readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex gap-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Edit Demographics
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
