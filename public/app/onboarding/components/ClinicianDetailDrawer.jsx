import { useEffect, useMemo, useState } from 'react'
import ProgressBar from './ProgressBar'
import StatusBadge from './StatusBadge'

const TABS = [
  'Overview',
  'Credentialing',
  'Documents',
  'Internal Setup',
  'Orientation',
  'Monitoring',
  'Notes',
  'Activity Log',
]

export default function ClinicianDetailDrawer({
  open,
  clinician,
  documents,
  payers,
  tasks,
  reminders,
  warnings,
  readiness,
  activityLog,
  notes,
  onClose,
  onAddNote,
}) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [noteDraft, setNoteDraft] = useState('')

  useEffect(() => {
    setActiveTab('Overview')
  }, [clinician?.id])

  const internalTasks = useMemo(
    () => tasks.filter((task) => task.category === 'Internal Setup' || task.category === 'Go Live'),
    [tasks]
  )

  if (!open || !clinician) {
    return null
  }

  const overviewRows = [
    ['Full Name', clinician.fullName],
    ['Credentials', clinician.credentials],
    ['Practice Name', clinician.practiceName],
    ['Supervisor', clinician.supervisor],
    ['Assigned Staff', clinician.assignedStaff],
    ['Due Date', clinician.dueDate],
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />

      <aside
        className="relative h-full w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 overflow-auto transition-transform duration-200"
        style={{ animation: 'drawerSlideIn 180ms ease-out' }}
      >
        <style>{'@keyframes drawerSlideIn{from{transform:translateX(28px);opacity:0}to{transform:translateX(0);opacity:1}}'}</style>
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">{clinician.fullName}</h3>
              <p className="text-sm text-slate-500">Clinician Detail Drawer</p>
            </div>
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl bg-slate-100">Close</button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full text-xs border ${activeTab === tab ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-600'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {activeTab === 'Overview' ? (
            <section className="space-y-4">
              {warnings.red.length > 0 ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <p className="font-semibold">Critical warnings</p>
                  {warnings.red.map((warning) => (<p key={warning}>• {warning}</p>))}
                </div>
              ) : null}

              {warnings.yellow.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  <p className="font-semibold">Time-sensitive warnings</p>
                  {warnings.yellow.map((warning) => (<p key={warning}>• {warning}</p>))}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {overviewRows.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-slate-500">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <ProgressBar value={clinician.onboardingPercent} label="Overall Progress" colorClass="bg-indigo-600" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between"><span>License</span><StatusBadge status={clinician.licenseStatus} /></div>
                <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between"><span>Malpractice</span><StatusBadge status={clinician.malpracticeStatus} /></div>
                <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between"><span>Credentialing</span><StatusBadge status={clinician.credentialingStatus} /></div>
                <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between"><span>EHR</span><StatusBadge status={clinician.ehrStatus} /></div>
                <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between"><span>Orientation</span><StatusBadge status={clinician.orientationStatus} /></div>
                <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between"><span>Monitoring</span><StatusBadge status={clinician.monitoringStatus} /></div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-semibold mb-2">Missing Items Summary</p>
                {clinician.missingItems.length > 0 ? clinician.missingItems.map((item) => <p key={item}>• {item}</p>) : <p>None</p>}
              </div>
            </section>
          ) : null}

          {activeTab === 'Credentialing' ? (
            <section className="space-y-2">
              {payers.map((payer) => (
                <div key={payer.id} className="rounded-xl border border-slate-200 p-3 text-sm flex items-center justify-between">
                  <span>{payer.payerName}</span>
                  <StatusBadge status={payer.status} />
                </div>
              ))}
            </section>
          ) : null}

          {activeTab === 'Documents' ? (
            <section className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between"><p className="font-medium">{doc.documentName}</p><StatusBadge status={doc.status} /></div>
                  <p className="text-xs text-slate-500 mt-1">{doc.category} • Exp: {doc.expirationDate || '-'}</p>
                </div>
              ))}
            </section>
          ) : null}

          {activeTab === 'Internal Setup' ? (
            <section className="space-y-2 text-sm">
              <div className="rounded-xl border border-slate-200 p-3 flex justify-between"><span>Internal Setup</span><StatusBadge status={clinician.internalSetupStatus} /></div>
              <div className="rounded-xl border border-slate-200 p-3 flex justify-between"><span>Stripe Setup</span><StatusBadge status={clinician.stripeStatus} /></div>
              <div className="rounded-xl border border-slate-200 p-3 flex justify-between"><span>EHR Setup</span><StatusBadge status={clinician.ehrStatus} /></div>
              {internalTasks.map((task) => (
                <div key={task.id} className="rounded-xl bg-slate-50 border border-slate-200 p-3">{task.task} • {task.status}</div>
              ))}
            </section>
          ) : null}

          {activeTab === 'Orientation' ? (
            <section className="space-y-2 text-sm">
              {tasks.filter((task) => task.category === 'Orientation').map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-200 p-3 flex justify-between">
                  <span>{task.task}</span>
                  <StatusBadge status={task.status} />
                </div>
              ))}
            </section>
          ) : null}

          {activeTab === 'Monitoring' ? (
            <section className="space-y-2 text-sm">
              <div className="rounded-xl border border-slate-200 p-3 flex justify-between"><span>Monitoring Status</span><StatusBadge status={clinician.monitoringStatus} /></div>
              <div className="rounded-xl border border-slate-200 p-3">Readiness Score: {readiness.score}</div>
              {tasks.filter((task) => task.category === 'Monitoring').map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-200 p-3 flex justify-between">
                  <span>{task.task}</span>
                  <StatusBadge status={task.status} />
                </div>
              ))}
            </section>
          ) : null}

          {activeTab === 'Notes' ? (
            <section className="space-y-3 text-sm">
              <div className="rounded-xl border border-slate-200 p-3">
                <textarea
                  className="w-full min-h-24 border border-slate-300 rounded-lg p-2"
                  placeholder="Add internal comment"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                />
                <button
                  type="button"
                  className="mt-2 px-3 py-2 rounded-lg bg-slate-900 text-white"
                  onClick={() => {
                    if (noteDraft.trim()) {
                      onAddNote(clinician.id, noteDraft)
                      setNoteDraft('')
                    }
                  }}
                >
                  Save Note
                </button>
              </div>

              {notes.map((note) => (
                <div key={note.id} className="rounded-xl border border-slate-200 p-3">
                  <p>{note.text}</p>
                  <p className="text-xs text-slate-500 mt-1">{note.timestamp}</p>
                </div>
              ))}
            </section>
          ) : null}

          {activeTab === 'Activity Log' ? (
            <section className="space-y-2">
              {activityLog.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <p className="font-medium">{item.date} • {item.user}</p>
                  <p>{item.action}</p>
                  <p className="text-slate-500">{item.comments}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section className="space-y-2 text-sm">
            <p className="font-semibold">Clinician Reminders</p>
            {reminders.map((item) => (
              <div key={item.id} className={`rounded-xl p-3 border ${item.severity === 'red' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                <p>{item.message}</p>
              </div>
            ))}
          </section>
        </div>
      </aside>
    </div>
  )
}
