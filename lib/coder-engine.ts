export type ServicePath = "mh" | "sud" | "integrated";
export type RuleCode = "H0002" | "H0031" | "H0001" | "H0032";

export type CodingForm = {
  servicePath: ServicePath;

  dos: string;
  clinician: string;
  pos: string;
  providerType: string;

  start: string;
  end: string;
  mins: number | "";

  diagnosisCategory: string;
  diagnosisCode: string;
  sdoh: string;
  contextShort: string;

  screenTools: string[];
  screenScored: boolean;
  screenInterpreted: boolean;
  screenAction: "none" | "referral" | "further-assessment" | "triage" | "monitoring";

  // PAGE 2: What They're Experiencing
  newConcerns: "yes" | "no" | "";
  currentExperience: "yes" | "no" | "";
  symptomProgression: "yes" | "no" | "";
  sessionChanges: "yes" | "no" | "";
  severityExploration: "yes" | "no" | "";
  onsetHistory: "yes" | "no" | "";
  strengthsDiscussion: "yes" | "no" | "";
  substanceUse: "yes" | "no" | "";
  cravingsAssessment: "yes" | "no" | "";
  triggersIdentification: "yes" | "no" | "";
  treatmentHistory: "yes" | "no" | "";

  mh_currentSymptoms: boolean;
  mh_severity: boolean;
  mh_history: boolean;
  mh_strengths: boolean;
  mh_social: boolean;
  mh_work: boolean;
  mh_adl: boolean;
  mh_cognitive: boolean;
  mh_risk: boolean;
  mh_dxClarified: boolean;
  mh_dxRevised: boolean;
  mh_reassessment: boolean;

  sud_alcohol: boolean;
  sud_opioids: boolean;
  sud_stimulants: boolean;
  sud_cannabis: boolean;
  sud_sedatives: boolean;
  sud_otherSubstance: boolean;
  sud_frequency: boolean;
  sud_quantity: boolean;
  sud_duration: boolean;
  sud_route: boolean;
  sud_lastUse: boolean;
  sud_history: boolean;
  sud_cravings: boolean;
  sud_tolerance: boolean;
  sud_withdrawal: boolean;
  sud_relapse: boolean;
  sud_readiness: boolean;
  sud_functionImpact: boolean;
  sud_diagnosis: boolean;
  sud_asam: boolean;
  sud_loc: boolean;

  plan_initial: boolean;
  plan_review: boolean;
  plan_goals: boolean;
  plan_objectives: boolean;
  plan_interventions: boolean;
  plan_progress: boolean;
  plan_barriers: boolean;
  plan_clientCollab: boolean;
  planReason: string;
  planFreqChange: boolean;

  interventions: string[];

  engagement: string;
  functionalStatus: string;
  responseBenefit: string;
  followUp: string;
};

export type RuleResult = {
  code: RuleCode;
  category: string;
  triggerThreshold: number;
  matchedCount: number;
  score: number;
  blocked: boolean;
  status: "none" | "blocked" | "suggest" | "borderline";
  confidence: "low" | "medium" | "high";
  support: string[];
  requiredMissing: string[];
  matchedAutoTriggers: string[];
  matchedExclusions: string[];
  autoTriggered: boolean;
  recommendedDocumentation: string[];
  suggestedQuestionPrompts: string[];
  exclusionRules: string[];
  explanation: string;
  followUp: string;
};

export type TriggerRule = {
  code: RuleCode;
  category: string;
  triggerThreshold: number;
  requiredConditions: string[];
  optionalConditions: string[];
  autoTriggers: string[];
  exclusionRules: string[];
  exclusionConditions: string[];
  recommendedDocumentation: string[];
  suggestedQuestionPrompts: string[];
};

export type PsychotherapyResult = {
  code: string;
  label: string;
  detail: string;
};

export type CodingOutput = {
  missing: string[];
  psych: PsychotherapyResult;
  ruleResults: RuleResult[];
  strength: {
    score: number;
    chips: string[];
  };
  supportSummary: string;
  narrative: string;
};

export const TRIGGER_RULES: TriggerRule[] = [
  {
    code: "H0031",
    category: "Behavioral Health Assessment",
    triggerThreshold: 2,
    requiredConditions: [],
    optionalConditions: [
      "newSymptomsReviewed",
      "changeInSymptomsReviewed",
      "mentalHealthHistoryReviewed",
      "functioningDiscussed",
      "socialFunctioningDiscussed",
      "occupationalFunctioningDiscussed",
      "housingOrEnvironmentalStabilityReviewed",
      "riskAssessmentCompleted",
      "suicideRiskReviewed",
      "violenceRiskReviewed",
      "safetyPlanDiscussed",
      "diagnosticClarificationPerformed",
      "diagnosticCriteriaReviewed",
      "differentialDiagnosisConsidered",
      "diagnosisUpdated",
      "significantLifeEventReviewed",
      "treatmentResponseReviewed",
      "relapseOrDecompensationReviewed",
    ],
    autoTriggers: [
      "initialIntake",
      "diagnosticClarification",
      "reassessmentAfterClinicalChange",
      "riskAssessmentCompleted",
    ],
    exclusionRules: [
      "Do not trigger solely because psychotherapy occurred",
      "Do not trigger if only coping skills or emotional support were discussed",
      "Do not trigger if there was no assessment of symptoms, functioning, risk, or diagnosis",
    ],
    exclusionConditions: ["routinePsychotherapyOnly", "supportiveOnlyNoAssessment", "noAssessmentElements"],
    recommendedDocumentation: [
      "Document symptoms reviewed",
      "Document changes in functioning",
      "Document diagnostic impressions",
      "Document risk assessment findings",
      "Document rationale for reassessment or updated diagnosis",
    ],
    suggestedQuestionPrompts: [
      "Did you identify any new symptoms or concerns?",
      "Did you discuss whether symptoms are improving, worsening, or staying the same?",
      "Did you review how symptoms are affecting work, school, relationships, or daily life?",
      "Did you assess for safety concerns, suicide risk, self-harm, or violence risk?",
      "Did you review or update the diagnosis?",
      "Did you discuss any major life changes affecting the client’s mental health?",
    ],
  },
  {
    code: "H0032",
    category: "Treatment Plan Development or Review",
    triggerThreshold: 1,
    requiredConditions: [],
    optionalConditions: [
      "treatmentGoalsCreated",
      "treatmentGoalsReviewed",
      "treatmentGoalsUpdated",
      "barriersToGoalsDiscussed",
      "progressTowardGoalsReviewed",
      "interventionsModified",
      "frequencyOfServicesChanged",
      "carePlanUpdated",
      "newProblemAddedToTreatmentPlan",
      "dischargePlanningDiscussed",
      "coordinationWithOtherProvidersDiscussed",
    ],
    autoTriggers: [
      "treatmentPlanUpdated",
      "goalsModified",
      "newInterventionAdded",
      "quarterlyTreatmentPlanReview",
      "dischargePlanningCompleted",
    ],
    exclusionRules: [
      "Do not trigger solely because progress was mentioned",
      "Do not trigger if no goals, objectives, interventions, or planning activities were discussed",
      "Do not trigger if the session was supportive only",
    ],
    exclusionConditions: ["progressOnlyMentioned", "noPlanningActivities", "supportiveSessionOnly"],
    recommendedDocumentation: [
      "Document treatment goals reviewed or modified",
      "Document barriers to progress",
      "Document intervention changes",
      "Document client participation in planning",
      "Document updated treatment plan elements",
    ],
    suggestedQuestionPrompts: [
      "Did you review any treatment goals with the client?",
      "Did you update or change any goals, objectives, or interventions?",
      "Did you discuss barriers that are affecting progress?",
      "Did you discuss changing the frequency of services or level of care?",
      "Did you create a new goal or focus area for treatment?",
    ],
  },
  {
    code: "H0001",
    category: "Substance Use Assessment",
    triggerThreshold: 2,
    requiredConditions: [],
    optionalConditions: [
      "substanceTypeReviewed",
      "frequencyOfUseReviewed",
      "quantityOfUseReviewed",
      "durationOfUseReviewed",
      "cravingsReviewed",
      "withdrawalSymptomsReviewed",
      "toleranceReviewed",
      "relapseHistoryReviewed",
      "triggersForUseReviewed",
      "recoverySupportsReviewed",
      "legalProblemsRelatedToUseReviewed",
      "employmentProblemsRelatedToUseReviewed",
      "relationshipProblemsRelatedToUseReviewed",
      "ASAMDimensionsReviewed",
      "substanceUseDiagnosisReviewed",
      "DSMCriteriaForSUDReviewed",
      "levelOfCareReviewed",
    ],
    autoTriggers: [
      "substanceUseIntake",
      "relapseAssessment",
      "ASAMAssessment",
      "courtOrderedSubstanceAssessment",
      "levelOfCareDetermination",
    ],
    exclusionRules: [
      "Do not trigger solely because the client reported using substances",
      "Do not trigger if only one brief question about alcohol or drug use was asked",
      "Do not trigger if no assessment of use patterns, consequences, risk, or diagnosis occurred",
    ],
    exclusionConditions: ["substanceUseReportedOnly", "briefSubstanceQuestionOnly", "noSubstanceAssessment"],
    recommendedDocumentation: [
      "Document substances used",
      "Document frequency, amount, and duration of use",
      "Document relapse history and triggers",
      "Document recovery supports",
      "Document diagnostic impressions related to substance use",
    ],
    suggestedQuestionPrompts: [
      "Did you ask about alcohol or drug use?",
      "Did you discuss what substances the client is using and how often?",
      "Did you ask about cravings, urges, relapse risk, or withdrawal symptoms?",
      "Did you discuss how substance use is affecting work, relationships, legal issues, or health?",
      "Did you discuss treatment history, detox, rehab, or recovery supports?",
    ],
  },
  {
    code: "H0002",
    category: "Behavioral Health Screening",
    triggerThreshold: 1,
    requiredConditions: [],
    optionalConditions: [
      "PHQ9Completed",
      "GAD7Completed",
      "PCL5Completed",
      "AUDITCompleted",
      "AUDITCCompleted",
      "DASTCompleted",
      "CAGECompleted",
      "CSSRSCompleted",
      "MoodDisorderQuestionnaireCompleted",
      "screeningResultsReviewed",
      "screeningResultsDiscussed",
      "screeningUsedForReferralDecision",
      "screeningUsedForEligibilityDecision",
    ],
    autoTriggers: ["validatedScreeningToolCompleted"],
    exclusionRules: [
      "Do not trigger if no formal screening instrument was used",
      "Do not trigger solely because symptoms were discussed",
      "Do not trigger if only informal questions were asked",
    ],
    exclusionConditions: ["noFormalScreeningInstrument", "symptomsDiscussedOnly", "informalQuestionsOnly"],
    recommendedDocumentation: [
      "Document which screening tool was used",
      "Document score or result",
      "Document interpretation of results",
      "Document how the screening affected treatment decisions",
    ],
    suggestedQuestionPrompts: [
      "Did you complete a PHQ-9, GAD-7, PCL-5, C-SSRS, AUDIT, DAST, or another formal screening tool?",
      "Did you review the screening results with the client?",
      "Did the screening results affect diagnosis, referral, or treatment planning?",
    ],
  },
];

export const RULE_BY_CODE: Record<RuleCode, TriggerRule> = Object.fromEntries(
  TRIGGER_RULES.map((rule) => [rule.code, rule])
) as Record<RuleCode, TriggerRule>;

export function calcMinutes(data: CodingForm): number {
  if (typeof data.mins === "number" && data.mins > 0) return data.mins;
  if (!data.start || !data.end) return 0;

  const [sh, sm] = data.start.split(":").map(Number);
  const [eh, em] = data.end.split(":").map(Number);

  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;

  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  return endMinutes - startMinutes;
}

export function getPsychotherapyResult(data: CodingForm): PsychotherapyResult {
  const mins = calcMinutes(data);

  if (mins >= 53) {
    return {
      code: "90837",
      label: "90837 — Psychotherapy, 60 minutes",
      detail: `${mins} total minutes documented.`,
    };
  }
  if (mins >= 38) {
    return {
      code: "90834",
      label: "90834 — Psychotherapy, 45 minutes",
      detail: `${mins} total minutes documented.`,
    };
  }
  if (mins >= 16) {
    return {
      code: "90832",
      label: "90832 — Psychotherapy, 30 minutes",
      detail: `${mins} total minutes documented.`,
    };
  }

  return {
    code: "",
    label: "No psychotherapy code supported by duration",
    detail: mins ? `${mins} total minutes documented.` : "Session minutes not available.",
  };
}

export function validateCore(data: CodingForm): string[] {
  const missing: string[] = [];
  if (!data.dos) missing.push("Date of Service");
  if (!data.clinician) missing.push("Clinician");
  if (!data.pos) missing.push("Place of Service");
  if (!data.diagnosisCode) missing.push("Diagnosis");
  if (calcMinutes(data) <= 0) missing.push("Time / Minutes");
  if (data.interventions.length === 0) missing.push("At least one intervention");
  return missing;
}

export function getSupportFlags(data: CodingForm): Set<string> {
  const flags = new Set<string>();
  const tools = data.screenTools;
  const interventions = data.interventions;

  if (tools.length) {
    flags.add("validated_screening_tool_used");
    flags.add("validatedScreeningToolCompleted");
  } else {
    flags.add("no_screening_tool_used");
    flags.add("noFormalScreeningInstrument");
  }

  if (data.screenScored) flags.add("screening_score_documented");
  if (data.screenInterpreted) flags.add("screening_interpreted");
  if (data.screenScored || data.screenInterpreted) {
    flags.add("screeningResultsReviewed");
    flags.add("screeningResultsDiscussed");
  }
  if (tools.length && (data.screenScored || data.screenInterpreted)) {
    flags.add("screening_discussed_with_client");
  }
  if (data.screenAction === "referral") {
    flags.add("screening_used_for_referral");
    flags.add("screeningUsedForReferralDecision");
  }
  if (data.screenAction === "triage" || data.screenAction === "further-assessment") {
    flags.add("screening_used_for_triage");
    flags.add("screeningUsedForEligibilityDecision");
  }

  if (tools.includes("PHQ-9")) flags.add("PHQ9Completed");
  if (tools.includes("GAD-7")) flags.add("GAD7Completed");
  if (tools.includes("PCL-5")) flags.add("PCL5Completed");
  if (tools.includes("AUDIT/AUDIT-C")) {
    flags.add("AUDITCompleted");
    flags.add("AUDITCCompleted");
  }
  if (tools.includes("DAST")) flags.add("DASTCompleted");
  if (tools.includes("CAGE")) flags.add("CAGECompleted");
  if (tools.includes("C-SSRS")) flags.add("CSSRSCompleted");
  if (tools.includes("MDQ")) flags.add("MoodDisorderQuestionnaireCompleted");
  if (!tools.length && (data.screenScored || data.screenInterpreted)) {
    flags.add("informalQuestionsOnly");
  }

  if (data.servicePath !== "sud") {
    // PAGE 2: What They're Experiencing
    if (data.newConcerns === "yes" || data.currentExperience === "yes") flags.add("current_symptoms_reviewed");
    if (data.symptomProgression === "yes" || data.severityExploration === "yes") flags.add("symptom_severity_reviewed");
    if (data.onsetHistory === "yes" || data.sessionChanges === "yes") flags.add("history_of_presenting_problem_reviewed");
    if (data.strengthsDiscussion === "yes") flags.add("strengths_reviewed");
    
    const page2Activity = [
      data.newConcerns === "yes",
      data.currentExperience === "yes",
      data.symptomProgression === "yes",
      data.sessionChanges === "yes",
      data.severityExploration === "yes",
      data.onsetHistory === "yes",
      data.strengthsDiscussion === "yes",
    ].filter(Boolean).length;
    
    if (page2Activity > 0) flags.add("mh_reassessment");

    // PAGE 5: Legacy MH checkbox fields (kept for backward compatibility)
    if (data.mh_currentSymptoms) flags.add("current_symptoms_reviewed");
    if (data.mh_severity) flags.add("symptom_severity_reviewed");
    if (data.mh_history) flags.add("history_of_presenting_problem_reviewed");
    if (data.mh_strengths) flags.add("strengths_reviewed");

    const funcCount = [data.mh_social, data.mh_work, data.mh_adl, data.mh_cognitive].filter(Boolean).length;
    if (funcCount === 1) flags.add("functioning_reviewed_single_domain");
    if (funcCount >= 2) flags.add("functioning_reviewed_multiple_domains");

    if (data.mh_risk) flags.add("risk_assessed");
    if (data.mh_dxClarified) flags.add("diagnostic_clarification_done");
    if (data.mh_dxRevised) flags.add("diagnosis_revised");
    if (data.mh_reassessment) flags.add("mh_reassessment");

    if (data.newConcerns === "yes" || data.currentExperience === "yes" || data.mh_currentSymptoms) {
      flags.add("newSymptomsReviewed");
    }
    if (data.symptomProgression === "yes" || data.severityExploration === "yes" || data.mh_severity) {
      flags.add("changeInSymptomsReviewed");
    }
    if (data.onsetHistory === "yes" || data.sessionChanges === "yes" || data.mh_history) {
      flags.add("mentalHealthHistoryReviewed");
    }
    if (funcCount > 0) flags.add("functioningDiscussed");
    if (data.mh_social) flags.add("socialFunctioningDiscussed");
    if (data.mh_work) flags.add("occupationalFunctioningDiscussed");
    if (data.sdoh && data.sdoh !== "None / Not documented") {
      flags.add("housingOrEnvironmentalStabilityReviewed");
    }
    if (data.mh_risk) {
      flags.add("riskAssessmentCompleted");
      flags.add("suicideRiskReviewed");
      flags.add("violenceRiskReviewed");
    }
    if (data.planReason === "safety") flags.add("safetyPlanDiscussed");
    if (data.mh_dxClarified) {
      flags.add("diagnosticClarificationPerformed");
      flags.add("diagnosticCriteriaReviewed");
      flags.add("differentialDiagnosisConsidered");
      flags.add("diagnosticClarification");
    }
    if (data.mh_dxRevised) flags.add("diagnosisUpdated");
    if (data.contextShort) flags.add("significantLifeEventReviewed");
    if (data.responseBenefit) flags.add("treatmentResponseReviewed");
    if (data.mh_reassessment || data.sud_relapse) flags.add("relapseOrDecompensationReviewed");
    if (data.mh_reassessment || page2Activity > 0) flags.add("reassessmentAfterClinicalChange");
    if (data.newConcerns === "yes" && data.onsetHistory === "yes") flags.add("initialIntake");

    const mhActivity = [
      data.mh_currentSymptoms,
      data.mh_severity,
      data.mh_history,
      data.mh_strengths,
      data.mh_social,
      data.mh_work,
      data.mh_adl,
      data.mh_cognitive,
      data.mh_risk,
      data.mh_dxClarified,
      data.mh_dxRevised,
      data.mh_reassessment,
    ].filter(Boolean).length;

    if (mhActivity === 0 && page2Activity === 0 && interventions.length) {
      flags.add("routine_psychotherapy_only");
      flags.add("routinePsychotherapyOnly");
      flags.add("supportiveOnlyNoAssessment");
    }
    if (tools.length && mhActivity === 0 && page2Activity === 0 && !interventions.length) flags.add("brief_screen_only");
    if (mhActivity === 0 && page2Activity === 0) flags.add("noAssessmentElements");
  }

  if (data.servicePath !== "mh") {
    // PAGE 2: Substance use questions
    if (data.substanceUse === "yes") {
      flags.add("substance_type_reviewed");
      if (data.cravingsAssessment === "yes") flags.add("cravings_reviewed");
      if (data.triggersIdentification === "yes") flags.add("relapse_triggers_reviewed");
      if (data.treatmentHistory === "yes") flags.add("level_of_care_reviewed");
    }

    // PAGE 5: Legacy SUD checkbox fields (kept for backward compatibility)
    const substanceCount = [
      data.sud_alcohol,
      data.sud_opioids,
      data.sud_stimulants,
      data.sud_cannabis,
      data.sud_sedatives,
      data.sud_otherSubstance,
    ].filter(Boolean).length;

    if (substanceCount) flags.add("substance_type_reviewed");
    if (data.sud_frequency) flags.add("frequency_reviewed");
    if (data.sud_quantity) flags.add("quantity_reviewed");
    if (data.sud_duration) flags.add("duration_reviewed");
    if (data.sud_route) flags.add("route_reviewed");
    if (data.sud_lastUse) flags.add("last_use_reviewed");
    if (data.sud_cravings) flags.add("cravings_reviewed");
    if (data.sud_tolerance) flags.add("tolerance_reviewed");
    if (data.sud_withdrawal) flags.add("withdrawal_reviewed");
    if (data.sud_relapse) flags.add("relapse_triggers_reviewed");
    if (data.sud_readiness) flags.add("readiness_to_change_reviewed");
    if (data.sud_functionImpact) flags.add("functional_impact_reviewed");
    if (data.sud_diagnosis) flags.add("sud_diagnosis_documented");
    if (data.sud_asam) flags.add("asam_review_completed");
    if (data.sud_loc) flags.add("level_of_care_reviewed");

    if (substanceCount) flags.add("substanceTypeReviewed");
    if (data.sud_frequency) flags.add("frequencyOfUseReviewed");
    if (data.sud_quantity) flags.add("quantityOfUseReviewed");
    if (data.sud_duration) flags.add("durationOfUseReviewed");
    if (data.sud_cravings || data.cravingsAssessment === "yes") flags.add("cravingsReviewed");
    if (data.sud_withdrawal) flags.add("withdrawalSymptomsReviewed");
    if (data.sud_tolerance) flags.add("toleranceReviewed");
    if (data.sud_relapse) flags.add("relapseHistoryReviewed");
    if (data.sud_relapse || data.triggersIdentification === "yes") flags.add("triggersForUseReviewed");
    if (data.sud_readiness || data.treatmentHistory === "yes") flags.add("recoverySupportsReviewed");
    if (data.pos.includes("Correctional")) flags.add("legalProblemsRelatedToUseReviewed");
    if (data.sud_functionImpact) {
      flags.add("employmentProblemsRelatedToUseReviewed");
      flags.add("relationshipProblemsRelatedToUseReviewed");
    }
    if (data.sud_asam) flags.add("ASAMDimensionsReviewed");
    if (data.sud_diagnosis) {
      flags.add("substanceUseDiagnosisReviewed");
      flags.add("DSMCriteriaForSUDReviewed");
    }
    if (data.sud_loc || data.treatmentHistory === "yes") flags.add("levelOfCareReviewed");

    if (substanceCount && (data.sud_history || data.sud_diagnosis || data.substanceUse === "yes")) {
      flags.add("substanceUseIntake");
    }
    if (data.sud_relapse || data.triggersIdentification === "yes") flags.add("relapseAssessment");
    if (data.sud_asam) flags.add("ASAMAssessment");
    if (data.pos.includes("Correctional")) flags.add("courtOrderedSubstanceAssessment");
    if (data.sud_loc) flags.add("levelOfCareDetermination");

    const sudActivity =
      [
        data.sud_frequency,
        data.sud_quantity,
        data.sud_duration,
        data.sud_route,
        data.sud_lastUse,
        data.sud_cravings,
        data.sud_tolerance,
        data.sud_withdrawal,
        data.sud_relapse,
        data.sud_readiness,
        data.sud_functionImpact,
        data.sud_diagnosis,
        data.sud_asam,
        data.sud_loc,
        data.sud_history,
      ].filter(Boolean).length + substanceCount;

    if (substanceCount && sudActivity < 3) {
      flags.add("substance_use_only_briefly_mentioned");
      flags.add("substanceUseReportedOnly");
      flags.add("briefSubstanceQuestionOnly");
    }
    if (tools.length && sudActivity === 0) flags.add("screening_only");
    if (sudActivity === 0 && data.substanceUse !== "yes") flags.add("noSubstanceAssessment");
  }

  if (data.plan_initial) flags.add("initial_treatment_plan_created");
  if (data.plan_review) flags.add("formal_treatment_plan_review_completed");
  if (data.plan_goals) flags.add("treatment_goals_revised");
  if (data.plan_objectives) flags.add("objectives_documented");
  if (data.plan_interventions || data.interventions.includes("treatment plan review")) {
    flags.add("interventions_documented");
  }
  if (data.plan_progress) flags.add("progress_toward_goals_reviewed");
  if (data.plan_barriers) flags.add("barriers_reviewed");
  if (data.plan_clientCollab) flags.add("client_collaboration_documented");
  if (data.planFreqChange) flags.add("frequency_changed");
  if (data.planReason !== "none") flags.add("reason_for_plan_review_documented");

  if (data.plan_initial) flags.add("treatmentGoalsCreated");
  if (data.plan_review) flags.add("treatmentGoalsReviewed");
  if (data.plan_goals) flags.add("treatmentGoalsUpdated");
  if (data.plan_barriers) flags.add("barriersToGoalsDiscussed");
  if (data.plan_progress) flags.add("progressTowardGoalsReviewed");
  if (data.plan_interventions || data.interventions.includes("treatment plan review")) {
    flags.add("interventionsModified");
  }
  if (data.planFreqChange) flags.add("frequencyOfServicesChanged");
  if (data.planReason !== "none") flags.add("carePlanUpdated");
  if (data.planReason === "new-focus") flags.add("newProblemAddedToTreatmentPlan");
  if (data.planReason === "external") flags.add("coordinationWithOtherProvidersDiscussed");
  if (data.followUp.toLowerCase().includes("referral")) flags.add("dischargePlanningDiscussed");

  if (data.planReason !== "none" || data.plan_review) flags.add("treatmentPlanUpdated");
  if (data.plan_goals) flags.add("goalsModified");
  if (data.plan_interventions || data.interventions.includes("treatment plan review")) {
    flags.add("newInterventionAdded");
  }
  if (data.planReason === "scheduled-review") flags.add("quarterlyTreatmentPlanReview");
  if (data.followUp.toLowerCase().includes("referral")) flags.add("dischargePlanningCompleted");

  const planElements =
    [
      data.plan_initial,
      data.plan_review,
      data.plan_goals,
      data.plan_objectives,
      data.plan_interventions,
      data.plan_progress,
      data.plan_barriers,
      data.plan_clientCollab,
    ].filter(Boolean).length +
    (data.planReason !== "none" ? 1 : 0) +
    (data.planFreqChange ? 1 : 0);

  if (planElements === 0) {
    flags.add("no_actual_plan_work");
    flags.add("noPlanningActivities");
    if (interventions.includes("supportive therapy")) flags.add("supportiveSessionOnly");
  }
  if (
    planElements > 0 &&
    !data.plan_goals &&
    !data.plan_objectives &&
    !data.plan_interventions &&
    !data.plan_review &&
    !data.plan_initial
  ) {
    flags.add("goals_only_briefly_referenced");
    flags.add("progressOnlyMentioned");
  }

  const anyMhAssessment = [
    data.mh_currentSymptoms,
    data.mh_severity,
    data.mh_history,
    data.mh_social,
    data.mh_work,
    data.mh_adl,
    data.mh_cognitive,
    data.mh_risk,
    data.mh_dxClarified,
    data.mh_dxRevised,
    data.mh_reassessment,
  ].some(Boolean);

  const anySudAssessment = [
    data.sud_frequency,
    data.sud_quantity,
    data.sud_duration,
    data.sud_route,
    data.sud_lastUse,
    data.sud_cravings,
    data.sud_tolerance,
    data.sud_withdrawal,
    data.sud_relapse,
    data.sud_readiness,
    data.sud_functionImpact,
    data.sud_diagnosis,
    data.sud_asam,
    data.sud_loc,
  ].some(Boolean);

  if (planElements > 0 && !anyMhAssessment && !anySudAssessment) {
    flags.add("plan_only_without_assessment");
  }
  if (planElements === 0 && interventions.length) {
    flags.add("routine_progress_note_only");
  }

  if (
    !tools.length &&
    [data.newConcerns === "yes", data.currentExperience === "yes", data.symptomProgression === "yes", data.mh_currentSymptoms, data.mh_severity].some(Boolean)
  ) {
    flags.add("symptomsDiscussedOnly");
  }

  return flags;
}

export function evaluateRule(code: RuleCode, flags: Set<string>): RuleResult {
  const rule = RULE_BY_CODE[code];
  const matchedRequired = rule.requiredConditions.filter((c) => flags.has(c));
  const requiredMissing = rule.requiredConditions.filter((c) => !flags.has(c));
  const matchedOptional = rule.optionalConditions.filter((c) => flags.has(c));
  const matchedAutoTriggers = rule.autoTriggers.filter((c) => flags.has(c));
  const matchedExclusions = rule.exclusionConditions.filter((c) => flags.has(c));

  const matchedCount = matchedRequired.length + matchedOptional.length;
  const autoTriggered = matchedAutoTriggers.length > 0;
  const blocked = matchedExclusions.length > 0;
  const requiredComplete = requiredMissing.length === 0;

  let status: RuleResult["status"] = "none";
  let confidence: RuleResult["confidence"] = "low";

  if (blocked) {
    status = "blocked";
  } else if (autoTriggered) {
    status = "suggest";
    confidence = "high";
  } else if (requiredComplete && matchedCount >= rule.triggerThreshold) {
    status = "suggest";
    confidence = "high";
  } else if (matchedCount > 0) {
    status = "borderline";
    confidence = "medium";
  }

  const support = [...matchedRequired, ...matchedOptional, ...matchedAutoTriggers];
  const explanation = blocked
    ? `Excluded by rule safeguards for ${rule.code}.`
    : autoTriggered
      ? `${rule.code} auto-triggered by: ${matchedAutoTriggers.join(", ")}.`
      : `${rule.code} matched ${matchedCount} condition(s); threshold is ${rule.triggerThreshold}.`;

  return {
    code,
    category: rule.category,
    triggerThreshold: rule.triggerThreshold,
    matchedCount,
    score: matchedCount,
    blocked,
    status,
    confidence,
    support,
    requiredMissing,
    matchedAutoTriggers,
    matchedExclusions,
    autoTriggered,
    recommendedDocumentation: rule.recommendedDocumentation,
    suggestedQuestionPrompts: rule.suggestedQuestionPrompts,
    exclusionRules: rule.exclusionRules,
    explanation,
    followUp: rule.suggestedQuestionPrompts[0] || "",
  };
}

export function humanizeSupport(arr: string[]): string[] {
  const map: Record<string, string> = {
    validated_screening_tool_used: "Validated screening tool used",
    screening_score_documented: "Screening score documented",
    screening_interpreted: "Screening interpreted",
    screening_discussed_with_client: "Screening outcome discussed",
    screening_used_for_referral: "Screening informed referral",
    screening_used_for_triage: "Screening informed triage / further assessment",
    current_symptoms_reviewed: "Current symptoms reviewed",
    symptom_severity_reviewed: "Symptom severity reviewed",
    history_of_presenting_problem_reviewed: "History of presenting problem reviewed",
    functioning_reviewed_single_domain: "Functioning reviewed in one domain",
    functioning_reviewed_multiple_domains: "Functioning reviewed in multiple domains",
    risk_assessed: "Risk assessed",
    diagnostic_clarification_done: "Diagnostic clarification documented",
    diagnosis_revised: "Diagnosis revised",
    mh_reassessment: "Mental health reassessment completed",
    strengths_reviewed: "Strengths / limitations documented",
    substance_type_reviewed: "Substance type reviewed",
    frequency_reviewed: "Frequency reviewed",
    quantity_reviewed: "Quantity reviewed",
    duration_reviewed: "Duration reviewed",
    route_reviewed: "Route reviewed",
    last_use_reviewed: "Last use reviewed",
    cravings_reviewed: "Cravings reviewed",
    tolerance_reviewed: "Tolerance reviewed",
    withdrawal_reviewed: "Withdrawal reviewed",
    relapse_triggers_reviewed: "Relapse triggers reviewed",
    readiness_to_change_reviewed: "Readiness to change reviewed",
    functional_impact_reviewed: "Functional impact reviewed",
    sud_diagnosis_documented: "SUD diagnosis / severity documented",
    asam_review_completed: "ASAM or structured SUD framework reviewed",
    level_of_care_reviewed: "Level of care / referral needs evaluated",
    initial_treatment_plan_created: "Initial treatment plan created",
    formal_treatment_plan_review_completed: "Formal treatment plan review completed",
    treatment_goals_revised: "Goals created or revised",
    objectives_documented: "Objectives documented",
    interventions_documented: "Interventions documented or revised",
    progress_toward_goals_reviewed: "Progress toward goals reviewed",
    barriers_reviewed: "Barriers reviewed",
    client_collaboration_documented: "Client collaboration documented",
    frequency_changed: "Frequency or modality changed",
    reason_for_plan_review_documented: "Reason for plan work documented",
    newSymptomsReviewed: "New symptoms reviewed",
    changeInSymptomsReviewed: "Symptom change reviewed",
    mentalHealthHistoryReviewed: "Mental health history reviewed",
    functioningDiscussed: "Functioning discussed",
    socialFunctioningDiscussed: "Social functioning discussed",
    occupationalFunctioningDiscussed: "Occupational functioning discussed",
    housingOrEnvironmentalStabilityReviewed: "Housing/environmental stability reviewed",
    riskAssessmentCompleted: "Risk assessment completed",
    suicideRiskReviewed: "Suicide risk reviewed",
    violenceRiskReviewed: "Violence risk reviewed",
    safetyPlanDiscussed: "Safety planning discussed",
    diagnosticClarificationPerformed: "Diagnostic clarification performed",
    diagnosticCriteriaReviewed: "Diagnostic criteria reviewed",
    differentialDiagnosisConsidered: "Differential diagnosis considered",
    diagnosisUpdated: "Diagnosis updated",
    significantLifeEventReviewed: "Significant life event reviewed",
    treatmentResponseReviewed: "Treatment response reviewed",
    relapseOrDecompensationReviewed: "Relapse/decompensation reviewed",
    treatmentGoalsCreated: "Treatment goals created",
    treatmentGoalsReviewed: "Treatment goals reviewed",
    treatmentGoalsUpdated: "Treatment goals updated",
    barriersToGoalsDiscussed: "Barriers to goals discussed",
    progressTowardGoalsReviewed: "Progress toward goals reviewed",
    interventionsModified: "Interventions modified",
    frequencyOfServicesChanged: "Frequency of services changed",
    carePlanUpdated: "Care plan updated",
    newProblemAddedToTreatmentPlan: "New problem added to treatment plan",
    dischargePlanningDiscussed: "Discharge planning discussed",
    coordinationWithOtherProvidersDiscussed: "Coordination with other providers discussed",
    substanceTypeReviewed: "Substance type reviewed",
    frequencyOfUseReviewed: "Frequency of use reviewed",
    quantityOfUseReviewed: "Quantity of use reviewed",
    durationOfUseReviewed: "Duration of use reviewed",
    cravingsReviewed: "Cravings reviewed",
    withdrawalSymptomsReviewed: "Withdrawal symptoms reviewed",
    toleranceReviewed: "Tolerance reviewed",
    relapseHistoryReviewed: "Relapse history reviewed",
    triggersForUseReviewed: "Use triggers reviewed",
    recoverySupportsReviewed: "Recovery supports reviewed",
    legalProblemsRelatedToUseReviewed: "Legal problems related to use reviewed",
    employmentProblemsRelatedToUseReviewed: "Employment problems related to use reviewed",
    relationshipProblemsRelatedToUseReviewed: "Relationship problems related to use reviewed",
    ASAMDimensionsReviewed: "ASAM dimensions reviewed",
    substanceUseDiagnosisReviewed: "Substance use diagnosis reviewed",
    DSMCriteriaForSUDReviewed: "DSM criteria for SUD reviewed",
    levelOfCareReviewed: "Level of care reviewed",
    PHQ9Completed: "PHQ-9 completed",
    GAD7Completed: "GAD-7 completed",
    PCL5Completed: "PCL-5 completed",
    AUDITCompleted: "AUDIT completed",
    AUDITCCompleted: "AUDIT-C completed",
    DASTCompleted: "DAST completed",
    CAGECompleted: "CAGE completed",
    CSSRSCompleted: "C-SSRS completed",
    MoodDisorderQuestionnaireCompleted: "Mood Disorder Questionnaire completed",
    screeningResultsReviewed: "Screening results reviewed",
    screeningResultsDiscussed: "Screening results discussed",
    screeningUsedForReferralDecision: "Screening used for referral decision",
    screeningUsedForEligibilityDecision: "Screening used for eligibility decision",
    validatedScreeningToolCompleted: "Validated screening tool completed",
    treatmentPlanUpdated: "Treatment plan updated",
    goalsModified: "Goals modified",
    newInterventionAdded: "New intervention added",
    quarterlyTreatmentPlanReview: "Quarterly treatment plan review",
    dischargePlanningCompleted: "Discharge planning completed",
  };

  return arr.map((x) => map[x] || x.replace(/([a-z])([A-Z])/g, "$1 $2"));
}

export function buildStrength(ruleResults: RuleResult[], data: CodingForm, psych: PsychotherapyResult) {
  let score = 0;
  const chips: string[] = [];
  const allSupport = [...new Set(ruleResults.flatMap((r) => r.support))];

  score += Math.min(allSupport.length * 7, 56);
  if (psych.code) score += 12;
  if (data.dos && data.clinician && data.diagnosisCode) score += 12;
  if (calcMinutes(data) > 0) score += 10;
  if (data.interventions.length > 0) score += 10;
  if (score > 100) score = 100;

  if (allSupport.includes("current_symptoms_reviewed") || allSupport.includes("substance_type_reviewed")) {
    chips.push("Symptoms / Use Patterns");
  }
  if (
    allSupport.includes("functioning_reviewed_single_domain") ||
    allSupport.includes("functioning_reviewed_multiple_domains") ||
    allSupport.includes("functional_impact_reviewed")
  ) {
    chips.push("Functioning / Impact");
  }
  if (allSupport.includes("risk_assessed")) chips.push("Risk");
  if (
    allSupport.includes("diagnostic_clarification_done") ||
    allSupport.includes("sud_diagnosis_documented")
  ) {
    chips.push("Diagnosis");
  }
  if (
    allSupport.includes("treatment_goals_revised") ||
    allSupport.includes("formal_treatment_plan_review_completed")
  ) {
    chips.push("Plan Work");
  }
  if (data.interventions.length) chips.push("Interventions");

  return { score, chips };
}

export function buildSupportSummary(ruleResults: RuleResult[], psych: PsychotherapyResult): string {
  const lines: string[] = [];
  lines.push("Final Coding Guidance");
  lines.push("");

  const codeNames: Record<RuleCode, string> = {
    H0002: "H0002 – Behavioral Health Screening",
    H0031: "H0031 – Behavioral Health Assessment",
    H0001: "H0001 – Alcohol / Drug Assessment",
    H0032: "H0032 – Treatment Plan Review",
  };

  ruleResults
    .filter((r) => r.status === "suggest" || r.status === "borderline")
    .forEach((r) => {
      lines.push(codeNames[r.code]);
      lines.push(
        `Confidence: ${r.status === "suggest" ? "High" : "Borderline"} | Matched: ${r.matchedCount}/${r.triggerThreshold}${r.autoTriggered ? " | Auto-triggered" : ""}`
      );
      lines.push(`Reason: ${r.explanation}`);
      if (r.support.length) {
        lines.push("Support Indicators:");
        humanizeSupport(r.support).forEach((s) => lines.push(`- ${s}`));
      }
      if (r.suggestedQuestionPrompts.length) {
        lines.push("Suggested Question Prompts:");
        r.suggestedQuestionPrompts.slice(0, 3).forEach((p) => lines.push(`- ${p}`));
      }
      if (r.recommendedDocumentation.length) {
        lines.push("Recommended Documentation:");
        r.recommendedDocumentation.forEach((doc) => lines.push(`- ${doc}`));
      }
      lines.push("");
    });

  ruleResults
    .filter((r) => r.status === "blocked")
    .forEach((r) => {
      lines.push(`${codeNames[r.code]} (Excluded)`);
      lines.push(`Matched: ${r.matchedCount}/${r.triggerThreshold}`);
      if (r.exclusionRules.length) {
        lines.push("Exclusion Rules Triggered:");
        r.exclusionRules.forEach((x) => lines.push(`- ${x}`));
      }
      lines.push("");
    });

  if (psych.code) {
    lines.push(`${psych.label}`);
    lines.push(`Reason: Time supports psychotherapy duration code. ${psych.detail}`);
  }

  return lines.join("\n").trim();
}

export function joinPretty(arr: string[]): string {
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
}

export function buildNarrative(ruleResults: RuleResult[], psych: PsychotherapyResult, data: CodingForm): string {
  const lines: string[] = [];
  const codesSuggested = ruleResults
    .filter((r) => r.status === "suggest")
    .map((r) => r.code);

  const functioning: string[] = [];
  if (data.mh_social) functioning.push("Social/Relationships");
  if (data.mh_work) functioning.push("Work/School");
  if (data.mh_adl) functioning.push("Daily Living/Self-care");
  if (data.mh_cognitive) functioning.push("Cognitive/Behavioral Functioning");

  lines.push(`Date of service: ${data.dos || "Not entered"}.`);
  lines.push(`The client participated in a ${data.servicePath.toUpperCase()} session.`);
  lines.push(`Primary diagnosis documented: ${data.diagnosisCode || "Not entered"}.`);

  if (data.sdoh && data.sdoh !== "None / Not documented") {
    lines.push(`Relevant psychosocial stressor: ${data.sdoh}.`);
  }
  if (data.contextShort) {
    lines.push(`Additional context: ${data.contextShort}.`);
  }
  if (psych.code) {
    lines.push(`Total documented psychotherapy time was ${calcMinutes(data)} minutes, supporting ${psych.label}.`);
  }

  if (data.interventions.length) {
    lines.push(
      `Interventions included ${joinPretty(data.interventions)}, tailored to the client’s needs and current presentation.`
    );
  }

  if (functioning.length) {
    lines.push(`Functionally, performance in ${joinPretty(functioning)} is currently ${data.functionalStatus}.`);
  } else {
    lines.push(`Overall functioning is currently ${data.functionalStatus}.`);
  }

  lines.push(`The client was ${data.engagement} and ${data.responseBenefit}.`);

  const codeSentences: string[] = [];
  if (ruleResults.some((r) => r.code === "H0002" && r.status === "suggest")) {
    codeSentences.push("structured screening was administered and used in clinical decision-making");
  }
  if (ruleResults.some((r) => r.code === "H0031" && r.status === "suggest")) {
    codeSentences.push("behavioral health assessment work was completed beyond routine therapy");
  }
  if (ruleResults.some((r) => r.code === "H0001" && r.status === "suggest")) {
    codeSentences.push("substance use assessment work was completed with diagnostic and functional review");
  }
  if (ruleResults.some((r) => r.code === "H0032" && r.status === "suggest")) {
    codeSentences.push("active treatment plan development or review occurred");
  }
  if (codeSentences.length) {
    lines.push(`Documentation supports that ${joinPretty(codeSentences)}.`);
  }

  if (data.followUp) {
    lines.push(`${data.followUp.charAt(0).toUpperCase() + data.followUp.slice(1)}.`);
  }

  lines.push(
    `Suggested Codes Supported by Structured Inputs: ${
      codesSuggested.length ? codesSuggested.join(", ") : "No additional code suggestions fired"
    }.`
  );

  return lines.join("\n");
}

export function runCoder(data: CodingForm): CodingOutput {
  const missing = validateCore(data);
  const psych = getPsychotherapyResult(data);

  if (missing.length) {
    return {
      missing,
      psych,
      ruleResults: [],
      strength: { score: 0, chips: [] },
      supportSummary: "",
      narrative: "",
    };
  }

  const flags = getSupportFlags(data);
  const ruleResults = TRIGGER_RULES.map((rule) => evaluateRule(rule.code, flags));

  if (data.servicePath === "mh") {
    ruleResults.forEach((r) => {
      if (r.code === "H0001") r.status = "none";
    });
  }
  if (data.servicePath === "sud") {
    ruleResults.forEach((r) => {
      if (r.code === "H0031") r.status = "none";
    });
  }

  const h0032 = ruleResults.find((r) => r.code === "H0032");
  if (h0032 && (h0032.status === "suggest" || h0032.status === "borderline")) {
    const hasPlanCore =
      !!data.diagnosisCode &&
      (data.plan_goals || data.plan_objectives) &&
      (data.plan_interventions || data.interventions.includes("treatment plan review")) &&
      data.planReason !== "none";

    if (!hasPlanCore) {
      h0032.status = "borderline";
      h0032.support = h0032.support.filter((x) => x !== "initial_treatment_plan_created");
    }
  }

  const strength = buildStrength(ruleResults, data, psych);
  const supportSummary = buildSupportSummary(ruleResults, psych);
  const narrative = buildNarrative(ruleResults, psych, data);

  return {
    missing,
    psych,
    ruleResults,
    strength,
    supportSummary,
    narrative,
  };
}