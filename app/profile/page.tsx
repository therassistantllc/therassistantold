// File: app/profile/page.tsx
import AppShell from "@/components/layout/AppShell";

export default function ProfilePage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            <p className="mt-2 text-sm text-gray-600">
              Staff profile, to-do items, unfinished work, and draft note awareness belong here.
            </p>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
