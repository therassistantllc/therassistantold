import { EncounterNote } from "@/lib/types/encounter";
import ScheduleStatusBadge from "@/components/scheduling/ScheduleStatusBadge";

interface DocumentationPanelProps {
  note: EncounterNote | null;
  onOpenNote: () => void;
}

function getNoteStatusBadge(status: string) {
  switch (status) {
    case "signed":
      return { label: "Signed", tone: "success" as const };
    case "in_progress":
      return { label: "In Progress", tone: "warning" as const };
    default:
      return { label: "Not Started", tone: "neutral" as const };
  }
}

export default function DocumentationPanel({ note, onOpenNote }: DocumentationPanelProps) {
  const statusBadge = note ? getNoteStatusBadge(note.status) : getNoteStatusBadge("not_started");

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Documentation</h2>
        <button
          onClick={onOpenNote}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {note ? "Open Note" : "Start Note"}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <ScheduleStatusBadge label={statusBadge.label} tone={statusBadge.tone} />
        </div>

        {note && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Note Type:</span>
              <span className="text-sm text-gray-900">
                {note.noteType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>

            {note.lastModified && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Last Modified:</span>
                <span className="text-sm text-gray-900">
                  {new Date(note.lastModified).toLocaleString()}
                </span>
              </div>
            )}

            {note.signedAt && note.signedBy && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Signed:</span>
                <span className="text-sm text-gray-900">
                  {note.signedBy} on {new Date(note.signedAt).toLocaleString()}
                </span>
              </div>
            )}

            {note.lockedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Locked:</span>
                <span className="text-sm text-gray-900">
                  {new Date(note.lockedAt).toLocaleString()}
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Required Fields Complete:</span>
                <span className={note.requiredFieldsComplete ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                  {note.requiredFieldsComplete ? "Yes" : "No"}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Diagnoses Documented:</span>
                <span className="text-gray-900 font-medium">{note.diagnosesCount}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Service Codes:</span>
                <span className={note.hasServiceCodes ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                  {note.hasServiceCodes ? "Present" : "Missing"}
                </span>
              </div>
            </div>
          </>
        )}

        {!note && (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-500 mb-3">No documentation has been started for this encounter</p>
            <button
              onClick={onOpenNote}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Begin Documentation →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
