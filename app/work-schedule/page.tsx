// File: app/work-schedule/page.tsx
import AppShell from "@/components/layout/AppShell";

export default function WorkSchedulePage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Work Schedule</h1>
            <p className="mt-2 text-sm text-gray-600">
              This layer defines when clinicians can be booked. It should control provider availability, blocked time, breaks, and location-specific booking rules.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="font-medium text-gray-900">Provider Availability</div>
                <div className="mt-2">Available days, start/end times, and recurrence rules belong here.</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="font-medium text-gray-900">Blocked Time</div>
                <div className="mt-2">Lunch, meetings, admin time, PTO, and non-clinical blocks should prevent scheduling conflicts.</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
