import { ScheduleProvider } from "@/lib/types/schedule";

interface ScheduleHeaderControlsProps {
  selectedDate: string;
  selectedProviderId: string;
  providers: ScheduleProvider[];
  onDateChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onAddAppointment: () => void;
}

export default function ScheduleHeaderControls({
  selectedDate,
  selectedProviderId,
  providers,
  onDateChange,
  onProviderChange,
  onPreviousDay,
  onNextDay,
  onToday,
  onAddAppointment,
}: ScheduleHeaderControlsProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousDay}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onToday}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onNextDay}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Next
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
          >
            Day
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-500"
          >
            Week (Soon)
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-500"
          >
            Month (Soon)
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[200px_240px_1fr_auto]">
        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm text-gray-700">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Provider</span>
          <select
            value={selectedProviderId}
            onChange={(event) => onProviderChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All Providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Daily list is ready for weekly/monthly expansion without route changes.
          </p>
        </div>

        <div className="flex items-end justify-end">
          <button
            type="button"
            onClick={onAddAppointment}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Add Appointment
          </button>
        </div>
      </div>
    </div>
  );
}
