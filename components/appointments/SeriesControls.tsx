"use client";

import { useState } from "react";

type Scope = "single" | "series";

export default function SeriesControls({
  appointmentId,
  hasSeries,
}: {
  appointmentId: string;
  hasSeries: boolean;
}) {
  const [scope, setScope] = useState<Scope>("single");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendStatus(status: "cancelled" | "completed") {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/scheduling/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          updates: {
            appointment_status: status,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Could not update appointment status");
      }

      setMessage(
        scope === "series"
          ? `${status === "cancelled" ? "Cancelled" : "Completed"} ${payload.updatedCount ?? "series"} appointments.`
          : `Appointment marked ${status}.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update appointment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Occurrence controls</p>

      {hasSeries ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <span>Apply to:</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as Scope)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            <option value="single">This occurrence only</option>
            <option value="series">This and future in series</option>
          </select>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Standalone appointment (no recurrence series).</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void sendStatus("completed")}
          className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Mark completed
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void sendStatus("cancelled")}
          className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>

      {message ? <p className="mt-2 text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
