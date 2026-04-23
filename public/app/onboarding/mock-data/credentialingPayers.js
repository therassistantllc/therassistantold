export const PAYER_PRESETS = [
  'Colorado Medicaid',
  'Colorado Access',
  'CCHA',
  'RMHP',
  'Medicare',
  'Aetna',
  'Anthem BCBS',
  'Cigna',
  'UHC',
  'Kaiser',
  'TriWest',
  'Denver Health Medical Plan',
  'Elevate',
]

export const createDefaultPayerRow = (clinicianId, payerName, status = 'Not Started') => ({
  id: `${clinicianId}-${payerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  clinicianId,
  payerName,
  status,
  submissionDate: '',
  followUpDate: '',
  effectiveDate: '',
  contractReceived: 'No',
  feeScheduleReceived: 'No',
  eftStatus: 'Not Started',
  eraStatus: 'Not Started',
  portalLoginCreated: 'No',
  notes: '',
})

export const credentialingPayers = [
  {
    ...createDefaultPayerRow('cln-001', 'Colorado Medicaid', 'In Progress'),
    submissionDate: '2026-04-01',
    followUpDate: '2026-04-16',
    eftStatus: 'EFT Pending',
    eraStatus: 'ERA Pending',
    notes: 'CAQH attestation needed before final review',
  },
  {
    ...createDefaultPayerRow('cln-001', 'Colorado Access', 'Submitted'),
    submissionDate: '2026-03-29',
    followUpDate: '2026-04-17',
    contractReceived: 'Yes',
    feeScheduleReceived: 'Yes',
    eftStatus: 'EFT Pending',
    eraStatus: 'ERA Pending',
    portalLoginCreated: 'Yes',
  },
  {
    ...createDefaultPayerRow('cln-001', 'Aetna', 'Pending Additional Information'),
    submissionDate: '2026-04-03',
    followUpDate: '2026-04-19',
    notes: 'Missing supervisory agreement',
  },

  ...PAYER_PRESETS.map((payer) => createDefaultPayerRow('cln-002', payer, 'Fully Complete')).map((row) => ({
    ...row,
    submissionDate: '2026-02-20',
    followUpDate: '2026-03-05',
    effectiveDate: '2026-04-15',
    contractReceived: 'Yes',
    feeScheduleReceived: 'Yes',
    eftStatus: 'Active',
    eraStatus: 'Active',
    portalLoginCreated: 'Yes',
    notes: 'Loaded and verified',
  })),

  {
    ...createDefaultPayerRow('cln-003', 'Colorado Medicaid', 'Not Started'),
    followUpDate: '2026-04-22',
  },
  {
    ...createDefaultPayerRow('cln-003', 'Colorado Access', 'Not Started'),
  },

  {
    ...createDefaultPayerRow('cln-004', 'Medicare', 'Fully Complete'),
    submissionDate: '2026-01-14',
    followUpDate: '2026-02-05',
    effectiveDate: '2026-03-01',
    contractReceived: 'Yes',
    feeScheduleReceived: 'Yes',
    eftStatus: 'Active',
    eraStatus: 'Active',
    portalLoginCreated: 'Yes',
  },
  {
    ...createDefaultPayerRow('cln-004', 'Anthem BCBS', 'Fully Complete'),
    submissionDate: '2026-01-18',
    followUpDate: '2026-02-08',
    effectiveDate: '2026-03-05',
    contractReceived: 'Yes',
    feeScheduleReceived: 'Yes',
    eftStatus: 'Active',
    eraStatus: 'Active',
    portalLoginCreated: 'Yes',
  },

  ...PAYER_PRESETS.slice(0, 4).map((payer) => createDefaultPayerRow('cln-005', payer, 'Not Started')),
]
