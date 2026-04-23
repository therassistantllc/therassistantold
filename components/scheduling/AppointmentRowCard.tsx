import { ScheduleAppointment } from "@/lib/types/schedule";
import {
  formatCurrency,
  formatDisplayTime,
  getClaimCreationGate,
  getClaimStatusLabel,
  getEligibilityStatus,
  getNoteStatusLabel,
} from "@/lib/utils/schedule";
import ScheduleStatusBadge from "./ScheduleStatusBadge";
import Link from "next/link";

interface AppointmentRowCardProps {
  appointment: ScheduleAppointment;
  loadingAction?: "eligibility" | "claim" | "ticket";
  onOpenClient: (appointment: ScheduleAppointment) => void;
  onCollect: (appointment: ScheduleAppointment) => void;
  onRouteToBiller: (appointment: ScheduleAppointment) => void;
  onOpenNote: (appointment: ScheduleAppointment) => void;
  onCheckEligibility: (appointment: ScheduleAppointment) => void;
  onClaimAction: (appointment: ScheduleAppointment) => void;
}

export default function AppointmentRowCard({
  appointment,
  loadingAction,
  onOpenClient,
  onCollect,
  onRouteToBiller,
  onOpenNote,
  onCheckEligibility,
  onClaimAction,
}: AppointmentRowCardProps) {
  const eligibilityStatus = getEligibilityStatus(appointment.eligibility);
  const claimGate = getClaimCreationGate(appointment);
  const claimExists = Boolean(appointment.claim);
  const claimButtonLabel = claimExists ? "Open Claim" : "Create Claim";
  const isCheckEligibilityProminent = eligibilityStatus === "Not Checked";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{formatDisplayTime(appointment.appointmentTime)}</p>
          <p className="text-base font-semibold text-gray-900">{appointment.clientFullName}</p>
          <p className="text-sm text-gray-600">
            {appointment.providerName}
            {appointment.appointmentType ? ` - ${appointment.appointmentType}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScheduleStatusBadge
            label={eligibilityStatus}
            tone={eligibilityStatus === "Active" ? "success" : eligibilityStatus === "Inactive" ? "danger" : "warning"}
          />
          <ScheduleStatusBadge
            label={`Note: ${getNoteStatusLabel(appointment.noteStatus)}`}
            tone={appointment.noteStatus === "signed" ? "success" : appointment.noteStatus === "in_progress" ? "warning" : "neutral"}
          />
          <ScheduleStatusBadge
            label={appointment.claim ? `Claim: ${getClaimStatusLabel(appointment.claim.status)}` : "Claim: Not Created"}
            tone={appointment.claim ? "info" : "neutral"}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 text-sm text-gray-700 md:grid-cols-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payer</p>
          <p>{appointment.payerName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client Balance</p>
          <p>{formatCurrency(appointment.clientBalance)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Billing Alerts</p>
          <p>{appointment.billingAlertsCount}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Encounter</p>
          <p className="font-mono">{appointment.encounterId}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Claim Number</p>
          <p className="font-mono">{appointment.claim?.claimNumber ?? "--"}</p>
        </div>
      </div>

      {!claimExists && !claimGate.canCreate && (
        <div className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          {claimGate.blockers.join(" ")}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/sessions/${appointment.encounterId}`}
          className="rounded-lg bg-blue-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-blue-700"
        >
          Open Encounter
        </Link>
        <button
          type="button"
          onClick={() => onOpenClient(appointment)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Open Client
        </button>
        <button
          type="button"
          onClick={() => onCollect(appointment)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Collect
        </button>
        <button
          type="button"
          onClick={() => onRouteToBiller(appointment)}
          disabled={loadingAction === "ticket"}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Route to Biller
        </button>
        <button
          type="button"
          onClick={() => onOpenNote(appointment)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Open Note
        </button>
        <button
          type="button"
          onClick={() => onCheckEligibility(appointment)}
          disabled={loadingAction === "eligibility"}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            isCheckEligibilityProminent
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          } disabled:opacity-60`}
        >
          {loadingAction === "eligibility" ? "Checking..." : "Check Eligibility"}
        </button>
        <button
          type="button"
          onClick={() => onClaimAction(appointment)}
          disabled={!claimExists && !claimGate.canCreate}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            claimExists
              ? "border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "bg-purple-600 text-white hover:bg-purple-700"
          } disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500`}
        >
          {loadingAction === "claim" ? "Creating..." : claimButtonLabel}
        </button>
      </div>
    </div>
  );
}
