// File: app/sessions/[id]/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EncounterWorkspace } from "@/lib/types/encounter";
import {
  fetchEncounterWorkspace,
  performEncounterAction,
} from "@/lib/data/encounter";
import EncounterHeader from "@/components/encounter/EncounterHeader";
import ClientBillingSnapshot from "@/components/encounter/ClientBillingSnapshot";
import DocumentationPanel from "@/components/encounter/DocumentationPanel";
import CodingReadinessPanel from "@/components/encounter/CodingReadinessPanel";
import ClaimPanel from "@/components/encounter/ClaimPanel";
import EncounterActionBar from "@/components/encounter/EncounterActionBar";

type EncounterAction =
  | "open_client"
  | "open_note"
  | "check_eligibility"
  | "route_to_biller"
  | "collect"
  | "open_claim"
  | "create_claim";

interface EncounterPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EncounterPage({ params }: EncounterPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [encounter, setEncounter] = useState<EncounterWorkspace | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [currentAction, setCurrentAction] = useState<EncounterAction | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadEncounter(id);
  }, [id]);

  useEffect(() => {
    if (!actionMessage) return;

    const timeout = window.setTimeout(() => {
      setActionMessage(null);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [actionMessage]);

  async function loadEncounter(encounterId: string): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchEncounterWorkspace(encounterId);

      if (!data) {
        setEncounter(null);
        setError("Encounter not found");
        return;
      }

      setEncounter(data);
    } catch (err) {
      setEncounter(null);
      setError(err instanceof Error ? err.message : "Failed to load encounter");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(
    action: EncounterAction,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!encounter) return;

    setActionLoading(true);
    setCurrentAction(action);
    setActionMessage(null);

    try {
      const result = await performEncounterAction({
        action,
        encounterId: encounter.encounterId,
        metadata,
      });

      if (!result.success) {
        setActionMessage(result.error || "Action failed");
        return;
      }

      if (result.redirect) {
        router.push(result.redirect);
        return;
      }

      if (result.message) {
        setActionMessage(result.message);
      }

      await loadEncounter(id);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
      setCurrentAction(null);
    }
  }

  function handleOpenClient(): void {
    if (!encounter) return;
    void handleAction("open_client", { clientId: encounter.clientId });
  }

  function handleOpenNote(): void {
    void handleAction("open_note");
  }

  function handleCheckEligibility(): void {
    void handleAction("check_eligibility");
  }

  function handleRouteToBiller(): void {
    void handleAction("route_to_biller");
  }

  function handleCollect(): void {
    if (!encounter) return;
    void handleAction("collect", { clientId: encounter.clientId });
  }

  function handleClaimAction(): void {
    if (!encounter) return;

    if (encounter.claim) {
      void handleAction("open_claim", { claimId: encounter.claim.id });
      return;
    }

    void handleAction("create_claim");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Loading encounter workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl text-red-600">⚠</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Encounter Not Found
          </h1>
          <p className="mb-6 text-gray-600">
            {error || "The requested encounter could not be loaded."}
          </p>
          <button
            onClick={() => router.push("/scheduling")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Return to Schedule
          </button>
        </div>
      </div>
    );
  }

  const isActionError =
    actionMessage?.toLowerCase().includes("error") ||
    actionMessage?.toLowerCase().includes("failed");

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <EncounterHeader encounter={encounter} />

      {actionMessage && (
        <div className="mx-auto max-w-[1400px] px-6 pt-4">
          <div
            className={`rounded-lg border px-4 py-3 ${
              isActionError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {actionMessage}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <ClientBillingSnapshot
              clientId={encounter.clientId}
              clientName={encounter.clientFullName}
              billing={encounter.billing}
              onOpenClient={handleOpenClient}
            />
            <DocumentationPanel
              note={encounter.note}
              onOpenNote={handleOpenNote}
            />
          </div>

          <div className="space-y-6">
            <CodingReadinessPanel coding={encounter.coding} />
          </div>

          <div className="space-y-6">
            <ClaimPanel
              claim={encounter.claim}
              canCreateClaim={encounter.coding.status !== "blocked"}
              blockers={encounter.coding.blockers}
              onCreateClaim={handleClaimAction}
              onOpenClaim={handleClaimAction}
              isCreating={actionLoading && currentAction === "create_claim"}
            />

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Quick Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Client DOB:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(encounter.clientDob).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Provider ID:</span>
                  <span className="font-mono text-xs text-gray-900">
                    {encounter.providerId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payer ID:</span>
                  <span className="font-mono text-xs text-gray-900">
                    {encounter.payerId || "--"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EncounterActionBar
        onOpenClient={handleOpenClient}
        onOpenNote={handleOpenNote}
        onCheckEligibility={handleCheckEligibility}
        onRouteToBiller={handleRouteToBiller}
        onCollect={handleCollect}
        onClaimAction={handleClaimAction}
        claimExists={Boolean(encounter.claim)}
        isLoading={actionLoading}
        loadingAction={currentAction || undefined}
      />
    </div>
  );
}