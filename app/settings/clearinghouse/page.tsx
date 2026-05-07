// File: app/settings/clearinghouse/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import type { IntegrationConnection } from "@/types/integrations";

export default function ClearinghousePage() {
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/connections");
      if (!response.ok) {
        throw new Error("Failed to load integration connections");
      }

      const data = await response.json();
      setConnections(data.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection(integrationName: string) {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/integrations/office-ally/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationName }),
      });

      const data = await response.json();
      setTestResult({
        success: response.ok,
        message: data.message || (response.ok ? "Connection test successful" : "Connection test failed"),
      });

      if (response.ok) {
        // Reload connections to get updated last_checked_at
        await loadConnections();
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setTestingConnection(false);
    }
  }

  const officeAlly = connections.find((c) => c.integration_name === "office_ally");

  return (
    <AppShell>
      <main className="min-h-screen" style={{ background: "var(--neutral-50)" }}>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "var(--brand-navy)" }}>
              Clearinghouse Settings
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--neutral-600)" }}>
              Manage clearinghouse integrations, test connections, and view transaction logs.
            </p>
          </div>

          {testResult && (
            <div
              className="card mb-6"
              style={{
                background: testResult.success ? "var(--success-bg)" : "var(--error-bg)",
                borderColor: testResult.success ? "var(--success-border)" : "var(--error-border)",
                color: testResult.success ? "var(--success-text)" : "var(--error-text)",
              }}
            >
              {testResult.message}
            </div>
          )}

          {loading ? (
            <div className="card">
              <p className="text-sm" style={{ color: "var(--neutral-600)" }}>
                Loading clearinghouse connections...
              </p>
            </div>
          ) : error ? (
            <div
              className="card"
              style={{
                background: "var(--error-bg)",
                borderColor: "var(--error-border)",
                color: "var(--error-text)",
              }}
            >
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Office Ally Connection Card */}
              {officeAlly && (
                <div className="card">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold" style={{ color: "var(--brand-navy)" }}>
                        Office Ally
                      </h2>
                      <p className="mt-1 text-sm" style={{ color: "var(--neutral-600)" }}>
                        Primary clearinghouse for eligibility, claim status, and submissions
                      </p>
                    </div>
                    <div className={`badge-${officeAlly.connection_status === "sandbox_configured" ? "info" : "warning"}`}>
                      {officeAlly.connection_status.replace(/_/g, " ")}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--neutral-500)" }}>
                        Mode
                      </label>
                      <div className="mt-1 text-sm" style={{ color: "var(--neutral-900)" }}>
                        {officeAlly.mode}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--neutral-500)" }}>
                        Live Transactions
                      </label>
                      <div className="mt-1">
                        <span
                          className={`badge-${officeAlly.live_transactions_enabled ? "success" : "error"}`}
                        >
                          {officeAlly.live_transactions_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--neutral-500)" }}>
                        Credentials Storage
                      </label>
                      <div className="mt-1 text-sm" style={{ color: "var(--neutral-900)" }}>
                        {officeAlly.credentials_storage?.replace(/_/g, " ")}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--neutral-500)" }}>
                        Last Checked
                      </label>
                      <div className="mt-1 text-sm" style={{ color: "var(--neutral-900)" }}>
                        {officeAlly.last_checked_at
                          ? new Date(officeAlly.last_checked_at).toLocaleString()
                          : "Never"}
                      </div>
                    </div>
                  </div>

                  {officeAlly.supported_transactions && officeAlly.supported_transactions.length > 0 && (
                    <div className="mt-4">
                      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--neutral-500)" }}>
                        Supported Transactions
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {officeAlly.supported_transactions.map((txn) => (
                          <span
                            key={txn}
                            className="rounded-lg px-3 py-1 text-sm"
                            style={{
                              background: "var(--info-bg)",
                              color: "var(--brand-navy)",
                              border: "1px solid var(--info-border)",
                            }}
                          >
                            {txn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleTestConnection("office_ally")}
                      disabled={testingConnection}
                      className="btn-primary"
                    >
                      {testingConnection ? "Testing..." : "Test Connection"}
                    </button>
                    <Link href="/settings/clearinghouse/transactions" className="btn-secondary">
                      View Transaction Log
                    </Link>
                    <Link href="/settings/clearinghouse/configure" className="btn-secondary">
                      Configure Office Ally
                    </Link>
                  </div>
                </div>
              )}

              {!officeAlly && (
                <div className="card">
                  <h2 className="text-lg font-semibold" style={{ color: "var(--brand-navy)" }}>
                    No Clearinghouse Connections
                  </h2>
                  <p className="mt-2 text-sm" style={{ color: "var(--neutral-600)" }}>
                    No clearinghouse connections have been configured yet. Please configure Office Ally to enable
                    eligibility checks and claim submissions.
                  </p>
                  <div className="mt-4">
                    <Link href="/settings/clearinghouse/configure" className="btn-primary">
                      Configure Office Ally
                    </Link>
                  </div>
                </div>
              )}

              {/* Additional Connections */}
              {connections.filter((c) => c.integration_name !== "office_ally").map((connection) => (
                <div key={connection.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold" style={{ color: "var(--brand-navy)" }}>
                        {(connection.integration_name ?? "").replace(/_/g, " ").toUpperCase()}
                      </h3>
                      <p className="mt-1 text-sm" style={{ color: "var(--neutral-600)" }}>
                        Status: {(connection.connection_status ?? "").replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="badge-info">{connection.mode}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
