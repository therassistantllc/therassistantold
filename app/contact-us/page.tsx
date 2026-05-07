import AppShell from "@/components/layout/AppShell";

export default function ContactUsPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-3xl font-black text-slate-950">Contact Us</h1>
          <p className="mt-2 text-sm text-slate-600">Use these support channels for account, workflow, and technical assistance.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Support Email</h2>
              <p className="mt-2 text-sm text-slate-600">support@therassistant.app</p>
              <p className="mt-3 text-xs text-slate-500">Best for non-urgent workflow and configuration questions.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Support Phone</h2>
              <p className="mt-2 text-sm text-slate-600">1-800-555-0142</p>
              <p className="mt-3 text-xs text-slate-500">Best for urgent practice-impacting issues.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
              <h2 className="text-lg font-bold text-slate-900">When contacting support</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Include patient ID or claim ID when relevant.</li>
                <li>Include a screenshot and exact page path.</li>
                <li>Describe expected behavior and actual behavior.</li>
                <li>Include timestamp and user role used during the issue.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
