import ClinicianCard from './ClinicianCard'
import ProgressBar from './ProgressBar'
import { useDroppable } from '@dnd-kit/core'

export default function PipelineColumn({ phase, clinicians, selectedClinicianId, onSelectClinician }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.name })

  return (
    <div
      ref={setNodeRef}
      className={`bg-slate-50 rounded-2xl p-4 border min-h-[220px] transition ${
        isOver ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'
      }`}
    >
      <div className="flex justify-between items-start mb-3 gap-2">
        <h4 className="font-semibold text-sm leading-tight">{phase.name}</h4>
        <span className={`${phase.colorClass} text-white text-xs px-2 py-1 rounded-full`}>
          {phase.targetPercent}%
        </span>
      </div>

      <ProgressBar value={phase.targetPercent} colorClass={phase.colorClass} />

      <div className="mt-4 space-y-3">
        {clinicians.length > 0 ? (
          clinicians.map((clinician) => (
            <ClinicianCard
              key={clinician.id}
              clinician={clinician}
              onSelect={onSelectClinician}
              isSelected={selectedClinicianId === clinician.id}
            />
          ))
        ) : (
          <p className="text-xs text-slate-500">No clinicians in this phase</p>
        )}
      </div>
    </div>
  )
}
