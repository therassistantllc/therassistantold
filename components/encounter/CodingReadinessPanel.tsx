import { CodingReadiness } from "@/lib/types/encounter";
import ScheduleStatusBadge from "@/components/scheduling/ScheduleStatusBadge";

interface CodingReadinessPanelProps {
  coding: CodingReadiness;
}

function getReadinessBadge(status: string) {
  switch (status) {
    case "ready":
      return { label: "Ready to Bill", tone: "success" as const };
    case "warning":
      return { label: "Ready with Warnings", tone: "warning" as const };
    case "blocked":
      return { label: "Blocked", tone: "danger" as const };
    default:
      return { label: "Unknown", tone: "neutral" as const };
  }
}

export default function CodingReadinessPanel({ coding }: CodingReadinessPanelProps) {
  const readinessBadge = getReadinessBadge(coding.status);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Coding & Readiness</h2>
        <ScheduleStatusBadge label={readinessBadge.label} tone={readinessBadge.tone} />
      </div>

      <div className="space-y-4">
        {/* Diagnoses */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Diagnoses</h3>
          {coding.diagnoses.length > 0 ? (
            <div className="space-y-1">
              {coding.diagnoses.map((dx) => (
                <div
                  key={dx.id}
                  className="flex items-start justify-between px-3 py-2 bg-gray-50 rounded border border-gray-200"
                >
                  <div>
                    <span className="font-mono text-sm font-medium text-gray-900">{dx.code}</span>
                    <p className="text-xs text-gray-600 mt-0.5">{dx.description}</p>
                  </div>
                  {dx.isPrimary && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Primary</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-600 px-3 py-2 bg-red-50 border border-red-200 rounded">
              No diagnoses documented
            </p>
          )}
        </div>

        {/* Service Codes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Service Codes</h3>
          {coding.serviceCodes.length > 0 ? (
            <div className="space-y-1">
              {coding.serviceCodes.map((service, index) => (
                <div
                  key={index}
                  className="px-3 py-2 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-sm font-medium text-gray-900">{service.code}</span>
                      {service.modifiers && service.modifiers.length > 0 && (
                        <span className="ml-2 text-xs font-medium text-gray-600">
                          +{service.modifiers.join(", ")}
                        </span>
                      )}
                      <p className="text-xs text-gray-600 mt-0.5">{service.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">{service.units} unit{service.units !== 1 ? "s" : ""}</span>
                      {service.isSuggested && (
                        <p className="text-xs text-green-600 mt-0.5">Suggested</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-600 px-3 py-2 bg-red-50 border border-red-200 rounded">
              No service codes documented
            </p>
          )}
        </div>

        {/* Providers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Rendering Provider</h3>
            {coding.renderingProvider ? (
              <div className="text-sm">
                <p className="font-medium text-gray-900">{coding.renderingProvider.name}</p>
                <p className="text-xs text-gray-600 font-mono">NPI: {coding.renderingProvider.npi}</p>
              </div>
            ) : (
              <p className="text-sm text-red-600">Not assigned</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Billing Provider</h3>
            {coding.billingProvider ? (
              <div className="text-sm">
                <p className="font-medium text-gray-900">{coding.billingProvider.name}</p>
                <p className="text-xs text-gray-600 font-mono">
                  NPI: {coding.billingProvider.npi} | Tax ID: {coding.billingProvider.taxId}
                </p>
              </div>
            ) : (
              <p className="text-sm text-red-600">Not assigned</p>
            )}
          </div>
        </div>

        {/* Blockers */}
        {coding.blockers.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-red-700 mb-2">Blockers</h3>
            <ul className="space-y-1">
              {coding.blockers.map((blocker, index) => (
                <li key={index} className="text-sm text-red-600 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {coding.warnings.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-yellow-700 mb-2">Warnings</h3>
            <ul className="space-y-1">
              {coding.warnings.map((warning, index) => (
                <li key={index} className="text-sm text-yellow-600 flex items-start">
                  <span className="mr-2">⚠</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
