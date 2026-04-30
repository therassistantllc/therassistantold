"use client";

import type { WorkflowStatus, WorkflowStepStatus } from "@/lib/workflow/deriveEncounterWorkflowStatus";

interface EncounterWorkflowTrackerProps {
  status: WorkflowStatus;
  orientation?: "horizontal" | "vertical";
  showLabels?: boolean;
  compact?: boolean;
}

const stepLabels = {
  appointmentStatus: "Appointment",
  encounterStatus: "Encounter",
  noteStatus: "Note",
  chargeStatus: "Charge",
  claimStatus: "Claim",
  paymentStatus: "Payment",
};

function getStepColor(status: WorkflowStepStatus): string {
  switch (status) {
    case "complete":
      return "bg-green-500 border-green-600";
    case "in_progress":
      return "bg-blue-500 border-blue-600";
    case "needs_review":
      return "bg-yellow-500 border-yellow-600";
    case "blocked":
      return "bg-red-500 border-red-600";
    case "not_started":
    default:
      return "bg-gray-300 border-gray-400";
  }
}

function getStepIcon(status: WorkflowStepStatus): string {
  switch (status) {
    case "complete":
      return "✓";
    case "in_progress":
      return "→";
    case "needs_review":
      return "!";
    case "blocked":
      return "✕";
    case "not_started":
    default:
      return "○";
  }
}

export default function EncounterWorkflowTracker({
  status,
  orientation = "horizontal",
  showLabels = true,
  compact = false,
}: EncounterWorkflowTrackerProps) {
  const steps: Array<{ key: keyof typeof stepLabels; status: WorkflowStepStatus }> = [
    { key: "appointmentStatus", status: status.appointmentStatus },
    { key: "encounterStatus", status: status.encounterStatus },
    { key: "noteStatus", status: status.noteStatus },
    { key: "chargeStatus", status: status.chargeStatus },
    { key: "claimStatus", status: status.claimStatus },
    { key: "paymentStatus", status: status.paymentStatus },
  ];

  if (orientation === "horizontal") {
    return (
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-${compact ? "8" : "10"} w-${compact ? "8" : "10"} items-center justify-center rounded-full border-2 ${getStepColor(step.status)} text-white text-xs font-bold`}
                title={`${stepLabels[step.key]}: ${step.status.replace("_", " ")}`}
              >
                {getStepIcon(step.status)}
              </div>
              {showLabels && (
                <div className="mt-1 text-center text-[10px] text-gray-600">
                  {stepLabels[step.key]}
                </div>
              )}
            </div>
            {index < steps.length - 1 && (
              <div className={`h-0.5 w-${compact ? "4" : "8"} bg-gray-300`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Vertical orientation
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, index) => (
        <div key={step.key} className="flex flex-col">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-${compact ? "8" : "10"} w-${compact ? "8" : "10"} flex-shrink-0 items-center justify-center rounded-full border-2 ${getStepColor(step.status)} text-white text-xs font-bold`}
              title={`${stepLabels[step.key]}: ${step.status.replace("_", " ")}`}
            >
              {getStepIcon(step.status)}
            </div>
            {showLabels && (
              <div className="text-sm font-medium text-gray-700">
                {stepLabels[step.key]}
                <div className="text-xs text-gray-500 capitalize">
                  {step.status.replace("_", " ")}
                </div>
              </div>
            )}
          </div>
          {index < steps.length - 1 && (
            <div className={`ml-${compact ? "4" : "5"} h-${compact ? "4" : "6"} w-0.5 bg-gray-300`} />
          )}
        </div>
      ))}
    </div>
  );
}
