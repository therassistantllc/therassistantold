"use client";

import { useState } from "react";
import TabNavigation from "@/components/ui/TabNavigation";
import StatusBadge from "@/components/ui/StatusBadge";

export default function ProviderProfilePage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Mock provider data
  const provider = {
    id: "PRV-001",
    name: "Dr. Michael Chen",
    title: "Licensed Clinical Psychologist",
    npi: "1234567890",
    license: "PSY-12345",
    email: "mchen@therassistant.com",
    phone: "(555) 987-6543",
    specialties: ["CBT", "DBT", "Trauma-Informed Care"],
    status: "active"
  };

  const tabs = [
    { id: "overview", label: "Overview", href: "/credentialing/providers/PRV-001" },
    { id: "schedule", label: "Schedule", href: "/credentialing/providers/PRV-001/schedule" },
    { id: "credentialing", label: "Credentialing", href: "/credentialing/providers/PRV-001/credentialing", count: 5 },
    { id: "claims", label: "Claims", href: "/credentialing/providers/PRV-001/claims", count: 234 },
    { id: "productivity", label: "Productivity", href: "/credentialing/providers/PRV-001/productivity" },
    { id: "documents", label: "Documents", href: "/credentialing/providers/PRV-001/documents", count: 18 },
    { id: "contracts", label: "Contracts", href: "/credentialing/providers/PRV-001/contracts", count: 12 },
    { id: "tasks", label: "Tasks", href: "/credentialing/providers/PRV-001/tasks", count: 3 },
    { id: "messages", label: "Messages", href: "/credentialing/providers/PRV-001/messages", count: 7 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Provider Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">MC</span>
              </div>

              {/* Provider Info */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{provider.name}</h1>
                  <StatusBadge status={provider.status.toUpperCase()} variant="success" />
                </div>
                <p className="text-gray-600 mb-3">{provider.title}</p>

                <div className="grid grid-cols-4 gap-6 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">NPI</div>
                    <div className="text-gray-900 font-mono font-medium mt-1">{provider.npi}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">License</div>
                    <div className="text-gray-900 font-mono font-medium mt-1">{provider.license}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Specialties</div>
                    <div className="text-gray-900 font-medium mt-1">{provider.specialties.join(", ")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Contact</div>
                    <div className="text-gray-900 font-medium mt-1">{provider.phone}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                View Schedule
              </button>
              <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Send Message
              </button>
              <button className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Update Credentialing
              </button>
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-[1800px] mx-auto px-6">
          <TabNavigation tabs={tabs} activeTab={activeTab} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {activeTab === "overview" && (
          <div className="grid grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Patients This Month</span>
                    <span className="text-lg font-bold text-gray-900">42</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Visits</span>
                    <span className="text-lg font-bold text-gray-900">156</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Revenue YTD</span>
                    <span className="text-lg font-bold text-gray-900">$124,500</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Utilization</span>
                    <span className="text-lg font-bold text-green-900">92%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Credentialing Status</h2>
                <div className="space-y-3">
                  {[
                    { payer: "Anthem BCBS", status: "active", expiry: "2027-03-15" },
                    { payer: "UnitedHealthcare", status: "active", expiry: "2027-06-20" },
                    { payer: "Cigna", status: "pending", expiry: "N/A" },
                  ].map((cred, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{cred.payer}</span>
                        <StatusBadge 
                          status={cred.status.toUpperCase()} 
                          variant={cred.status === "active" ? "success" : "warning"}
                          size="sm"
                        />
                      </div>
                      {cred.expiry !== "N/A" && (
                        <div className="text-xs text-gray-600">Expires: {cred.expiry}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle/Right Columns */}
            <div className="col-span-2 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">This Week's Schedule</h2>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                    View Full Schedule
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { day: "Monday", appointments: 8, hours: 7 },
                    { day: "Tuesday", appointments: 7, hours: 6 },
                    { day: "Wednesday", appointments: 9, hours: 8 },
                    { day: "Thursday", appointments: 8, hours: 7 },
                    { day: "Friday", appointments: 6, hours: 5 },
                  ].map((day) => (
                    <div key={day.day} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">{day.day}</span>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span>{day.appointments} appointments</span>
                        <span>{day.hours} clinical hours</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Claims</h2>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { id: "CLM-2024-0045", patient: "Sarah Johnson", dos: "2026-04-20", amount: 150, status: "submitted" },
                    { id: "CLM-2024-0044", patient: "Michael Smith", dos: "2026-04-19", amount: 200, status: "paid" },
                    { id: "CLM-2024-0043", patient: "Emily Davis", dos: "2026-04-18", amount: 150, status: "paid" },
                  ].map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900 font-mono">{claim.id}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {claim.patient} • {claim.dos} • ${claim.amount}
                        </div>
                      </div>
                      <StatusBadge 
                        status={claim.status.toUpperCase()} 
                        variant={claim.status === "paid" ? "success" : "info"}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Productivity Metrics</h2>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                    View Report
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-xs text-blue-700 uppercase tracking-wide">Avg Session Time</div>
                    <div className="text-2xl font-bold text-blue-900 mt-1">52 min</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-xs text-green-700 uppercase tracking-wide">No-Show Rate</div>
                    <div className="text-2xl font-bold text-green-900 mt-1">3.2%</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-xs text-purple-700 uppercase tracking-wide">Revenue Per Visit</div>
                    <div className="text-2xl font-bold text-purple-900 mt-1">$178</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="text-xs text-orange-700 uppercase tracking-wide">Collection Rate</div>
                    <div className="text-2xl font-bold text-orange-900 mt-1">94%</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Open Tasks</h2>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { title: "Complete CAQH update", due: "2026-04-22", priority: "high" },
                    { title: "Review Cigna contract", due: "2026-04-25", priority: "medium" },
                    { title: "Submit license renewal", due: "2026-05-01", priority: "low" },
                  ].map((task, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        <div className="text-xs text-gray-600 mt-1">Due: {task.due}</div>
                      </div>
                      <StatusBadge 
                        status={task.priority.toUpperCase()} 
                        variant={task.priority === "high" ? "error" : task.priority === "medium" ? "warning" : "default"}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
