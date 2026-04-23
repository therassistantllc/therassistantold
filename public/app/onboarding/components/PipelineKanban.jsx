import PipelineColumn from './PipelineColumn'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import ClinicianCard from './ClinicianCard'

export default function PipelineKanban({
  phases,
  clinicians,
  selectedClinicianId,
  onSelectClinician,
  onMoveClinician,
}) {
  const [activeClinicianId, setActiveClinicianId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeClinician = useMemo(
    () => clinicians.find((clinician) => clinician.id === activeClinicianId) || null,
    [clinicians, activeClinicianId]
  )

  const handleDragStart = (event) => {
    setActiveClinicianId(event.active.id)
  }

  const handleDragEnd = (event) => {
    setActiveClinicianId(null)

    if (!event.over || !event.active) {
      return
    }

    const clinicianId = event.active.id
    const targetPhase = String(event.over.id)
    onMoveClinician(clinicianId, targetPhase)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Onboarding Pipeline</h3>
          <span className="text-sm text-slate-500">Drag clinicians between phases</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {phases.map((phase) => {
            const cliniciansInPhase = clinicians.filter(
              (clinician) => clinician.onboardingPhase === phase.name
            )

            return (
              <PipelineColumn
                key={phase.id}
                phase={phase}
                clinicians={cliniciansInPhase}
                selectedClinicianId={selectedClinicianId}
                onSelectClinician={onSelectClinician}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {activeClinician ? (
          <div className="w-72">
            <ClinicianCard clinician={activeClinician} onSelect={() => {}} isSelected={false} draggable={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
