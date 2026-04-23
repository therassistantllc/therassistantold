export default function ProgressBar({ value, colorClass = 'bg-slate-900', label, size = 'md' }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))
  const heightClass = size === 'sm' ? 'h-2' : 'h-2.5'

  return (
    <div>
      {label ? (
        <div className="flex items-center justify-between mb-1 text-xs text-slate-500">
          <span>{label}</span>
          <span>{safeValue}%</span>
        </div>
      ) : null}
      <div className={`w-full rounded-full bg-slate-200 ${heightClass}`}>
        <div className={`${colorClass} ${heightClass} rounded-full transition-all`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}
