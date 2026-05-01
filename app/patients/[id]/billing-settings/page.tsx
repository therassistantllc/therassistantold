// File: app/patients/[id]/billing-settings/page.tsx
"use client";

import { useParams } from "next/navigation";
import ClassicPatientChartResolved from "@/components/patient-chart/ClassicPatientChartResolved";

interface InsurancePolicyRecord {
  id: string;
  plan_name?: string | null;
  policy_number?: string | null;
  subscriber_id?: string | null;
  payer_id?: string | null;
  effective_date?: string | null;
  termination_date?: string | null;
  active_flag?: boolean | null;
  priority?: string | number | null;
}

export default function PatientInsuranceEligibilityPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [policies, setPolicies] = useState<InsurancePolicyRecord[]>([]);
  const [latest, setLatest] = useState<EligibilityCheck | null>(null);
  const [history, setHistory] = useState<EligibilityCheck[]>([]);
  const [transactions, setTransactions] = useState<EdiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!patientId) {
      setError("Patient ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const policyResp = await supabase
      .from("insurance_policies")
      .select("*")
      .eq("client_id", patientId)
      .is("archived_at", null)
      .order("priority", { ascending: true });

    if (policyResp.error) {
      setError(policyResp.error.message);
      setLoading(false);
      return;
    }

    setPolicies((policyResp.data ?? []) as InsurancePolicyRecord[]);

    const eligibilityResp = await fetch(`/api/patients/${patientId}/eligibility`);
    const eligibilityPayload = await eligibilityResp.json();
    if (!eligibilityResp.ok) {
      setError(eligibilityPayload.error ?? "Could not load eligibility history.");
      setLoading(false);
      return;
    }

    setLatest((eligibilityPayload.latest ?? null) as EligibilityCheck | null);
    setHistory((eligibilityPayload.history ?? []) as EligibilityCheck[]);

    const transactionResp = await fetch(`/api/clearinghouse/transactions?patient_id=${patientId}`);
    const transactionPayload = await transactionResp.json();
    if (transactionResp.ok) {
      setTransactions((transactionPayload.rows ?? []) as EdiTransaction[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [patientId]);

  const activePolicy = policies.find((item) => item.active_flag) ?? policies[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insurance & Eligibility</h1>
            <p className="mt-2 text-sm text-gray-600">
              Active insurance, latest 271 result, and eligibility history live here.
            </p>
          </div>
          <Link href="/clearinghouse/transactions" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
            Open Transaction Log
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading insurance and eligibility...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Active Policies</h2>
              {policies.length === 0 ? (
                <div className="mt-4 text-sm text-gray-600">No insurance policies found.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {policies.map((policy) => (
                    <div key={policy.id} className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">{policy.plan_name ?? "Policy"}</div>
                      <div className="mt-1">Policy: {policy.policy_number ?? "—"} • Member: {policy.subscriber_id ?? "—"}</div>
                      <div className="mt-1">Payer ID: {policy.payer_id ?? "—"} • Priority: {policy.priority ?? "—"}</div>
                      <div className="mt-1">Coverage: {policy.effective_date ?? "—"} to {policy.termination_date ?? "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {patientId ? (
              <EligibilityPanel
                patientId={patientId}
                insurancePolicyId={activePolicy?.id ?? null}
                latest={latest}
                onComplete={load}
              />
            ) : null}
          </div>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Eligibility History</h2>
            </div>
            <EligibilityHistoryTable rows={history} />
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Clearinghouse Transaction Visibility</h2>
            </div>
            <EdiTransactionLog rows={transactions} />
          </section>
        </>
      )}
    </div>
  );
}
