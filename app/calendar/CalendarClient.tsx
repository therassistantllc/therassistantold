"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  countStatuses,
  formatDisplayDate,
  formatDisplayTime,
  getTimeSlots,
  providers,
  statusLabel,
  statusTone,
  type Appointment,
} from "@/lib/canonical-ehr/scheduling";

type AppointmentWithId = Appointment & { id: string };

function toneStyle(appointment: Appointment) {
  const tone = statusTone(appointment.status);
  if (tone === "green") return { borderColor: "#1d7f49", background: "#eef9f1" };
  if (tone === "amber") return { borderColor: "#b7791f", background: "#fff8e8" };
  if (tone === "red") return { borderColor: "#c53030", background: "#fff0f0" };
  if (tone === "blue") return { borderColor: "#2b6cb0", background: "#eef4ff" };
  return { borderColor: "#5c6e82", background: "#f5f7f9" };
}

export function CalendarClient() {
  const [appointments, setAppointments] = useState<AppointmentWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [clientId, setClientId] = useState("");
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [appointmentType, setAppointmentType] = useState("Intake");
  const [reason, setReason] = useState("");
  const [serviceLocation, setServiceLocation] = useState<"office" | "telehealth">("telehealth");

  const organizationId = useMemo(() => {
    if (typeof window === "undefined") return process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
    return new URLSearchParams(window.location.search).get("organizationId") || process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";
  }, []);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/scheduling/appointments?organizationId=${encodeURIComponent(organizationId)}`);
      const data = (await response.json()) as { success?: boolean; appointments?: AppointmentWithId[]; error?: string };
      if (!response.ok || !data.success) {
        setError(data.error || "Unable to load appointments");
        setAppointments([]);
      } else {
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      setError((err instanceof Error) ? err.message : "Failed to load appointments");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      void loadAppointments();
    } else {
      setError("Missing organizationId.");
      setLoading(false);
    }
  }, [organizationId, loadAppointments]);

  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !providerId || !scheduledStartAt || !appointmentType || !reason) {
      setError("All fields are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/scheduling/appointments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          clientId,
          providerId,
          scheduledStartAt,
          durationMinutes,
          appointmentType,
          reason,
          serviceLocation,
          reminderEmailEnabled: true,
        }),
      });

      const data = (await response.json()) as { success?: boolean; error?: string; appointmentIds?: string[] };
      if (!response.ok || !data.success) {
        setError(data.error || "Unable to create appointment");
      } else {
        setMessage(`Appointment created successfully (${data.appointmentIds?.length || 1} instance${data.appointmentIds && data.appointmentIds.length !== 1 ? 's' : ''})`);
        // Reset form
        setClientId("");
        setProviderId(providers[0]?.id ?? "");
        setScheduledStartAt("");
        setDurationMinutes(60);
        setAppointmentType("Intake");
        setReason("");
        setServiceLocation("telehealth");
        // Reload appointments
        await loadAppointments();
      }
    } catch (err) {
      setError((err instanceof Error) ? err.message : "Failed to create appointment");
    } finally {
      setSubmitting(false);
    }
  }

  const statusCounts = countStatuses(appointments);
  const slotCount = getTimeSlots(8, 18).length;

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>Scheduling Workspace</h1>
          <p className="hero-copy">
            Manage today&apos;s schedule, check-in readiness, eligibility context, and visit handoffs from one calendar-first home screen.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button" href="/clinician/agenda">Open Agenda View</Link>
          <Link className="button button-secondary" href="/clients">Search Patient</Link>
          <Link className="button button-secondary" href="/chart-room">Chart Room</Link>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card"><span>Scheduled</span><strong>{statusCounts.scheduled}</strong></article>
        <article className="metric-card"><span>Checked In</span><strong>{statusCounts.checkedIn}</strong></article>
        <article className="metric-card"><span>Completed</span><strong>{statusCounts.completed}</strong></article>
        <article className="metric-card"><span>Slots (8a-6p)</span><strong>{slotCount}</strong></article>
      </section>

      {error && <div className="alert-panel">{error}</div>}
      {message && <div className="empty-state success-panel">{message}</div>}

      <section className="two-column-panel">
        <div className="panel form-panel">
          <h2>Create Appointment</h2>
          <form onSubmit={handleCreateAppointment}>
            <div className="form-group">
              <label>Patient ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter client ID"
                required
              />
            </div>
            <div className="form-group">
              <label>Provider</label>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} required>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Start Date/Time</label>
              <input
                type="datetime-local"
                value={scheduledStartAt}
                onChange={(e) => setScheduledStartAt(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(15, Number(e.target.value)))}
                min={15}
                step={15}
                required
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={appointmentType} onChange={(e) => setAppointmentType(e.target.value)} required>
                <option>Intake</option>
                <option>Follow-up</option>
                <option>Telehealth</option>
                <option>Initial Consultation</option>
              </select>
            </div>
            <div className="form-group">
              <label>Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Behavioral health assessment"
                required
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <select value={serviceLocation} onChange={(e) => setServiceLocation(e.target.value as "office" | "telehealth")} required>
                <option value="office">Office</option>
                <option value="telehealth">Telehealth</option>
              </select>
            </div>
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? "Creating..." : "Create Appointment"}
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Today&apos;s Appointments</h2>
              {loading && <p>Loading...</p>}
            </div>
            <button className="button button-secondary" onClick={() => void loadAppointments()} disabled={loading}>
              Refresh
            </button>
          </div>
          <div className="stack-list">
            {appointments.length === 0 && !loading ? (
              <p className="empty-state">No appointments scheduled yet.</p>
            ) : (
              appointments.map((appointment) => (
                <article className="stack-item" key={appointment.id} style={toneStyle(appointment)}>
                  <div className="stack-row">
                    <div>
                      <strong>{appointment.patientName}</strong>
                      <span>{formatDisplayDate(appointment.start)} · {formatDisplayTime(appointment.start)}-{formatDisplayTime(appointment.end)}</span>
                      <span>{appointment.type} · {appointment.location} · {statusLabel(appointment.status)}</span>
                    </div>
                    <div className="section-actions">
                      <Link className="button button-secondary" href="/clinician/agenda">Open Agenda</Link>
                      <Link className="button" href={`/encounters/new?appointmentId=${appointment.id}`}>Start Note</Link>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="chart-grid">
        <article className="panel">
          <h2>Provider Directory</h2>
          <div className="detail-list">
            {providers.map((provider) => (
              <p key={provider.id}><strong>{provider.name}</strong> ({provider.credentials}) · {provider.location}</p>
            ))}
          </div>
        </article>
        <article className="panel">
          <h2>Available Time Slots</h2>
          <div className="detail-list">
            <p>Operating hours: 8:00 AM - 6:00 PM</p>
            <p>Available slots: {slotCount}</p>
            <p>15-minute intervals required for scheduling.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
