export default function MissingItemsPanel({ items }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-xl font-semibold mb-4">Critical Missing Items</h3>

      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4"
            >
              <span className="text-sm font-medium text-rose-700">{item}</span>
              <button type="button" className="text-xs bg-rose-600 text-white px-3 py-2 rounded-xl">
                Resolve
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No missing items for this clinician.</p>
        )}
      </div>
    </div>
  )
}
