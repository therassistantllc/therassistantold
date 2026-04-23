export default function MonitoringDashboard({ clinician, monitoringTasks, onMarkMonitoringComplete }) {
  if (!clinician) {
    return null
  }

  const metrics = [
    ['Monitoring Status', clinician.monitoringStatus],
    ['Missing Items', String(clinician.missingItems.length)],
    ['Orientation Status', clinician.orientationStatus],
    ['Go-Live Status', clinician.goLiveStatus],
  ]

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-xl font-semibold mb-4">30-Day Monitoring Dashboard</h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {monitoringTasks.length > 0 ? (
          monitoringTasks.map((task) => (
            <div key={task.task} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-medium">{task.task}</p>
              <p className="text-xs text-slate-500 mt-1">Status: {task.status} | Due: {task.dueDate}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No monitoring tasks yet.</p>
        )}
      </div>

      <button
        type="button"
        onClick={onMarkMonitoringComplete}
        className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm"
      >
        Mark 30-Day Monitoring Complete
      </button>
    </div>
  )
}
