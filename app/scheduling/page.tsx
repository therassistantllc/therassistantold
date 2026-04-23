"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppointmentRowCard from "@/components/scheduling/AppointmentRowCard";
import ScheduleHeaderControls from "@/components/scheduling/ScheduleHeaderControls";
import PageHeader from "@/components/ui/PageHeader";
import { createClaimViaApi, routeToBillerViaApi } from "@/lib/api/canonical";
import { scheduleDataSource } from "@/lib/data/schedule";
import { ScheduleAppointment } from "@/lib/types/schedule";
import { addDays, formatDisplayDate, getTodayIsoDate } from "@/lib/utils/schedule";

type LoadingAction = "eligibility" | "claim" | "ticket";

interface AddAppointmentFormState {
  clientFullName: string;
  appointmentTime: string;
  providerId: string;
  appointmentType: string;
  payerName: string;
}

export default function SchedulingPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
  const [selectedProviderId, setSelectedProviderId] = useState("all");
  const [appointments, setAppointments] = useState<ScheduleAppointment[]>([]);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingByAppointment, setActionLoadingByAppointment] = useState<Record<string, LoadingAction | undefined>>({});
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [collectTarget, setCollectTarget] = useState<ScheduleAppointment | null>(null);
  const [routeTarget, setRouteTarget] = useState<ScheduleAppointment | null>(null);
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddAppointmentFormState>({
    clientFullName: "",
    appointmentTime: "09:00",
    providerId: "prov-chen",
    appointmentType: "Psychotherapy",
    payerName: "Anthem BCBS",
  });

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await scheduleDataSource.fetchDailySchedule({
        date: selectedDate,
        providerId: selectedProviderId,
      });
      setAppointments(result.appointments);
      setProviders(result.providers);
      if (!result.providers.find((provider) => provider.id === addForm.providerId) && result.providers.length > 0) {
        setAddForm((prev) => ({ ...prev, providerId: result.providers[0].id }));
      }
    } catch {
      setError("Unable to load the daily schedule. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [addForm.providerId, selectedDate, selectedProviderId]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const totals = useMemo(() => {
    const alerts = appointments.reduce((sum, appointment) => sum + appointment.billingAlertsCount, 0);
    const balances = appointments.reduce((sum, appointment) => sum + appointment.clientBalance, 0);
    const claimReady = appointments.filter((appointment) => !appointment.claim).length;
    return {
      appointments: appointments.length,
      alerts,
      balances,
      claimReady,
    };
  }, [appointments]);

  const setActionLoading = (appointmentId: string, action?: LoadingAction) => {
    setActionLoadingByAppointment((prev) => ({
      ...prev,
      [appointmentId]: action,
    }));
  };

  const handleOpenClient = (appointment: ScheduleAppointment) => {
    router.push(`/patients/${appointment.clientId}`);
  };

  const handleCollect = (appointment: ScheduleAppointment) => {
    setCollectTarget(appointment);
  };

  const handleRouteToBiller = async (appointment: ScheduleAppointment) => {
    try {
      setActionLoading(appointment.id, "ticket");
      const response = await routeToBillerViaApi({
        sourceObjectType: "encounter",
        sourceObjectId: appointment.encounterId,
        title: `Schedule routing: ${appointment.clientFullName}`,
        description: `Route from schedule for ${appointment.appointmentDate} ${appointment.appointmentTime}`,
      });
      setLastTicketId(response.workqueueItemId || null);
      setRouteTarget(appointment);
    } catch (ticketError) {
      setInlineMessage(ticketError instanceof Error ? ticketError.message : "Unable to route to biller.");
    } finally {
      setActionLoading(appointment.id, undefined);
    }
  };

  const handleOpenNote = (appointment: ScheduleAppointment) => {
    router.push(
      `/sessions/new?appointmentId=${appointment.id}&encounterId=${appointment.encounterId}&patientId=${appointment.clientId}&providerId=${appointment.providerId}&date=${appointment.appointmentDate}`,
    );
  };

  const handleCheckEligibility = async (appointment: ScheduleAppointment) => {
    try {
      setActionLoading(appointment.id, "eligibility");
      await scheduleDataSource.runEligibilityCheck(appointment.id);
      await loadSchedule();
      setInlineMessage(`Eligibility refreshed for ${appointment.clientFullName}.`);
    } catch (eligibilityError) {
      setInlineMessage(eligibilityError instanceof Error ? eligibilityError.message : "Eligibility check failed.");
    } finally {
      setActionLoading(appointment.id, undefined);
    }
  };

  const handleClaimAction = async (appointment: ScheduleAppointment) => {
    if (appointment.claim) {
      router.push(`/claims/${appointment.claim.id}`);
      return;
    }

    try {
      setActionLoading(appointment.id, "claim");
      const created = await createClaimViaApi(appointment.encounterId);
      if (!created.claimId) {
        throw new Error(created.blockers?.join(" ") || "Claim creation blocked.");
      }
      setInlineMessage(`Claim created for ${appointment.clientFullName}.`);
      router.push(`/claims/${created.claimId}`);
    } catch (claimError) {
      setInlineMessage(claimError instanceof Error ? claimError.message : "Claim creation failed.");
    } finally {
      setActionLoading(appointment.id, undefined);
    }
  };

  const handleAddAppointment = async () => {
    if (!addForm.clientFullName.trim()) {
      setInlineMessage("Client full name is required.");
      return;
    }

    try {
      await scheduleDataSource.createAppointment({
        appointmentDate: selectedDate,
        appointmentTime: addForm.appointmentTime,
        clientFullName: addForm.clientFullName.trim(),
        providerId: addForm.providerId,
        appointmentType: addForm.appointmentType.trim() || undefined,
        payerName: addForm.payerName.trim() || "Self Pay",
      });
      setAddModalOpen(false);
      setAddForm((prev) => ({ ...prev, clientFullName: "" }));
      await loadSchedule();
      setInlineMessage("Appointment created successfully.");
    } catch {
      setInlineMessage("Unable to add appointment.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Daily Schedule"
        subtitle={`Visit readiness command center - ${formatDisplayDate(selectedDate)}`}
        actions={
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Add Appointment
          </button>
        }
      />

      <div className="mx-auto max-w-[1800px] space-y-4 px-6 py-6">
        <ScheduleHeaderControls
          selectedDate={selectedDate}
          selectedProviderId={selectedProviderId}
          providers={providers}
          onDateChange={setSelectedDate}
          onProviderChange={setSelectedProviderId}
          onPreviousDay={() => setSelectedDate((current) => addDays(current, -1))}
          onNextDay={() => setSelectedDate((current) => addDays(current, 1))}
          onToday={() => setSelectedDate(getTodayIsoDate())}
          onAddAppointment={() => setAddModalOpen(true)}
        />

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Appointments</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totals.appointments}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Billing Alerts</p>
            <p className="mt-1 text-2xl font-bold text-red-800">{totals.alerts}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Outstanding Balance</p>
            <p className="mt-1 text-2xl font-bold text-yellow-800">${totals.balances.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Without Claim</p>
            <p className="mt-1 text-2xl font-bold text-blue-800">{totals.claimReady}</p>
          </div>
        </div>

        {inlineMessage && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {inlineMessage}
          </div>
        )}

        {loading && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
            Loading appointments...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadSchedule()}
              className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && appointments.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
            No appointments found for this date and provider filter.
          </div>
        )}

        {!loading && !error && appointments.length > 0 && (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <AppointmentRowCard
                key={appointment.id}
                appointment={appointment}
                loadingAction={actionLoadingByAppointment[appointment.id]}
                onOpenClient={handleOpenClient}
                onCollect={handleCollect}
                onRouteToBiller={handleRouteToBiller}
                onOpenNote={handleOpenNote}
                onCheckEligibility={handleCheckEligibility}
                onClaimAction={handleClaimAction}
              />
            ))}
          </div>
        )}
      </div>

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Add Appointment</h2>
            <p className="mt-1 text-sm text-gray-600">
              Date and provider are prefilled from the current schedule context.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                Client Full Name
                <input
                  value={addForm.clientFullName}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, clientFullName: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Enter client name"
                />
              </label>
              <label className="text-sm text-gray-700">
                Time
                <input
                  type="time"
                  value={addForm.appointmentTime}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, appointmentTime: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                Provider
                <select
                  value={addForm.providerId}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, providerId: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Appointment Type
                <input
                  value={addForm.appointmentType}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, appointmentType: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Psychotherapy"
                />
              </label>
              <label className="text-sm text-gray-700 md:col-span-2">
                Insurance Payer
                <input
                  value={addForm.payerName}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, payerName: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Anthem BCBS"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddAppointment()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Save Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {collectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Collect Payment</h2>
            <p className="mt-2 text-sm text-gray-700">
              Start payment collection for {collectTarget.clientFullName} with context tied to encounter{" "}
              <span className="font-mono">{collectTarget.encounterId}</span>.
            </p>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              Current balance: ${collectTarget.clientBalance.toFixed(2)}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCollectTarget(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/billing/payment-posting?patientId=${collectTarget.clientId}&encounterId=${collectTarget.encounterId}&source=schedule`,
                  )
                }
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Open Collection Flow
              </button>
            </div>
          </div>
        </div>
      )}

      {routeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Route to Biller</h2>
            <p className="mt-2 text-sm text-gray-700">
              Billing ticket {lastTicketId ?? "created"} is prefilled with client, provider, schedule, payer, and alert
              context.
            </p>
            <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p>Client: {routeTarget.clientFullName}</p>
              <p>Provider: {routeTarget.providerName}</p>
              <p>
                Appointment: {routeTarget.appointmentDate} {routeTarget.appointmentTime}
              </p>
              <p>Payer: {routeTarget.payerName}</p>
              <p>Billing Alerts: {routeTarget.billingAlertsCount}</p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setRouteTarget(null)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
