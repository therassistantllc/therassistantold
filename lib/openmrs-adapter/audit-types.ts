/**
 * OpenMRS ESM Module Audit & Compatibility Checker
 * 
 * Evaluates OpenMRS modules for integration feasibility with TherAssistant EHR.
 * Determines: npm vs GitHub source, single-spa vs standalone, feature mapping, risks.
 */

// ==================== Audit Types ====================

export type ModuleSourceType = "npm" | "github";
export type ExecutionModel = "single-spa" | "standalone" | "webpack-plugin";
export type IntegrationStrategy = "direct-import" | "adapter" | "api-bridge" | "defer";
export type AuditStatus = "pending" | "in-progress" | "reviewed" | "risk-identified" | "approved";

export interface ModuleAuditRequest {
  /** Module name (e.g., "@openmrs/esm-home-app") */
  name: string;

  /** GitHub repo path (e.g., "openmrs/openmrs-esm-core") */
  githubRepo?: string;

  /** NPM package name (e.g., "@openmrs/esm-home-app") */
  npmPackage?: string;

  /** TherAssistant feature this module replaces/enhances */
  therassistantContext?: string;

  /** Priority: 0 (critical/blocking) - 5 (nice-to-have) */
  priority: number;

  /** Module description from OpenMRS */
  description?: string;
}

export interface ModuleAuditResult {
  // Request context
  name: string;
  auditedAt: string;
  auditedBy?: string;

  // Source & Distribution
  sourceType: ModuleSourceType;
  sourceUrl: string;
  npmPackageName: string;
  latestVersion?: string;
  packageSize?: number; // bytes

  // Architecture
  executionModel: ExecutionModel;
  singleSpaPlugin: boolean;
  webpackModuleFederation?: boolean;
  iframeReady?: boolean;

  // Dependencies
  dependencies: Array<{
    name: string;
    version: string;
    isOptional: boolean;
    conflictsWith?: string[]; // TherAssistant packages
  }>;

  // Features & Functionality
  features: Array<{
    name: string;
    description: string;
    tldr: string;
    mapsTo?: string; // TherAssistant feature/route
  }>;

  // Integration assessment
  integration: {
    strategy: IntegrationStrategy;
    reasoning: string;
    estimatedEffort: "low" | "medium" | "high" | "very-high";
    blockers?: string[];
    risks?: string[];
  };

  // OpenMRS-specific concerns
  openmrsDetails: {
    requiredCoreVersion?: string;
    deprecations?: string[];
    knownIssues?: string[];
  };

  // Recommendations
  recommendation: {
    status: AuditStatus;
    decision: "import" | "adapt" | "defer" | "skip";
    reasoning: string;
    nextSteps?: string[];
  };

  // Full audit notes (markdown)
  fullAudit?: string;
}

// ==================== High Priority Modules ====================

export const HIGH_PRIORITY_MODULES: ModuleAuditRequest[] = [
  {
    name: "esm-home-app",
    githubRepo: "openmrs/openmrs-esm-core",
    npmPackage: "@openmrs/esm-home-app",
    therassistantContext: "/calendar - appointment scheduling surface",
    priority: 0,
    description: "OpenMRS home dashboard with appointments, vital alerts, patient search",
  },
  {
    name: "esm-patient-chart-app",
    githubRepo: "openmrs/openmrs-esm-core",
    npmPackage: "@openmrs/esm-patient-chart-app",
    therassistantContext: "/clients/[id] - patient chart room",
    priority: 0,
    description: "Main patient chart with encounters, medications, allergies, notes",
  },
  {
    name: "esm-appointments-app",
    githubRepo: "openmrs/openmrs-esm-appointments",
    npmPackage: "@openmrs/esm-appointments-app",
    therassistantContext: "/calendar - appointment scheduling",
    priority: 0,
    description: "Dedicated appointments scheduling and management app",
  },
  {
    name: "esm-patient-search-app",
    githubRepo: "openmrs/openmrs-esm-core",
    npmPackage: "@openmrs/esm-patient-search-app",
    therassistantContext: "/clients - patient/client list and search",
    priority: 0,
    description: "Patient search, lookup, registration interface",
  },
  {
    name: "esm-patient-attachments-app",
    githubRepo: "openmrs/openmrs-esm-attachments",
    npmPackage: "@openmrs/esm-patient-attachments-app",
    therassistantContext: "/mailroom - document management",
    priority: 1,
    description: "Patient attachments, file uploads, document management",
  },
];

// ==================== Module Feature Mapping ====================

export const FEATURE_MAPPINGS: Record<string, Record<string, string>> = {
  "esm-home-app": {
    "Scheduled Visits": "/calendar",
    "Quick Visit Notes": "/encounters/new",
    "Recent Patients": "/clients",
    "Alerts & Warnings": "/workflow-status",
    "Patient Search": "/clients",
  },
  "esm-patient-chart-app": {
    "Patient Demographics": "/clients/[id]",
    "Active Encounters": "/clients/[id]/appointments",
    "Medications": "/clients/[id]/documents",
    "Allergies": "/clients/[id]/conditions",
    "Diagnosis History": "/clients/[id]/conditions",
    "Clinical Notes": "/clinician/agenda",
  },
  "esm-appointments-app": {
    "Schedule Appointments": "/calendar",
    "View Appointments": "/clinician/agenda",
    "Manage Schedules": "/calendar",
    "Calendar View": "/calendar",
  },
  "esm-patient-search-app": {
    "Patient Search": "/clients",
    "Patient Lookup": "/clients",
    "Quick Search": "/clients",
    "Recent Searches": "/clients",
  },
  "esm-patient-attachments-app": {
    "Upload Files": "/mailroom",
    "View Attachments": "/clients/[id]/documents",
    "Download Documents": "/mailroom",
    "File Management": "/mailroom",
  },
};

// ==================== Compatibility Checker ====================

/**
 * Check if a module can be directly imported as npm package
 *
 * Indicators:
 * - Available on npm registry
 * - Exports UMD/ESM builds
 * - No build-time bundler assumptions
 * - Reasonable package size
 */
export function canImportFromNPM(result: ModuleAuditResult): boolean {
  const indicators = [
    result.sourceType === "npm",
    result.latestVersion !== undefined,
    result.executionModel !== "webpack-plugin",
    (result.packageSize || 0) < 500000, // < 500KB
  ];

  return indicators.filter(Boolean).length >= 3;
}

/**
 * Check if module uses single-spa conventions
 *
 * Requires:
 * - Compatible package.json exports
 * - singleSpaPlugin declaration
 * - No assumption of window.openmrs
 */
export function usesSingleSpa(result: ModuleAuditResult): boolean {
  return result.singleSpaPlugin && !result.iframeReady;
}

/**
 * Check if module has dependency conflicts with TherAssistant
 *
 * Conflicts if:
 * - Different major version of React
 * - Incompatible form library
 * - Conflicting CSS framework
 */
export function hasConflicts(result: ModuleAuditResult): boolean {
  const conflictPatterns = ["react", "react-dom", "react-router-dom", "tailwindcss"];

  return result.dependencies.some(
    (dep) =>
      conflictPatterns.some((pattern) => dep.name.includes(pattern)) &&
      dep.conflictsWith &&
      dep.conflictsWith.length > 0,
  );
}

/**
 * Recommend integration strategy based on audit
 *
 * Decision tree:
 * 1. Can import from npm + no conflicts → direct-import
 * 2. Need adaptation + moderate effort → adapter
 * 3. Fundamentally incompatible → api-bridge or defer
 */
export function recommendStrategy(result: ModuleAuditResult): IntegrationStrategy {
  // Already decided
  if (result.integration.strategy !== "direct-import") {
    return result.integration.strategy;
  }

  const canImport = canImportFromNPM(result);
  const hasConflict = hasConflicts(result);

  if (!canImport || hasConflict) {
    const effort = result.integration.estimatedEffort;
    if (effort === "low" || effort === "medium") {
      return "adapter";
    } else if (effort === "high" || effort === "very-high") {
      return "api-bridge";
    }
  }

  if (canImport && !hasConflict) {
    return "direct-import";
  }

  return "defer";
}

// ==================== Audit Checklist ====================

export const AUDIT_CHECKLIST = {
  "Source & Distribution": [
    "Find module on npm registry",
    "Check GitHub source repo",
    "Document package.json exports",
    "Note package size",
    "Check download stats & maintenance",
  ],

  "Architecture": [
    "Verify single-spa plugin declaration",
    "Check for webpack module federation",
    "Look for iframe isolation readiness",
    "Review module entry point structure",
    "Document execution model",
  ],

  "Dependencies": [
    "Extract npm dependencies",
    "Cross-check against TherAssistant package.json",
    "Identify version conflicts",
    "Mark optional dependencies",
    "Check for peer dependency requirements",
  ],

  "Features": [
    "List all exported features/components",
    "Map to TherAssistant equivalent routes/features",
    "Identify overlaps & gaps",
    "Document feature flags/configuration",
    "Note which features are essential vs optional",
  ],

  "Integration Assessment": [
    "Estimate adaptation effort",
    "Identify blockers (missing APIs, incompatibilities)",
    "Document risks (breaking changes, browser compatibility)",
    "Determine reversibility",
    "Plan rollback strategy",
  ],

  "OpenMRS Context": [
    "Check required OpenMRS core version",
    "Look for deprecation warnings",
    "Note known issues from OpenMRS GitHub",
    "Document API compatibility assumptions",
    "Check update frequency",
  ],

  "Recommendation": [
    "Summarize decision (import/adapt/defer/skip)",
    "Justify with evidence from audit",
    "Define next steps if approval",
    "Set priority/timeline",
    "Assign to team member",
  ],
};
