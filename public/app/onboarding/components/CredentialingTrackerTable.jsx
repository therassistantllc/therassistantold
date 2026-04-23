import StatusBadge from './StatusBadge'
import { useMemo, useState } from 'react'

const STATUS_FILTERS = ['All', 'Not Started', 'In Progress', 'Submitted', 'Pending Additional Information', 'Approved', 'Denied', 'Contract Received', 'EFT Pending', 'ERA Pending', 'Fully Complete']

const statusSortScore = (status) => {
  const order = [
    'Not Started',
    'In Progress',
    'Submitted',
    'Pending Additional Information',
    'Approved',
    'Contract Received',
    'EFT Pending',
    'ERA Pending',
    'Fully Complete',
  ]

  const idx = order.indexOf(status)
  return idx === -1 ? 99 : idx
}

export default function CredentialingTrackerTable({ payers, onUpdatePayer }) {
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortBy, setSortBy] = useState('payerName')

  const visibleRows = useMemo(() => {
    const filtered = payers.filter((payer) => statusFilter === 'All' || payer.status === statusFilter)
    const rows = [...filtered]
    rows.sort((a, b) => {
      if (sortBy === 'status') {
        return statusSortScore(a.status) - statusSortScore(b.status)
      }
      return String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''))
    })
    return rows
  }, [payers, sortBy, statusFilter])

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-8">
      <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Credentialing Tracker</h3>
        <div className="flex gap-2">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="payerName">Sort: Payer</option>
            <option value="status">Sort: Status</option>
            <option value="followUpDate">Sort: Follow-Up Date</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm min-w-[1320px]">
          <thead>
            <tr className="text-left border-b border-slate-200 text-slate-500">
              <th className="pb-3">Payer Name</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Submission Date</th>
              <th className="pb-3">Follow-Up Date</th>
              <th className="pb-3">Effective Date</th>
              <th className="pb-3">Contract Received</th>
              <th className="pb-3">Fee Schedule Received</th>
              <th className="pb-3">EFT Status</th>
              <th className="pb-3">ERA Status</th>
              <th className="pb-3">Portal Login Created</th>
              <th className="pb-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((payer) => (
              <tr key={payer.id} className="border-b border-slate-100 align-top">
                <td className="py-3 font-medium">{payer.payerName}</td>
                <td className="py-3">
                  <div className="flex gap-2 items-center">
                    <StatusBadge status={payer.status} />
                    <select
                      className="border border-slate-300 rounded-lg px-2 py-1"
                      value={payer.status}
                      onChange={(event) => onUpdatePayer(payer.id, { status: event.target.value })}
                    >
                      {STATUS_FILTERS.filter((status) => status !== 'All').map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="py-3">
                  <input
                    type="date"
                    value={payer.submissionDate || ''}
                    className="border border-slate-300 rounded-lg px-2 py-1"
                    onChange={(event) => onUpdatePayer(payer.id, { submissionDate: event.target.value })}
                  />
                </td>
                <td className="py-3">
                  <input
                    type="date"
                    value={payer.followUpDate || ''}
                    className="border border-slate-300 rounded-lg px-2 py-1"
                    onChange={(event) => onUpdatePayer(payer.id, { followUpDate: event.target.value })}
                  />
                </td>
                <td className="py-3">
                  <input
                    type="date"
                    value={payer.effectiveDate || ''}
                    className="border border-slate-300 rounded-lg px-2 py-1"
                    onChange={(event) => onUpdatePayer(payer.id, { effectiveDate: event.target.value })}
                  />
                </td>
                <td className="py-3">
                  <select
                    className="border border-slate-300 rounded-lg px-2 py-1"
                    value={payer.contractReceived}
                    onChange={(event) => onUpdatePayer(payer.id, { contractReceived: event.target.value })}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </td>
                <td className="py-3">
                  <select
                    className="border border-slate-300 rounded-lg px-2 py-1"
                    value={payer.feeScheduleReceived}
                    onChange={(event) => onUpdatePayer(payer.id, { feeScheduleReceived: event.target.value })}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </td>
                <td className="py-3">
                  <input
                    type="text"
                    value={payer.eftStatus}
                    className="border border-slate-300 rounded-lg px-2 py-1"
                    onChange={(event) => onUpdatePayer(payer.id, { eftStatus: event.target.value })}
                  />
                </td>
                <td className="py-3">
                  <input
                    type="text"
                    value={payer.eraStatus}
                    className="border border-slate-300 rounded-lg px-2 py-1"
                    onChange={(event) => onUpdatePayer(payer.id, { eraStatus: event.target.value })}
                  />
                </td>
                <td className="py-3">
                  <select
                    className="border border-slate-300 rounded-lg px-2 py-1"
                    value={payer.portalLoginCreated}
                    onChange={(event) => onUpdatePayer(payer.id, { portalLoginCreated: event.target.value })}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </td>
                <td className="py-3 min-w-[240px]">
                  <input
                    type="text"
                    className="border border-slate-300 rounded-lg px-2 py-1 w-full"
                    value={payer.notes || ''}
                    onChange={(event) => onUpdatePayer(payer.id, { notes: event.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
