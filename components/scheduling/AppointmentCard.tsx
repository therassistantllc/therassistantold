// File: components/scheduling/AppointmentCard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

interface Appointment {
  id: string;
  client_id?: string | null;
  provider_id?: string | null;
  insurance_policy_id?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  appointment_status?: string | null;
  appointment_type?: string | null;
  reason?: string | null;
}

interface Patient {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
}

interface EligibilityStatus {
  status: "no_policy" | "not_checked" | "stale" | "active" | "inactive" | "error";
  checked_at?: string | null;
  copay_amount?: number | null;
  deductible_remaining?: number | null;
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;
}

interface AppointmentCardProps {
  appointment: Appointment;
  patient?: Patient;
  eligibilityStatus?: EligibilityStatus | null;
  colorMode: "status" | "type";
  isSelected?: boolean;
  onSelect?: () => void;
  onRefresh?: () => Promise<void>;
}

function patientLabel(patient: Patient | undefined) {
  if (!patient) return "Unknown patient";
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(" ");
  return patient.preferred_name ? `${name || "Patient"} (${patient.preferred_name})` : name || patient.id;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function statusColor(status: string | null | undefined) {
  const value = String(status ?? "").toLowerCase();
  if (value === "completed") return "border-green-300 bg-green-50 text-green-900";
  if (value === "checked_in") return "border-blue-300 bg-blue-50 text-blue-900";
  if (value === "cancelled" || value === "no_show") return "border-red-300 bg-red-50 text-red-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function typeColor(type: string | null | undefined) {
  if (type === "Telehealth") return "border-violet-300 bg-violet-50 text-violet-900";
  if (type === "In-person") return "border-sky-300 bg-sky-50 text-sky-900";
  return "border-gray-300 bg-gray-50 text-gray-900";
}

function eligibilityBadgeColor(status: string) {
  if (status === "active") return "bg-green-100 text-green-800 border-green-200";
  if (status === "inactive") return "bg-red-100 text-red-800 border-red-200";
  if (status === "not_checked") return "bg-gray-100 text-gray-700 border-gray-200";
  if (status === "stale") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "no_policy") return "bg-gray-100 text-gray-600 border-gray-200";
  if (status === "error") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function eligibilityBadgeLabel(status: string) {
  if (status === "active") return "Eligible";
  if (status === "inactive") return "Inactive";
  if (status === "not_checked") return "Not Checked";
  if (status === "stale") return "Stale";
  if (status === "no_policy") return "No Policy";
  if (status === "error") return "Error";
  return "Unknown";
}

export default function AppointmentCard({
  appointment,
  patient,
  eligibilityStatus,
  colorMode,
  isSelected,
  onSelect,
  onRefresh,
}: AppointmentCardProps) {
  const [runningEligibility, setRunningEligibility] = useState(false);
  const [creatingEncounter, setCreatingEncounter] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const colorClass = colorMode === "status" ? statusColor(appointment.appointment_status) : typeColor(appointment.appointment_type);

  async function handleRunEligibility(e: React.MouseEvent) {
    e.stopPropagation();
    if (!appointment.client_id) return;

    setRunningEligibility(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          organizationId: appointment.insurance_policy_id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setActionMessage({ type: "success", text: "Eligibility updated" });
        await onRefresh?.();
      } else {
        setActionMessage({ type: "error", text: result.error || "Eligibility check failed" });
      }
    } catch (error) {
      setActionMessage({ type: "error", text: "Network error" });
    } finally {
      setRunningEligibility(false);
      setTimeout(() => setActionMessage(null), 3000);
    }
  }

  async function handleCreateEncounter(e: React.MouseEvent) {
    e.stopPropagation();

    setCreatingEncounter(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/encounters/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setActionMessage({ type: "success", text: "Encounter created" });
        // Navigate to encounter
        window.location.href = `/encounters/${result.encounter.id}`;
      } else {
        setActionMessage({ type: "error", text: result.error || "Failed to create encounter" });
      }
    } catch (error) {
      setActionMessage({ type: "error", text: "Network error" });
    } finally {
      setCreatingEncounter(false);
    }
  }

  function handleCollectCopay(e: React.MouseEvent) {
    e.stopPropagation();
    setActionMessage({ type: "success", text: "Payment collection (Stripe integration placeholder)" });
    setTimeout(() => setActionMessage(null), 3000);
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-3 shadow-sm ${colorClass} ${isSelected ? "ring-2 ring-blue-400" : ""} cursor-pointer hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium opacity-80">
            {formatTime(appointment.scheduled_start_at)}
          </div>
          <div className="mt-0.5 line-clamp-1 text-sm font-semibold">
            {patientLabel(patient)}
          </div>
          <div className="line-clamp-1 text-[11px] opacity-80">
            {appointment.reason ?? appointment.appointment_type ?? "Appointment"}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {eligibilityStatus && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${eligibilityBadgeColor(eligibilityStatus.status)}`}>
              {eligibilityBadgeLabel(eligibilityStatus.status)}
            </span>
          )}
        </div>
      </div>

      {eligibilityStatus && eligibilityStatus.status === "active" && (
        <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
          {eligibilityStatus.copay_amount !== null && eligibilityStatus.copay_amount !== undefined && (
            <div className="text-gray-700">
              <span className="font-medium">Copay:</span> {formatMoney(eligibilityStatus.copay_amount)}
            </div>
          )}
          {eligibilityStatus.deductible_remaining !== null && eligibilityStatus.deductible_remaining !== undefined && (
            <div className="text-gray-700">
              <span className="font-medium">Deduct:</span> {formatMoney(eligibilityStatus.deductible_remaining)}
            </div>
          )}
          {eligibilityStatus.coverage_end_date && (
            <div className="col-span-2 text-gray-600">
              Valid until {new Date(eligibilityStatus.coverage_end_date).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <button
          onClick={handleRunEligibility}
          disabled={runningEligibility}
          className="flex-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {runningEligibility ? "Running..." : "Check Eligibility"}
        </button>
        <button
          onClick={handleCreateEncounter}
          disabled={creatingEncounter}
          className="flex-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creatingEncounter ? "Creating..." : "Create Encounter"}
        </button>
        <button
          onClick={handleCollectCopay}
          className="flex-1 rounded-md bg-purple-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-purple-700"
        >
          Collect Copay
        </button>
      </div>

      {actionMessage && (
        <div className={`mt-2 rounded-md px-2 py-1 text-[10px] ${actionMessage.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {actionMessage.text}
        </div>
      )}
    </div>
  );
}
