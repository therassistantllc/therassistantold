const DAY_MS = 24 * 60 * 60 * 1000

const PHASE_PROGRESS = {
  'Inquiry / Qualification': 10,
  'Intake Packet Sent': 20,
  'Documents Received': 35,
  'Internal Setup': 50,
  'Credentialing In Progress': 65,
  'EHR Setup': 75,
  'Ready to Go Live': 90,
  '30-Day Monitoring': 95,
  Completed: 100,
}

export const GO_LIVE_CHECKS = [
  { id: 'documents', label: 'All required documents are uploaded/approved' },
  { id: 'credentialing', label: 'Credentialing approvals are complete' },
  { id: 'eft', label: 'EFT is active' },
  { id: 'era', label: 'ERA is active' },
  { id: 'ehr', label: 'EHR setup is complete' },
  { id: 'orientation', label: 'Orientation is complete' },
]

export const READINESS_CHECKS = [
  { id: 'documents', label: 'Required documents complete', weight: 16 },
  { id: 'credentialing', label: 'Credentialing complete', weight: 16 },
  { id: 'eft', label: 'EFT complete', weight: 12 },
  { id: 'era', label: 'ERA complete', weight: 12 },
  { id: 'ehr', label: 'EHR setup complete', weight: 12 },
  { id: 'stripe', label: 'Stripe setup complete', weight: 10 },
  { id: 'orientation', label: 'Orientation complete', weight: 12 },
  { id: 'internal', label: 'Internal setup complete', weight: 10 },
]

const isTruthyCompletion = (value) => ['approved', 'active', 'completed', 'fully complete', 'yes', 'ready', 'live'].includes(String(value || '').toLowerCase())
const isDocumentSatisfied = (status) => ['uploaded', 'approved', 'expiring soon'].includes(String(status || '').toLowerCase())

export function isExpiringWithin30Days(expirationDate) {
  if (!expirationDate) {
    return false
  }

  const now = new Date()
  const target = new Date(expirationDate)
  if (Number.isNaN(target.getTime())) {
    return false
  }

  const diffDays = Math.floor((target.getTime() - now.getTime()) / DAY_MS)
  return diffDays >= 0 && diffDays <= 30
}

export function normalizeDocument(document) {
  if (document.status === 'Missing') {
    return document
  }

  if (isExpiringWithin30Days(document.expirationDate)) {
    return {
      ...document,
      status: document.status === 'Rejected' ? 'Rejected' : 'Expiring Soon',
    }
  }

  return document
}

export function buildClinicianSnapshot(clinician, documents, payers, tasks) {
  const clinicianDocuments = documents.filter((doc) => doc.clinicianId === clinician.id).map(normalizeDocument)
  const clinicianPayers = payers.filter((payer) => payer.clinicianId === clinician.id)
  const clinicianTasks = tasks.filter((task) => task.clinicianId === clinician.id)

  const requiredDocs = clinicianDocuments.filter((doc) => doc.required)
  const approvedDocs = requiredDocs.filter((doc) => doc.status === 'Approved')
  const satisfiedDocs = requiredDocs.filter((doc) => isDocumentSatisfied(doc.status))
  const missingDocs = requiredDocs.filter((doc) => doc.status === 'Missing')
  const rejectedDocs = requiredDocs.filter((doc) => doc.status === 'Rejected')
  const expiringDocs = requiredDocs.filter((doc) => doc.status === 'Expiring Soon')

  const credentialingComplete = clinicianPayers.length > 0 && clinicianPayers.every((payer) => ['Approved', 'Fully Complete', 'Contract Received'].includes(payer.status))
  const eftComplete = clinicianPayers.length > 0 && clinicianPayers.every((payer) => isTruthyCompletion(payer.eftStatus))
  const eraComplete = clinicianPayers.length > 0 && clinicianPayers.every((payer) => isTruthyCompletion(payer.eraStatus))

  const orientationComplete = isTruthyCompletion(clinician.orientationStatus)
  const ehrComplete = isTruthyCompletion(clinician.ehrStatus)
  const stripeComplete = isTruthyCompletion(clinician.stripeStatus)
  const internalComplete = isTruthyCompletion(clinician.internalSetupStatus)

  const monitoringComplete = clinicianTasks
    .filter((task) => task.category === 'Monitoring')
    .every((task) => task.status === 'Completed') && isTruthyCompletion(clinician.monitoringStatus)

  const checks = {
    documents: missingDocs.length === 0 && rejectedDocs.length === 0 && satisfiedDocs.length === requiredDocs.length,
    credentialing: credentialingComplete,
    eft: eftComplete,
    era: eraComplete,
    ehr: ehrComplete,
    stripe: stripeComplete,
    orientation: orientationComplete,
    internal: internalComplete,
    monitoring: monitoringComplete,
  }

  const readinessScore = Math.round(
    READINESS_CHECKS.reduce((sum, check) => sum + (checks[check.id] ? check.weight : 0), 0)
  )

  const completedChecks = READINESS_CHECKS.filter((check) => checks[check.id]).map((check) => check.label)
  const blockingChecks = READINESS_CHECKS.filter((check) => !checks[check.id]).map((check) => check.label)

  const rejectedTaskCount = rejectedDocs.length

  const phaseFloor = PHASE_PROGRESS[clinician.onboardingPhase] || 0
  const onboardingPercent = Math.max(phaseFloor, Math.max(0, Math.min(100, readinessScore - rejectedTaskCount * 4)))

  const missingItems = [
    ...missingDocs.map((doc) => `${doc.documentName} missing`),
    ...rejectedDocs.map((doc) => `${doc.documentName} rejected`),
    ...(!checks.credentialing ? ['Credentialing approvals incomplete'] : []),
    ...(!checks.eft ? ['EFT setup incomplete'] : []),
    ...(!checks.era ? ['ERA setup incomplete'] : []),
    ...(!checks.ehr ? ['EHR setup incomplete'] : []),
    ...(!checks.orientation ? ['Orientation incomplete'] : []),
  ]

  return {
    clinicianDocuments,
    clinicianPayers,
    clinicianTasks,
    checks,
    readinessScore,
    completedChecks,
    blockingChecks,
    onboardingPercent,
    missingItems,
    warnings: {
      red: [...missingDocs.map((doc) => `${doc.documentName} is missing`), ...rejectedDocs.map((doc) => `${doc.documentName} is rejected`)],
      yellow: expiringDocs.map((doc) => `${doc.documentName} expires on ${doc.expirationDate}`),
    },
  }
}

export function canMoveToPhase(targetPhase, snapshot) {
  if (targetPhase === 'Ready to Go Live') {
    const blockers = GO_LIVE_CHECKS.filter((check) => !snapshot.checks[check.id]).map((check) => check.label)
    return { allowed: blockers.length === 0, blockers }
  }

  if (targetPhase === 'Completed') {
    const blockers = snapshot.checks.monitoring ? [] : ['30-day monitoring phase is not complete']
    return { allowed: blockers.length === 0, blockers }
  }

  return { allowed: true, blockers: [] }
}

export function readinessTone(score) {
  if (score >= 90) {
    return 'green'
  }
  if (score >= 70) {
    return 'yellow'
  }
  return 'red'
}

export function estimateGoLiveDate(clinicianDueDate, blockersCount) {
  if (!clinicianDueDate) {
    return 'TBD'
  }

  const base = new Date(clinicianDueDate)
  if (Number.isNaN(base.getTime())) {
    return 'TBD'
  }

  base.setDate(base.getDate() + blockersCount * 2)
  return base.toISOString().slice(0, 10)
}
