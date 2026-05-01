"use client";

import { useMemo, useState } from "react";
import { initialBlocks, initialWorkSchedule, providers, WorkScheduleWindow } from "@/lib/canonical-ehr/scheduling";

const days: WorkScheduleWindow["day"][] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WorkScheduleWorkspace() {
  const [schedule, setSchedule] = useState<WorkScheduleWindow[]>(initialWorkSchedule);
  const [selectedProviderId, setSelectedProviderId] = useState(providers[0].id);
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0];
  const windows = useMemo(() => schedule.filter((window) => window.providerId === selectedProviderId), [schedule, selectedProviderId]);

  function toggleDay(day: WorkScheduleWindow["day"]) {
    setSchedule((current) => {
      const found = current.find((window) => window.providerId === selectedProviderId && window.day === day);
      if (found) return current.map((window) => window.id === found.id ? { ...window, enabled: !window.enabled } : window);
      return [...current, { id: `ws-${Date.now()}`, providerId: selectedProviderId, day, start: "09:00", end: "17:00", location: "Office + Telehealth", enabled: true }];
    });
  }

  function patchWindow(id: string, patch: Partial<WorkScheduleWindow>) {
    setSchedule((current) => current.map((window) => window.id === id ? { ...window, ...patch } : window));
  }

  return (
    <main className="ws-shell">
      <section className="ws-hero"><div><span>Provider availability controls scheduling</span><h1>Work Schedule</h1><p>Define when each provider can be booked. Scheduling should prevent appointments outside these windows.</p></div><a href="/scheduling">Back to Scheduling</a></section>
      <section className="ws-tabs">{providers.map((provider) => <button key={provider.id} className={provider.id === selectedProviderId ? "active" : ""} onClick={() => setSelectedProviderId(provider.id)}><span style={{ backgroundColor: provider.color }} />{provider.name}, {provider.credentials}</button>)}</section>
      <section className="ws-layout">
        <section className="ws-card">
          <div className="ws-head"><div><h2>{selectedProvider.name}'s Availability</h2><p>Toggle days on/off and set bookable hours and location.</p></div></div>
          <div className="ws-days">
            {days.map((day) => {
              const window = windows.find((item) => item.day === day);
              return <div key={day} className={`ws-day ${window?.enabled ? "enabled" : ""}`}><div className="ws-day-head"><strong>{day}</strong><button onClick={() => toggleDay(day)}>{window?.enabled ? "Available" : "Unavailable"}</button></div>{window ? <div className="ws-fields"><label>Start<input type="time" value={window.start} disabled={!window.enabled} onChange={(event) => patchWindow(window.id, { start: event.target.value })} /></label><label>End<input type="time" value={window.end} disabled={!window.enabled} onChange={(event) => patchWindow(window.id, { end: event.target.value })} /></label><label>Location<select value={window.location} disabled={!window.enabled} onChange={(event) => patchWindow(window.id, { location: event.target.value as WorkScheduleWindow["location"] })}><option>Office</option><option>Telehealth</option><option>Office + Telehealth</option></select></label></div> : <p>No availability window configured.</p>}</div>;
            })}
          </div>
        </section>
        <aside className="ws-card">
          <h2>Non-Clinical Blocks</h2>
          <p>Blocks control time but never create encounters, charges, or claims.</p>
          <div className="ws-blocks">{initialBlocks.filter((block) => block.providerId === selectedProviderId).map((block) => <div key={block.id}><strong>{block.title}</strong><span>{new Date(block.start).toLocaleString()} - {new Date(block.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><em>{block.kind}</em></div>)}</div>
          <div className="ws-rules"><h3>Rules</h3><ul><li>Appointments require patient, provider, type, start time, duration, and location.</li><li>Only completed appointments create encounters.</li><li>Recurring appointments create independent records.</li></ul></div>
        </aside>
      </section>
      <style jsx global>{`
        .ws-shell{min-height:100vh;background:#f3f6fb;color:#0f172a;padding:24px}.ws-hero,.ws-tabs,.ws-card{background:white;border:1px solid #dbe3ef;border-radius:24px;box-shadow:0 18px 45px rgba(15,23,42,.06)}.ws-hero{padding:28px;display:flex;justify-content:space-between;gap:18px;margin-bottom:18px}.ws-hero h1{font-size:clamp(32px,5vw,54px);letter-spacing:-.06em;line-height:.95;margin:12px 0 8px}.ws-hero p,.ws-card p{color:#64748b;line-height:1.55}.ws-hero span{display:inline-flex;border-radius:999px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:5px 9px;font-size:11px;font-weight:900}.ws-hero a{background:#111827;color:white;padding:10px 12px;border-radius:14px;text-decoration:none;font-weight:900;height:max-content}.ws-tabs{display:flex;gap:8px;padding:12px;margin-bottom:18px;flex-wrap:wrap}.ws-tabs button{border:1px solid #dbe3ef;border-radius:999px;background:#f8fafc;padding:10px 12px;font-weight:900;display:flex;gap:8px;align-items:center;cursor:pointer}.ws-tabs button.active{background:#111827;color:white}.ws-tabs span{width:12px;height:12px;border-radius:999px}.ws-layout{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:18px}.ws-card{padding:18px}.ws-head{display:flex;justify-content:space-between;margin-bottom:16px}.ws-days{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.ws-day{border:1px solid #dbe3ef;border-radius:18px;padding:14px;background:#f8fafc}.ws-day.enabled{background:#ecfdf5;border-color:#a7f3d0}.ws-day-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}.ws-day-head button{border:1px solid #dbe3ef;border-radius:999px;background:white;padding:7px 10px;font-weight:900;cursor:pointer}.ws-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ws-fields label{display:grid;gap:5px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-weight:900;font-size:11px}.ws-fields input,.ws-fields select{border:1px solid #dbe3ef;border-radius:12px;padding:9px;color:#0f172a;font-weight:800;background:white}.ws-blocks{display:grid;gap:10px}.ws-blocks div,.ws-rules{border:1px solid #dbe3ef;border-radius:18px;padding:13px;background:#f8fafc;display:grid;gap:6px}.ws-blocks span{color:#64748b;font-size:13px}.ws-blocks em{font-style:normal;font-weight:900;color:#b45309}.ws-rules{margin-top:14px;background:#eff6ff;border-color:#bfdbfe;color:#1e40af}@media(max-width:1050px){.ws-layout,.ws-days{grid-template-columns:1fr}.ws-hero{flex-direction:column}}@media(max-width:720px){.ws-shell{padding:12px}.ws-fields{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
