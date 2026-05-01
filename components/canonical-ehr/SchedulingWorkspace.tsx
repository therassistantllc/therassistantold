"use client";

import { useMemo, useState } from "react";
import {
  Appointment,
  AppointmentFormState,
  AppointmentType,
  CalendarView,
  appointmentCanCreateEncounter,
  appointmentHeightPx,
  appointmentTopPx,
  appointmentTypeDefaults,
  appointmentTypes,
  countStatuses,
  createAppointmentFromForm,
  createEncounterId,
  formatDisplayDate,
  formatDisplayTime,
  getTimeSlots,
  initialAppointments,
  initialBlocks,
  nextAppointmentStatus,
  providers,
  sameDate,
  statusLabel,
  statusTone,
} from "@/lib/canonical-ehr/scheduling";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`sch-badge sch-badge-${tone}`}>{children}</span>;
}

function Button({ children, onClick, disabled, tone = "default" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: string }) {
  return <button className={`sch-btn sch-btn-${tone}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export default function SchedulingWorkspace() {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [view, setView] = useState<CalendarView>("week");
  const [selectedDate, setSelectedDate] = useState("2026-04-28");
  const [selectedProviderIds, setSelectedProviderIds] = useState(providers.map((p) => p.id));
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(initialAppointments[0]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AppointmentFormState>({
    patientName: "Avery Morgan",
    providerId: "prov-lena",
    type: "90837",
    date: "2026-04-28",
    startTime: "15:00",
    durationMinutes: 60,
    location: "Telehealth",
    recurrence: "none",
    recurrenceCount: 1,
    notes: "",
    sendReminder: true,
  });

  const visibleProviders = providers.filter((provider) => selectedProviderIds.includes(provider.id));
  const dayAppointments = appointments.filter((appointment) => sameDate(appointment.start, selectedDate));
  const visibleAppointments = appointments
    .filter((appointment) => selectedProviderIds.includes(appointment.providerId))
    .filter((appointment) => view === "month" || sameDate(appointment.start, selectedDate))
    .sort((a, b) => a.start.localeCompare(b.start));
  const stats = countStatuses(dayAppointments);
  const slots = getTimeSlots();

  function toggleProvider(id: string) {
    setSelectedProviderIds((current) => {
      if (current.includes(id) && current.length > 1) return current.filter((item) => item !== id);
      if (!current.includes(id)) return [...current, id];
      return current;
    });
  }

  function updateAppointment(id: string, updater: (appointment: Appointment) => Appointment) {
    setAppointments((current) => current.map((appointment) => appointment.id === id ? updater(appointment) : appointment));
    setSelectedAppointment((current) => current?.id === id ? updater(current) : current);
  }

  function advanceStatus(appointment: Appointment) {
    const next = nextAppointmentStatus(appointment.status);
    if (!next) return;
    updateAppointment(appointment.id, (current) => ({
      ...current,
      status: next,
      flags: [...new Set([...current.flags, next === "completed" ? "ready for encounter" : "arrived"])],
    }));
  }

  function createEncounter(appointment: Appointment) {
    updateAppointment(appointment.id, (current) => ({
      ...current,
      status: "completed",
      encounterId: createEncounterId(current.id),
      flags: [...new Set([...current.flags, "encounter created", "documentation needed"])],
    }));
  }

  function cancelAppointment(appointment: Appointment) {
    updateAppointment(appointment.id, (current) => ({ ...current, status: "cancelled", flags: [...new Set([...current.flags, "cancelled"])] }));
  }

  function markNoShow(appointment: Appointment) {
    updateAppointment(appointment.id, (current) => ({ ...current, status: "no_show", flags: [...new Set([...current.flags, "no show"])] }));
  }

  function updateFormType(type: AppointmentType) {
    setForm((current) => ({ ...current, type, durationMinutes: appointmentTypeDefaults[type].duration }));
  }

  function createAppointments() {
    const count = form.recurrence === "none" ? 1 : Math.max(1, Math.min(52, form.recurrenceCount));
    const created = Array.from({ length: count }, (_, index) => createAppointmentFromForm(form, index));
    setAppointments((current) => [...current, ...created].sort((a, b) => a.start.localeCompare(b.start)));
    setSelectedAppointment(created[0]);
    setShowForm(false);
  }

  function AppointmentCard({ appointment, compact = false }: { appointment: Appointment; compact?: boolean }) {
    const provider = providers.find((item) => item.id === appointment.providerId);
    return (
      <button className={`sch-appt sch-appt-${statusTone(appointment.status)} ${compact ? "sch-appt-compact" : ""}`} onClick={() => setSelectedAppointment(appointment)} style={{ borderLeftColor: provider?.color }}>
        <div className="sch-appt-row"><strong>{appointment.patientName}</strong><Badge tone={statusTone(appointment.status)}>{statusLabel(appointment.status)}</Badge></div>
        <p>{formatDisplayTime(appointment.start)} - {formatDisplayTime(appointment.end)} · {appointment.type}</p>
        <small>{provider?.name}, {provider?.credentials} · {appointment.location}</small>
        <div className="sch-flags">{appointment.flags.map((flag) => <span key={flag}>{flag}</span>)}</div>
      </button>
    );
  }

  return (
    <main className="sch-shell">
      <section className="sch-hero">
        <div>
          <div className="sch-kicker"><Badge tone="blue">Scheduling entry point</Badge><Badge tone="green">Appointment → Encounter → Note → Charge → Claim</Badge></div>
          <h1>Scheduling Command Center</h1>
          <p>Control provider time, patient flow, reminders, telehealth, appointment lifecycle, and downstream encounter creation.</p>
        </div>
        <div className="sch-actions">
          <Button tone="primary" onClick={() => setShowForm(true)}>Schedule Appointment</Button>
          <a className="sch-link" href="/work-schedule">Manage Work Schedule</a>
        </div>
      </section>

      <section className="sch-toolbar">
        <div className="sch-switcher">
          {(["day", "week", "month"] as CalendarView[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}
        </div>
        <label>Date <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <div className="sch-provider-filter">
          {providers.map((provider) => (
            <button key={provider.id} className={selectedProviderIds.includes(provider.id) ? "active" : ""} onClick={() => toggleProvider(provider.id)}>
              <span style={{ backgroundColor: provider.color }} /> {provider.name}
            </button>
          ))}
        </div>
      </section>

      <section className="sch-stats">
        <div><span>Scheduled</span><strong>{stats.scheduled}</strong><small>Initial state</small></div>
        <div><span>Checked In</span><strong>{stats.checkedIn}</strong><small>Patient arrived</small></div>
        <div><span>Completed</span><strong>{stats.completed}</strong><small>Can create encounter</small></div>
        <div><span>No show / cancelled</span><strong>{stats.cancelledOrNoShow}</strong><small>Tracked, not billable</small></div>
      </section>

      {showForm && (
        <section className="sch-form-panel">
          <div className="sch-panel-head"><div><h2>Schedule Appointment</h2><p>Scheduling creates appointment records only. Billing is finalized later from encounters.</p></div><Button onClick={() => setShowForm(false)}>Close</Button></div>
          <div className="sch-form-grid">
            <label>Patient<input value={form.patientName} onChange={(event) => setForm({ ...form, patientName: event.target.value })} /></label>
            <label>Provider<select value={form.providerId} onChange={(event) => setForm({ ...form, providerId: event.target.value })}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}, {provider.credentials}</option>)}</select></label>
            <label>Type<select value={form.type} onChange={(event) => updateFormType(event.target.value as AppointmentType)}>{appointmentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            <label>Start<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label>
            <label>Duration<input type="number" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} /></label>
            <label>Location<select value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value as AppointmentFormState["location"] })}><option>Office</option><option>Telehealth</option></select></label>
            <label>Recurrence<select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as AppointmentFormState["recurrence"] })}><option value="none">None</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option></select></label>
            <label>Sessions<input type="number" min={1} max={52} disabled={form.recurrence === "none"} value={form.recurrenceCount} onChange={(event) => setForm({ ...form, recurrenceCount: Number(event.target.value) })} /></label>
            <label className="sch-wide">Scheduling notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Internal scheduling notes only." /></label>
          </div>
          <div className="sch-defaults"><Badge tone="blue">Default CPT {appointmentTypeDefaults[form.type].cpt}</Badge><span>{appointmentTypeDefaults[form.type].label}</span><label><input type="checkbox" checked={form.sendReminder} onChange={(event) => setForm({ ...form, sendReminder: event.target.checked })} /> Send reminder</label></div>
          <div className="sch-actions"><Button onClick={() => setShowForm(false)}>Cancel</Button><Button tone="primary" onClick={createAppointments}>Create Appointment{form.recurrence !== "none" ? " Series" : ""}</Button></div>
        </section>
      )}

      <section className="sch-layout">
        <section className="sch-calendar-card">
          <div className="sch-panel-head"><div><h2>{view === "month" ? "Month Planning" : "Provider Calendar"}</h2><p>{view === "month" ? "High-level planning." : "Provider columns with 15-minute increments."}</p></div><Badge tone="purple">{formatDisplayDate(`${selectedDate}T12:00:00`)}</Badge></div>
          {view === "month" ? (
            <div className="sch-month">
              {Array.from({ length: 35 }, (_, index) => {
                const day = new Date(`${selectedDate}T00:00:00`);
                day.setDate(day.getDate() - day.getDay() + index);
                const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                const matches = appointments.filter((appointment) => sameDate(appointment.start, key));
                return <button key={key} className={key === selectedDate ? "active" : ""} onClick={() => { setSelectedDate(key); setView("week"); }}><strong>{day.getDate()}</strong><span>{matches.length} appts</span>{matches.slice(0, 2).map((item) => <small key={item.id}>{item.patientName}</small>)}</button>;
              })}
            </div>
          ) : (
            <div className="sch-grid-calendar">
              <div className="sch-time-axis"><div className="sch-provider-head">Time</div>{slots.map((slot) => <div key={slot} className="sch-time-slot">{slot.endsWith(":00") ? slot : ""}</div>)}</div>
              {visibleProviders.map((provider) => {
                const providerAppointments = visibleAppointments.filter((appointment) => appointment.providerId === provider.id);
                const providerBlocks = initialBlocks.filter((block) => block.providerId === provider.id && sameDate(block.start, selectedDate));
                return (
                  <div key={provider.id} className="sch-provider-col">
                    <div className="sch-provider-head"><span style={{ backgroundColor: provider.color }} /><strong>{provider.name}</strong><em>{provider.credentials}</em></div>
                    <div className="sch-provider-body">
                      {slots.map((slot) => <button key={slot} className="sch-slot" onClick={() => { setForm({ ...form, providerId: provider.id, date: selectedDate, startTime: slot }); setShowForm(true); }} />)}
                      {providerBlocks.map((block) => <div key={block.id} className="sch-positioned" style={{ top: appointmentTopPx(block.start), height: appointmentHeightPx((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000) }}><div className="sch-block"><strong>{block.title}</strong><small>{formatDisplayTime(block.start)} - {formatDisplayTime(block.end)}</small><em>{block.kind}</em></div></div>)}
                      {providerAppointments.map((appointment) => <div key={appointment.id} className="sch-positioned" style={{ top: appointmentTopPx(appointment.start), height: appointmentHeightPx(appointment.durationMinutes) }}><AppointmentCard appointment={appointment} compact /></div>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="sch-detail-card">
          {selectedAppointment ? (
            <>
              <div className="sch-panel-head"><div><h2>{selectedAppointment.patientName}</h2><p>{formatDisplayDate(selectedAppointment.start)} · {formatDisplayTime(selectedAppointment.start)} - {formatDisplayTime(selectedAppointment.end)}</p></div><Badge tone={statusTone(selectedAppointment.status)}>{statusLabel(selectedAppointment.status)}</Badge></div>
              <div className="sch-detail-list">
                <div><span>Type</span><strong>{selectedAppointment.type}</strong></div>
                <div><span>Default CPT</span><strong>{selectedAppointment.defaultCpt}</strong></div>
                <div><span>Location</span><strong>{selectedAppointment.location}</strong></div>
                <div><span>Reminder</span><strong>{selectedAppointment.reminderStatus.replace("_", " ")}</strong></div>
                <div><span>Duration</span><strong>{selectedAppointment.durationMinutes} minutes</strong></div>
              </div>
              {selectedAppointment.telehealthUrl && <div className="sch-info-box"><strong>Telehealth</strong><span>{selectedAppointment.telehealthUrl}</span></div>}
              <div className="sch-notes"><strong>Scheduling notes</strong><p>{selectedAppointment.notes || "No notes."}</p></div>
              <div className="sch-actions">
                <Button tone="warning" onClick={() => advanceStatus(selectedAppointment)} disabled={!nextAppointmentStatus(selectedAppointment.status)}>{selectedAppointment.status === "scheduled" ? "Check In" : selectedAppointment.status === "checked_in" ? "Mark Completed" : "Status Complete"}</Button>
                <Button tone="primary" onClick={() => createEncounter(selectedAppointment)} disabled={!appointmentCanCreateEncounter(selectedAppointment)}>Create Encounter</Button>
                <a className={`sch-link ${selectedAppointment.encounterId ? "" : "disabled"}`} href={selectedAppointment.encounterId ? `/encounters/${selectedAppointment.encounterId}` : "#"}>Open Encounter</a>
                <a className="sch-link" href={`/patients/${selectedAppointment.patientId}`}>Open Patient Chart</a>
                <Button tone="danger" onClick={() => cancelAppointment(selectedAppointment)} disabled={selectedAppointment.status === "completed"}>Cancel</Button>
                <Button onClick={() => markNoShow(selectedAppointment)} disabled={selectedAppointment.status === "completed"}>No Show</Button>
              </div>
              <div className="sch-rule"><strong>Compliance gate:</strong> Only completed appointments can move into documentation, charges, claims, and billing.</div>
            </>
          ) : <div className="sch-empty"><h2>No appointment selected</h2><p>Click an appointment block.</p></div>}
        </aside>
      </section>

      <style jsx global>{`
        .sch-shell{min-height:100vh;background:#f3f6fb;color:#0f172a;padding:24px}.sch-hero,.sch-toolbar,.sch-form-panel,.sch-calendar-card,.sch-detail-card,.sch-stats>div{background:white;border:1px solid #dbe3ef;border-radius:24px;box-shadow:0 18px 45px rgba(15,23,42,.06)}.sch-hero{display:flex;justify-content:space-between;gap:24px;padding:28px;margin-bottom:18px}.sch-hero h1{font-size:clamp(32px,5vw,54px);letter-spacing:-.06em;line-height:.95;margin:12px 0 8px}.sch-hero p,.sch-panel-head p{color:#64748b;line-height:1.55;margin:0}.sch-kicker,.sch-actions,.sch-defaults{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.sch-toolbar{display:grid;grid-template-columns:auto 190px 1fr;gap:14px;align-items:end;padding:14px;margin-bottom:18px}.sch-switcher,.sch-provider-filter{display:flex;gap:8px;flex-wrap:wrap}.sch-switcher button,.sch-provider-filter button{border:1px solid #dbe3ef;border-radius:999px;background:#f8fafc;padding:9px 12px;font-weight:800;cursor:pointer}.sch-switcher button.active,.sch-provider-filter button.active{background:#111827;color:white;border-color:#111827}.sch-provider-filter span,.sch-provider-head span{display:inline-block;width:11px;height:11px;border-radius:999px}.sch-toolbar label,.sch-form-grid label{display:grid;gap:6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#64748b}.sch-toolbar input,.sch-form-grid input,.sch-form-grid select,.sch-form-grid textarea{border:1px solid #dbe3ef;border-radius:14px;padding:10px;color:#0f172a;font-weight:700;background:white;text-transform:none;letter-spacing:0}.sch-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.sch-stats>div{padding:18px}.sch-stats span{color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:900}.sch-stats strong{display:block;font-size:34px;letter-spacing:-.05em;margin-top:8px}.sch-stats small{color:#64748b}.sch-form-panel{padding:18px;margin-bottom:18px}.sch-panel-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}.sch-panel-head h2{margin:0 0 4px;font-size:22px;letter-spacing:-.04em}.sch-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.sch-wide{grid-column:1/-1}.sch-wide textarea{min-height:88px}.sch-defaults{background:#f8fafc;border:1px solid #dbe3ef;border-radius:18px;padding:12px;margin:14px 0}.sch-layout{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:18px}.sch-calendar-card,.sch-detail-card{padding:18px}.sch-grid-calendar{display:grid;grid-template-columns:72px repeat(3,minmax(230px,1fr));overflow-x:auto;border:1px solid #dbe3ef;border-radius:20px}.sch-time-axis,.sch-provider-col{border-right:1px solid #dbe3ef}.sch-provider-col{min-width:240px}.sch-provider-head{height:58px;padding:10px;border-bottom:1px solid #dbe3ef;background:#f8fafc;display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:3}.sch-provider-head em{font-size:12px;color:#64748b;font-style:normal}.sch-time-slot,.sch-slot{height:15.75px;border:0;border-bottom:1px solid #edf2f7;background:white;color:#64748b;font-size:11px}.sch-time-slot{padding-left:8px}.sch-slot{display:block;width:100%;cursor:pointer}.sch-slot:hover{background:#eff6ff}.sch-provider-body{position:relative;min-height:819px}.sch-positioned{position:absolute;left:8px;right:8px;z-index:2}.sch-appt{width:100%;text-align:left;border:1px solid #dbe3ef;border-left:6px solid #2563eb;border-radius:18px;padding:12px;background:white;cursor:pointer;box-shadow:0 12px 26px rgba(15,23,42,.08)}.sch-appt-compact{height:100%;overflow:hidden;padding:8px;border-radius:14px}.sch-appt-row{display:flex;justify-content:space-between;gap:8px}.sch-appt p,.sch-appt small{display:block;color:#475569;font-size:12px;margin:4px 0 0}.sch-flags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.sch-flags span{font-size:10px;padding:3px 6px;border-radius:999px;background:#f1f5f9;color:#475569;font-weight:800}.sch-block{height:100%;border:1px dashed #cbd5e1;background:#f8fafc;border-radius:14px;padding:8px;color:#475569;display:grid;align-content:center}.sch-block em{font-style:normal;font-size:12px}.sch-month{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}.sch-month button{min-height:110px;border:1px solid #dbe3ef;border-radius:16px;background:white;padding:10px;text-align:left;display:grid;align-content:start;gap:5px;cursor:pointer}.sch-month button.active{border-color:#2563eb;background:#eff6ff}.sch-detail-list{display:grid;gap:8px}.sch-detail-list div{display:flex;justify-content:space-between;gap:14px;padding:12px;border-radius:16px;background:#f8fafc;border:1px solid #dbe3ef}.sch-detail-list span{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.sch-info-box,.sch-notes,.sch-rule{border-radius:18px;padding:13px;margin-top:12px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;display:grid;gap:4px}.sch-notes{background:#f8fafc;color:#334155;border-color:#dbe3ef}.sch-rule{background:#fffbeb;color:#92400e;border-color:#fde68a}.sch-btn,.sch-link{border:1px solid #dbe3ef;border-radius:14px;background:white;color:#0f172a;padding:10px 12px;font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.sch-btn-primary,.sch-link{background:#111827;color:white;border-color:#111827}.sch-btn-warning{background:#d97706;color:white;border-color:#d97706}.sch-btn-danger{background:#e11d48;color:white;border-color:#e11d48}.sch-btn:disabled,.sch-link.disabled{opacity:.5;cursor:not-allowed;pointer-events:none}.sch-badge{border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;border:1px solid #dbe3ef;background:#f8fafc;color:#475569;display:inline-flex;white-space:nowrap}.sch-badge-blue{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}.sch-badge-green{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.sch-badge-amber{background:#fffbeb;color:#b45309;border-color:#fde68a}.sch-badge-red{background:#fff1f2;color:#be123c;border-color:#fecdd3}.sch-badge-purple{background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe}@media(max-width:1100px){.sch-hero,.sch-panel-head{flex-direction:column}.sch-toolbar,.sch-layout{grid-template-columns:1fr}.sch-stats,.sch-form-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.sch-shell{padding:12px}.sch-stats,.sch-form-grid,.sch-month{grid-template-columns:1fr}.sch-actions .sch-btn,.sch-actions .sch-link{width:100%}}
      `}</style>
    </main>
  );
}
