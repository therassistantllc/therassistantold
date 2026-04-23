import StatusBadge from './StatusBadge'

export default function ReminderBanner({ reminders, onReminderAction }) {
  const activeReminders = reminders.filter((item) => item.state !== 'Completed')
  const redCount = activeReminders.filter((item) => item.severity === 'red').length
  const yellowCount = activeReminders.filter((item) => item.severity === 'yellow').length

  if (!activeReminders.length) {
    return null
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Global Reminder Center</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700">Red: {redCount}</span>
          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">Yellow: {yellowCount}</span>
        </div>
      </div>

      {redCount > 0 ? (
        <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Immediate blockers detected: {redCount}
        </div>
      ) : null}
      {yellowCount > 0 ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Time-sensitive items detected: {yellowCount}
        </div>
      ) : null}

      <div className="space-y-2 max-h-64 overflow-auto">
        {activeReminders.map((reminder) => (
          <div key={reminder.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{reminder.message}</p>
                <p className="text-xs text-slate-500 mt-1">{reminder.type} • {reminder.clinicianName}</p>
              </div>
              <StatusBadge status={reminder.severity === 'red' ? 'Escalated' : 'Pending'} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={() => onReminderAction(reminder.id, 'Snoozed')} className="px-2 py-1 rounded-lg bg-sky-100 text-sky-700">Snooze</button>
              <button type="button" onClick={() => onReminderAction(reminder.id, 'Completed')} className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">Complete</button>
              <button type="button" onClick={() => onReminderAction(reminder.id, 'Assigned')} className="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700">Assign</button>
              <button type="button" onClick={() => onReminderAction(reminder.id, 'Escalated')} className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700">Escalate</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
