import { ClaimHistoryEvent } from "@/lib/types/claim";

interface ClaimTimelineProps {
  history: ClaimHistoryEvent[];
}

export default function ClaimTimeline({ history }: ClaimTimelineProps) {
  const eventIcons: Record<string, string> = {
    created: "📝",
    submitted: "📤",
    accepted: "✅",
    rejected: "❌",
    paid: "💰",
    appealed: "⚖️",
    notes_added: "📋"
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Claim History Timeline</h2>
      </div>
      
      <div className="p-6">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No history events yet.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((event) => (
              <div key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">
                    {eventIcons[event.event_type] || "📌"}
                  </div>
                  <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                </div>
                
                <div className="flex-1 pb-8">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {event.event_type.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{event.description}</p>
                  {event.user_name && (
                    <p className="text-xs text-gray-500 mt-1">By {event.user_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
