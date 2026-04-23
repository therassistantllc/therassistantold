"use client";

import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Link href="/scheduling">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Today's Appointments</h3>
                <span className="text-2xl">📅</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">24</div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="text-green-600">18 Checked In</span>
                <span className="text-red-600">2 No Shows</span>
              </div>
            </div>
          </Link>

          <Link href="/billing/claims">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Claims Ready</h3>
                <span className="text-2xl">📄</span>
              </div>
              <div className="text-3xl font-bold text-blue-900 mb-2">47</div>
              <div className="text-sm text-gray-600">$12,450 total value</div>
            </div>
          </Link>

          <Link href="/billing/payment-posting">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Unposted Payments</h3>
                <span className="text-2xl">💰</span>
              </div>
              <div className="text-3xl font-bold text-yellow-900 mb-2">23</div>
              <div className="text-sm text-gray-600">$28,750 unposted</div>
            </div>
          </Link>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Open Tasks</h3>
              <span className="text-2xl">✓</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">18</div>
            <div className="text-sm text-red-600">5 high priority</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="col-span-2 space-y-6">
            {/* Alerts & Notifications */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts & Notifications</h2>
              <div className="space-y-3">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-red-900">8 Claims Rejected</div>
                      <div className="text-sm text-red-700 mt-1">Require immediate attention for resubmission</div>
                    </div>
                    <Link href="/billing/claims?tab=rejected">
                      <button className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50">
                        Review
                      </button>
                    </Link>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-yellow-900">23 Claims Aging 90+ Days</div>
                      <div className="text-sm text-yellow-700 mt-1">Risk of denial - follow up immediately</div>
                    </div>
                    <Link href="/billing/claims?tab=aging">
                      <button className="px-3 py-1 text-xs font-medium text-yellow-700 bg-white border border-yellow-300 rounded hover:bg-yellow-50">
                        View
                      </button>
                    </Link>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-blue-900">New ERA Received</div>
                      <div className="text-sm text-blue-700 mt-1">Anthem BCBS - $1,250.00 ready to post</div>
                    </div>
                    <Link href="/billing/payment-posting">
                      <button className="px-3 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50">
                        Post
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { icon: "📝", action: "Progress Note Created", detail: "Sarah Johnson - Dr. Chen", time: "5 min ago" },
                  { icon: "💰", action: "Payment Posted", detail: "CLM-2024-0042 - $150.00", time: "12 min ago" },
                  { icon: "📄", action: "Claim Submitted", detail: "Batch #BATCH-2024-042 - 12 claims", time: "1 hour ago" },
                  { icon: "📅", action: "Appointment Scheduled", detail: "Michael Smith - 2026-04-25", time: "2 hours ago" },
                  { icon: "✅", action: "Eligibility Verified", detail: "Emily Davis - Anthem BCBS", time: "3 hours ago" },
                ].map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                    <span className="text-2xl">{activity.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{activity.action}</div>
                      <div className="text-sm text-gray-600 mt-1">{activity.detail}</div>
                    </div>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-3 gap-3">
                <button className="px-4 py-3 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200">
                  New Appointment
                </button>
                <button className="px-4 py-3 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 border border-purple-200">
                  Create Claim
                </button>
                <button className="px-4 py-3 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 border border-green-200">
                  Post Payment
                </button>
                <button className="px-4 py-3 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 border border-orange-200">
                  New Patient
                </button>
                <button className="px-4 py-3 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200">
                  Import ERA
                </button>
                <button className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200">
                  Submit Batch
                </button>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Today's Schedule */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
                <Link href="/scheduling">
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-700">
                    View All
                  </button>
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { time: "09:00 AM", patient: "Sarah Johnson", provider: "Dr. Chen", status: "completed" },
                  { time: "10:00 AM", patient: "Michael Smith", provider: "Dr. Chen", status: "in-progress" },
                  { time: "11:00 AM", patient: "Emily Davis", provider: "Dr. Johnson", status: "confirmed" },
                  { time: "01:00 PM", patient: "Robert Brown", provider: "Dr. Chen", status: "confirmed" },
                ].map((apt, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{apt.time}</span>
                      <StatusBadge 
                        status={apt.status.toUpperCase().replace("-", " ")} 
                        variant={
                          apt.status === "completed" ? "success" :
                          apt.status === "in-progress" ? "info" :
                          "default"
                        }
                        size="sm"
                      />
                    </div>
                    <div className="text-sm text-gray-900">{apt.patient}</div>
                    <div className="text-xs text-gray-600 mt-1">{apt.provider}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Metrics */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Metrics</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Collections This Month</span>
                    <span className="font-bold text-gray-900">$124,500</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: "82%" }}></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">82% of goal ($152,000)</div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">A/R Outstanding</span>
                    <span className="font-bold text-yellow-900">$45,200</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Collection Rate</span>
                    <span className="font-bold text-green-900">94%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Priorities */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Priorities</h2>
              <div className="space-y-3">
                {[
                  { title: "Review rejected claims", priority: "high", due: "Today" },
                  { title: "Post ERA payments", priority: "high", due: "Today" },
                  { title: "Follow up on aging claims", priority: "medium", due: "Tomorrow" },
                  { title: "Verify eligibility batch", priority: "medium", due: "This Week" },
                ].map((task, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{task.title}</span>
                      <StatusBadge 
                        status={task.priority.toUpperCase()} 
                        variant={task.priority === "high" ? "error" : "warning"}
                        size="sm"
                      />
                    </div>
                    <div className="text-xs text-gray-600">Due: {task.due}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
