import ProgressBar from './ProgressBar'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export default function ClinicianCard({ clinician, onSelect, isSelected, draggable = true }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: clinician.id,
    disabled: !draggable,
    data: {
      type: 'clinician',
      clinicianId: clinician.id,
      fromPhase: clinician.onboardingPhase,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={() => onSelect(clinician.id)}
      className={`w-full rounded-xl border p-3 text-left shadow-sm transition ${
        isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      {...listeners}
      {...attributes}
    >
      <p className="font-semibold text-sm">{clinician.fullName}, {clinician.credentials}</p>
      <p className="text-slate-500 text-xs mt-1">Assigned: {clinician.assignedStaff}</p>
      <p className="text-slate-500 text-xs">Due: {clinician.dueDate}</p>
      <div className="mt-2">
        <ProgressBar value={clinician.onboardingPercent} colorClass="bg-slate-900" size="sm" />
      </div>
    </button>
  )
}
