"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

type DraftNote = {
  id: string;
  encounter_id: string | null;
  status: string | null;
  created_at: string | null;
  client_id: string | null;
};

type OpenTask = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  source_object_id: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export default function ProfilePage() {
  const [draftNotes, setDraftNotes] = useState<DraftNote[]>([]);
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const [notesResp, tasksResp] = await Promise.all([
      supabase
        .from("encounter_notes")
        .select("id, encounter_id, status, created_at, client_id")
        .is("archived_at", null)
        .or("signed_at.is.null,status.eq.draft,status.eq.in_progress")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("workqueue_items")
        .select("id, title, description, status, priority, created_at, source_object_id")
        .is("archived_at", null)
        .in("status", ["open", "in_progress", "blocked"])
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (notesResp.error || tasksResp.error) {
      setError(notesResp.error?.message || tasksResp.error?.message || "Could not load profile work queues.");
      setLoading(false);
      return;
    }

    setDraftNotes((notesResp.data ?? []) as DraftNote[]);
    setOpenTasks((tasksResp.data ?? []) as OpenTask[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(
    () => ({
      drafts: draftNotes.length,
      tasks: openTasks.length,
      urgent: openTasks.filter((task) => String(task.priority ?? "").toLowerCase() === "urgent").length,
    }),
    [draftNotes, openTasks],
  );

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="text-3xl font-black text-slate-950">Profile</h1>
          <p className="mt-2 text-sm text-slate-600">Your personal work queue: draft notes, assigned work, and incomplete items.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Metric label="Draft notes" value={String(summary.drafts)} />
            <Metric label="Open tasks" value={String(summary.tasks)} />
            <Metric label="Urgent tasks" value={String(summary.urgent)} />
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading profile workspace...</div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Draft Notes</h2>
                  <Link href="/encounters" className="text-sm font-semibold text-indigo-700">Open encounters</Link>
                </div>
                <div className="mt-4 space-y-3">
                  {draftNotes.length === 0 ? (
                    <p className="text-sm text-slate-500">No draft notes found.</p>
                  ) : (
                    draftNotes.map((note) => (
                      <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">Note {note.id.slice(0, 8)}</p>
                        <p className="mt-1 text-xs text-slate-600">Status: {note.status ?? "draft"} • Created {formatDateTime(note.created_at)}</p>
                        {note.encounter_id ? (
                          <Link href={`/encounters/${note.encounter_id}`} className="mt-2 inline-block text-xs font-semibold text-indigo-700">Continue note</Link>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">To-Do Tasks</h2>
                  <Link href="/billing/workqueue" className="text-sm font-semibold text-indigo-700">Open workqueue</Link>
                </div>
                <div className="mt-4 space-y-3">
                  {openTasks.length === 0 ? (
                    <p className="text-sm text-slate-500">No open tasks found.</p>
                  ) : (
                    openTasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">{task.title ?? "Work item"}</p>
                        <p className="mt-1 text-xs text-slate-600">{task.status ?? "open"} • {task.priority ?? "normal"} • {formatDateTime(task.created_at)}</p>
                        <p className="mt-1 text-xs text-slate-500">{task.description ?? "No description"}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
