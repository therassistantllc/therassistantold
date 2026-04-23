"use client";

import { useRouter } from "next/navigation";

interface NotePageProps {
  params: {
    id: string;
  };
}

export default function NotePage({ params }: NotePageProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-blue-600 text-5xl mb-4">📝</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Clinical Note Workspace</h1>
        <p className="text-gray-600 mb-6">
          This is a placeholder for the clinical note editor.
          <br />
          Encounter ID: <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{params.id}</code>
        </p>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            The note workspace will include:
          </p>
          <ul className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-2">
            <li>• SOAP note template or structured documentation</li>
            <li>• Diagnosis selection and coding</li>
            <li>• Service code recommendation</li>
            <li>• Digital signature workflow</li>
            <li>• Auto-save and version history</li>
          </ul>
        </div>
        <div className="mt-8 flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Back to Encounter
          </button>
          <button
            onClick={() => router.push(`/sessions/${params.id}`)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Return to Encounter Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
