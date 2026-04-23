import { useEffect, useMemo, useState } from 'react'
import { clinicians as initialClinicians } from '../mock-data/clinicians'
import { onboardingPhases } from '../mock-data/onboardingPhases'
import {
  credentialingPayers as initialPayers,
  PAYER_PRESETS,
  createDefaultPayerRow,
} from '../mock-data/credentialingPayers'
import { requiredDocuments as initialDocuments } from '../mock-data/requiredDocuments'
import { onboardingTasks as initialTasks } from '../mock-data/onboardingTasks'
import {
  buildClinicianSnapshot,
  canMoveToPhase,
  estimateGoLiveDate,
} from '../utils/onboardingEngine'
import SidebarNavigation from './SidebarNavigation'
import PipelineKanban from './PipelineKanban'
import ClinicianProfilePanel from './ClinicianProfilePanel'
import CredentialingTrackerTable from './CredentialingTrackerTable'
import RequiredDocumentsPanel from './RequiredDocumentsPanel'
import MissingItemsPanel from './MissingItemsPanel'
import GoLiveReadinessPanel from './GoLiveReadinessPanel'
import OrientationTrainingPanel from './OrientationTrainingPanel'
import MonitoringDashboard from './MonitoringDashboard'
import ReminderBanner from './ReminderBanner'
import ClinicianDetailDrawer from './ClinicianDetailDrawer'

const isCompleteStatus = (value) => ['Approved', 'Active', 'Completed', 'Fully Complete', 'Ready', 'Live', 'Yes'].includes(value)

const makeLog = (user, action, comments) => ({
  id: `${Date.now()}-${Math.random()}`,
  date: new Date().toISOString().slice(0, 10),
  user,
  action,
  comments,
})

function buildReminders(clinicians, documents, payers, tasks) {
  const today = new Date().toISOString().slice(0, 10)
  const reminders = []

  clinicians.forEach((clinician) => {
    const clinicianDocuments = documents.filter((doc) => doc.clinicianId === clinician.id)
    const clinicianPayers = payers.filter((payer) => payer.clinicianId === clinician.id)
    const clinicianTasks = tasks.filter((task) => task.clinicianId === clinician.id)

    const missingDocuments = clinicianDocuments.filter((doc) => doc.required && doc.status === 'Missing')
    const expiringLicenses = clinicianDocuments.filter((doc) => doc.category === 'Licensure Documents' && doc.status === 'Expiring Soon')
    const expiringMalpractice = clinicianDocuments.filter((doc) => doc.category === 'Insurance Documents' && doc.status === 'Expiring Soon')
    const caqhDoc = clinicianDocuments.find((doc) => doc.documentName === 'CAQH Attestation')

    const overdueFollowUp = clinicianPayers.some((payer) => payer.followUpDate && payer.followUpDate < today && !isCompleteStatus(payer.status))
    const orientationOverdue = clinicianTasks.some((task) => task.category === 'Orientation' && task.dueDate < today && task.status !== 'Completed')
    const goLiveOverdue = clinician.dueDate < today && !['Ready to Go Live', '30-Day Monitoring', 'Completed'].includes(clinician.onboardingPhase)

    if (missingDocuments.length > 0) {
      reminders.push({
        id: `rem-missing-docs-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Missing documents',
        severity: 'red',
        message: `${missingDocuments.length} required document(s) missing`,
      })
    }

    if (expiringLicenses.length > 0) {
      reminders.push({
        id: `rem-expiring-license-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Expiring licenses',
        severity: 'yellow',
        message: 'Licensure document expiring within 30 days',
      })
    }

    if (expiringMalpractice.length > 0 || clinician.malpracticeStatus === 'Expiring Soon') {
      reminders.push({
        id: `rem-expiring-malpractice-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Expiring malpractice insurance',
        severity: 'yellow',
        message: 'Malpractice insurance expiring within 30 days',
      })
    }

    if (!caqhDoc || caqhDoc.status === 'Missing') {
      reminders.push({
        id: `rem-missing-caqh-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Missing CAQH attestation',
        severity: 'red',
        message: 'CAQH attestation is missing',
      })
    }

    if (clinicianPayers.some((payer) => !isCompleteStatus(payer.eftStatus))) {
      reminders.push({
        id: `rem-missing-eft-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Missing EFT setup',
        severity: 'red',
        message: 'One or more payers missing active EFT setup',
      })
    }

    if (clinicianPayers.some((payer) => !isCompleteStatus(payer.eraStatus))) {
      reminders.push({
        id: `rem-missing-era-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Missing ERA enrollment',
        severity: 'red',
        message: 'One or more payers missing active ERA setup',
      })
    }

    if (overdueFollowUp) {
      reminders.push({
        id: `rem-cred-followup-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Credentialing follow-up overdue',
        severity: 'yellow',
        message: 'Credentialing follow-up date has passed',
      })
    }

    if (orientationOverdue) {
      reminders.push({
        id: `rem-orientation-overdue-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Orientation overdue',
        severity: 'yellow',
        message: 'Orientation tasks overdue',
      })
    }

    if (goLiveOverdue) {
      reminders.push({
        id: `rem-go-live-overdue-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'Go-live overdue',
        severity: 'red',
        message: 'Target go-live date has passed',
      })
    }

    if (clinician.onboardingPhase === '30-Day Monitoring' && clinician.monitoringStatus !== 'Completed') {
      reminders.push({
        id: `rem-no-claims-submitted-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'No claims submitted after go-live',
        severity: 'yellow',
        message: 'Claims submission still not confirmed in monitoring',
      })
    }

    if (clinician.onboardingPhase === '30-Day Monitoring' && clinicianPayers.some((payer) => !isCompleteStatus(payer.eraStatus))) {
      reminders.push({
        id: `rem-no-era-activity-${clinician.id}`,
        clinicianId: clinician.id,
        clinicianName: clinician.fullName,
        type: 'No ERA activity after claim submission',
        severity: 'red',
        message: 'ERA activity is missing during monitoring',
      })
    }
  })

  return reminders
}

export default function OnboardingDashboard() {
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [clinicians, setClinicians] = useState(initialClinicians)
  const [payers, setPayers] = useState(initialPayers)
  const [documents, setDocuments] = useState(initialDocuments)
  const [tasks, setTasks] = useState(initialTasks)

  const [selectedClinicianId, setSelectedClinicianId] = useState(initialClinicians[0]?.id || null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [warningModal, setWarningModal] = useState(null)
  const [reminderStateMap, setReminderStateMap] = useState({})
  const [notesByClinician, setNotesByClinician] = useState({})
  const [activityByClinician, setActivityByClinician] = useState({})

  useEffect(() => {
    if (!selectedClinicianId) {
      return
    }

    setPayers((prev) => {
      const existingNames = new Set(
        prev
          .filter((payer) => payer.clinicianId === selectedClinicianId)
          .map((payer) => payer.payerName)
      )

      const missingRows = PAYER_PRESETS
        .filter((payerName) => !existingNames.has(payerName))
        .map((payerName) => createDefaultPayerRow(selectedClinicianId, payerName))

      if (!missingRows.length) {
        return prev
      }

      return [...prev, ...missingRows]
    })
  }, [selectedClinicianId])

  const snapshotByClinicianId = useMemo(() => {
    return clinicians.reduce((acc, clinician) => {
      acc[clinician.id] = buildClinicianSnapshot(clinician, documents, payers, tasks)
      return acc
    }, {})
  }, [clinicians, documents, payers, tasks])

  const cliniciansWithComputedState = useMemo(() => {
    return clinicians.map((clinician) => {
      const snapshot = snapshotByClinicianId[clinician.id]
      const credentialingStatus = snapshot.checks.credentialing ? 'Approved' : clinician.credentialingStatus
      const goLiveStatus = snapshot.checks.documents && snapshot.checks.credentialing && snapshot.checks.eft && snapshot.checks.era && snapshot.checks.ehr && snapshot.checks.orientation ? 'Ready' : clinician.goLiveStatus

      return {
        ...clinician,
        onboardingPercent: snapshot.onboardingPercent,
        missingItems: snapshot.missingItems,
        credentialingStatus,
        goLiveStatus,
        eftStatus: snapshot.checks.eft ? 'Active' : clinician.eftStatus,
        eraStatus: snapshot.checks.era ? 'Active' : clinician.eraStatus,
      }
    })
  }, [clinicians, snapshotByClinicianId])

  const selectedClinician = useMemo(
    () => cliniciansWithComputedState.find((clinician) => clinician.id === selectedClinicianId) || cliniciansWithComputedState[0] || null,
    [cliniciansWithComputedState, selectedClinicianId]
  )

  const selectedPayers = useMemo(
    () => payers.filter((payer) => payer.clinicianId === selectedClinician?.id),
    [payers, selectedClinician]
  )

  const selectedDocuments = useMemo(
    () => documents.filter((document) => document.clinicianId === selectedClinician?.id),
    [documents, selectedClinician]
  )

  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.clinicianId === selectedClinician?.id),
    [tasks, selectedClinician]
  )

  const reminders = useMemo(() => {
    const base = buildReminders(cliniciansWithComputedState, documents, payers, tasks)
    return base.map((item) => ({
      ...item,
      state: reminderStateMap[item.id] || 'Open',
    }))
  }, [cliniciansWithComputedState, documents, payers, reminderStateMap, tasks])

  const summary = useMemo(() => {
    const activeOnboarding = cliniciansWithComputedState.filter((clinician) => clinician.onboardingPhase !== 'Completed').length
    const missingDocuments = documents.filter((doc) => doc.required && doc.status === 'Missing').length
    const readyToGoLive = cliniciansWithComputedState.filter((clinician) => clinician.onboardingPhase === 'Ready to Go Live').length
    const expiringItems = documents.filter((doc) => doc.status === 'Expiring Soon').length
    const actionableReminders = reminders.filter((item) => item.state !== 'Completed')
    const redReminders = actionableReminders.filter((item) => item.severity === 'red').length
    const yellowReminders = actionableReminders.filter((item) => item.severity === 'yellow').length

    return {
      activeOnboarding,
      missingDocuments,
      readyToGoLive,
      expiringItems,
      redReminders,
      yellowReminders,
    }
  }, [cliniciansWithComputedState, documents, reminders])

  const selectedSnapshot = selectedClinician ? snapshotByClinicianId[selectedClinician.id] : null

  const readiness = useMemo(() => {
    if (!selectedClinician || !selectedSnapshot) {
      return {
        score: 0,
        blockingItems: [],
        completedItems: [],
        recommendedNextSteps: [],
        estimatedGoLiveDate: 'TBD',
      }
    }

    return {
      score: selectedSnapshot.readinessScore,
      blockingItems: selectedSnapshot.blockingChecks,
      completedItems: selectedSnapshot.completedChecks,
      recommendedNextSteps: selectedSnapshot.blockingChecks.length
        ? selectedSnapshot.blockingChecks.slice(0, 3).map((item) => `Complete: ${item}`)
        : ['Validate first ERA and first paid claim posting'],
      estimatedGoLiveDate: estimateGoLiveDate(selectedClinician.dueDate, selectedSnapshot.blockingChecks.length),
    }
  }, [selectedClinician, selectedSnapshot])

  const openDrawerForClinician = (clinicianId) => {
    setSelectedClinicianId(clinicianId)
    setIsDrawerOpen(true)
  }

  const addActivity = (clinicianId, action, comments) => {
    setActivityByClinician((prev) => {
      const existing = prev[clinicianId] || []
      return {
        ...prev,
        [clinicianId]: [makeLog('System', action, comments), ...existing],
      }
    })
  }

  const handleMoveClinician = (clinicianId, targetPhase) => {
    const clinician = clinicians.find((item) => item.id === clinicianId)
    if (!clinician || clinician.onboardingPhase === targetPhase) {
      return
    }

    const snapshot = snapshotByClinicianId[clinicianId]
    const gate = canMoveToPhase(targetPhase, snapshot)

    if (!gate.allowed) {
      setWarningModal({
        clinicianName: clinician.fullName,
        targetPhase,
        blockers: gate.blockers,
      })
      return
    }

    setClinicians((prev) => prev.map((item) => {
      if (item.id !== clinicianId) {
        return item
      }

      return {
        ...item,
        onboardingPhase: targetPhase,
        goLiveStatus: targetPhase === 'Ready to Go Live' ? 'Ready' : item.goLiveStatus,
        monitoringStatus: targetPhase === 'Completed' ? 'Completed' : item.monitoringStatus,
      }
    }))

    addActivity(clinicianId, 'Phase Moved', `Moved to ${targetPhase}`)
  }

  const handleUpdateDocument = (documentId, updates) => {
    const original = documents.find((doc) => doc.id === documentId)
    if (!original) {
      return
    }

    setDocuments((prev) => prev.map((doc) => (doc.id === documentId ? { ...doc, ...updates } : doc)))

    if (updates.status === 'Rejected') {
      setTasks((prev) => prev.map((task) => {
        if (task.clinicianId !== original.clinicianId || task.status !== 'Completed') {
          return task
        }
        return { ...task, status: 'In Progress' }
      }))
      addActivity(original.clinicianId, 'Document Rejected', `${original.documentName} rejected and tasks reopened`)
    } else {
      addActivity(original.clinicianId, 'Document Updated', `${original.documentName} updated`)
    }
  }

  const handleUpdatePayer = (payerId, updates) => {
    const original = payers.find((payer) => payer.id === payerId)
    if (!original) {
      return
    }

    setPayers((prev) => prev.map((payer) => (payer.id === payerId ? { ...payer, ...updates } : payer)))
    addActivity(original.clinicianId, 'Credentialing Updated', `${original.payerName} row updated`)
  }

  const handleReminderAction = (reminderId, state) => {
    setReminderStateMap((prev) => ({
      ...prev,
      [reminderId]: state,
    }))
  }

  const handleAddNote = (clinicianId, text) => {
    const note = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      timestamp: new Date().toLocaleString(),
    }

    setNotesByClinician((prev) => ({
      ...prev,
      [clinicianId]: [note, ...(prev[clinicianId] || [])],
    }))

    addActivity(clinicianId, 'Note Added', text)
  }

  const handleMarkMonitoringComplete = () => {
    if (!selectedClinician) {
      return
    }

    setClinicians((prev) => prev.map((item) => {
      if (item.id !== selectedClinician.id) {
        return item
      }

      return {
        ...item,
        monitoringStatus: 'Completed',
      }
    }))

    setTasks((prev) => prev.map((task) => {
      if (task.clinicianId !== selectedClinician.id || task.category !== 'Monitoring') {
        return task
      }

      return {
        ...task,
        status: 'Completed',
      }
    }))

    addActivity(selectedClinician.id, 'Monitoring Completed', '30-day monitoring marked complete')
  }

  const selectedReminders = reminders.filter((item) => item.clinicianId === selectedClinician?.id)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex">
      <SidebarNavigation activeItem={activeItem} onSelect={setActiveItem} />

      <main className="flex-1 p-8 overflow-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold">Clinician Onboarding Workflow</h2>
            <p className="text-slate-500 mt-1">Track credentialing, setup, training, and go-live readiness.</p>
          </div>
        </div>

        <ReminderBanner reminders={reminders} onReminderAction={handleReminderAction} />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">Active Onboarding</p>
            <h3 className="text-3xl font-bold mt-2">{summary.activeOnboarding}</h3>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">Missing Documents</p>
            <h3 className="text-3xl font-bold mt-2 text-rose-600">{summary.missingDocuments}</h3>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">Ready to Go Live</p>
            <h3 className="text-3xl font-bold mt-2 text-emerald-600">{summary.readyToGoLive}</h3>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">Expiring Items</p>
            <h3 className="text-3xl font-bold mt-2 text-amber-600">{summary.expiringItems}</h3>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">Red Reminders</p>
            <h3 className="text-3xl font-bold mt-2 text-rose-600">{summary.redReminders}</h3>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">Yellow Reminders</p>
            <h3 className="text-3xl font-bold mt-2 text-amber-600">{summary.yellowReminders}</h3>
          </div>
        </div>

        <PipelineKanban
          phases={onboardingPhases}
          clinicians={cliniciansWithComputedState}
          selectedClinicianId={selectedClinician?.id || null}
          onSelectClinician={openDrawerForClinician}
          onMoveClinician={handleMoveClinician}
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <ClinicianProfilePanel clinician={selectedClinician} />
          <MissingItemsPanel items={selectedClinician?.missingItems || []} />
        </div>

        <CredentialingTrackerTable payers={selectedPayers} onUpdatePayer={handleUpdatePayer} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <RequiredDocumentsPanel documents={selectedDocuments} onUpdateDocument={handleUpdateDocument} />
          <OrientationTrainingPanel tasks={selectedTasks.filter((task) => task.category === 'Orientation')} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <GoLiveReadinessPanel clinician={selectedClinician} readiness={readiness} />
          <MonitoringDashboard
            clinician={selectedClinician}
            monitoringTasks={selectedTasks.filter((task) => task.category === 'Monitoring')}
            onMarkMonitoringComplete={handleMarkMonitoringComplete}
          />
        </div>
      </main>

      <ClinicianDetailDrawer
        open={isDrawerOpen}
        clinician={selectedClinician}
        documents={selectedDocuments}
        payers={selectedPayers}
        tasks={selectedTasks}
        reminders={selectedReminders}
        warnings={selectedSnapshot?.warnings || { red: [], yellow: [] }}
        readiness={readiness}
        notes={notesByClinician[selectedClinician?.id] || []}
        activityLog={activityByClinician[selectedClinician?.id] || []}
        onAddNote={handleAddNote}
        onClose={() => setIsDrawerOpen(false)}
      />

      {warningModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setWarningModal(null)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl border border-rose-200 p-6 max-w-lg w-full">
            <h3 className="text-xl font-semibold text-rose-700">Move blocked for {warningModal.clinicianName}</h3>
            <p className="text-sm text-slate-600 mt-2">Cannot move into {warningModal.targetPhase} yet. Complete these required items first:</p>
            <div className="mt-3 space-y-2">
              {warningModal.blockers.map((item) => (
                <div key={item} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">• {item}</div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setWarningModal(null)}
              className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
