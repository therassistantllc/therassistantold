const NAV_ITEMS = [
  'Dashboard',
  'Kanban View',
  'Clinician Profiles',
  'Credentialing Tracker',
  'Missing Documents',
  'Orientation and Training',
  'Go-Live Readiness',
  '30-Day Monitoring',
]

export default function SidebarNavigation({ activeItem, onSelect }) {
  return (
    <aside className="w-72 bg-slate-900 text-white p-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-wide">THERASSISTANT</h1>
        <p className="text-slate-400 text-sm mt-1">Clinician Onboarding</p>
      </div>

      <nav className="mt-6 space-y-2 text-sm">
        {NAV_ITEMS.map((item) => {
          const isActive = item === activeItem

          return (
            <button
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              className={`w-full px-4 py-3 rounded-xl text-left transition ${
                isActive ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              {item}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
