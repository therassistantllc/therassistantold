"use client";

import { getMockBillingDashboardMetrics } from "@/lib/data/mock-billing";
import Link from "next/link";

export default function BillingDashboardPage() {
  const metrics = getMockBillingDashboardMetrics();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Overview of claims, payments, and revenue cycle metrics
          </p>
        </div>
        
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Ready to Submit */}
          <Link href="/billing/ready-to-submit">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Ready to Submit
                </h3>
                <span className="text-2xl">📤</span>
              </div>
              <div className="text-3xl font-bold text-blue-900 mb-2">
                {metrics.ready_claims_count}
              </div>
              <div className="text-sm text-gray-600">
                ${metrics.ready_claims_amount.toLocaleString()} total
              </div>
              <div className="mt-4 text-xs text-blue-600 font-medium">
                View Claims →
              </div>
            </div>
          </Link>
          
          {/* Unposted Payments */}
          <Link href="/billing/unposted-payments">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Unposted Payments
                </h3>
                <span className="text-2xl">💰</span>
              </div>
              <div className="text-3xl font-bold text-yellow-900 mb-2">
                {metrics.unposted_payments_count}
              </div>
              <div className="text-sm text-gray-600">
                ${metrics.unposted_payments_amount.toLocaleString()} unposted
              </div>
              <div className="mt-4 text-xs text-yellow-600 font-medium">
                Post Payments →
              </div>
            </div>
          </Link>
          
          {/* Failed Submissions */}
          <Link href="/billing/batches">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Failed Submissions
                </h3>
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="text-3xl font-bold text-red-900 mb-2">
                {metrics.failed_submissions_count}
              </div>
              <div className="text-sm text-gray-600">
                Requires attention
              </div>
              <div className="mt-4 text-xs text-red-600 font-medium">
                View Batches →
              </div>
            </div>
          </Link>
          
          {/* Rejected Claims */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Rejected Claims
              </h3>
              <span className="text-2xl">❌</span>
            </div>
            <div className="text-3xl font-bold text-red-900 mb-2">
              {metrics.rejected_claims_count}
            </div>
            <div className="text-sm text-gray-600">
              Needs correction
            </div>
          </div>
          
          {/* Payments Needing Review */}
          <Link href="/billing/unposted-payments">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Payments Need Review
                </h3>
                <span className="text-2xl">🔍</span>
              </div>
              <div className="text-3xl font-bold text-orange-900 mb-2">
                {metrics.payments_needing_review}
              </div>
              <div className="text-sm text-gray-600">
                Requires manual review
              </div>
              <div className="mt-4 text-xs text-orange-600 font-medium">
                Review Now →
              </div>
            </div>
          </Link>
          
          {/* Overpayments */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Overpayments Detected
              </h3>
              <span className="text-2xl">💸</span>
            </div>
            <div className="text-3xl font-bold text-purple-900 mb-2">
              {metrics.overpayments_detected_count}
            </div>
            <div className="text-sm text-gray-600">
              Requires action
            </div>
          </div>
          
          {/* Recoupments */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Recoupments Pending
              </h3>
              <span className="text-2xl">⚖️</span>
            </div>
            <div className="text-3xl font-bold text-red-900 mb-2">
              {metrics.recoupments_pending_count}
            </div>
            <div className="text-sm text-gray-600">
              Under review
            </div>
          </div>
        </div>
        
        {/* Quick Links */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-4">
            <Link href="/billing/ready-to-submit">
              <button className="w-full px-4 py-3 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200">
                Submit Claims
              </button>
            </Link>
            <Link href="/billing/unposted-payments">
              <button className="w-full px-4 py-3 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 border border-yellow-200">
                Post Payments
              </button>
            </Link>
            <Link href="/billing/batches">
              <button className="w-full px-4 py-3 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 border border-purple-200">
                View Batches
              </button>
            </Link>
            <button className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Import ERA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
