import StatusBadge from './StatusBadge'
import { useMemo } from 'react'

const STATUS_OPTIONS = ['Missing', 'Uploaded', 'Expiring Soon', 'Rejected', 'Approved']

export default function RequiredDocumentsPanel({ documents, onUpdateDocument }) {
  const grouped = useMemo(() => {
    return documents.reduce((acc, document) => {
      if (!acc[document.category]) {
        acc[document.category] = []
      }

      acc[document.category].push(document)
      return acc
    }, {})
  }, [documents])

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-xl font-semibold mb-4">Required Documents</h3>

      <div className="space-y-5 text-sm">
        {Object.entries(grouped).map(([category, rows]) => (
          <div key={category} className="rounded-2xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <p className="font-semibold">{category}</p>
            </div>

            <div className="overflow-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-200">
                    <th className="text-left py-2 px-3">Document Name</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Expiration Date</th>
                    <th className="text-left py-2 px-3">Uploaded By</th>
                    <th className="text-left py-2 px-3">Uploaded Date</th>
                    <th className="text-left py-2 px-3">Reviewer</th>
                    <th className="text-left py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((document) => (
                    <tr
                      key={document.id}
                      className={`border-b border-slate-100 ${document.status === 'Missing' || document.status === 'Rejected' ? 'bg-rose-50' : ''}`}
                    >
                      <td className="py-3 px-3 font-medium">{document.documentName}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={document.status} />
                          <select
                            className="border border-slate-300 rounded-lg px-2 py-1"
                            value={document.status}
                            onChange={(event) => onUpdateDocument(document.id, { status: event.target.value })}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="date"
                          className="border border-slate-300 rounded-lg px-2 py-1"
                          value={document.expirationDate || ''}
                          onChange={(event) => onUpdateDocument(document.id, { expirationDate: event.target.value })}
                        />
                      </td>
                      <td className="py-3 px-3">{document.uploadedBy || '-'}</td>
                      <td className="py-3 px-3">{document.uploadedDate || '-'}</td>
                      <td className="py-3 px-3">{document.reviewer || '-'}</td>
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          className="border border-slate-300 rounded-lg px-2 py-1 w-full"
                          value={document.notes || ''}
                          onChange={(event) => onUpdateDocument(document.id, { notes: event.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
