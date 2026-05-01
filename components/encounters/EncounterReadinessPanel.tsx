import type { EncounterReadinessResult } from "@/lib/workqueue/model";

export default function EncounterReadinessPanel({ readiness }: { readiness: EncounterReadinessResult }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Readiness Audit</h2>
          <p className="mt-1 text-sm text-slate-600">
            This runs automatically when a note is signed.
          </p>
        </div>
        <span
          className={
            readiness.passed
              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
              : "rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200"
          }
        >
          {readiness.passed ? "Passed" : `${readiness.missingBlockingItems.length} blockers`}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {readiness.checks.map((check) => (
          <div key={check.key} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex justify-between gap-3">
              <p className="font-bold text-slate-950">{check.label}</p>
              <span className={check.passed ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-red-700"}>
                {check.passed ? "Passed" : "Needs review"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{check.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
