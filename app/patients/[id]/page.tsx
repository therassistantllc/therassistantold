"use client";

import { useState } from "react";
import TabNavigation from "@/components/ui/TabNavigation";
import StatusBadge from "@/components/ui/StatusBadge";

export default function PatientProfilePage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Mock patient data
  const patient = {
    id: "PAT-001",
    name: "Sarah Johnson",
    dob: "1985-06-15",
    age: 40,
    insurance: "Anthem BCBS",
    memberId: "ABC123456789",
    balance: 245.50,
    eligibilityStatus: "active",
    lastAppointment: "2026-04-15",
    nextAppointment: "2026-04-25",
    phone: "(555) 123-4567",
    email: "sarah.johnson@email.com",
    address: "123 Main St, Denver, CO 80202"
  };

  const tabs = [
    { id: "overview", label: "Overview", href: "/patients/PAT-001" },
    { id: "demographics", label: "Demographics", href: "/patients/PAT-001/demographics" },
    { id: "insurance", label: "Insurance", href: "/patients/PAT-001/insurance" },
    { id: "appointments", label: "Appointments", href: "/patients/PAT-001/appointments", count: 12 },
    { id: "notes", label: "Notes", href: "/patients/PAT-001/notes", count: 8 },
    { id: "claims", label: "Claims", href: "/patients/PAT-001/claims", count: 15 },
    { id: "balances", label: "Balances", href: "/patients/PAT-001/balances", badge: patient.balance > 0 ? "$" + patient.balance : undefined },
    { id: "documents", label: "Documents", href: "/patients/PAT-001/documents", count: 24 },
    { id: "communications", label: "Communications", href: "/patients/PAT-001/communications", count: 5 },
    { id: "tasks", label: "Tasks", href: "/patients/PAT-001/tasks", count: 3 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Patient Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">SJ</span>
              </div>

              {/* Patient Info */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
                  <StatusBadge status={patient.eligibilityStatus.toUpperCase()} variant="success" />
                  {patient.balance > 0 && (
                    <StatusBadge status={`Balance: $${patient.balance}`} variant="warning" />
                  )}
                </div>

                <div className="grid grid-cols-4 gap-6 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">DOB / Age</div>
                    <div className="text-gray-900 font-medium mt-1">{patient.dob} • {patient.age}y</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Insurance</div>
                    <div className="text-gray-900 font-medium mt-1">{patient.insurance}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{patient.memberId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Last Appointment</div>
                    <div className="text-gray-900 font-medium mt-1">{patient.lastAppointment}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Next Appointment</div>
                    <div className="text-gray-900 font-medium mt-1">{patient.nextAppointment}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Schedule
              </button>
              <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                New Note
              </button>
              <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Send Message
              </button>
              <button className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Create Claim
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
            {/* Left Column - Quick Stats */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Visits</span>
                    <span className="text-lg font-bold text-gray-900">24</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Open Claims</span>
                    <span className="text-lg font-bold text-blue-900">5</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Billed</span>
                    <span className="text-lg font-bold text-gray-900">$8,450</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Patient Balance</span>
                    <span className="text-lg font-bold text-red-900">${patient.balance}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Phone</div>
                    <div className="text-sm text-gray-900 mt-1">{patient.phone}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Email</div>
                    <div className="text-sm text-gray-900 mt-1">{patient.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Address</div>
                    <div className="text-sm text-gray-900 mt-1">{patient.address}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column - Recent Activity */}
            <div className="col-span-2 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Appointments</h2>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { date: "2026-04-15", provider: "Dr. Chen", type: "Therapy", status: "completed" },
                    { date: "2026-04-08", provider: "Dr. Chen", type: "Therapy", status: "completed" },
                    { date: "2026-04-01", provider: "Dr. Johnson", type: "Medication Management", status: "completed" },
                  ].map((apt, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{apt.type}</div>
                        <div className="text-xs text-gray-600 mt-1">{apt.provider} • {apt.date}</div>
                      </div>
                      <StatusBadge status={apt.status.toUpperCase()} variant="success" size="sm" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Notes</h2>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { date: "2026-04-15", title: "Progress Note - Therapy Session", provider: "Dr. Chen" },
                    { date: "2026-04-08", title: "Progress Note - Therapy Session", provider: "Dr. Chen" },
                  ].map((note, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-900">{note.title}</div>
                      <div className="text-xs text-gray-600 mt-1">{note.provider} • {note.date}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Open Claims</h2>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { id: "CLM-2024-0042", dos: "2026-04-15", amount: "$150.00", status: "submitted" },
                    { id: "CLM-2024-0041", dos: "2026-04-08", amount: "$150.00", status: "ready" },
                  ].map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900 font-mono">{claim.id}</div>
                        <div className="text-xs text-gray-600 mt-1">DOS: {claim.dos} • {claim.amount}</div>
                      </div>
                      <StatusBadge 
                        status={claim.status.toUpperCase()} 
                        variant={claim.status === "submitted" ? "info" : "warning"} 
                        size="sm" 
                      />
                    </div>
                  ))}
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
                    { title: "Verify insurance eligibility", due: "2026-04-22", priority: "high" },
                    { title: "Request auth for next appointment", due: "2026-04-23", priority: "medium" },
                    { title: "Send appointment reminder", due: "2026-04-24", priority: "low" },
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

        {activeTab === "demographics" && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Demographics</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input type="text" value="Sarah" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input type="text" value="Johnson" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                <input type="date" value="1985-06-15" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SSN</label>
                <input type="text" value="***-**-6789" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Single</option>
                  <option>Married</option>
                  <option>Divorced</option>
                  <option>Widowed</option>
                </select>
              </div>
            </div>
            <div className="mt-6">
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Additional tabs would be similarly structured */}
      </div>
    </div>
  );
}
