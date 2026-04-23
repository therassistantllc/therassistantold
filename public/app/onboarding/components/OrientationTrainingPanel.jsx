import StatusBadge from './StatusBadge'

export default function OrientationTrainingPanel({ tasks }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-xl font-semibold mb-4">Orientation and Training</h3>

      <div className="space-y-3">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div key={task.task} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{task.task}</p>
                <StatusBadge status={task.status} />
              </div>
              <p className="text-xs text-slate-500 mt-2">Due: {task.dueDate}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No orientation tasks assigned.</p>
        )}
      </div>
    </div>
  )
}
