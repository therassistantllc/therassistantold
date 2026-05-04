// File: components/appointments/StartEncounterButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StartEncounterButtonProps {
  appointmentId: string;
  organizationId?: string | null;
  className?: string;
}

export default function StartEncounterButton({
  appointmentId,
  organizationId,
  className,
}: StartEncounterButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startEncounter() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/encounters/create-from-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, organizationId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to start encounter");
      }

      const encounterId = payload.encounterId ?? payload.encounter?.id ?? payload.id;

      if (!encounterId) {
        throw new Error("Encounter was created, but no encounter id was returned.");
      }

      router.push(`/encounters/${encounterId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start encounter");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startEncounter}
        disabled={loading}
        className={
          className ??
          "rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {loading ? "Starting encounter..." : "Start Encounter"}
      </button>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}