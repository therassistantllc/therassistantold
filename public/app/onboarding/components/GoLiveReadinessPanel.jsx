import { readinessTone } from '../utils/onboardingEngine'

const toneClasses = {
  green: 'text-emerald-600 stroke-emerald-500',
  yellow: 'text-amber-600 stroke-amber-500',
  red: 'text-rose-600 stroke-rose-500',
}

export default function GoLiveReadinessPanel({ clinician, readiness }) {
  if (!clinician) {
    return null
  }

  const tone = readinessTone(readiness.score)
  const ringClass = toneClasses[tone]
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (readiness.score / 100) * circumference

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-xl font-semibold mb-4">Go-Live Readiness</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="rounded-2xl border border-slate-200 p-4 flex items-center justify-center">
          <svg width="120" height="120" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="10" fill="none" />
            <circle
              cx="50"
              cy="50"
              r="40"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              className={ringClass}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
            />
            <text x="50" y="54" textAnchor="middle" className={`text-lg font-bold ${ringClass}`}>
              {readiness.score}
            </text>
          </svg>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
          <p className="text-sm text-slate-500">Estimated Go-Live Date</p>
          <p className="text-xl font-semibold">{readiness.estimatedGoLiveDate}</p>

          <div className="mt-3 text-sm">
            <p className="text-slate-500">Recommended Next Steps</p>
            <ul className="mt-1 space-y-1 list-disc pl-5">
              {readiness.recommendedNextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 md:col-span-3">
          <p className="font-semibold text-rose-700 mb-2">Blocking Items</p>
          <div className="space-y-2">
            {readiness.blockingItems.length > 0 ? (
              readiness.blockingItems.map((item) => (
                <div key={item} className="rounded-lg border border-rose-200 bg-white p-2 text-rose-700">{item}</div>
              ))
            ) : (
              <p className="text-emerald-700">No blockers remaining.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 md:col-span-3">
          <p className="font-semibold text-emerald-700 mb-2">Completed Items</p>
          <div className="space-y-1 text-sm">
            {readiness.completedItems.map((item) => (
              <p key={item} className="text-emerald-800">• {item}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
