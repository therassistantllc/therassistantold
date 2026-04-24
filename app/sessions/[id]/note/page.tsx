"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NotePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function NotePage({ params }: NotePageProps) {
  const router = useRouter();
  const { id } = use(params);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
        <h1 className="text-2xl font-bold text-gray-900">Clinical Note Workspace</h1>
        <p className="mt-2 text-sm text-gray-600">
          Encounter <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">{id}</code>
          . Use these actions to continue documentation and billing workflows.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/sessions/${id}`}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Return to Encounter
          </Link>
          <Link
            href="/scheduling"
            className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Open Schedule
          </Link>
          <Link
            href="/billing/claims"
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open Claim Center
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
