"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

type ProviderRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type RuleRow = {
  id: string;
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_type: string;
};

type BlockRow = {
  id: string;
  provider_id: string;
  block_type: string;
  title: string;
  starts_at: string;
  ends_at: string;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function providerName(provider: ProviderRow | undefined) {
  if (!provider) return "Unknown provider";
  if (provider.display_name) return provider.display_name;
  return [provider.first_name, provider.last_name].filter(Boolean).join(" ") || provider.id;
}

export default function WorkSchedulePage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [ruleForm, setRuleForm] = useState({
    providerId: "",
    dayOfWeek: "1",
    startTime: "09:00:00",
    endTime: "17:00:00",
    locationType: "any",
  });

  const [blockForm, setBlockForm] = useState({
    providerId: "",
    blockType: "administrative",
    title: "Administrative block",
    startsAt: "",
    endsAt: "",
  });

  async function loadAll() {
    setLoading(true);
    setError(null);

    const providerResp = await supabase
      .from("providers")
      .select("id, display_name, first_name, last_name")
      .eq("is_active", true)
      .is("archived_at", null)
      .order("display_name", { ascending: true });

    if (providerResp.error) {
      setError(providerResp.error.message);
      setLoading(false);
      return;
    }

    setProviders((providerResp.data ?? []) as ProviderRow[]);

    const scheduleResp = await fetch("/api/scheduling/work-schedule", { method: "GET" });
    const schedulePayload = await scheduleResp.json();

    if (!scheduleResp.ok || schedulePayload.success === false) {
      setError(schedulePayload.error ?? "Could not load work schedule");
      setLoading(false);
      return;
    }

    setRules((schedulePayload.rules ?? []) as RuleRow[]);
    setBlocks((schedulePayload.blocks ?? []) as BlockRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const response = await fetch("/api/scheduling/work-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "availability_rule",
        providerId: ruleForm.providerId,
        dayOfWeek: Number(ruleForm.dayOfWeek),
        startTime: ruleForm.startTime,
        endTime: ruleForm.endTime,
        locationType: ruleForm.locationType,
      }),
    });

    const payload = await response.json();
    if (!response.ok || payload.success === false) {
      setError(payload.error ?? "Could not create availability rule");
      return;
    }

    setMessage("Availability rule created.");
    await loadAll();
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const response = await fetch("/api/scheduling/work-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "administrative_block",
        providerId: blockForm.providerId,
        blockType: blockForm.blockType,
        title: blockForm.title,
        startsAt: blockForm.startsAt,
        endsAt: blockForm.endsAt,
      }),
    });

    const payload = await response.json();
    if (!response.ok || payload.success === false) {
      setError(payload.error ?? "Could not create administrative block");
      return;
    }

    setMessage("Administrative block created.");
    await loadAll();
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="text-3xl font-black text-slate-950">Provider Work Schedule</h1>
          <p className="mt-2 text-sm text-slate-600">
            Define clinical availability and non-billable administrative blocks that scheduling must enforce.
          </p>

          {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div> : null}

          {loading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading work schedule...</div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Add Availability Rule</h2>
                <form onSubmit={createRule} className="mt-4 grid gap-3">
                  <select
                    value={ruleForm.providerId}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, providerId: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {providerName(provider)}
                      </option>
                    ))}
                  </select>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <select
                      value={ruleForm.dayOfWeek}
                      onChange={(event) => setRuleForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      {dayNames.map((day, index) => (
                        <option key={day} value={String(index)}>
                          {day}
                        </option>
                      ))}
                    </select>

                    <input
                      type="time"
                      value={ruleForm.startTime.slice(0, 5)}
                      onChange={(event) => setRuleForm((prev) => ({ ...prev, startTime: `${event.target.value}:00` }))}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="time"
                      value={ruleForm.endTime.slice(0, 5)}
                      onChange={(event) => setRuleForm((prev) => ({ ...prev, endTime: `${event.target.value}:00` }))}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <select
                    value={ruleForm.locationType}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, locationType: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="any">Any location</option>
                    <option value="office">Office only</option>
                    <option value="telehealth">Telehealth only</option>
                  </select>

                  <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save rule</button>
                </form>

                <div className="mt-5 space-y-2">
                  {rules.slice(0, 8).map((rule) => (
                    <div key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      {providerName(providers.find((p) => p.id === rule.provider_id))} • {dayNames[rule.day_of_week]} • {rule.start_time.slice(0, 5)}-{rule.end_time.slice(0, 5)} • {rule.location_type}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Add Administrative Block</h2>
                <form onSubmit={createBlock} className="mt-4 grid gap-3">
                  <select
                    value={blockForm.providerId}
                    onChange={(event) => setBlockForm((prev) => ({ ...prev, providerId: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {providerName(provider)}
                      </option>
                    ))}
                  </select>

                  <input
                    value={blockForm.title}
                    onChange={(event) => setBlockForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Title"
                    required
                  />

                  <select
                    value={blockForm.blockType}
                    onChange={(event) => setBlockForm((prev) => ({ ...prev, blockType: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="administrative">Administrative</option>
                    <option value="meeting">Meeting</option>
                    <option value="break">Break</option>
                    <option value="meal">Meal</option>
                    <option value="leave">Leave</option>
                  </select>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={blockForm.startsAt}
                      onChange={(event) => setBlockForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      required
                    />
                    <input
                      type="datetime-local"
                      value={blockForm.endsAt}
                      onChange={(event) => setBlockForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save block</button>
                </form>

                <div className="mt-5 space-y-2">
                  {blocks.slice(0, 8).map((block) => (
                    <div key={block.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      {providerName(providers.find((p) => p.id === block.provider_id))} • {block.block_type} • {block.title}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
