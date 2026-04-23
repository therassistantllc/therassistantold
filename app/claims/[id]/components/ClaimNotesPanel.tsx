import { ClaimNote } from "@/lib/types/claim";

interface ClaimNotesPanelProps {
  notes: ClaimNote[];
  claimId: string;
}

export default function ClaimNotesPanel({ notes, claimId }: ClaimNotesPanelProps) {
  const noteTypeColors: Record<string, string> = {
    internal: "bg-blue-100 text-blue-800",
    payer_call: "bg-green-100 text-green-800",
    appeal: "bg-orange-100 text-orange-800",
    ticket: "bg-purple-100 text-purple-800"
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Claim Notes & Internal Activity</h2>
      </div>
      
      <div className="p-6">
        {/* Add Note Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add New Note
          </label>
          <div className="flex gap-3">
            <select className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <option value="internal">Internal Note</option>
              <option value="payer_call">Payer Call Log</option>
              <option value="appeal">Appeal Note</option>
              <option value="ticket">Ticket Note</option>
            </select>
            <input
              type="text"
              placeholder="Type note here... Use *** for smart phrases"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Add Note
            </button>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6 pb-6 border-b border-gray-200">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Defer Claim
          </button>
          <button className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-300 rounded-lg hover:bg-orange-100">
            Create Appeal
          </button>
          <button className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded-lg hover:bg-purple-100">
            Create Reconsideration
          </button>
          <button className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100">
            Generate DOI Complaint
          </button>
        </div>
        
        {/* Notes Timeline */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Activity Timeline</h3>
          
          {notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notes or activity yet. Add a note to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${noteTypeColors[note.note_type]}`}>
                        {note.note_type.replace("_", " ").toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{note.user_name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(note.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{note.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Attachments */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Attachments</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop files here, or{" "}
              <button className="text-blue-600 hover:text-blue-700 font-medium">browse</button>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PDF, DOC, DOCX, JPG, PNG up to 10MB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
