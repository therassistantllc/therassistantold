// File: components/encounter/ClientBillingSnapshot.tsx
"use client";

type BillingAlert = {
  id?: string;
  title?: string;
  message?: string;
  severity?: "info" | "warning" | "error";
};

type BillingSnapshot = {
  patientBalance?: number;
  insuranceBalance?: number;
  totalBalance?: number;
  unpostedAmount?: number;
  billingAlertCount?: number;
  alerts?: BillingAlert[];
};

type ClientBillingSnapshotProps = {
  billing?: BillingSnapshot | null;
};

function formatCurrency(value: number | undefined): string {
  const amount = Number(value ?? 0);
  return `$${amount.toFixed(2)}`;
}

export default function ClientBillingSnapshotComponent({
  billing,
}: ClientBillingSnapshotProps) {
  const safeBilling: Required<
    Pick<
      BillingSnapshot,
      "patientBalance" | "insuranceBalance" | "totalBalance" | "unpostedAmount" | "billingAlertCount"
    >
  > & { alerts: BillingAlert[] } = {
    patientBalance: Number(billing?.patientBalance ?? 0),
    insuranceBalance: Number(billing?.insuranceBalance ?? 0),
    totalBalance: Number(billing?.totalBalance ?? 0),
    unpostedAmount: Number(billing?.unpostedAmount ?? 0),
    billingAlertCount: Number(billing?.billingAlertCount ?? 0),
    alerts: Array.isArray(billing?.alerts) ? billing!.alerts : [],
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">Billing Snapshot</h3>
        <p className="text-sm text-gray-500">Current client financial summary</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Patient Balance
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatCurrency(safeBilling.patientBalance)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Insurance Balance
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatCurrency(safeBilling.insuranceBalance)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Total Balance
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatCurrency(safeBilling.totalBalance)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Unposted Amount
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatCurrency(safeBilling.unpostedAmount)}
          </p>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Alert count: {safeBilling.billingAlertCount}
      </div>

      {safeBilling.alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Billing Alerts
          </p>

          {safeBilling.alerts.map((alert, index) => (
            <div
              key={alert.id || `${alert.title || "alert"}-${index}`}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <p className="font-medium">{alert.title || "Billing Alert"}</p>
              {alert.message && <p className="mt-1">{alert.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}