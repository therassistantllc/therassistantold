// File: app/scheduling/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppointmentRowCard from "@/components/scheduling/AppointmentRowCard";
import ScheduleHeaderControls from "@/components/scheduling/ScheduleHeaderControls";
import PageHeader from "@/components/ui/PageHeader";
import {
  createClaimViaApi,
  resolveEncounterForAppointmentViaApi,
  routeToBillerViaApi,
} from "@/lib/api/canonical";
import { scheduleDataSource } from "@/lib/data/schedule";
import type { ScheduleAppointment } from "@/lib/types/schedule";
import { addDays, formatDisplayDate, getTodayIsoDate } from "@/lib/utils/schedule";

type LoadingAction = "eligibility" | "claim" | "ticket" | "encounter";

interface AddAppointmentFormState {
  clientFullName: string;
  appointmentTime: string;
  providerId: string;
  appointmentType: string;
  payerName: string;
}

function getStoredOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem("organization_id") ||
    window.localStorage.getItem("org_id")
  );
}

function getDateFromAppointment(appointment: ScheduleAppointment | undefined): string | null {
  if (!appointment?.appointmentDate) return null;
  return appointment.appointmentDate;
}

export default function SchedulingPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
  const [selectedProviderId, setSelectedProviderId] = useState("all");
  const [appointments, setAppointments] = useState<ScheduleAppointment[]>([]);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingByAppointment, setActionLoadingByAppointment] = useState<
    Record<string, LoadingAction | undefined>
  >({});
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [collectTarget, setCollectTarget] = useState<ScheduleAppointment | null>(null);
  const [routeTarget, setRouteTarget] = useState<ScheduleAppointment | null>(null);
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddAppointmentFormState>({
    clientFullName: "",
    appointmentTime: "09:00",
    providerId: "",
    appointmentType: "Psychotherapy",
    payerName: "Anthem BCBS",
  });
  const autoAdjustedDateRef = useRef(false);

  const setActionLoading = useCallback((appointmentId: string, action?: LoadingAction) => {
    setActionLoadingByAppointment((current) => ({
      ...current,
      [appointmentId]: action,
    }));
  }, []);

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

      if (
        !result.providers.find((provider) => provider.id === addForm.providerId) &&
        result.providers.length > 0
      ) {
        setAddForm((prev) => ({ ...prev, providerId: result.providers[0].id }));
      }

      if (
        !autoAdjustedDateRef.current &&
        result.appointments.length === 0 &&
        getStoredOrganizationId() === "11111111-1111-1111-1111-111111111111"
      ) {
        const nextDay = addDays(selectedDate, 1);
        const nextDayResult = await scheduleDataSource.fetchDailySchedule({
          date: nextDay,
          providerId: selectedProviderId,
        });

        if (nextDayResult.appointments.length > 0) {
          autoAdjustedDateRef.current = true;
          setSelectedDate(nextDay);
          setAppointments(nextDayResult.appointments);
          setProviders(nextDayResult.providers);
          setInlineMessage(
            `Showing ${formatDisplayDate(nextDay)} because no appointments were found for ${formatDisplayDate(
              selectedDate,
            )}.`,
          );
        }
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the daily schedule. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [addForm.providerId, selectedDate, selectedProviderId]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const totals = useMemo(() => {
    const alerts = appointments.reduce(
      (sum, appointment) => sum + appointment.billingAlertsCount,
      0,
    );
    const balances = appointments.reduce(
      (sum, appointment) => sum + appointment.clientBalance,
      0,
    );
    const claimReady = appointments.filter((appointment) => !appointment.claim).length;

    return {
      appointments: appointments.length,
      alerts,
      balances,
      claimReady,
    };
  }, [appointments]);

  const resolveEncounterId = useCallback(async (appointment: ScheduleAppointment) => {
    if (appointment.encounterId) {
      return appointment.encounterId;
    }

    const resolved = await resolveEncounterForAppointmentViaApi(appointment.id);
    if (!resolved?.encounterId) {
      throw new Error("Unable to resolve encounter for appointment.");
    }

    return resolved.encounterId;
  }, []);

  const handleOpenEncounter = async (appointment: ScheduleAppointment) => {
    try {
      setActionLoading(appointment.id, "encounter");
      const encounterId = await resolveEncounterId(appointment);
      router.push(`/sessions/${encounterId}`);
    } catch (encounterError) {
      setInlineMessage(
        encounterError instanceof Error
          ? encounterError.message
          : "Unable to open encounter.",
      );
    } finally {
      setActionLoading(appointment.id, undefined);
    }
  };

  const handleOpenClient = (appointment: ScheduleAppointment) => {
    router.push(`/patients/${appointment.clientId}`);
  };

  const handleOpenNote = async (appointment: ScheduleAppointment) => {
    try {
      setActionLoading(appointment.id, "encounter");
      const encounterId = await resolveEncounterId(appointment);
      router.push(`/sessions/${encounterId}/note`);
    } catch (noteError) {
      setInlineMessage(
        noteError instanceof Error ? noteError.message : "Unable to open note.",
      );
    } finally {
      setActionLoading(appointment.id, undefined);
    }
  };

  const handleCheckEligibility = async (appointment: ScheduleAppointment) => {
    try {
      setActionLoading(appointment.id, "eligibility");
      const encounterId = await resolveEncounterId(appointment);
      setInlineMessage(
        `Open encounter ${encounterId} to run eligibility with the connected workflow.`,
      );
      router.push(`/sessions/${encounterId}`);
    } catch (eligibilityError) {
      setInlineMessage(
        eligibilityError instanceof Error
          ? eligibilityError.message
          : "Eligibility check failed.",
      );
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
      const encounterId = await resolveEncounterId(appointment);
      const created = await createClaimViaApi(encounterId);

      if (!created.claimId) {
        throw new Error(created.blockers?.join(" ") || "Claim creation blocked.");
      }

      setInlineMessage(`Claim created for ${appointment.clientFullName}.`);
      router.push(`/claims/${created.claimId}`);
    } catch (claimError) {
      setInlineMessage(
        claimError instanceof Error ? claimError.message : "Claim creation failed.",
      );
    } finally {
      setActionLoading(appointment.id, undefined);
    }
  };

  const handleRouteToBiller = async (appointment: ScheduleAppointment) => {
    try {
      setActionLoading(appointment.id, "ticket");
      const encounterId = await resolveEncounterId(appointment);

      const routed = await routeToBillerViaApi({
        sourceObjectType: "encounter",
        sourceObjectId: encounterId,
        title: `Billing review for ${appointment.clientFullName}`,
        description: `Route encounter ${encounterId} to biller from schedule.`,
      });

      setLastTicketId(routed.workqueueItemId || null);
      setInlineMessage(`Routed ${appointment.clientFullName} to biller.`);
      await loadSchedule();
    } catch (routeError) {
      setInlineMessage(
        routeError instanceof Error ? routeError.message : "Unable to route to biller.",
      );
    } finally {
      setActionLoading(appointment.id, undefined);
    }
  };

  const handleCollect = (appointment: ScheduleAppointment) => {
    setCollectTarget(appointment);
    setInlineMessage(`Opening payment workspace for ${appointment.clientFullName}.`);
    router.push("/billing/payment-posting");
  };

  const handleOpenAppointmentIntake = () => {
    setInlineMessage("Opening session intake workflow.");
    router.push("/sessions/new");
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
    } catch (createError) {
      setInlineMessage(
        createError instanceof Error ? createError.message : "Unable to add appointment.",
      );
    }
  };

  const hasAppointments = appointments.length > 0;
  const firstAppointmentDate = getDateFromAppointment(appointments[0]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Daily Schedule"
        subtitle={`Visit readiness command center - ${formatDisplayDate(selectedDate)}`}
        actions={
          <button
            type="button"
            onClick={handleOpenAppointmentIntake}
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
          onToday={() => {
            autoAdjustedDateRef.current = false;
            setSelectedDate(getTodayIsoDate());
          }}
          onAddAppointment={handleOpenAppointmentIntake}
        />

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Appointments
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totals.appointments}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Billing Alerts
            </p>
            <p className="mt-1 text-2xl font-bold text-red-800">{totals.alerts}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Outstanding Balance
            </p>
            <p className="mt-1 text-2xl font-bold text-yellow-800">
              ${totals.balances.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Without Claim
            </p>
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

        {!loading && !error && !hasAppointments && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
            No appointments found for {formatDisplayDate(selectedDate)}.
          </div>
        )}

        {!loading && !error && hasAppointments && (
          <div className="space-y-3">
            {firstAppointmentDate && firstAppointmentDate !== selectedDate && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Showing appointments dated {formatDisplayDate(firstAppointmentDate)}.
              </div>
            )}

            {appointments.map((appointment) => (
              <AppointmentRowCard
                key={appointment.id}
                appointment={appointment}
                loadingAction={actionLoadingByAppointment[appointment.id]}
                onOpenEncounter={handleOpenEncounter}
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
    </div>
  );
}
