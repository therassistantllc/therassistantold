import StatusBadge from './StatusBadge'

export default function ClinicianProfilePanel({ clinician }) {
  if (!clinician) {
    return null
  }

  const profileRows = [
    ['Full Name', clinician.fullName],
    ['Credentials', clinician.credentials],
    ['Practice', clinician.practiceName],
    ['Supervisor', clinician.supervisor],
    ['Assigned Staff', clinician.assignedStaff],
    ['Due Date', clinician.dueDate],
  ]

  const statusRows = [
    ['License', clinician.licenseStatus],
    ['Malpractice', clinician.malpracticeStatus],
    ['Credentialing', clinician.credentialingStatus],
    ['EHR', clinician.ehrStatus],
    ['Orientation', clinician.orientationStatus],
    ['Go-Live', clinician.goLiveStatus],
    ['Monitoring', clinician.monitoringStatus],
  ]

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-xl font-semibold mb-4">Clinician Profile</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {profileRows.map(([label, value]) => (
          <div key={label}>
            <p className="text-slate-500">{label}</p>
            <p className="font-medium mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {statusRows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="text-sm text-slate-600">{label}</span>
            <StatusBadge status={value} />
          </div>
        ))}
      </div>
    </div>
  )
}
