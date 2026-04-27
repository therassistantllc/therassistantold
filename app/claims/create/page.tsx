// File: app/claims/create/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type {
  ClaimRecord,
  EncounterDiagnosisRecord,
  EncounterRecord,
  EncounterServiceLineRecord,
  InsurancePolicyRecord,
} from "@/lib/types";

interface EncounterCandidate extends EncounterRecord {
  diagnoses: EncounterDiagnosisRecord[];
  serviceLines: EncounterServiceLineRecord[];
  policy: InsurancePolicyRecord | null;
  existingClaim: ClaimRecord | null;
}

function sumCharges(lines: EncounterServiceLineRecord[]) {
  return lines.reduce((sum, line) => {
    const value = Number.parseFloat(String(line.charge_amount ?? "0"));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function canCreateClaim(encounter: EncounterCandidate) {
  return Boolean(
    encounter.required_billing_fields_complete &&
      encounter.serviceLines.length > 0 &&
      encounter.diagnoses.length > 0 &&
      encounter.policy
  );
}

export default function ClaimCreationPage() {
  const [encounters, setEncounters] = useState<EncounterCandidate[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      const { data: encounterData, error: encounterError } = await supabase
        .from("encounters")
        .select("*")
        .is("archived_at", null)
        .order("service_date", { ascending: false })
        .limit(100);

      if (!active) return;

      if (encounterError) {
        setError(encounterError.message);
        setLoading(false);
        return;
      }

      const encounterRows = (encounterData ?? []) as EncounterRecord[];
      const encounterIds = encounterRows.map((row) => row.id);
      const clientIds = Array.from(new Set(encounterRows.map((row) => row.client_id).filter(Boolean))) as string[];

      const [
        diagnosisResp,
        serviceLineResp,
        claimResp,
        policyResp,
      ] = await Promise.all([
        supabase
          .from("encounter_diagnoses")
          .select("*")
          .in("encounter_id", encounterIds.length ? encounterIds : ["00000000-0000-0000-0000-000000000000"])
          .is("archived_at", null),
        supabase
          .from("encounter_service_lines")
          .select("*")
          .in("encounter_id", encounterIds.length ? encounterIds : ["00000000-0000-0000-0000-000000000000"])
          .is("archived_at", null),
        supabase
          .from("claims")
          .select("*")
          .in("encounter_id", encounterIds.length ? encounterIds : ["00000000-0000-0000-0000-000000000000"])
          .is("archived_at", null),
        supabase
          .from("insurance_policies")
          .select("*")
          .in("client_id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"])
          .eq("is_primary", True)
          .is("archived_at", null),
      ]);

      if (!active) return;

      const firstError =
        diagnosisResp.error?.message ||
        serviceLineResp.error?.message ||
        claimResp.error?.message ||
        policyResp.error?.message;

      if (firstError) {
        setError(firstError);
        setLoading(false);
        return;
      }

      const diagnoses = (diagnosisResp.data ?? []) as EncounterDiagnosisRecord[];
      const serviceLines = (serviceLineResp.data ?? []) as EncounterServiceLineRecord[];
      const claims = (claimResp.data ?? []) as ClaimRecord[];
      const policies = (policyResp.data ?? []) as InsurancePolicyRecord[];

      const diagnosisMap = new Map<string, EncounterDiagnosisRecord[]>();
      for (const item of diagnoses) {
        const key = item.encounter_id ?? "";
        diagnosisMap.set(key, [...(diagnosisMap.get(key) ?? []), item]);
      }

      const serviceLineMap = new Map<string, EncounterServiceLineRecord[]>();
      for (const item of serviceLines) {
        const key = item.encounter_id ?? "";
        serviceLineMap.set(key, [...(serviceLineMap.get(key) ?? []), item]);
      }

      const claimMap = new Map<string, ClaimRecord>();
      for (const claim of claims) {
        if (claim.encounter_id) {
          claimMap.set(claim.encounter_id, claim);
        }
      }

      const policyMap = new Map<string, InsurancePolicyRecord>();
      for (const policy of policies) {
        if (policy.client_id && !policyMap.has(policy.client_id)) {
          policyMap.set(policy.client_id, policy);
        }
      }

      const merged = encounterRows.map((encounter) => ({
        ...encounter,
        diagnoses: diagnosisMap.get(encounter.id) ?? [],
        serviceLines: serviceLineMap.get(encounter.id) ?? [],
        policy: encounter.client_id ? policyMap.get(encounter.client_id) ?? null : null,
        existingClaim: claimMap.get(encounter.id) ?? null,
      }));

      setEncounters(merged);
      setSelectedEncounterId(merged[0]?.id ?? "");
      setLoading(false);
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const selectedEncounter = useMemo(
    () => encounters.find((item) => item.id === selectedEncounterId) ?? null,
    [encounters, selectedEncounterId]
  );

  async function handleCreateClaim() {
    if (!selectedEncounter) return;

    if (!canCreateClaim(selectedEncounter)) {
      setError("Selected encounter is not ready for automated claim creation.");
      return;
    }

    setCreating(true);
    setError(null);
    setResult(null);

    const totalChargeAmount = sumCharges(selectedEncounter.serviceLines).toFixed(2);

    const { data: createdClaim, error: insertError } = await supabase
      .from("claims")
      .insert({
        organization_id: selectedEncounter.organization_id ?? null,
        encounter_id: selectedEncounter.id,
        client_id: selectedEncounter.client_id ?? null,
        insurance_policy_id: selectedEncounter.policy?.id ?? null,
        claim_status: "draft",
        claim_number: null,
        total_charge_amount: totalChargeAmount,
      })
      .select("*")
      .single();

    if (insertError) {
      setError(insertError.message);
      setCreating(false);
      return;
    }

    const claimId = createdClaim.id as string;

    const serviceLinePayload = selectedEncounter.serviceLines.map((line, index) => ({
      organization_id: line.organization_id ?? selectedEncounter.organization_id ?? null,
      claim_id: claimId,
      encounter_service_line_id: line.id,
      service_date: line.service_date ?? selectedEncounter.service_date ?? null,
      sequence_number: index + 1,
      cpt_hcpcs_code: line.cpt_hcpcs_code ?? null,
      modifier_1: line.modifier_1 ?? null,
      modifier_2: line.modifier_2 ?? null,
      modifier_3: line.modifier_3 ?? null,
      modifier_4: line.modifier_4 ?? null,
      units: String(line.units ?? "1"),
      charge_amount: String(line.charge_amount ?? "0.00"),
      allowed_amount: null,
      paid_amount: null,
      diagnosis_pointers: line.diagnosis_pointers ?? null,
      place_of_service_code: line.place_of_service_code ?? null,
      rendering_provider_npi: line.rendering_provider_npi ?? null,
      claim_line_status: "draft",
    }));

    const { error: serviceLineError } = await supabase
      .from("claim_service_lines")
      .insert(serviceLinePayload);

    if (serviceLineError) {
      setError(serviceLineError.message);
      setCreating(false);
      return;
    }

    const { error: encounterUpdateError } = await supabase
      .from("encounters")
      .update({
        encounter_status: "ready_for_billing",
      })
      .eq("id", selectedEncounter.id);

    if (encounterUpdateError) {
      setError(encounterUpdateError.message);
      setCreating(false);
      return;
    }

    setResult(`Claim created and service lines copied: ${claimId}`);
    setCreating(false);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Automated Claim Creation</h1>
            <p className="mt-2 text-sm text-gray-600">
              Creates a draft claim from an encounter, attaches the primary policy, and copies encounter service lines.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading claim automation candidates...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <label className="mb-2 block text-sm font-medium text-gray-700">Select encounter</label>
                <select
                  value={selectedEncounterId}
                  onChange={(event) => setSelectedEncounterId(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
                >
                  {encounters.length === 0 ? (
                    <option value="">No encounters available</option>
                  ) : (
                    encounters.map((encounter) => (
                      <option key={encounter.id} value={encounter.id}>
                        {encounter.id} | client {encounter.client_id ?? "—"} | {encounter.service_date ?? "—"}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedEncounter && (
                <div className="grid gap-6 md:grid-cols-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="text-sm text-gray-500">Billing fields complete</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {selectedEncounter.required_billing_fields_complete ? "Yes" : "No"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="text-sm text-gray-500">Diagnoses</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">{selectedEncounter.diagnoses.length}</div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="text-sm text-gray-500">Service lines</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">{selectedEncounter.serviceLines.length}</div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="text-sm text-gray-500">Primary policy</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedEncounter.policy?.payer_name ?? "Missing"}
                    </div>
                  </div>
                </div>
              )}

              {selectedEncounter?.existingClaim ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
                  A claim already exists for this encounter: {selectedEncounter.existingClaim.id}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                  {error}
                </div>
              ) : null}

              {result ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 shadow-sm">
                  {result}
                </div>
              ) : null}

              <button
                type="button"
                disabled={!selectedEncounter || !canCreateClaim(selectedEncounter) || Boolean(selectedEncounter?.existingClaim) || creating}
                onClick={handleCreateClaim}
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Running automation..." : "Automate Claim Creation"}
              </button>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
