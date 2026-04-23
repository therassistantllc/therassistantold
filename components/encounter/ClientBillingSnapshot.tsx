import { ClientBillingSnapshot } from "@/lib/types/encounter";
import { formatCurrency } from "@/lib/utils/schedule";

interface ClientBillingSnapshotProps {
  clientId: string;
  clientName: string;
  billing: ClientBillingSnapshot;
  onOpenClient: () => void;
}

function getSeverityColor(severity: "error" | "warning" | "info") {
  switch (severity) {
    case "error":
      return "text-red-800 bg-red-50 border-red-200";
    case "warning":
      return "text-yellow-800 bg-yellow-50 border-yellow-200";
    case "info":
      return "text-blue-800 bg-blue-50 border-blue-200";
  }
}

export default function ClientBillingSnapshotComponent({ 
  clientId, 
  clientName, 
  billing, 
  onOpenClient 
}: ClientBillingSnapshotProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Client & Billing</h2>
        <button
          onClick={onOpenClient}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Open Client Profile →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Client Balance</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(billing.clientBalance)}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Insurance Balance</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(billing.insuranceBalance)}</p>
        </div>

        {billing.lastPaymentDate && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Last Payment</p>
              <p className="text-sm text-gray-900">{new Date(billing.lastPaymentDate).toLocaleDateString()}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Last Payment Amount</p>
              <p className="text-sm text-gray-900">
                {billing.lastPaymentAmount ? formatCurrency(billing.lastPaymentAmount) : "--"}
              </p>
            </div>
          </>
        )}
      </div>

      {billing.priorAuth && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Prior Authorization</p>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                billing.priorAuth.status === "active"
                  ? "bg-green-100 text-green-800"
                  : billing.priorAuth.status === "expired"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {billing.priorAuth.status.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-blue-900">
            <div>
              <span className="font-medium">Auth #:</span> {billing.priorAuth.authNumber}
            </div>
            <div>
              <span className="font-medium">Valid:</span> {new Date(billing.priorAuth.startDate).toLocaleDateString()} -{" "}
              {new Date(billing.priorAuth.endDate).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Units:</span> {billing.priorAuth.unitsUsed} / {billing.priorAuth.unitsAuthorized}
            </div>
          </div>
        </div>
      )}

      {billing.alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Billing Alerts</p>
          {billing.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`text-sm px-3 py-2 rounded-md border ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <span>{alert.message}</span>
                <span className="text-xs opacity-75">{alert.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {billing.alerts.length === 0 && !billing.priorAuth && (
        <p className="text-sm text-gray-500 italic">No billing alerts or authorizations</p>
      )}
    </div>
  );
}
