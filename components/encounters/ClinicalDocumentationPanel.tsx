"use client";

import { useState } from "react";
import type { ClinicalNoteRecord, EncounterRecord } from "@/lib/types/appointmentFirstWorkflow";
import type { EncounterReadinessResult } from "@/lib/workqueue/model";

interface ClinicalDocumentationPanelProps {
  encounter: EncounterRecord;
  notes: ClinicalNoteRecord[];
  readiness: EncounterReadinessResult;
}

export default function ClinicalDocumentationPanel({ encounter, notes, readiness }: ClinicalDocumentationPanelProps) {
  const latestNote = notes[0] ?? null;
  const [noteType, setNoteType] = useState(latestNote?.note_type ?? "progress");
  const [noteFormat, setNoteFormat] = useState(latestNote?.note_format ?? "dap");
  const [subjective, setSubjective] = useState(latestNote?.subjective ?? "");
  const [assessment, setAssessment] = useState(latestNote?.assessment ?? "");
  const [plan, setPlan] = useState(latestNote?.plan ?? "");
  const [riskAssessment, setRiskAssessment] = useState(latestNote?.risk_assessment ?? "");
  const [progress, setProgress] = useState(latestNote?.progress_toward_goals ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const locked = Boolean(latestNote?.locked && latestNote?.signed_at);

  async function signNote() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/encounters/${encounter.id}/notes/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId: latestNote?.id ?? null,
          noteType,
          noteFormat,
          subjective,
          assessment,
          plan,
          riskAssessment,
          progressTowardGoals: progress,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to sign note");
      }

      setMessage(
        payload.readiness?.passed
          ? "Note signed. Encounter automatically routed to ready-to-bill workqueue."
          : "Note signed, but documentation hold was created because readiness checks failed.",
      );

      window.location.reload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to sign note");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Clinical Documentation</h2>
            <p className="mt-1 text-sm text-slate-600">
              Signing automatically runs readiness checks and routes the encounter to billing if it passes.
            </p>
          </div>
          <span
            className={
              locked
                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                : "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200"
            }
          >
            {locked ? "Signed + locked" : "Draft editable"}
          </span>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Note type">
              <select value={noteType} onChange={(event) => setNoteType(event.target.value)} disabled={locked} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 outline-none ring-blue-500 focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500">
                <option value="progress">Progress note</option>
                <option value="intake">Intake assessment</option>
                <option value="treatment_plan">Treatment plan</option>
                <option value="discharge">Discharge</option>
                <option value="addendum">Addendum</option>
              </select>
            </Field>
            <Field label="Format">
              <select value={noteFormat} onChange={(event) => setNoteFormat(event.target.value)} disabled={locked} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 outline-none ring-blue-500 focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500">
                <option value="dap">DAP</option>
                <option value="soap">SOAP</option>
                <option value="birp">BIRP</option>
                <option value="narrative">Narrative</option>
              </select>
            </Field>
          </div>

          <TextArea label="Subjective / Data" value={subjective} onChange={setSubjective} disabled={locked} />
          <TextArea label="Assessment" value={assessment} onChange={setAssessment} disabled={locked} />
          <TextArea label="Plan" value={plan} onChange={setPlan} disabled={locked} />
          <div className="grid gap-4 md:grid-cols-2">
            <TextArea label="Risk assessment" value={riskAssessment} onChange={setRiskAssessment} disabled={locked} />
            <TextArea label="Progress toward goals" value={progress} onChange={setProgress} disabled={locked} />
          </div>

          {message ? <p className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">{message}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={locked || loading}
              onClick={signNote}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing..." : "Sign Note + Auto-route"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">Automatic Readiness</h3>
        <div className="mt-4 grid gap-3">
          {readiness.checks.map((check) => (
            <div key={check.key} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex justify-between gap-3">
                <p className="font-bold text-slate-950">{check.label}</p>
                <span className={check.passed ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-red-700"}>
                  {check.passed ? "Passed" : "Blocked"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={5}
        className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 outline-none ring-blue-500 focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}
