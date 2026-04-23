const STATUS_STYLES = {
  Active: 'bg-emerald-100 text-emerald-700',
  Uploaded: 'bg-emerald-100 text-emerald-700',
  Ready: 'bg-emerald-100 text-emerald-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  'Fully Complete': 'bg-emerald-100 text-emerald-700',
  Live: 'bg-emerald-100 text-emerald-700',
  Escalated: 'bg-rose-100 text-rose-700',
  Snoozed: 'bg-sky-100 text-sky-700',
  Assigned: 'bg-indigo-100 text-indigo-700',
  Rejected: 'bg-rose-100 text-rose-700',
  Overdue: 'bg-rose-100 text-rose-700',
  Denied: 'bg-rose-100 text-rose-700',
  'Contract Received': 'bg-emerald-100 text-emerald-700',
  'EFT Pending': 'bg-amber-100 text-amber-700',
  'ERA Pending': 'bg-amber-100 text-amber-700',
  'Pending Additional Information': 'bg-amber-100 text-amber-700',
  'Expiring Soon': 'bg-amber-100 text-amber-700',
  'Not Received': 'bg-slate-200 text-slate-700',
  'Not Submitted': 'bg-rose-100 text-rose-700',
  Missing: 'bg-rose-100 text-rose-700',
  Blocked: 'bg-rose-100 text-rose-700',
  Pending: 'bg-amber-100 text-amber-700',
  Scheduled: 'bg-sky-100 text-sky-700',
  Submitted: 'bg-indigo-100 text-indigo-700',
  Queued: 'bg-indigo-100 text-indigo-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'In Review': 'bg-cyan-100 text-cyan-700',
  'Not Started': 'bg-slate-200 text-slate-700',
  'Pending Setup': 'bg-slate-200 text-slate-700',
  'Pending Verification': 'bg-amber-100 text-amber-700',
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {status}
    </span>
  )
}
