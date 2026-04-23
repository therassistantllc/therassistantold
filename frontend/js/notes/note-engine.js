/**
 * THERASSISTANT Note Engine
 * Phase 4-8: Conditional fields, complexity, carry-forward,
 * treatment plan suggestions, background coding engine
 */

// ─────────────────────────────────────────────
// PHASE 4: CONDITIONAL FIELD RULES (Command 9)
// ─────────────────────────────────────────────

/**
 * CONDITIONAL_FIELD_RULES defines which sections are visible
 * based on current note state.
 *
 * Each rule:
 *   field:     the form field/selection that triggers the condition
 *   value:     the value that activates the condition
 *   show:      sections to reveal when condition is active
 *   hide:      sections to hide when condition is active
 */
const CONDITIONAL_FIELD_RULES = [
  // Safety concerns
  {
    field: "riskLevel",
    value: "no_safety_concerns",
    hide: ["detailed_suicide_risk", "si_plan_questions", "si_intent_questions", "hi_detail_questions"],
    show: ["protective_factors_brief"]
  },
  {
    field: "riskLevel",
    value: "passive_si",
    show: ["passive_si_detail", "protective_factors", "safety_plan_review"],
    hide: ["si_plan_questions", "si_intent_questions"]
  },
  {
    field: "riskLevel",
    value: "active_si_plan",
    show: ["detailed_suicide_risk", "si_plan_questions", "si_intent_questions", "safety_plan_review", "crisis_action_taken", "means_restriction"],
    hide: []
  },
  {
    field: "riskLevel",
    value: "active_si_intent",
    show: ["detailed_suicide_risk", "si_plan_questions", "si_intent_questions", "crisis_action_taken", "means_restriction", "hospitalization_considered"],
    hide: []
  },

  // Substance use
  {
    field: "substanceUsePresent",
    value: "no",
    hide: ["substance_detail", "cravings_section", "relapse_section", "detox_section", "mat_section", "withdrawal_section"],
    show: []
  },
  {
    field: "substanceUsePresent",
    value: "yes",
    show: ["substance_detail", "cravings_section", "relapse_section"],
    hide: []
  },

  // Visit type
  {
    field: "visitType",
    value: "routine_followup",
    hide: ["full_intake_sections", "diagnostic_impression_full", "asam_dimensions"],
    show: ["routine_progress", "brief_risk", "brief_mse"]
  },
  {
    field: "visitType",
    value: "new_concern",
    show: ["new_concern_assessment", "detailed_history", "functional_assessment"],
    hide: []
  },
  {
    field: "visitType",
    value: "crisis_intervention",
    show: ["crisis_section", "detailed_suicide_risk", "crisis_action_taken", "safety_plan_review", "post_crisis_plan", "hospitalization_considered"],
    hide: ["routine_progress"]
  },
  {
    field: "visitType",
    value: "intake_assessment",
    show: ["full_intake_sections", "diagnostic_impression_full", "full_history", "psychosocial", "full_risk", "asam_dimensions"],
    hide: ["routine_progress", "brief_mse", "brief_risk"]
  },

  // Complexity
  {
    field: "complexity",
    value: "routine_followup",
    hide: ["extended_assessment", "collateral_contacts", "medical_coordination", "diagnostic_update_section"],
    show: []
  },
  {
    field: "complexity",
    value: "high_complexity",
    show: ["extended_assessment", "collateral_contacts", "medical_coordination", "diagnostic_update_section"],
    hide: []
  },
  {
    field: "complexity",
    value: "crisis_visit",
    show: ["crisis_section", "detailed_suicide_risk", "safety_plan_review", "crisis_action_taken", "hospitalization_considered"],
    hide: ["routine_progress"]
  }
];

/**
 * Evaluate which sections should be visible given the current note state.
 * @param {object} noteState - current field values from the note form
 * @returns {object} { visibleSections: Set, hiddenSections: Set }
 */
function evaluateConditionalFields(noteState) {
  const visibleSections = new Set();
  const hiddenSections = new Set();

  for (const rule of CONDITIONAL_FIELD_RULES) {
    const fieldValue = noteState[rule.field];
    if (fieldValue === rule.value) {
      (rule.show || []).forEach(s => visibleSections.add(s));
      (rule.hide || []).forEach(s => hiddenSections.add(s));
    }
  }

  // Sections explicitly shown take priority over hidden
  for (const s of visibleSections) hiddenSections.delete(s);

  return { visibleSections, hiddenSections };
}

// ─────────────────────────────────────────────
// PHASE 5: NOTE COMPLEXITY SELECTOR (Command 10)
// ─────────────────────────────────────────────

const COMPLEXITY_LEVELS = {
  routine_followup: {
    label: "Routine Follow-up",
    description: "Brief progress update for stable returning client",
    icon: "🟢",
    sectionDepth: "minimal",
    followUpQuestions: 3,
    estimatedMinutes: "30-45",
    requiredSections: ["subjective", "brief_mse", "brief_risk", "plan"],
    optionalSections: ["interventions", "progress"],
    hiddenSections: ["full_intake_sections", "extended_assessment", "asam_dimensions"]
  },
  moderate_complexity: {
    label: "Moderate Complexity",
    description: "Returning client with new concerns or updating treatment plan",
    icon: "🟡",
    sectionDepth: "standard",
    followUpQuestions: 6,
    estimatedMinutes: "45-60",
    requiredSections: ["subjective", "mse", "risk", "interventions", "progress", "plan"],
    optionalSections: ["treatment_plan_section", "care_coordination"],
    hiddenSections: ["full_intake_sections", "asam_dimensions"]
  },
  high_complexity: {
    label: "High Complexity",
    description: "Complex clinical situation, diagnostic work, or multiple concerns",
    icon: "🟠",
    sectionDepth: "extended",
    followUpQuestions: 12,
    estimatedMinutes: "60+",
    requiredSections: ["subjective", "full_history", "mse", "risk", "interventions", "functional_assessment", "treatment_plan_section", "plan"],
    optionalSections: ["diagnostic_update_section", "care_coordination", "collateral_contacts", "medical_coordination"],
    hiddenSections: []
  },
  crisis_visit: {
    label: "Crisis Visit",
    description: "Active crisis intervention, safety concerns, or emergency response",
    icon: "🔴",
    sectionDepth: "crisis",
    followUpQuestions: 10,
    estimatedMinutes: "60-90+",
    requiredSections: ["subjective", "crisis_section", "detailed_suicide_risk", "safety_plan_review", "crisis_action_taken", "post_crisis_plan"],
    optionalSections: ["hospitalization_considered", "collateral_contacts", "means_restriction"],
    hiddenSections: ["routine_progress"]
  },
  intake_assessment: {
    label: "Intake / Assessment",
    description: "Initial evaluation, comprehensive assessment, or formal reassessment",
    icon: "📋",
    sectionDepth: "comprehensive",
    followUpQuestions: 20,
    estimatedMinutes: "90-120",
    requiredSections: [
      "presenting_concerns", "full_history", "psychosocial", "mse",
      "risk", "diagnostic_impression_full", "treatment_plan_section", "plan"
    ],
    optionalSections: ["asam_dimensions", "functional_assessment", "care_coordination"],
    hiddenSections: ["routine_progress", "brief_risk", "brief_mse"]
  }
};

/**
 * Get sections configuration for a complexity level.
 */
function getSectionsForComplexity(complexity) {
  return COMPLEXITY_LEVELS[complexity] || COMPLEXITY_LEVELS.routine_followup;
}

// ─────────────────────────────────────────────
// PHASE 5: QUICK-SELECT OPTIONS (Commands 11-13)
// ─────────────────────────────────────────────

const QUICK_SELECT = {
  // Command 11: Risk Assessment
  riskOptions: [
    { key: "no_si_hi",         label: "No SI/HI reported",               category: "no_concerns",    level: "low" },
    { key: "passive_si",       label: "Passive SI without plan",          category: "si",             level: "moderate" },
    { key: "active_si_plan",   label: "Active SI with plan",              category: "si",             level: "high" },
    { key: "active_si_intent", label: "Active SI with intent",            category: "si",             level: "high" },
    { key: "no_sh",            label: "No self-harm concerns",            category: "self_harm",      level: "low" },
    { key: "sh_urges",         label: "Self-harm urges present",          category: "self_harm",      level: "moderate" },
    { key: "sh_current",       label: "Current self-harm behavior",       category: "self_harm",      level: "high" },
    { key: "no_hi",            label: "No HI reported",                   category: "hi",             level: "low" },
    { key: "active_hi",        label: "Active HI present",                category: "hi",             level: "high" },
    { key: "protective_present","label": "Protective factors present",    category: "protective",     level: null },
    { key: "safety_reviewed",  label: "Safety plan reviewed",             category: "safety_plan",    level: null },
    { key: "safety_updated",   label: "Safety plan updated",              category: "safety_plan",    level: null },
    { key: "safety_new",       label: "New safety plan created",          category: "safety_plan",    level: null }
  ],

  // Command 12: MSE
  mseOptions: {
    appearance: [
      { key: "app_wnl",          label: "Well-groomed, appropriate dress", isNormal: true },
      { key: "app_casual",       label: "Casually dressed, adequate hygiene", isNormal: true },
      { key: "app_disheveled",   label: "Disheveled appearance", isNormal: false },
      { key: "app_poor_hygiene", label: "Poor hygiene noted", isNormal: false }
    ],
    mood: [
      { key: "mood_euthymic",  label: "Euthymic",           isNormal: true },
      { key: "mood_depressed", label: "Depressed",           isNormal: false },
      { key: "mood_anxious",   label: "Anxious",             isNormal: false },
      { key: "mood_irritable", label: "Irritable",           isNormal: false },
      { key: "mood_elevated",  label: "Elevated/expansive",  isNormal: false },
      { key: "mood_dysphoric", label: "Dysphoric",           isNormal: false }
    ],
    affect: [
      { key: "aff_full",        label: "Full range",       isNormal: true },
      { key: "aff_constricted", label: "Constricted",      isNormal: false },
      { key: "aff_flat",        label: "Flat",             isNormal: false },
      { key: "aff_blunted",     label: "Blunted",          isNormal: false },
      { key: "aff_labile",      label: "Labile",           isNormal: false },
      { key: "aff_congruent",   label: "Mood congruent",   isNormal: true }
    ],
    orientation: [
      { key: "ori_x4",      label: "Oriented x4",           isNormal: true },
      { key: "ori_x3",      label: "Oriented x3",           isNormal: false },
      { key: "ori_impaired",label: "Orientation impaired",  isNormal: false }
    ],
    thoughtProcess: [
      { key: "tp_logical",        label: "Logical and linear",  isNormal: true },
      { key: "tp_tangential",     label: "Tangential",          isNormal: false },
      { key: "tp_circumstantial", label: "Circumstantial",      isNormal: false },
      { key: "tp_loose",          label: "Loose associations",  isNormal: false },
      { key: "tp_racing",         label: "Racing thoughts",     isNormal: false }
    ],
    insight: [
      { key: "ins_good",    label: "Good insight",    isNormal: true },
      { key: "ins_fair",    label: "Fair insight",    isNormal: false },
      { key: "ins_limited", label: "Limited insight", isNormal: false },
      { key: "ins_poor",    label: "Poor insight",    isNormal: false }
    ],
    judgment: [
      { key: "jud_intact",   label: "Judgment intact",    isNormal: true },
      { key: "jud_fair",     label: "Fair judgment",      isNormal: false },
      { key: "jud_impaired", label: "Impaired judgment",  isNormal: false }
    ],
    speech: [
      { key: "sp_wnl",       label: "Normal rate, rhythm, volume", isNormal: true },
      { key: "sp_pressured", label: "Pressured speech",            isNormal: false },
      { key: "sp_slowed",    label: "Slowed/reduced speech",       isNormal: false },
      { key: "sp_loud",      label: "Loud/elevated volume",        isNormal: false },
      { key: "sp_quiet",     label: "Quiet/soft speech",           isNormal: false }
    ],
    memory: [
      { key: "mem_intact", label: "Memory intact",              isNormal: true },
      { key: "mem_short",  label: "Short-term memory impaired", isNormal: false },
      { key: "mem_long",   label: "Long-term memory impaired",  isNormal: false }
    ],
    attention: [
      { key: "att_intact",       label: "Attention and concentration intact",    isNormal: true },
      { key: "att_distractible", label: "Easily distracted",                     isNormal: false },
      { key: "att_impaired",     label: "Attention significantly impaired",      isNormal: false }
    ]
  },

  // Command 13: Interventions
  interventionOptions: [
    { key: "cbt",                  label: "CBT",                       billingHint: ["H2014"] },
    { key: "dbt",                  label: "DBT",                       billingHint: ["H2014"] },
    { key: "mi",                   label: "Motivational Interviewing",  billingHint: [] },
    { key: "psychoeducation",      label: "Psychoeducation",           billingHint: ["H2014"] },
    { key: "mindfulness",          label: "Mindfulness",               billingHint: ["H2014"] },
    { key: "coping_skills",        label: "Coping Skills",             billingHint: ["H2014"] },
    { key: "relapse_prevention",   label: "Relapse Prevention",        billingHint: ["H2014"] },
    { key: "boundary_setting",     label: "Boundary Setting",          billingHint: ["H2014"] },
    { key: "grounding",            label: "Grounding Techniques",      billingHint: ["H2014"] },
    { key: "treatment_planning",   label: "Treatment Planning",        billingHint: ["H0032"] },
    { key: "care_coordination",    label: "Care Coordination",         billingHint: ["T1017"] },
    { key: "crisis_intervention",  label: "Crisis Intervention",       billingHint: ["H2011", "90839"] },
    { key: "supportive_therapy",   label: "Supportive Therapy",        billingHint: [] },
    { key: "trauma_processing",    label: "Trauma Processing (EMDR/CPT)", billingHint: ["H2014"] },
    { key: "problem_solving",      label: "Problem Solving Therapy",   billingHint: ["H2014"] },
    { key: "behavioral_activation",label: "Behavioral Activation",     billingHint: ["H2014"] },
    { key: "safety_planning",      label: "Safety Planning",           billingHint: ["H2011"] },
    { key: "medication_education", label: "Medication Education",      billingHint: ["H2014"] }
  ]
};

// ─────────────────────────────────────────────
// PHASE 6: CARRY FORWARD (Commands 14-15)
// ─────────────────────────────────────────────

/**
 * Command 14: Generate smart defaults for a new note.
 * Uses last session state + clinician settings to prepopulate fields.
 *
 * @param {object} lastSessionState - from patient_last_session_state
 * @param {object} appointmentData  - from appointment record
 * @param {object} clinicianSettings - from clinician_note_settings
 * @param {boolean} isReturningPatient
 * @returns {object} noteDefaults
 */
function generateSmartDefaults(lastSessionState, appointmentData, clinicianSettings, isReturningPatient) {
  const settings = clinicianSettings || {};
  const mode = settings.smart_default_mode || "returning_patients_only";

  const useDefaults =
    mode === "always" ||
    (mode === "returning_patients_only" && isReturningPatient);

  if (!useDefaults || !lastSessionState) {
    return {
      useSmartDefaults: false,
      dos: appointmentData?.date || null,
      clinician: appointmentData?.clinician_name || null,
      posCode: appointmentData?.pos_code || settings.default_pos_code || null,
      modality: settings.default_modality || "individual",
      complexity: settings.default_complexity || "routine_followup",
      servicePath: settings.default_service_path || "mh"
    };
  }

  const carryFields = settings.carry_forward_fields || [
    "diagnoses", "treatment_goals", "mse", "risk_assessment", "interventions", "progress_summary"
  ];

  const defaults = {
    useSmartDefaults: true,
    dos: appointmentData?.date || null,
    clinician: appointmentData?.clinician_name || null,
    clinicianCredentials: appointmentData?.clinician_credentials || null,
    serviceLocation: appointmentData?.location || lastSessionState.last_service_location || null,
    insurancePayer: appointmentData?.insurance_payer || lastSessionState.last_insurance_payer || null,
    posCode: appointmentData?.pos_code || lastSessionState.last_pos_code || settings.default_pos_code || null,
    modality: lastSessionState.last_modality || settings.default_modality || "individual",
    complexity: settings.default_complexity || "routine_followup",
    servicePath: settings.default_service_path || "mh"
  };

  if (carryFields.includes("diagnoses")) {
    defaults.diagnosisList = lastSessionState.last_diagnosis_list || null;
    defaults.primaryDxCode = lastSessionState.last_primary_dx_code || null;
    defaults.primaryDxLabel = lastSessionState.last_primary_dx_label || null;
  }

  if (carryFields.includes("treatment_goals")) {
    defaults.treatmentGoals = lastSessionState.last_treatment_goals || null;
    defaults.activePlanId = lastSessionState.last_plan_id || null;
  }

  if (carryFields.includes("mse")) {
    defaults.mse = lastSessionState.last_mse || null;
  }

  if (carryFields.includes("risk_assessment")) {
    defaults.lastRiskLevel = lastSessionState.last_risk_level || null;
    defaults.lastRiskSI = lastSessionState.last_risk_si || null;
    defaults.lastRiskHI = lastSessionState.last_risk_hi || null;
    defaults.lastSafetyPlanUpdated = lastSessionState.last_safety_plan_updated || false;
  }

  if (carryFields.includes("interventions")) {
    defaults.interventions = lastSessionState.last_interventions || [];
  }

  if (carryFields.includes("progress_summary")) {
    defaults.lastProgressSummary = lastSessionState.last_progress_summary || null;
    defaults.lastPlanSection = lastSessionState.last_plan_section || null;
  }

  return defaults;
}

/**
 * Command 15: Build a compare view payload.
 * Returns structured diff between last note and current note for side-by-side view.
 *
 * @param {object} lastNote   - previous signed note object
 * @param {object} currentNote - current in-progress note object
 * @returns {object} compareData
 */
function buildCompareView(lastNote, currentNote) {
  const SECTIONS = [
    { key: "subjective",  label: "Subjective" },
    { key: "objective",   label: "Objective / Session Info" },
    { key: "assessment",  label: "Assessment" },
    { key: "plan",        label: "Plan" }
  ];

  const sections = SECTIONS.map(section => {
    const prev = (lastNote && lastNote[section.key]) || "";
    const curr = (currentNote && currentNote[section.key]) || "";
    const changed = prev.trim() !== curr.trim();

    return {
      key: section.key,
      label: section.label,
      previous: prev,
      current: curr,
      changed,
      changeType: !prev && curr ? "added"
        : prev && !curr ? "removed"
        : changed ? "modified"
        : "unchanged"
    };
  });

  // Simple word-diff highlight tokens for the UI to render
  const changedSections = sections.filter(s => s.changed);

  return {
    lastNoteDate: lastNote?.dos || null,
    currentNoteDate: currentNote?.dos || null,
    sections,
    changedSections: changedSections.length,
    summary: changedSections.length === 0
      ? "No changes from last session"
      : `${changedSections.length} section(s) changed from last session: ${changedSections.map(s => s.label).join(", ")}`
  };
}

// ─────────────────────────────────────────────
// PHASE 7: TREATMENT PLAN SUGGESTIONS (Commands 16-17)
// ─────────────────────────────────────────────

/**
 * Command 16: Analyze repeated themes across session history.
 * @param {Array} sessionHistory - array of {noteText, normalizedText, date, codes}
 * @param {number} repeatThreshold - how many sessions a theme must appear in to trigger
 * @returns {Array} repeatedThemes with counts
 */
function analyzeLongitudinalThemes(sessionHistory, repeatThreshold = 2) {
  if (!sessionHistory || sessionHistory.length < 2) return [];

  const THEMES = [
    "anxiety", "depression", "trauma", "ptsd", "grief", "loss",
    "substance use", "alcohol", "relapse prevention",
    "coping skills", "emotional regulation", "distress tolerance",
    "relationship issues", "interpersonal boundaries", "communication",
    "parenting", "family conflict", "domestic violence",
    "self esteem", "self worth", "identity",
    "anger management", "aggression", "impulse control",
    "sleep", "sleep hygiene",
    "medication adherence", "medication management",
    "vocational", "employment", "school",
    "housing", "homelessness", "financial stress",
    "chronic pain", "medical comorbidity",
    "suicidality", "self harm", "safety"
  ];

  const themeCounts = {};

  for (const session of sessionHistory) {
    const text = (session.normalizedText || session.noteText || "").toLowerCase();
    for (const theme of THEMES) {
      if (text.includes(theme)) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      }
    }
  }

  return Object.entries(themeCounts)
    .filter(([, count]) => count >= repeatThreshold)
    .sort((a, b) => b[1] - a[1])
    .map(([theme, count]) => ({
      theme,
      sessionCount: count,
      percentage: Math.round((count / sessionHistory.length) * 100),
      suggestionPriority: count >= repeatThreshold * 2 ? "high" : "medium"
    }));
}

/**
 * Command 17: Build treatment plan suggestion panel data.
 * @param {Array} repeatedThemes - from analyzeLongitudinalThemes
 * @param {object} currentNote - current note data
 * @returns {Array} treatmentPlanSuggestions
 */
function buildTreatmentPlanPanel(repeatedThemes, currentNote) {
  // Import from signal-parser theme map or inline condensed version
  const THEME_SUGGESTIONS = {
    "anxiety": {
      goal: "Client will reduce anxiety symptoms to a manageable level that does not impair daily functioning",
      objective: "Client will identify 3 anxiety triggers and practice 2 coping strategies at least 3x/week",
      intervention: "CBT techniques: thought challenging, relaxation training, exposure hierarchy",
      frequency: "Weekly individual therapy"
    },
    "depression": {
      goal: "Client will reduce depressive symptoms and improve daily functioning",
      objective: "Client will engage in 3 behavioral activation activities per week and track mood daily",
      intervention: "Behavioral activation, cognitive restructuring, psychoeducation about depression cycle",
      frequency: "Weekly individual therapy"
    },
    "trauma": {
      goal: "Client will process traumatic experiences and reduce PTSD symptom severity",
      objective: "Client will utilize 2 grounding techniques when experiencing trauma triggers",
      intervention: "Trauma-focused CBT, EMDR, or CPT; psychoeducation about trauma responses",
      frequency: "Weekly individual therapy"
    },
    "ptsd": {
      goal: "Client will reduce PTSD symptoms and improve daily functioning",
      objective: "Client will practice grounding and utilize safety plan when triggered",
      intervention: "Evidence-based trauma therapy (TF-CBT, CPT, or EMDR)",
      frequency: "Weekly individual therapy"
    },
    "substance use": {
      goal: "Client will achieve and maintain sobriety/reduced substance use",
      objective: "Client will identify 3 high-risk situations and practice 2 relapse prevention strategies",
      intervention: "Motivational interviewing, relapse prevention, connection to recovery supports",
      frequency: "Weekly individual or group therapy"
    },
    "relapse prevention": {
      goal: "Client will maintain recovery and reduce relapse risk",
      objective: "Client will maintain and implement personalized relapse prevention plan",
      intervention: "Relapse prevention planning, trigger management, recovery capital development",
      frequency: "Weekly individual therapy"
    },
    "coping skills": {
      goal: "Client will develop and consistently utilize effective coping strategies",
      objective: "Client will practice 3 new coping skills between sessions weekly",
      intervention: "DBT/CBT skills training: distress tolerance, emotional regulation, mindfulness",
      frequency: "Weekly individual therapy"
    },
    "emotional regulation": {
      goal: "Client will improve ability to identify and regulate emotional responses",
      objective: "Client will use emotional regulation skills 3x/week and track effectiveness",
      intervention: "DBT emotional regulation module, mindfulness practice",
      frequency: "Weekly individual and/or group DBT"
    },
    "anger management": {
      goal: "Client will reduce frequency and intensity of aggressive responses",
      objective: "Client will use de-escalation strategy before reaching high frustration 4x/week",
      intervention: "Anger management skills, cognitive restructuring, relaxation techniques",
      frequency: "Weekly individual therapy"
    },
    "self esteem": {
      goal: "Client will develop a more positive and realistic self-concept",
      objective: "Client will identify and challenge 3 negative self-talk patterns weekly",
      intervention: "CBT for core beliefs, strengths-based work, positive self-talk training",
      frequency: "Weekly individual therapy"
    },
    "suicidality": {
      goal: "Client will remain safe and develop effective means to manage suicidal crises",
      objective: "Client will review and update safety plan at each session",
      intervention: "Safety planning, means restriction counseling, crisis coping skills",
      frequency: "Weekly or more frequent individual therapy"
    },
    "medication adherence": {
      goal: "Client will take medications as prescribed and report effects consistently",
      objective: "Client will report medication adherence and side effects at each session",
      intervention: "Psychoeducation about medications, problem-solving barriers, prescriber coordination",
      frequency: "Weekly individual therapy / monthly prescriber coordination"
    },
    "parenting": {
      goal: "Client will improve parenting skills and reduce household conflict",
      objective: "Client will implement 2 positive parenting strategies per week and track outcomes",
      intervention: "Parent training, child development psychoeducation, family communication skills",
      frequency: "Weekly individual or family therapy"
    },
    "sleep": {
      goal: "Client will improve sleep quality and establish consistent healthy sleep patterns",
      objective: "Client will implement sleep hygiene strategies and track sleep log weekly",
      intervention: "CBT-I, sleep hygiene psychoeducation",
      frequency: "Weekly individual therapy"
    },
    "relationship issues": {
      goal: "Client will improve interpersonal functioning and relationship quality",
      objective: "Client will practice 2 improved communication strategies in real relationships weekly",
      intervention: "Interpersonal effectiveness (DBT), communication training, boundary-setting work",
      frequency: "Weekly individual therapy"
    }
  };

  return repeatedThemes.map(({ theme, sessionCount, percentage, suggestionPriority }) => {
    const suggestion = THEME_SUGGESTIONS[theme] || {
      goal: `Address ${theme} as identified treatment focus`,
      objective: `Client will demonstrate measurable progress in managing ${theme}`,
      intervention: `Evidence-based interventions targeting ${theme}`,
      frequency: "Weekly individual therapy"
    };

    return {
      theme,
      sessionCount,
      percentage,
      suggestionPriority,
      ...suggestion,
      alreadyInPlan: (currentNote?.treatmentGoals || []).some(g =>
        (g.goal_text || "").toLowerCase().includes(theme)
      )
    };
  });
}

// ─────────────────────────────────────────────
// PHASE 8: BACKGROUND CODING ENGINE (Commands 18-24)
// ─────────────────────────────────────────────

/**
 * Command 18-24: Background coding engine.
 * Runs automatically as note is filled out.
 * Integrates with signal-parser.js.
 *
 * @param {object} noteData - current note form state
 * @param {object} signalParserResult - result from signal-parser.js parseNote()
 * @returns {object} codingEngineOutput
 */
function runBackgroundCodingEngine(noteData, signalParserResult) {
  const parser = signalParserResult || {};
  const suggested = parser.suggestedCodes || [];
  const missing = parser.missingElements || [];
  const conflicts = parser.conflicts || [];
  const addendums = parser.addendumSuggestions || [];

  // ── Command 19-20: Code recommendations ──
  const recommendedCodes = buildCodeRecommendations(suggested, noteData);

  // ── Command 21: Combination rules ──
  const combinationWarnings = evaluateCombinationRules(recommendedCodes, noteData);

  // ── Command 22: Documentation warnings ──
  const documentationWarnings = buildDocumentationWarnings(noteData, parser);

  // ── Command 23: Missed revenue opportunities ──
  const missedRevenue = buildMissedRevenueAlerts(noteData, parser);

  // ── Command 24: Coding summary panel ──
  const overallConfidence = recommended => {
    if (!recommended.length) return 0;
    return Math.round(recommended.reduce((sum, c) => sum + (c.confidence || 0), 0) / recommended.length);
  };

  const medicalNecessityText = buildMedicalNecessityText(noteData, parser);

  return {
    // Command 24 panel fields
    recommendedCodes,
    suggestedModifiers: buildModifierSuggestions(noteData, recommendedCodes),
    overallConfidenceScore: overallConfidence(recommendedCodes),
    documentationWarnings,
    missedRevenueOpportunities: missedRevenue,
    combinationWarnings,
    conflicts,
    addendumSuggestions: addendums,
    medicalNecessityExplanation: medicalNecessityText,

    // Internal
    missingElements: missing,
    longitudinalAlerts: parser.longitudinalAlerts || [],
    treatmentPlanSuggestions: parser.treatmentPlanSuggestions || []
  };
}

/**
 * Build clean list of code recommendations from parser output.
 */
function buildCodeRecommendations(suggestedCodes, noteData) {
  // Filter to suggest and borderline codes only; exclude blocked
  return suggestedCodes
    .filter(c => !c.blocked && c.confidence >= 20)
    .map(c => ({
      code: c.code,
      label: c.label,
      description: c.description,
      confidence: c.confidence,
      status: c.status,
      explanation: c.explanation,
      notes: c.notes,
      placeOfService: noteData?.pos_code || null,
      units: getDefaultUnits(c.code, noteData)
    }));
}

function getDefaultUnits(code, noteData) {
  // H-codes and T-codes are typically billed per 15-min unit for some payers
  const unitCodes = ["H2014", "H0038", "T1017"];
  if (unitCodes.includes(code) && noteData?.session_minutes) {
    return Math.max(1, Math.floor(noteData.session_minutes / 15));
  }
  return 1;
}

/**
 * Command 21: Combination rules.
 */
function evaluateCombinationRules(recommendedCodes, noteData) {
  const warnings = [];
  const codes = recommendedCodes.map(c => c.code);

  const ALLOWED_COMBOS = [
    { codes: ["H0031", "90837"], note: "H0031 + 90837 allowed — assessment + psychotherapy" },
    { codes: ["H0031", "90834"], note: "H0031 + 90834 allowed — assessment + psychotherapy" },
    { codes: ["H0031", "90832"], note: "H0031 + 90832 allowed — assessment + psychotherapy" },
    { codes: ["H0032", "T1017"], note: "H0032 + T1017 allowed — treatment planning + care coordination" },
    { codes: ["H0002", "H0031"], note: "H0002 + H0031 allowed — screening + assessment" },
    { codes: ["H2014", "90837"], note: "H2014 + 90837 allowed — skills training + therapy" },
    { codes: ["90839", "90840"], note: "90840 is an add-on to 90839 — both may be billed together" }
  ];

  const BLOCKED_COMBOS = [
    {
      codes: ["90832", "90834"],
      message: "90832 and 90834 cannot both be billed — choose one psychotherapy code based on session duration"
    },
    {
      codes: ["90832", "90837"],
      message: "90832 and 90837 cannot both be billed — choose one psychotherapy code based on session duration"
    },
    {
      codes: ["90834", "90837"],
      message: "90834 and 90837 cannot both be billed — choose one psychotherapy code based on session duration"
    },
    {
      codes: ["90791", "90837"],
      message: "90791 (diagnostic eval) cannot be billed with 90837 on the same date — use only 90791"
    }
  ];

  // Check time-based overrun
  const timeBasedCodes = ["90832", "90834", "90837", "90839"];
  const timeCodeInPlan = codes.filter(c => timeBasedCodes.includes(c));
  if (timeCodeInPlan.length > 0 && noteData?.session_minutes) {
    const minutes = noteData.session_minutes;
    if (minutes > 0 && minutes < 16) {
      warnings.push({
        type: "duration_too_short",
        message: `Session time (${minutes} min) is too short to bill any psychotherapy code. Minimum is 16 minutes.`
      });
    }
  }

  // Check blocked combinations
  for (const blocked of BLOCKED_COMBOS) {
    if (blocked.codes.every(c => codes.includes(c))) {
      warnings.push({
        type: "blocked_combination",
        codes: blocked.codes,
        message: blocked.message
      });
    }
  }

  return warnings;
}

/**
 * Command 22: Documentation warnings.
 */
function buildDocumentationWarnings(noteData, parserResult) {
  const warnings = [];

  if (!noteData?.primaryDxCode && !noteData?.diagnosisList?.length) {
    warnings.push({ type: "missing_diagnosis", severity: "error", message: "No diagnosis documented. A valid ICD-10 code is required for billing." });
  }

  if (!noteData?.session_minutes && !noteData?.sessionStart) {
    warnings.push({ type: "missing_time", severity: "error", message: "Session time not documented. Time-based codes require start/end time or total minutes." });
  }

  if (!noteData?.clinician) {
    warnings.push({ type: "missing_clinician", severity: "error", message: "Clinician name not documented." });
  }

  if (!noteData?.dos) {
    warnings.push({ type: "missing_dos", severity: "error", message: "Date of service not documented." });
  }

  const parser = parserResult || {};
  const matched = parser.matchedSignals || {};

  // Check for risk assessment
  const riskCount = ((matched.assessment || {}).riskAssessment || {}).count || 0;
  if (riskCount === 0 && !noteData?.riskLevel) {
    warnings.push({ type: "missing_risk", severity: "warning", message: "No risk assessment documented. Include at minimum a brief SI/HI status." });
  }

  // Check for medical necessity language
  if (!noteData?.assessment && !noteData?.assessmentText) {
    warnings.push({ type: "missing_medical_necessity", severity: "warning", message: "Assessment section empty. Document clinical impression and medical necessity for services." });
  }

  // Check for treatment plan support
  const planCount = ((matched.treatmentPlanning || {}).goals || {}).count || 0;
  if (planCount === 0 && !noteData?.plan) {
    warnings.push({ type: "missing_treatment_plan_support", severity: "warning", message: "No treatment plan support documented. Include reference to goals or treatment plan." });
  }

  // Check for intervention documentation
  const interventions = noteData?.interventions || [];
  if (interventions.length === 0) {
    const interventionCount = ((matched.treatmentPlanning || {}).interventions || {}).count || 0;
    if (interventionCount === 0) {
      warnings.push({ type: "missing_interventions", severity: "warning", message: "No interventions documented. Document at least one clinical technique used." });
    }
  }

  return warnings;
}

/**
 * Command 23: Missed revenue opportunities.
 */
function buildMissedRevenueAlerts(noteData, parserResult) {
  const alerts = [];
  const parser = parserResult || {};
  const matched = parser.matchedSignals || {};
  const existingCodes = parser.suggestedCodes?.filter(c => c.status === "suggest").map(c => c.code) || [];

  // H0032 when treatment planning documented
  const planCount = ((matched.treatmentPlanning || {}).goals || {}).count || 0;
  if (planCount >= 1 && !existingCodes.includes("H0032")) {
    alerts.push({
      code: "H0032",
      label: "Treatment Plan Review",
      message: "Treatment planning language detected. Consider billing H0032 if a formal plan update or review occurred."
    });
  }

  // H0002 when screening tool mentioned
  const screenCount = ((matched.screeningTools || {}).completed || {}).count || 0;
  if (screenCount >= 1 && !existingCodes.includes("H0002")) {
    alerts.push({
      code: "H0002",
      label: "Behavioral Health Screening",
      message: "Screening tool language detected. Consider billing H0002 if a validated instrument was completed and scored."
    });
  }

  // H2014 when skills training documented
  const skillCount = ((matched.skills || {}).training || {}).count || 0;
  if (skillCount >= 1 && !existingCodes.includes("H2014")) {
    alerts.push({
      code: "H2014",
      label: "Skills Training",
      message: "Skills training language detected. Consider billing H2014 if specific skills were taught or practiced."
    });
  }

  // T1017 when care coordination documented
  const careCount = ((matched.careCoordination || {}).coordination || {}).count || 0;
  if (careCount >= 1 && !existingCodes.includes("T1017")) {
    alerts.push({
      code: "T1017",
      label: "Case Management / Care Coordination",
      message: "Care coordination language detected. Consider billing T1017 if case management activities were performed."
    });
  }

  // H0006 for SUD case management
  const sudCount = ((matched.assessment || {}).substanceUse || {}).count || 0;
  if (sudCount >= 2 && careCount >= 1 && !existingCodes.includes("H0006")) {
    alerts.push({
      code: "H0006",
      label: "SUD Case Management",
      message: "Substance use and care coordination both documented. Consider H0006 for SUD-related case management."
    });
  }

  // H0031 when assessment language detected in routine note
  const mhAssessCount = ((matched.assessment || {}).mentalHealth || {}).count || 0;
  if (mhAssessCount >= 2 && !existingCodes.includes("H0031")) {
    alerts.push({
      code: "H0031",
      label: "Behavioral Health Assessment",
      message: "Assessment language detected. If a structured clinical assessment was conducted beyond routine therapy, H0031 may be supported."
    });
  }

  return alerts;
}

/**
 * Build modifier suggestions for recommended codes.
 */
function buildModifierSuggestions(noteData, recommendedCodes) {
  const modifiers = [];
  const codes = recommendedCodes.map(c => c.code);

  // Telehealth modifier
  if (noteData?.modality === "telehealth_video" || noteData?.modality === "telehealth_phone") {
    modifiers.push({
      modifier: "95",
      applies_to: codes.filter(c => c.startsWith("908") || c.startsWith("907")),
      reason: "Telehealth services — modifier 95 may be required by payer"
    });
  }

  // GT modifier (alternative telehealth)
  if (noteData?.modality === "telehealth_video") {
    modifiers.push({
      modifier: "GT",
      applies_to: codes.filter(c => c.startsWith("H") || c.startsWith("T")),
      reason: "Video telehealth — modifier GT for HCPCS codes"
    });
  }

  // Interactive complexity add-on
  const hasCrisis = codes.includes("90839") || codes.includes("H2011");
  const hasHighRisk = noteData?.riskLevel === "active_si_plan" || noteData?.riskLevel === "active_si_intent";
  if ((hasCrisis || hasHighRisk) && codes.some(c => c.startsWith("908"))) {
    modifiers.push({
      modifier: "90785",
      type: "add-on",
      applies_to: codes.filter(c => c.startsWith("908") && c !== "90785"),
      reason: "Interactive complexity add-on — crisis or complex communication factors present"
    });
  }

  return modifiers;
}

/**
 * Build medical necessity explanation text.
 */
function buildMedicalNecessityText(noteData, parserResult) {
  const parser = parserResult || {};
  const matched = parser.matchedSignals || {};

  const parts = [];

  const dx = noteData?.primaryDxLabel || noteData?.primaryDxCode;
  if (dx) parts.push(`Client presents with ${dx}.`);

  const mhCount = ((matched.assessment || {}).mentalHealth || {}).count || 0;
  if (mhCount > 0) parts.push("Mental health symptoms were assessed and documented.");

  const riskCount = ((matched.assessment || {}).riskAssessment || {}).count || 0;
  if (riskCount > 0) parts.push("Risk assessment completed including SI/HI status.");

  const themes = parser.detectedThemes || [];
  if (themes.length > 0) parts.push(`Identified treatment themes: ${themes.slice(0, 3).join(", ")}.`);

  const interventions = noteData?.interventions || [];
  if (interventions.length > 0) parts.push(`Interventions provided: ${interventions.join(", ")}.`);

  const planCount = ((matched.treatmentPlanning || {}).goals || {}).count || 0;
  if (planCount > 0) parts.push("Treatment goals reviewed and services align with documented treatment plan.");

  return parts.length > 0
    ? parts.join(" ")
    : "Complete the note to generate medical necessity documentation.";
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CONDITIONAL_FIELD_RULES,
    COMPLEXITY_LEVELS,
    QUICK_SELECT,
    evaluateConditionalFields,
    getSectionsForComplexity,
    generateSmartDefaults,
    buildCompareView,
    analyzeLongitudinalThemes,
    buildTreatmentPlanPanel,
    runBackgroundCodingEngine,
    buildCodeRecommendations,
    evaluateCombinationRules,
    buildDocumentationWarnings,
    buildMissedRevenueAlerts,
    buildModifierSuggestions,
    buildMedicalNecessityText
  };
} else if (typeof window !== "undefined") {
  window.NoteEngine = {
    CONDITIONAL_FIELD_RULES,
    COMPLEXITY_LEVELS,
    QUICK_SELECT,
    evaluateConditionalFields,
    getSectionsForComplexity,
    generateSmartDefaults,
    buildCompareView,
    analyzeLongitudinalThemes,
    buildTreatmentPlanPanel,
    runBackgroundCodingEngine,
    buildCodeRecommendations,
    evaluateCombinationRules,
    buildDocumentationWarnings,
    buildMissedRevenueAlerts,
    buildModifierSuggestions,
    buildMedicalNecessityText
  };
}
