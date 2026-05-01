// File: app/settings/clearinghouse/configure/page.tsx
"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export default function ConfigureClearinghousePage() {
  return (
    <AppShell>
      <main className="min-h-screen" style={{ background: "var(--neutral-50)" }}>
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--brand-navy)" }}>
                Configure Office Ally
              </h1>
              <p className="mt-2 text-sm" style={{ color: "var(--neutral-600)" }}>
                Configure Office Ally clearinghouse integration settings.
              </p>
            </div>
            <Link href="/settings/clearinghouse" className="btn-secondary">
              Back to Clearinghouse
            </Link>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold" style={{ color: "var(--brand-navy)" }}>
              Configuration
            </h2>
            <p className="mt-4 text-sm" style={{ color: "var(--neutral-600)" }}>
              Office Ally configuration is currently handled at the database level. The connection is already configured
              in sandbox mode with credentials stored securely server-side.
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase" style={{ color: "var(--neutral-500)" }}>
                  Integration Status
                </label>
                <div className="badge-success">Sandbox Configured</div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase" style={{ color: "var(--neutral-500)" }}>
                  Mode
                </label>
                <div className="text-sm" style={{ color: "var(--neutral-900)" }}>
                  Sandbox (test mode)
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase" style={{ color: "var(--neutral-500)" }}>
                  Security
                </label>
                <div className="text-sm" style={{ color: "var(--neutral-900)" }}>
                  Credentials are stored server-side only and never exposed to client applications.
                </div>
              </div>
            </div>
          </div>

          <div
            className="card mt-6"
            style={{
              background: "var(--warning-bg)",
              borderColor: "var(--warning-border)",
            }}
          >
            <h3 className="font-semibold" style={{ color: "var(--warning-text)" }}>
              Important Security Notice
            </h3>
            <p className="mt-2 text-sm" style={{ color: "var(--warning-text)" }}>
              Live transactions are currently disabled. All API calls run in sandbox mode with mock responses. To enable
              live Office Ally transactions, contact your system administrator.
            </p>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
