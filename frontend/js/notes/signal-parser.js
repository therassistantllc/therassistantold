/**
 * DOCUSISTANT Signal Parser & Scoring Engine
 * Parses raw note text against the behavioral health signal library,
 * scores billing codes, and returns structured output for the documentation engine.
 */

// ─────────────────────────────────────────────
// SIGNAL LIBRARY
// ─────────────────────────────────────────────

const DEFAULT_SIGNAL_LIBRARY = {
  assessment: {
    mentalHealth: {
      label: "Mental Health Assessment",
      signals: [
        "presenting symptoms", "current symptoms", "symptom review", "chief complaint",
        "mental health history", "psychiatric history", "history of mental illness",
        "diagnostic clarification", "differential diagnosis", "diagnosis updated",
        "reassessment", "clinical change", "decompensation", "new concern",
        "mental status exam", "mse", "orientation", "affect", "mood", "thought process",
        "insight", "judgment", "memory", "attention", "concentration",
        "cognitive functioning", "intellectual functioning",
        "social functioning", "occupational functioning", "daily functioning", "adls",
        "activities of daily living", "work functioning", "school functioning",
        "interpersonal functioning", "relationship functioning",
        "trauma history", "adverse childhood experiences", "aces",
        "medical history", "medication review", "medication compliance",
        "psychiatric medication", "psychotropic medication",
        "sleep disturbance", "appetite changes", "energy level",
        "anhedonia", "hopelessness", "helplessness", "worthlessness",
        "panic attacks", "flashbacks", "nightmares", "hypervigilance",
        "dissociation", "rumination", "intrusive thoughts",
        "psychosis", "hallucinations", "delusions", "paranoia",
        "mania", "hypomania", "grandiosity", "racing thoughts",
        "depression", "anxiety", "ptsd", "bipolar", "adhd", "ocd",
        "personality disorder", "borderline", "schizophrenia",
        "strengths", "protective factors", "coping resources",
        "barriers to treatment", "treatment response", "medication adherence"
      ],
      abbreviations: {
        "mse": "mental status exam",
        "adls": "activities of daily living",
        "hx": "history",
        "sx": "symptoms",
        "dx": "diagnosis",
        "tx": "treatment",
        "meds": "medications",
        "ptsd": "post traumatic stress disorder",
        "adhd": "attention deficit hyperactivity disorder",
        "ocd": "obsessive compulsive disorder",
        "bpd": "borderline personality disorder",
        "mdd": "major depressive disorder",
        "gad": "generalized anxiety disorder",
        "sa": "suicidal ideation",
        "si": "suicidal ideation",
        "hi": "homicidal ideation",
        "sh": "self harm"
      }
    },
    substanceUse: {
      label: "Substance Use Assessment",
      signals: [
        "alcohol use", "drug use", "substance use", "substance abuse",
        "alcohol consumption", "drinking", "ethanol", "etoh",
        "cannabis", "marijuana", "weed", "thc", "pot",
        "opioids", "heroin", "fentanyl", "oxycodone", "hydrocodone", "pain pills",
        "cocaine", "crack", "stimulants", "meth", "methamphetamine", "amphetamine",
        "benzodiazepines", "benzos", "xanax", "klonopin", "valium",
        "sedatives", "sleeping pills",
        "tobacco", "nicotine", "vaping", "e-cigarettes",
        "polysubstance", "multiple substances",
        "frequency of use", "how often", "quantity", "how much",
        "duration of use", "how long", "onset of use",
        "last use", "most recent use", "days since use",
        "route of administration", "iv use", "injection", "snorting",
        "cravings", "urges", "compulsion to use",
        "withdrawal", "withdrawal symptoms", "detox", "detoxification",
        "tolerance", "increased tolerance", "needs more",
        "relapse", "relapsed", "using again", "resumed use", "slip",
        "triggers", "high risk situations", "relapse triggers",
        "blackouts", "memory loss from drinking",
        "consequences of use", "legal problems", "dui", "dwi",
        "employment problems from use", "relationship problems from use",
        "physical health from use", "medical complications",
        "readiness to change", "motivation to stop", "ambivalence",
        "recovery supports", "aa", "na", "smart recovery", "sponsor",
        "sober living", "halfway house", "treatment history",
        "asam", "level of care", "detox level", "residential treatment",
        "iop", "intensive outpatient", "op", "outpatient treatment",
        "medication assisted treatment", "mat", "suboxone", "methadone", "naltrexone", "vivitrol",
        "recovery capital", "sobriety date", "clean date",
        "drug screen", "urine drug screen", "uds", "urinalysis"
      ],
      abbreviations: {
        "etoh": "alcohol",
        "etol": "alcohol",
        "thc": "cannabis",
        "mj": "marijuana",
        "iv": "intravenous",
        "uds": "urine drug screen",
        "mat": "medication assisted treatment",
        "asam": "american society of addiction medicine",
        "iop": "intensive outpatient program",
        "php": "partial hospitalization program",
        "bac": "blood alcohol content",
        "dui": "driving under the influence",
        "aa": "alcoholics anonymous",
        "na": "narcotics anonymous"
      }
    },
    riskAssessment: {
      label: "Risk Assessment",
      signals: [
        "suicide risk", "suicidal ideation", "suicidal thoughts", "wants to die",
        "si", "suicidal", "passive suicidal ideation", "active suicidal ideation",
        "plan to suicide", "intent to suicide", "means to suicide",
        "hopeless", "hopelessness", "no reason to live", "burden to others",
        "self harm", "self-harm", "cutting", "burning", "self injury", "self-injury",
        "non suicidal self injury", "nssi",
        "homicidal ideation", "hi", "thoughts of harming others", "violence risk",
        "safety planning", "safety plan", "crisis plan", "safe messaging",
        "means restriction", "lethal means", "firearms", "medications locked up",
        "protective factors", "reasons for living", "supports",
        "no si", "no hi", "denies si", "denies suicidal", "no safety concerns",
        "risk level", "low risk", "moderate risk", "high risk",
        "columbia", "c-ssrs", "columbia protocol", "columbia scale",
        "stanley brown safety planning",
        "hospitalization", "inpatient", "psychiatric hold", "5150", "baker act",
        "crisis", "psychiatric emergency", "acute risk",
        "assault", "aggression", "threatening", "danger to others",
        "child abuse", "elder abuse", "domestic violence", "ipv", "mandated reporting"
      ],
      abbreviations: {
        "si": "suicidal ideation",
        "hi": "homicidal ideation",
        "sh": "self harm",
        "nssi": "non suicidal self injury",
        "c-ssrs": "columbia suicide severity rating scale",
        "ipv": "intimate partner violence",
        "dv": "domestic violence"
      }
    }
  },
  treatmentPlanning: {
    goals: {
      label: "Treatment Goals",
      signals: [
        "treatment goal", "treatment goals", "goal", "goals",
        "long term goal", "short term goal", "ltg", "stg",
        "objective", "objectives", "outcome",
        "measurable goal", "smart goal",
        "reduce symptoms", "decrease symptoms", "improve functioning",
        "increase coping", "develop skills", "build skills",
        "treatment plan", "care plan", "service plan",
        "collaborative goal", "client identified goal", "client agreed",
        "goal progress", "progress toward goal", "goal met", "goal achieved",
        "goal not met", "goal revised", "goal updated", "goal modified",
        "barriers to goals", "obstacles", "barriers to progress",
        "new focus area", "new problem", "added to treatment plan"
      ]
    },
    interventions: {
      label: "Interventions",
      signals: [
        "cognitive behavioral therapy", "cbt", "cognitive restructuring", "thought records",
        "dialectical behavior therapy", "dbt", "distress tolerance", "emotion regulation",
        "mindfulness", "mindfulness based", "present moment awareness", "grounding",
        "motivational interviewing", "mi", "reflective listening", "change talk",
        "acceptance and commitment therapy", "act",
        "trauma focused cbt", "tf-cbt", "emdr", "trauma processing",
        "prolonged exposure", "cognitive processing therapy", "cpt",
        "psychoeducation", "education provided", "informed client",
        "skill building", "skills training", "coping skills", "coping strategies",
        "relapse prevention", "relapse prevention planning",
        "boundary setting", "limit setting",
        "problem solving", "problem solving therapy",
        "behavioral activation", "activity scheduling",
        "exposure therapy", "systematic desensitization",
        "supportive therapy", "supportive listening", "validation",
        "solution focused", "sfbt", "strengths based",
        "family therapy", "couples therapy", "group therapy",
        "psychodynamic", "insight oriented",
        "somatic", "body based", "breathing exercises", "relaxation",
        "progressive muscle relaxation", "pmr",
        "biofeedback", "neurofeedback",
        "care coordination", "case management", "coordination of care",
        "referral", "referred to", "linkage to services",
        "medication management discussion", "medication education",
        "crisis intervention", "safety planning intervention",
        "treatment planning review", "treatment plan update"
      ],
      abbreviations: {
        "cbt": "cognitive behavioral therapy",
        "dbt": "dialectical behavior therapy",
        "mi": "motivational interviewing",
        "act": "acceptance and commitment therapy",
        "emdr": "eye movement desensitization and reprocessing",
        "tf-cbt": "trauma focused cognitive behavioral therapy",
        "cpt": "cognitive processing therapy",
        "sfbt": "solution focused brief therapy",
        "pmr": "progressive muscle relaxation"
      }
    },
    frequency: {
      label: "Service Frequency",
      signals: [
        "weekly", "biweekly", "every two weeks", "monthly", "twice weekly",
        "frequency", "frequency of services", "frequency of sessions",
        "increased frequency", "decreased frequency", "frequency change",
        "session frequency", "service frequency", "level of care change",
        "step up", "step down", "step up in care", "step down in care",
        "intensive outpatient", "iop", "partial hospitalization", "php",
        "discharge planning", "transition to", "transition of care",
        "referral to higher level", "lower level of care"
      ]
    }
  },
  screeningTools: {
    completed: {
      label: "Screening Tools Completed",
      signals: [
        "phq-9", "phq9", "patient health questionnaire", "depression screen",
        "gad-7", "gad7", "anxiety screen", "generalized anxiety disorder scale",
        "pcl-5", "pcl5", "ptsd checklist", "trauma screen",
        "audit", "audit-c", "auditc", "alcohol use disorders identification test",
        "dast", "drug abuse screening test",
        "cage", "cage questionnaire",
        "c-ssrs", "columbia suicide severity", "columbia scale",
        "mdq", "mood disorder questionnaire", "bipolar screen",
        "aces", "adverse childhood experiences",
        "asam", "asam criteria",
        "crafft", "adolescent substance use screen",
        "cssrs", "ssrs",
        "score of", "scored", "total score", "result", "results",
        "completed questionnaire", "administered screen", "screening completed"
      ]
    }
  },
  careCoordination: {
    coordination: {
      label: "Care Coordination",
      signals: [
        "coordinated with", "coordination with", "collaborated with", "collaboration with",
        "contacted provider", "spoke with", "called", "faxed", "emailed",
        "primary care", "pcp", "physician", "md", "np", "pa",
        "psychiatrist", "psychiatric provider", "prescriber",
        "case manager", "case management", "social worker",
        "community mental health", "cmhc",
        "school counselor", "school", "teacher",
        "probation officer", "parole officer", "court",
        "dcfs", "dhs", "child protective services", "cps",
        "hospital", "inpatient unit", "residential facility",
        "crisis line", "warmline", "988",
        "housing", "shelter", "homeless services",
        "food bank", "benefits", "medicaid", "insurance",
        "transportation", "bus pass",
        "vocational", "job training", "employment services",
        "referral made", "referral placed", "referral sent",
        "release of information", "roi", "consent to contact",
        "care team", "multidisciplinary team", "mdt",
        "community resources", "community support"
      ]
    }
  },
  skills: {
    training: {
      label: "Skills Training Documented",
      signals: [
        "taught", "practiced", "reviewed", "demonstrated", "modeled",
        "skill", "skills", "technique", "strategy", "tool", "worksheet",
        "homework", "practice assignment", "between session work",
        "coping skill", "coping strategy", "coping tool",
        "distress tolerance skill", "emotional regulation skill",
        "interpersonal effectiveness", "mindfulness skill",
        "breathing technique", "grounding technique",
        "thought challenging", "cognitive restructuring technique",
        "relapse prevention skill", "trigger management",
        "communication skill", "assertiveness", "boundary setting skill",
        "anger management technique", "conflict resolution",
        "problem solving skill", "decision making",
        "parenting skill", "parenting strategy", "parenting technique",
        "self care", "self care plan", "wellness plan",
        "sleep hygiene", "sleep skills",
        "medication management skill", "pill reminder",
        "completed workbook", "assigned reading", "psychoeducation handout"
      ]
    }
  },
  crisis: {
    intervention: {
      label: "Crisis Intervention",
      signals: [
        "crisis", "psychiatric emergency", "acute crisis", "immediate risk",
        "crisis intervention", "crisis services", "crisis team",
        "mobile crisis", "crisis stabilization", "crisis unit",
        "emergency room", "er", "emergency department", "ed",
        "911", "emergency services", "law enforcement",
        "psychiatric hold", "involuntary hold", "5150", "baker act", "72 hour hold",
        "voluntary hospitalization", "inpatient admission",
        "hospital transport", "transported to hospital",
        "crisis line", "988 call", "hotline",
        "de-escalation", "de-escalated",
        "safety contract", "no harm contract", "safety plan completed",
        "means restriction completed", "lethal means counseling",
        "crisis stabilized", "crisis resolved", "safety established",
        "followed up with", "safety monitoring",
        "increased session frequency due to crisis",
        "crisis follow up appointment", "next day appointment"
      ]
    }
  },
  sessionTime: {
    duration: {
      label: "Session Time",
      signals: [
        "minutes", "mins", "hour", "hours",
        "session length", "session duration", "total time",
        "start time", "end time", "time in session",
        "face to face", "face-to-face", "contact time",
        "telehealth session", "video session", "phone session",
        "in person session", "office visit"
      ],
      patterns: [
        /(\d+)\s*min(?:utes?)?/i,
        /(\d+)\s*hr(?:s|ours?)?/i,
        /(\d{1,2}):(\d{2})\s*(?:am|pm)?\s*(?:to|-)\s*(\d{1,2}):(\d{2})\s*(?:am|pm)?/i,
        /session\s+(?:was|lasted)\s+(\d+)/i,
        /(\d+)[\s-]+minute\s+session/i
      ]
    }
  },
  progress: {
    response: {
      label: "Treatment Response & Progress",
      signals: [
        "improving", "improved", "improvement", "better", "progress",
        "making progress", "progress toward goals", "goal progress",
        "symptoms decreased", "symptoms reduced", "symptom improvement",
        "functioning improved", "functioning better",
        "stable", "stabilized", "maintaining",
        "no change", "unchanged", "plateaued",
        "declining", "worsening", "deteriorating", "worse",
        "setback", "regression", "decompensation",
        "client reported", "client states", "client identified",
        "client engaged", "client motivated", "client cooperative",
        "client resistant", "client ambivalent", "limited engagement",
        "partially met", "not met", "fully met",
        "benefit from treatment", "responding to treatment",
        "tolerated well", "participated actively"
      ]
    }
  }
};

// ─────────────────────────────────────────────
// CODE RULES
// ─────────────────────────────────────────────

const DEFAULT_CODE_RULES = {
  H0031: {
    label: "Behavioral Health Assessment",
    description: "Mental health assessment - structured clinical evaluation",
    requiredCategories: [],
    primaryCategories: ["assessment.mentalHealth", "assessment.riskAssessment"],
    optionalCategories: ["screeningTools.completed", "treatmentPlanning.goals"],
    minSignals: 2,
    exclusions: ["routineTherapyOnly"],
    conflictsWith: [],
    notes: "Must reflect actual assessment activity, not routine psychotherapy"
  },
  H0032: {
    label: "Treatment Plan Development or Review",
    description: "Treatment planning or plan review",
    requiredCategories: [],
    primaryCategories: ["treatmentPlanning.goals", "treatmentPlanning.interventions"],
    optionalCategories: ["treatmentPlanning.frequency", "progress.response"],
    minSignals: 1,
    exclusions: ["progressOnlyMentioned"],
    conflictsWith: [],
    notes: "Must reflect actual planning activity, not just progress monitoring"
  },
  H0001: {
    label: "Substance Use Assessment",
    description: "Comprehensive substance use assessment",
    requiredCategories: [],
    primaryCategories: ["assessment.substanceUse"],
    optionalCategories: ["assessment.riskAssessment", "treatmentPlanning.goals"],
    minSignals: 2,
    exclusions: ["substanceUseOnlyBrieflyMentioned"],
    conflictsWith: [],
    notes: "Must reflect structured substance use assessment"
  },
  H0002: {
    label: "Behavioral Health Screening",
    description: "Validated screening tool completed and reviewed",
    requiredCategories: ["screeningTools.completed"],
    primaryCategories: ["screeningTools.completed"],
    optionalCategories: [],
    minSignals: 1,
    exclusions: ["noFormalScreeningTool"],
    conflictsWith: [],
    notes: "Requires use of validated screening instrument"
  },
  H2014: {
    label: "Skills Training",
    description: "Skills training and development - documented teaching of specific skills",
    requiredCategories: [],
    primaryCategories: ["skills.training"],
    optionalCategories: ["treatmentPlanning.interventions", "progress.response"],
    minSignals: 1,
    exclusions: [],
    conflictsWith: [],
    notes: "Must document specific skills taught or practiced"
  },
  T1017: {
    label: "Case Management / Care Coordination",
    description: "Targeted case management or care coordination activity",
    requiredCategories: [],
    primaryCategories: ["careCoordination.coordination"],
    optionalCategories: ["treatmentPlanning.goals"],
    minSignals: 1,
    exclusions: [],
    conflictsWith: [],
    notes: "Must document actual coordination or case management activities"
  },
  H0006: {
    label: "Alcohol/Drug Services - Case Management",
    description: "Case management for substance use disorders",
    requiredCategories: [],
    primaryCategories: ["careCoordination.coordination", "assessment.substanceUse"],
    optionalCategories: [],
    minSignals: 2,
    exclusions: [],
    conflictsWith: [],
    notes: "Requires both substance use context and case management activities"
  },
  H0038: {
    label: "Self-Help / Peer Services",
    description: "Peer support services",
    requiredCategories: [],
    primaryCategories: ["progress.response"],
    optionalCategories: [],
    minSignals: 1,
    exclusions: [],
    conflictsWith: [],
    notes: "Peer support context required"
  },
  H2011: {
    label: "Crisis Intervention",
    description: "Crisis intervention services",
    requiredCategories: ["crisis.intervention"],
    primaryCategories: ["crisis.intervention"],
    optionalCategories: ["assessment.riskAssessment"],
    minSignals: 1,
    exclusions: [],
    conflictsWith: [],
    notes: "Crisis must be documented to bill this code"
  },
  "90791": {
    label: "Psychiatric Diagnostic Evaluation",
    description: "Initial psychiatric diagnostic interview",
    requiredCategories: [],
    primaryCategories: ["assessment.mentalHealth", "assessment.riskAssessment"],
    optionalCategories: ["screeningTools.completed", "assessment.substanceUse"],
    minSignals: 3,
    exclusions: [],
    conflictsWith: [],
    notes: "Initial evaluation context required"
  },
  "90785": {
    label: "Interactive Complexity Add-on",
    description: "Add-on for complex communication factors",
    requiredCategories: [],
    primaryCategories: ["crisis.intervention", "assessment.riskAssessment"],
    optionalCategories: [],
    minSignals: 1,
    exclusions: [],
    conflictsWith: [],
    notes: "Add-on code - requires base psychotherapy code"
  },
  "90832": {
    label: "Psychotherapy 30 min",
    description: "Individual psychotherapy, 16-37 minutes",
    requiredCategories: ["sessionTime.duration"],
    primaryCategories: ["treatmentPlanning.interventions", "progress.response"],
    optionalCategories: [],
    minSignals: 1,
    durationMin: 16,
    durationMax: 37,
    exclusions: [],
    conflictsWith: ["90834", "90837"],
    notes: "Requires 16-37 minutes documented"
  },
  "90834": {
    label: "Psychotherapy 45 min",
    description: "Individual psychotherapy, 38-52 minutes",
    requiredCategories: ["sessionTime.duration"],
    primaryCategories: ["treatmentPlanning.interventions", "progress.response"],
    optionalCategories: [],
    minSignals: 1,
    durationMin: 38,
    durationMax: 52,
    exclusions: [],
    conflictsWith: ["90832", "90837"],
    notes: "Requires 38-52 minutes documented"
  },
  "90837": {
    label: "Psychotherapy 60 min",
    description: "Individual psychotherapy, 53+ minutes",
    requiredCategories: ["sessionTime.duration"],
    primaryCategories: ["treatmentPlanning.interventions", "progress.response"],
    optionalCategories: [],
    minSignals: 1,
    durationMin: 53,
    durationMax: null,
    exclusions: [],
    conflictsWith: ["90832", "90834"],
    notes: "Requires 53+ minutes documented"
  },
  "90839": {
    label: "Crisis Psychotherapy 60 min",
    description: "Crisis psychotherapy, first 30-74 minutes",
    requiredCategories: ["crisis.intervention"],
    primaryCategories: ["crisis.intervention", "assessment.riskAssessment"],
    optionalCategories: [],
    minSignals: 1,
    durationMin: 30,
    durationMax: 74,
    exclusions: [],
    conflictsWith: [],
    notes: "Crisis context required; 30-74 minutes"
  },
  "90840": {
    label: "Crisis Psychotherapy Add-on",
    description: "Crisis psychotherapy add-on, each additional 30 minutes",
    requiredCategories: ["crisis.intervention"],
    primaryCategories: ["crisis.intervention"],
    optionalCategories: [],
    minSignals: 1,
    durationMin: 75,
    durationMax: null,
    exclusions: [],
    conflictsWith: [],
    notes: "Add-on to 90839 for sessions exceeding 74 minutes"
  }
};

// ─────────────────────────────────────────────
// LONGITUDINAL RULES
// ─────────────────────────────────────────────

const DEFAULT_LONGITUDINAL_RULES = {
  codeOpportunities: {
    H0031: { label: "Behavioral Health Assessment", minGapDays: 30 },
    H0032: { label: "Treatment Plan", minGapDays: 90 },
    H0001: { label: "Substance Use Assessment", minGapDays: 30 },
    H0002: { label: "Screening Tool", minGapDays: 90 },
    H2014: { label: "Skills Training", minGapDays: 0 },
    T1017: { label: "Care Coordination", minGapDays: 0 }
  },
  overuseThresholds: {
    H0031: { maxPerMonth: 4, warningThreshold: 3 },
    H0032: { maxPerMonth: 2, warningThreshold: 2 },
    H0001: { maxPerMonth: 4, warningThreshold: 3 },
    H0002: { maxPerMonth: 2, warningThreshold: 2 }
  },
  treatmentPlanThemes: [
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
  ]
};

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Normalize raw note text for matching.
 * - Lowercase
 * - Expand known abbreviations
 * - Remove punctuation (preserve spaces)
 * - Split into sentences
 */
function normalizeText(rawText) {
  if (!rawText || typeof rawText !== "string") return { normalized: "", sentences: [] };

  let text = rawText.toLowerCase();

  // Expand all abbreviations from all categories
  const allAbbreviations = {};
  for (const cat of Object.values(DEFAULT_SIGNAL_LIBRARY)) {
    for (const sub of Object.values(cat)) {
      if (sub.abbreviations) {
        Object.assign(allAbbreviations, sub.abbreviations);
      }
    }
  }

  // Sort abbreviations by length descending to avoid partial replacements
  const sortedAbbrevs = Object.entries(allAbbreviations).sort((a, b) => b[0].length - a[0].length);
  for (const [abbrev, expansion] of sortedAbbrevs) {
    const pattern = new RegExp(`\\b${escapeRegex(abbrev)}\\b`, "gi");
    text = text.replace(pattern, expansion);
  }

  // Remove punctuation except periods (needed for sentence splitting) and hyphens
  const normalized = text.replace(/[^\w\s.\-\/]/g, " ").replace(/\s+/g, " ").trim();

  // Split into sentences
  const sentences = normalized
    .split(/(?<=[.!?])\s+|(?<=\n)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return { normalized, sentences };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Fuzzy match: checks if a signal phrase is present in text.
 * Supports:
 *  - Exact substring match
 *  - Plural/singular variants
 *  - Common verb tense variations
 *  - Partial phrase match (all words present near each other in window)
 */
function fuzzyMatch(signal, normalizedText) {
  const sig = signal.toLowerCase().trim();

  // Direct match
  if (normalizedText.includes(sig)) return true;

  // Plural / singular variants
  const variants = generateVariants(sig);
  for (const v of variants) {
    if (normalizedText.includes(v)) return true;
  }

  // All words in signal must appear within a 10-word window
  const sigWords = sig.split(/\s+/).filter(w => w.length > 2);
  if (sigWords.length >= 2) {
    if (wordsInWindow(sigWords, normalizedText, 10)) return true;
  }

  return false;
}

/**
 * Generate common variants of a signal phrase (plural, tense, etc.)
 */
function generateVariants(phrase) {
  const variants = new Set();
  const words = phrase.split(/\s+/);
  const lastWord = words[words.length - 1];

  // Plural/singular
  if (lastWord.endsWith("s") && lastWord.length > 3) {
    variants.add(phrase.slice(0, -1)); // remove trailing s
  } else {
    variants.add(phrase + "s");
    variants.add(phrase + "es");
    variants.add(phrase + "ing");
    variants.add(phrase + "ed");
    variants.add(phrase + "d");
  }

  // Common tense variants for last word
  const stemVariants = getStemVariants(lastWord);
  for (const sv of stemVariants) {
    variants.add(words.slice(0, -1).concat(sv).join(" "));
  }

  return [...variants];
}

function getStemVariants(word) {
  const variants = [];
  if (word.endsWith("ing")) {
    const base = word.slice(0, -3);
    variants.push(base, base + "e", base + "ed", base + "s");
  } else if (word.endsWith("ed")) {
    const base = word.slice(0, -2);
    variants.push(base, base + "e", base + "ing", base + "s");
  } else if (word.endsWith("s") && word.length > 4) {
    variants.push(word.slice(0, -1));
  } else {
    variants.push(word + "s", word + "ing", word + "ed", word + "d");
  }
  return variants;
}

/**
 * Check if all words in sigWords appear within a sliding window in text.
 */
function wordsInWindow(sigWords, text, windowSize) {
  const textWords = text.split(/\s+/);
  for (let i = 0; i <= textWords.length - windowSize; i++) {
    const window = textWords.slice(i, i + windowSize);
    if (sigWords.every(sw => window.some(tw => tw.includes(sw) || sw.includes(tw)))) {
      return true;
    }
  }
  return false;
}

/**
 * Extract session duration in minutes from normalized text.
 * Returns null if not found.
 */
function extractDurationMinutes(normalizedText) {
  const patterns = DEFAULT_SIGNAL_LIBRARY.sessionTime.duration.patterns;

  // Pattern: "60 minutes" or "60 mins"
  const minPattern = /(\d+)\s*min(?:utes?)?/i;
  const minMatch = normalizedText.match(minPattern);
  if (minMatch) return parseInt(minMatch[1], 10);

  // Pattern: "1 hour" or "2 hours"
  const hrPattern = /(\d+)\s*(?:hr|hour)s?/i;
  const hrMatch = normalizedText.match(hrPattern);
  if (hrMatch) return parseInt(hrMatch[1], 10) * 60;

  // Pattern: "10:00 to 11:00" or "10:00 - 11:00"
  const timeRangePattern = /(\d{1,2}):(\d{2})\s*(?:am|pm)?\s*(?:to|-)\s*(\d{1,2}):(\d{2})\s*(?:am|pm)?/i;
  const timeMatch = normalizedText.match(timeRangePattern);
  if (timeMatch) {
    let startH = parseInt(timeMatch[1], 10);
    const startM = parseInt(timeMatch[2], 10);
    let endH = parseInt(timeMatch[3], 10);
    const endM = parseInt(timeMatch[4], 10);

    // Crude AM/PM handling: if end < start, assume PM for end
    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;
    if (endTotal < startTotal) endTotal += 12 * 60;

    return endTotal - startTotal;
  }

  return null;
}

/**
 * Get psychotherapy code based on duration.
 * Also supports crisis codes when crisis signals are present.
 */
function getPsychCodeFromDuration(minutes, hasCrisis) {
  if (minutes === null || minutes === undefined) return null;

  if (hasCrisis) {
    if (minutes >= 75) return { primary: "90839", addon: "90840", label: "Crisis Psychotherapy 75+ min" };
    if (minutes >= 30) return { primary: "90839", addon: null, label: "Crisis Psychotherapy 30-74 min" };
  }

  if (minutes >= 53) return { code: "90837", label: "Psychotherapy 60 min (53+ min)" };
  if (minutes >= 38) return { code: "90834", label: "Psychotherapy 45 min (38-52 min)" };
  if (minutes >= 16) return { code: "90832", label: "Psychotherapy 30 min (16-37 min)" };

  return null;
}

// ─────────────────────────────────────────────
// SIGNAL MATCHING
// ─────────────────────────────────────────────

/**
 * Match signals from the library against normalized text.
 * Returns an object grouped by category > subcategory with matched signals.
 */
function matchSignals(normalizedText, signalLibrary) {
  const lib = signalLibrary || DEFAULT_SIGNAL_LIBRARY;
  const result = {};
  const matchedSignalTexts = new Set(); // for dedup

  for (const [categoryKey, categoryValue] of Object.entries(lib)) {
    result[categoryKey] = {};

    for (const [subKey, subValue] of Object.entries(categoryValue)) {
      if (!subValue.signals) continue;

      const matched = [];
      for (const signal of subValue.signals) {
        // Skip if an equivalent signal was already matched (dedup for similar terms)
        const normalized_signal = signal.toLowerCase().trim();
        if (matchedSignalTexts.has(normalized_signal)) continue;

        if (fuzzyMatch(signal, normalizedText)) {
          matched.push(signal);
          matchedSignalTexts.add(normalized_signal);
          // Add variants to dedup set
          for (const v of generateVariants(normalized_signal)) {
            matchedSignalTexts.add(v);
          }
        }
      }

      result[categoryKey][subKey] = {
        label: subValue.label || subKey,
        matchedSignals: matched,
        count: matched.length
      };
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// CATEGORY SCORING
// ─────────────────────────────────────────────

/**
 * Given matched signals and a category path like "assessment.mentalHealth",
 * return the count of matched signals in that category.
 */
function getCategorySignalCount(matchedSignals, categoryPath) {
  const [cat, sub] = categoryPath.split(".");
  if (!matchedSignals[cat] || !matchedSignals[cat][sub]) return 0;
  return matchedSignals[cat][sub].count || 0;
}

/**
 * Check if any required category meets its minimum signal count.
 */
function checkRequiredCategories(matchedSignals, requiredCategories, codeRules) {
  const missing = [];
  for (const catPath of requiredCategories) {
    const count = getCategorySignalCount(matchedSignals, catPath);
    if (count === 0) missing.push(catPath);
  }
  return missing;
}

// ─────────────────────────────────────────────
// CONFIDENCE SCORE
// ─────────────────────────────────────────────

/**
 * Generate a confidence score (0-100) for a billing code.
 */
function calcConfidenceScore({
  primaryMatches,
  optionalMatches,
  requiredMet,
  durationMatch,
  codeRule,
  hasCrisis
}) {
  let score = 0;

  const minSignals = codeRule.minSignals || 1;

  // Primary category matches
  const primaryTotal = primaryMatches.reduce((a, b) => a + b, 0);
  if (primaryTotal >= minSignals) {
    score += 50;
  } else if (primaryTotal > 0) {
    score += Math.round((primaryTotal / minSignals) * 40);
  }

  // Optional category bonus
  const optionalTotal = optionalMatches.reduce((a, b) => a + b, 0);
  score += Math.min(optionalTotal * 5, 25);

  // Required categories met
  if (!requiredMet) score = Math.min(score, 20); // hard cap

  // Duration match (for time-based codes)
  if (codeRule.durationMin !== undefined) {
    if (durationMatch) score += 10;
    else score = Math.min(score, 30); // penalize missing duration
  }

  // Crisis bonus
  if (hasCrisis && (codeRule.requiredCategories || []).includes("crisis.intervention")) {
    score += 15;
  }

  return Math.min(Math.max(Math.round(score), 0), 100);
}

// ─────────────────────────────────────────────
// EXCLUSION / CONFLICT DETECTION
// ─────────────────────────────────────────────

/**
 * Detect active exclusion conditions from matched signals.
 */
function detectExclusions(matchedSignals, normalizedText) {
  const exclusions = [];

  const hasAssessment =
    getCategorySignalCount(matchedSignals, "assessment.mentalHealth") > 0 ||
    getCategorySignalCount(matchedSignals, "assessment.substanceUse") > 0 ||
    getCategorySignalCount(matchedSignals, "assessment.riskAssessment") > 0;

  const hasIntervention = getCategorySignalCount(matchedSignals, "treatmentPlanning.interventions") > 0;
  const hasScreening = getCategorySignalCount(matchedSignals, "screeningTools.completed") > 0;
  const hasPlanning = getCategorySignalCount(matchedSignals, "treatmentPlanning.goals") > 0;
  const hasSubstance = getCategorySignalCount(matchedSignals, "assessment.substanceUse") > 0;

  if (!hasAssessment && hasIntervention) exclusions.push("routineTherapyOnly");
  if (hasPlanning && !hasAssessment) exclusions.push("progressOnlyMentioned");
  if (!hasScreening) exclusions.push("noFormalScreeningTool");
  if (hasSubstance && getCategorySignalCount(matchedSignals, "assessment.substanceUse") < 2) {
    exclusions.push("substanceUseOnlyBrieflyMentioned");
  }

  return exclusions;
}

/**
 * Detect conflicting codes (e.g., two psychotherapy codes).
 */
function detectConflicts(suggestedCodes, codeRules) {
  const conflicts = [];
  for (const suggested of suggestedCodes) {
    const rule = codeRules[suggested.code];
    if (!rule || !rule.conflictsWith) continue;
    for (const conflictCode of rule.conflictsWith) {
      if (suggestedCodes.some(sc => sc.code === conflictCode)) {
        const existing = conflicts.find(
          c => (c.code1 === suggested.code && c.code2 === conflictCode) ||
               (c.code1 === conflictCode && c.code2 === suggested.code)
        );
        if (!existing) {
          conflicts.push({
            code1: suggested.code,
            code2: conflictCode,
            message: `${suggested.code} and ${conflictCode} cannot be billed together`
          });
        }
      }
    }
  }
  return conflicts;
}

// ─────────────────────────────────────────────
// CODE SCORING
// ─────────────────────────────────────────────

/**
 * Score all billing codes and return structured suggestions.
 */
function scoreCodes(matchedSignals, codeRules, durationMinutes, normalizedText) {
  const rules = codeRules || DEFAULT_CODE_RULES;
  const exclusions = detectExclusions(matchedSignals, normalizedText);
  const hasCrisis = getCategorySignalCount(matchedSignals, "crisis.intervention") > 0;

  const suggestedCodes = [];
  const missingElements = [];

  for (const [code, rule] of Object.entries(rules)) {
    // Skip time-based codes without duration info
    const isTimeBased = rule.durationMin !== undefined;

    // Check required categories
    const requiredMissing = checkRequiredCategories(matchedSignals, rule.requiredCategories || [], rules);
    const requiredMet = requiredMissing.length === 0;

    // Check exclusions
    const activeExclusions = (rule.exclusions || []).filter(ex => exclusions.includes(ex));
    const blocked = activeExclusions.length > 0;

    // Primary category match counts
    const primaryMatches = (rule.primaryCategories || []).map(cat =>
      getCategorySignalCount(matchedSignals, cat)
    );

    // Optional category match counts
    const optionalMatches = (rule.optionalCategories || []).map(cat =>
      getCategorySignalCount(matchedSignals, cat)
    );

    const primaryTotal = primaryMatches.reduce((a, b) => a + b, 0);

    // Duration check for time-based codes
    let durationMatch = false;
    if (isTimeBased && durationMinutes !== null) {
      durationMatch =
        durationMinutes >= rule.durationMin &&
        (rule.durationMax === null || durationMinutes <= rule.durationMax);
    }

    // Skip if no primary signals at all
    if (primaryTotal === 0 && !hasCrisis) continue;

    // Skip time-based if no duration AND no crisis
    if (isTimeBased && durationMinutes === null && !hasCrisis) continue;

    const confidence = blocked ? 0 : calcConfidenceScore({
      primaryMatches,
      optionalMatches,
      requiredMet,
      durationMatch: isTimeBased ? durationMatch : true,
      codeRule: rule,
      hasCrisis
    });

    const explanation = buildExplanation(code, rule, primaryMatches, optionalMatches, requiredMissing, activeExclusions, durationMinutes, durationMatch);
    const status = blocked ? "excluded" : confidence >= 60 ? "suggest" : confidence >= 30 ? "borderline" : "weak";

    if (confidence > 0 || status === "excluded") {
      suggestedCodes.push({
        code,
        label: rule.label,
        description: rule.description,
        confidence,
        status,
        blocked,
        exclusionReasons: activeExclusions,
        primaryCategoryMatches: primaryTotal,
        optionalCategoryMatches: optionalMatches.reduce((a, b) => a + b, 0),
        requiredMissing,
        explanation,
        notes: rule.notes || ""
      });
    }

    // Collect missing elements for high-value codes
    if (!blocked && confidence < 60 && requiredMissing.length > 0) {
      requiredMissing.forEach(rm => {
        missingElements.push({
          code,
          missing: rm,
          message: `${code}: Missing documentation for "${rm.replace(".", " › ")}"`
        });
      });
    }
  }

  // Sort by confidence descending
  suggestedCodes.sort((a, b) => b.confidence - a.confidence);

  return { suggestedCodes, missingElements, exclusions };
}

/**
 * Build human-readable explanation for a code suggestion.
 */
function buildExplanation(code, rule, primaryMatches, optionalMatches, requiredMissing, activeExclusions, durationMinutes, durationMatch) {
  if (activeExclusions.length > 0) {
    return `${code} excluded: ${activeExclusions.join(", ")}. ${rule.notes || ""}`;
  }

  const primaryTotal = primaryMatches.reduce((a, b) => a + b, 0);
  const optionalTotal = optionalMatches.reduce((a, b) => a + b, 0);

  let parts = [];

  if (primaryTotal >= (rule.minSignals || 1)) {
    parts.push(`${primaryTotal} primary signal(s) matched`);
  } else {
    parts.push(`Only ${primaryTotal} of ${rule.minSignals || 1} required primary signal(s) found`);
  }

  if (optionalTotal > 0) parts.push(`${optionalTotal} supporting signal(s) found`);
  if (requiredMissing.length > 0) parts.push(`Missing required: ${requiredMissing.join(", ")}`);

  if (rule.durationMin !== undefined) {
    if (durationMinutes !== null) {
      parts.push(durationMatch
        ? `Session duration (${durationMinutes} min) meets ${rule.durationMin}-${rule.durationMax || "∞"} min range`
        : `Session duration (${durationMinutes} min) does NOT meet ${rule.durationMin}-${rule.durationMax || "∞"} min range`
      );
    } else {
      parts.push("Session duration not found in note");
    }
  }

  return `${code} (${rule.label}): ${parts.join("; ")}.`;
}

// ─────────────────────────────────────────────
// ADDENDUM SUGGESTIONS
// ─────────────────────────────────────────────

/**
 * Generate addendum suggestions based on missing documentation.
 */
function generateAddendumSuggestions(suggestedCodes, matchedSignals, durationMinutes) {
  const suggestions = [];

  for (const sc of suggestedCodes) {
    if (sc.status === "borderline" || sc.confidence >= 30 && sc.confidence < 60) {
      if (sc.requiredMissing.length > 0) {
        suggestions.push({
          code: sc.code,
          label: sc.label,
          type: "missing_required",
          suggestion: `To support billing ${sc.code}, add documentation for: ${sc.requiredMissing.map(r => r.replace(".", " › ")).join(", ")}.`
        });
      }
    }

    if (sc.code.startsWith("9083") || sc.code === "90839") {
      if (durationMinutes === null) {
        suggestions.push({
          code: sc.code,
          label: sc.label,
          type: "missing_duration",
          suggestion: `Add session start and end time (or total minutes) to support time-based code ${sc.code}.`
        });
      }
    }

    if (sc.code === "H0002" && getCategorySignalCount(matchedSignals, "screeningTools.completed") === 0) {
      suggestions.push({
        code: "H0002",
        label: "Behavioral Health Screening",
        type: "missing_screening",
        suggestion: "Document the name of the validated screening tool used, score obtained, interpretation, and how results affected treatment decisions."
      });
    }

    if (sc.code === "T1017" && getCategorySignalCount(matchedSignals, "careCoordination.coordination") === 0) {
      suggestions.push({
        code: "T1017",
        label: "Case Management",
        type: "missing_coordination",
        suggestion: "Document coordination activities: which providers were contacted, what information was shared, and how this supports treatment."
      });
    }
  }

  // General clinical completeness suggestions
  if (getCategorySignalCount(matchedSignals, "assessment.riskAssessment") === 0) {
    suggestions.push({
      code: null,
      label: "Risk Assessment",
      type: "clinical_quality",
      suggestion: "Consider adding a brief risk assessment documenting SI/HI status, protective factors, and risk level."
    });
  }

  if (getCategorySignalCount(matchedSignals, "progress.response") === 0) {
    suggestions.push({
      code: null,
      label: "Treatment Response",
      type: "clinical_quality",
      suggestion: "Add documentation of client's response to interventions and progress toward treatment goals."
    });
  }

  return suggestions;
}

// ─────────────────────────────────────────────
// TREATMENT PLAN THEME DETECTION
// ─────────────────────────────────────────────

/**
 * Detect recurring treatment plan themes in note text.
 */
function detectTreatmentPlanThemes(normalizedText, themes) {
  const themeList = themes || DEFAULT_LONGITUDINAL_RULES.treatmentPlanThemes;
  const detected = [];

  for (const theme of themeList) {
    if (fuzzyMatch(theme, normalizedText)) {
      detected.push(theme);
    }
  }

  return detected;
}

/**
 * Generate treatment plan suggestions from detected themes.
 */
function generateTreatmentPlanSuggestions(detectedThemes) {
  const themeMap = {
    "anxiety": {
      goal: "Client will reduce anxiety symptoms to a manageable level",
      objective: "Client will identify 3 anxiety triggers and practice 2 coping strategies weekly",
      intervention: "CBT techniques for anxiety management, including thought challenging and relaxation training",
      frequency: "Weekly individual therapy sessions"
    },
    "depression": {
      goal: "Client will reduce depressive symptoms and improve daily functioning",
      objective: "Client will engage in behavioral activation activities at least 3 times per week",
      intervention: "Behavioral activation, cognitive restructuring, and psychoeducation about depression",
      frequency: "Weekly individual therapy sessions"
    },
    "trauma": {
      goal: "Client will process trauma and reduce PTSD symptoms",
      objective: "Client will utilize grounding techniques when experiencing trauma symptoms",
      intervention: "Trauma-focused CBT or EMDR; psychoeducation about trauma responses",
      frequency: "Weekly individual therapy sessions"
    },
    "ptsd": {
      goal: "Client will reduce PTSD symptom severity and improve daily functioning",
      objective: "Client will practice grounding techniques and utilize safety plan when triggered",
      intervention: "Evidence-based trauma therapy (TF-CBT, CPT, or EMDR) and distress tolerance skills",
      frequency: "Weekly individual therapy sessions"
    },
    "substance use": {
      goal: "Client will achieve and maintain sobriety/reduced harm from substance use",
      objective: "Client will identify high-risk situations and use relapse prevention strategies",
      intervention: "Motivational interviewing, relapse prevention planning, and connection to recovery supports",
      frequency: "Weekly individual or group therapy sessions"
    },
    "relapse prevention": {
      goal: "Client will maintain recovery and prevent relapse",
      objective: "Client will develop and implement a personalized relapse prevention plan",
      intervention: "Relapse prevention planning, trigger identification, and coping skills development",
      frequency: "Weekly individual sessions"
    },
    "coping skills": {
      goal: "Client will develop and utilize effective coping strategies",
      objective: "Client will practice and demonstrate 3 new coping skills between sessions",
      intervention: "Skills training in distress tolerance, emotional regulation, and mindfulness",
      frequency: "Weekly individual therapy"
    },
    "emotional regulation": {
      goal: "Client will improve ability to identify and regulate emotional responses",
      objective: "Client will utilize DBT emotional regulation skills at least 3x per week",
      intervention: "DBT skills training: emotional regulation module; mindfulness practice",
      frequency: "Weekly individual and/or group DBT sessions"
    },
    "relationship issues": {
      goal: "Client will improve interpersonal functioning and relationship quality",
      objective: "Client will identify and practice 2 improved communication strategies",
      intervention: "Interpersonal effectiveness skills (DBT), communication training, and boundary work",
      frequency: "Weekly individual therapy sessions"
    },
    "anger management": {
      goal: "Client will reduce frequency and intensity of aggressive responses",
      objective: "Client will utilize de-escalation techniques before reaching crisis threshold",
      intervention: "Anger management skills, cognitive restructuring, and relaxation techniques",
      frequency: "Weekly individual therapy sessions"
    },
    "self esteem": {
      goal: "Client will develop a more positive and realistic self-concept",
      objective: "Client will identify and challenge negative self-talk patterns weekly",
      intervention: "CBT for core beliefs, strengths-based work, and positive self-talk development",
      frequency: "Weekly individual therapy sessions"
    },
    "suicidality": {
      goal: "Client will remain safe and develop means to manage suicidal crises",
      objective: "Client will review and update safety plan at each session",
      intervention: "Safety planning, means restriction counseling, and crisis coping skills",
      frequency: "Weekly or more frequent individual therapy sessions"
    },
    "medication adherence": {
      goal: "Client will consistently take medications as prescribed",
      objective: "Client will report medication adherence and side effects at each session",
      intervention: "Psychoeducation about medications, problem-solving barriers to adherence",
      frequency: "Weekly individual therapy sessions; monthly coordination with prescriber"
    },
    "parenting": {
      goal: "Client will improve parenting skills and reduce conflict in the home",
      objective: "Client will implement 2 new positive parenting strategies weekly",
      intervention: "Parent training, psychoeducation about child development, and family communication skills",
      frequency: "Weekly individual or family therapy sessions"
    },
    "sleep": {
      goal: "Client will improve sleep quality and establish healthy sleep patterns",
      objective: "Client will implement sleep hygiene strategies and track sleep log weekly",
      intervention: "CBT for insomnia (CBT-I), sleep hygiene psychoeducation",
      frequency: "Weekly individual therapy sessions"
    }
  };

  const suggestions = [];
  for (const theme of detectedThemes) {
    const map = themeMap[theme];
    if (map) {
      suggestions.push({ theme, ...map });
    } else {
      suggestions.push({
        theme,
        goal: `Address ${theme} as identified treatment focus`,
        objective: `Client will demonstrate measurable progress in managing ${theme}`,
        intervention: `Evidence-based interventions targeting ${theme}`,
        frequency: "Weekly individual therapy sessions"
      });
    }
  }

  return suggestions;
}

// ─────────────────────────────────────────────
// LONGITUDINAL REVIEW
// ─────────────────────────────────────────────

/**
 * Compare current note against prior session history.
 * Returns longitudinal alerts.
 */
function reviewLongitudinal(currentNote, previousSessionHistory, longitudinalRules) {
  const rules = longitudinalRules || DEFAULT_LONGITUDINAL_RULES;
  const alerts = [];

  if (!previousSessionHistory || previousSessionHistory.length === 0) {
    return alerts;
  }

  const now = new Date();

  // ── Missed code opportunities ──
  for (const [code, rule] of Object.entries(rules.codeOpportunities)) {
    const lastSession = previousSessionHistory
      .filter(s => (s.codes || []).includes(code))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!lastSession && rule.minGapDays > 0) {
      alerts.push({
        type: "missed_opportunity",
        code,
        label: rule.label,
        message: `${code} (${rule.label}) has not been billed in recent history. Review if eligible this session.`
      });
    } else if (lastSession && rule.minGapDays > 0) {
      const daysSince = Math.floor((now - new Date(lastSession.date)) / (1000 * 60 * 60 * 24));
      if (daysSince >= rule.minGapDays) {
        alerts.push({
          type: "code_opportunity",
          code,
          label: rule.label,
          daysSinceLastBilled: daysSince,
          message: `${code} (${rule.label}) last billed ${daysSince} days ago. May be eligible this session.`
        });
      }
    }
  }

  // ── Code overuse detection ──
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  for (const [code, threshold] of Object.entries(rules.overuseThresholds)) {
    const recentCount = previousSessionHistory.filter(s => {
      return new Date(s.date) >= thirtyDaysAgo && (s.codes || []).includes(code);
    }).length;

    if (recentCount >= threshold.maxPerMonth) {
      alerts.push({
        type: "overuse_warning",
        code,
        count: recentCount,
        message: `${code} has been billed ${recentCount} times in the last 30 days. Review documentation for each session to ensure billing is supported.`
      });
    } else if (recentCount >= threshold.warningThreshold) {
      alerts.push({
        type: "overuse_watch",
        code,
        count: recentCount,
        message: `${code} has been billed ${recentCount} times in the last 30 days. Approaching potential overuse threshold.`
      });
    }
  }

  // ── Repeated themes ──
  const currentNoteText = (currentNote.normalized || "").toLowerCase();
  const repeatThemes = [];

  for (const session of previousSessionHistory.slice(0, 5)) {
    const sessionText = (session.normalizedText || session.noteText || "").toLowerCase();
    const currentThemes = detectTreatmentPlanThemes(currentNoteText);
    const sessionThemes = detectTreatmentPlanThemes(sessionText);
    const repeated = currentThemes.filter(t => sessionThemes.includes(t));
    repeatThemes.push(...repeated);
  }

  const uniqueRepeated = [...new Set(repeatThemes)];
  if (uniqueRepeated.length > 0) {
    alerts.push({
      type: "repeated_themes",
      themes: uniqueRepeated,
      message: `Recurring themes detected across sessions: ${uniqueRepeated.join(", ")}. Consider updating treatment plan goals to address these themes.`
    });
  }

  // ── Treatment plan staleness ──
  const lastTreatmentPlan = previousSessionHistory
    .filter(s => (s.codes || []).includes("H0032"))
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  if (!lastTreatmentPlan) {
    alerts.push({
      type: "treatment_plan_missing",
      message: "No treatment plan review (H0032) found in recent history. Consider reviewing or updating the treatment plan this session."
    });
  } else {
    const daysSincePlan = Math.floor((now - new Date(lastTreatmentPlan.date)) / (1000 * 60 * 60 * 24));
    if (daysSincePlan > 90) {
      alerts.push({
        type: "treatment_plan_stale",
        daysSinceLastReview: daysSincePlan,
        message: `Treatment plan last reviewed ${daysSincePlan} days ago. Colorado Medicaid requires review at least every 90 days.`
      });
    }
  }

  // ── Assessment staleness ──
  const lastAssessment = previousSessionHistory
    .filter(s => (s.codes || []).includes("H0031") || (s.codes || []).includes("H0001"))
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  if (lastAssessment) {
    const daysSinceAssessment = Math.floor((now - new Date(lastAssessment.date)) / (1000 * 60 * 60 * 24));
    if (daysSinceAssessment > 180) {
      alerts.push({
        type: "reassessment_due",
        daysSinceLastAssessment: daysSinceAssessment,
        message: `Last formal assessment was ${daysSinceAssessment} days ago. Consider a reassessment to review diagnostic status and functioning.`
      });
    }
  }

  return alerts;
}

// ─────────────────────────────────────────────
// MAIN PARSER FUNCTION
// ─────────────────────────────────────────────

/**
 * Main entry point for the signal parser and scoring engine.
 *
 * @param {string} rawNoteText - Raw clinical note text
 * @param {object} [signalLibrary] - Optional override for signal library
 * @param {object} [codeRules] - Optional override for code rules
 * @param {object} [longitudinalRules] - Optional override for longitudinal rules
 * @param {Array}  [previousSessionHistory] - Array of prior session objects
 *   Each session: { date: "YYYY-MM-DD", codes: ["H0031", ...], noteText: "...", normalizedText: "..." }
 *
 * @returns {object} Structured output
 */
function parseNote(rawNoteText, signalLibrary, codeRules, longitudinalRules, previousSessionHistory) {
  // Step 1: Normalize text
  const { normalized, sentences } = normalizeText(rawNoteText);

  // Step 2: Match signals
  const matchedSignals = matchSignals(normalized, signalLibrary);

  // Step 3: Extract duration
  const durationMinutes = extractDurationMinutes(normalized);
  const hasCrisis = getCategorySignalCount(matchedSignals, "crisis.intervention") > 0;

  // Step 4: Score codes
  const { suggestedCodes, missingElements, exclusions } = scoreCodes(
    matchedSignals,
    codeRules || DEFAULT_CODE_RULES,
    durationMinutes,
    normalized
  );

  // Step 5: Add psychotherapy code from duration
  const psychCode = getPsychCodeFromDuration(durationMinutes, hasCrisis);
  if (psychCode) {
    const existingPsych = suggestedCodes.find(sc =>
      sc.code === psychCode.code || sc.code === psychCode.primary
    );
    if (!existingPsych) {
      const pCode = psychCode.code || psychCode.primary;
      const rule = (codeRules || DEFAULT_CODE_RULES)[pCode];
      if (rule) {
        suggestedCodes.unshift({
          code: pCode,
          label: rule.label,
          description: rule.description,
          confidence: durationMinutes ? 85 : 40,
          status: "suggest",
          blocked: false,
          exclusionReasons: [],
          primaryCategoryMatches: getCategorySignalCount(matchedSignals, "treatmentPlanning.interventions"),
          optionalCategoryMatches: 0,
          requiredMissing: [],
          explanation: psychCode.label + (durationMinutes ? ` — ${durationMinutes} minutes documented.` : ""),
          notes: rule.notes || ""
        });
      }

      // Add 90840 add-on if applicable
      if (psychCode.addon === "90840") {
        const addonRule = (codeRules || DEFAULT_CODE_RULES)["90840"];
        if (addonRule) {
          suggestedCodes.unshift({
            code: "90840",
            label: addonRule.label,
            description: addonRule.description,
            confidence: 75,
            status: "suggest",
            blocked: false,
            exclusionReasons: [],
            primaryCategoryMatches: 1,
            optionalCategoryMatches: 0,
            requiredMissing: [],
            explanation: `90840 add-on: session exceeds 74 minutes (${durationMinutes} min documented).`,
            notes: addonRule.notes || ""
          });
        }
      }
    }
  }

  // Step 6: Detect conflicts
  const conflicts = detectConflicts(suggestedCodes, codeRules || DEFAULT_CODE_RULES);

  // Step 7: Addendum suggestions
  const addendumSuggestions = generateAddendumSuggestions(suggestedCodes, matchedSignals, durationMinutes);

  // Step 8: Treatment plan suggestions
  const currentThemes = detectTreatmentPlanThemes(normalized);
  const treatmentPlanSuggestions = generateTreatmentPlanSuggestions(currentThemes);

  // Step 9: Longitudinal review
  const longitudinalAlerts = reviewLongitudinal(
    { normalized, noteText: rawNoteText },
    previousSessionHistory || [],
    longitudinalRules
  );

  return {
    matchedSignals,
    suggestedCodes,
    missingElements,
    conflicts,
    activeExclusions: exclusions,
    durationMinutes,
    detectedThemes: currentThemes,
    addendumSuggestions,
    treatmentPlanSuggestions,
    longitudinalAlerts,
    meta: {
      sentenceCount: sentences.length,
      totalSignalsMatched: Object.values(matchedSignals).reduce((total, cat) =>
        total + Object.values(cat).reduce((t2, sub) => t2 + (sub.count || 0), 0), 0
      ),
      normalizedLength: normalized.length
    }
  };
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

// ES Module + CommonJS / browser global support
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseNote,
    normalizeText,
    matchSignals,
    scoreCodes,
    detectExclusions,
    detectConflicts,
    calcConfidenceScore,
    fuzzyMatch,
    generateVariants,
    extractDurationMinutes,
    getPsychCodeFromDuration,
    detectTreatmentPlanThemes,
    generateTreatmentPlanSuggestions,
    generateAddendumSuggestions,
    reviewLongitudinal,
    buildExplanation,
    getCategorySignalCount,
    DEFAULT_SIGNAL_LIBRARY,
    DEFAULT_CODE_RULES,
    DEFAULT_LONGITUDINAL_RULES
  };
} else if (typeof window !== "undefined") {
  window.SignalParser = {
    parseNote,
    normalizeText,
    matchSignals,
    scoreCodes,
    detectExclusions,
    detectConflicts,
    calcConfidenceScore,
    fuzzyMatch,
    generateVariants,
    extractDurationMinutes,
    getPsychCodeFromDuration,
    detectTreatmentPlanThemes,
    generateTreatmentPlanSuggestions,
    generateAddendumSuggestions,
    reviewLongitudinal,
    buildExplanation,
    getCategorySignalCount,
    DEFAULT_SIGNAL_LIBRARY,
    DEFAULT_CODE_RULES,
    DEFAULT_LONGITUDINAL_RULES
  };
}
