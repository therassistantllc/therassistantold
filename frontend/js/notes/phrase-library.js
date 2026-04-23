/**
 * THERASSISTANT Reusable Phrase Library
 * Commands 6-8: Categories, Smart Phrases with *** placeholders, Save/Share
 */

// ─────────────────────────────────────────────
// PHRASE CATEGORIES & BUILT-IN LIBRARY
// ─────────────────────────────────────────────

const PHRASE_CATEGORIES = [
  { id: "subjective",       label: "Subjective / Presenting Symptoms" },
  { id: "progress",         label: "Progress Toward Goals" },
  { id: "interventions",    label: "Interventions" },
  { id: "risk",             label: "Risk Assessment" },
  { id: "mse",              label: "Mental Status" },
  { id: "treatment_plan",   label: "Treatment Planning" },
  { id: "care_coordination",label: "Care Coordination" },
  { id: "substance_use",    label: "Substance Use" },
  { id: "crisis",           label: "Crisis Intervention" },
  { id: "discharge",        label: "Discharge Planning" }
];

const BUILT_IN_PHRASES = [
  // ── Subjective ──
  {
    id: "subj_001", category: "subjective", label: "Presenting concern – general",
    text: "Client reported *** symptoms related to ***. Symptoms have been present for *** and continue to impact ***.",
    placeholders: 4
  },
  {
    id: "subj_002", category: "subjective", label: "Mood and energy",
    text: "Client described mood as *** with *** energy level. Sleep has been *** and appetite has been ***.",
    placeholders: 4
  },
  {
    id: "subj_003", category: "subjective", label: "Anxiety presentation",
    text: "Client reported experiencing *** anxiety, including *** symptoms. Triggers identified include ***. Client rates anxiety at *** out of 10.",
    placeholders: 4
  },
  {
    id: "subj_004", category: "subjective", label: "Depression presentation",
    text: "Client reported persistent *** mood over the past ***. Endorsed *** with limited motivation to engage in ***.",
    placeholders: 4
  },
  {
    id: "subj_005", category: "subjective", label: "PTSD / trauma symptoms",
    text: "Client reported *** trauma-related symptoms including *** flashbacks and *** hypervigilance. Triggers included ***.",
    placeholders: 4
  },
  {
    id: "subj_006", category: "subjective", label: "Change in symptoms",
    text: "Client reported *** in symptoms since the last session. Specifically, *** has improved, while *** continues to be a challenge.",
    placeholders: 3
  },
  {
    id: "subj_007", category: "subjective", label: "Significant life event",
    text: "Client disclosed a significant life event: ***. This has impacted *** and contributes to current presentation.",
    placeholders: 2
  },

  // ── Progress ──
  {
    id: "prog_001", category: "progress", label: "Progress toward goal – positive",
    text: "Client demonstrated *** progress toward goal of ***. Client was able to *** since the last session.",
    placeholders: 3
  },
  {
    id: "prog_002", category: "progress", label: "Limited progress",
    text: "Client made limited progress toward *** this session due to ***. Plan is to ***.",
    placeholders: 3
  },
  {
    id: "prog_003", category: "progress", label: "Goal met",
    text: "Client successfully achieved *** goal. *** was demonstrated consistently over the past ***.",
    placeholders: 3
  },
  {
    id: "prog_004", category: "progress", label: "Barrier to progress",
    text: "Client identified *** as a barrier to progress toward ***. Clinician and client discussed *** as strategies to address this barrier.",
    placeholders: 3
  },
  {
    id: "prog_005", category: "progress", label: "Client engagement",
    text: "Client was *** engaged in session. Client *** participated in *** activities and was *** responsive to intervention.",
    placeholders: 4
  },

  // ── Interventions ──
  {
    id: "int_001", category: "interventions", label: "CBT intervention",
    text: "Clinician utilized cognitive behavioral techniques to address ***. Client identified *** automatic thoughts and practiced *** cognitive restructuring strategies.",
    placeholders: 3
  },
  {
    id: "int_002", category: "interventions", label: "DBT skill – general",
    text: "Clinician reviewed *** DBT skill with client from the *** module. Client practiced *** and reported ***.",
    placeholders: 4
  },
  {
    id: "int_003", category: "interventions", label: "Motivational interviewing",
    text: "Clinician used motivational interviewing techniques to explore *** ambivalence. Client expressed *** about change and identified *** as motivation for change.",
    placeholders: 3
  },
  {
    id: "int_004", category: "interventions", label: "Psychoeducation",
    text: "Clinician provided psychoeducation on *** including ***. Client demonstrated *** understanding and asked ***.",
    placeholders: 4
  },
  {
    id: "int_005", category: "interventions", label: "Mindfulness/grounding",
    text: "Clinician guided client through *** mindfulness/grounding exercise. Client reported *** distress level before and *** after the exercise.",
    placeholders: 3
  },
  {
    id: "int_006", category: "interventions", label: "Coping skills training",
    text: "Clinician taught *** coping skill to address ***. Client practiced the skill in session and reported *** confidence in using it independently.",
    placeholders: 3
  },
  {
    id: "int_007", category: "interventions", label: "Relapse prevention",
    text: "Clinician and client reviewed relapse prevention planning for ***. High-risk situations identified include ***. Client committed to using *** as a coping strategy.",
    placeholders: 3
  },
  {
    id: "int_008", category: "interventions", label: "Crisis intervention",
    text: "Crisis intervention was provided in response to ***. Clinician assessed *** risk level and collaborated with client on *** plan to address immediate safety.",
    placeholders: 3
  },

  // ── Risk Assessment ──
  {
    id: "risk_001", category: "risk", label: "No safety concerns",
    text: "Risk assessment completed. Client denied SI, HI, and intent to harm self or others. No safety concerns identified at this time. Protective factors include ***.",
    placeholders: 1
  },
  {
    id: "risk_002", category: "risk", label: "Passive SI no plan",
    text: "Client reported passive suicidal ideation without plan or intent. Client denies access to lethal means. Protective factors include ***. Safety plan reviewed and remains in place.",
    placeholders: 1
  },
  {
    id: "risk_003", category: "risk", label: "Active SI with plan",
    text: "Client reported active suicidal ideation with ***. Clinician assessed *** risk level. Safety plan was *** and *** action was taken including ***.",
    placeholders: 5
  },
  {
    id: "risk_004", category: "risk", label: "Safety plan reviewed",
    text: "Safety plan reviewed with client. Plan includes *** warning signs, *** coping strategies, and *** crisis contacts. Client verbalized understanding and agreement.",
    placeholders: 3
  },
  {
    id: "risk_005", category: "risk", label: "Self-harm",
    text: "Client disclosed *** self-harm behavior involving ***. Last occurrence was ***. Clinician assessed risk level as *** and *** intervention was provided.",
    placeholders: 5
  },

  // ── MSE ──
  {
    id: "mse_001", category: "mse", label: "WNL mental status",
    text: "Mental status exam: Client appeared *** groomed and dressed appropriately. Mood reported as *** with *** affect. Thought process was logical and linear. Oriented x4. Insight and judgment ***.",
    placeholders: 4
  },
  {
    id: "mse_002", category: "mse", label: "MSE with concerns",
    text: "Mental status exam: Appearance ***. Mood described as *** with *** affect. Thought process was ***. Memory and concentration appeared ***. Insight was ***.",
    placeholders: 6
  },
  {
    id: "mse_003", category: "mse", label: "Psychosis-related MSE",
    text: "Mental status: Appeared *** with *** hygiene. Mood ***. Thought process evidenced *** with content including ***. Perceptual disturbances ***.",
    placeholders: 5
  },

  // ── Treatment Planning ──
  {
    id: "tp_001", category: "treatment_plan", label: "Goal review",
    text: "Treatment goals reviewed with client. Goal of *** is ***. Client identified *** as the next step toward this goal.",
    placeholders: 3
  },
  {
    id: "tp_002", category: "treatment_plan", label: "Goal update",
    text: "Treatment goal updated to reflect ***. New objective: ***. Intervention modified to include ***.",
    placeholders: 3
  },
  {
    id: "tp_003", category: "treatment_plan", label: "New treatment focus",
    text: "Client and clinician agreed to add *** as a new treatment focus. This is supported by *** and aligns with client's stated goal of ***.",
    placeholders: 3
  },
  {
    id: "tp_004", category: "treatment_plan", label: "Frequency change",
    text: "Treatment frequency adjusted to *** based on ***. Next appointment scheduled for ***.",
    placeholders: 3
  },
  {
    id: "tp_005", category: "treatment_plan", label: "Barriers to treatment",
    text: "Client identified *** as barriers to treatment progress. Clinician and client collaborated on *** to address these barriers.",
    placeholders: 2
  },

  // ── Care Coordination ──
  {
    id: "cc_001", category: "care_coordination", label: "Provider contact",
    text: "Clinician coordinated with *** regarding ***. Information shared included *** with appropriate release of information on file.",
    placeholders: 3
  },
  {
    id: "cc_002", category: "care_coordination", label: "Referral made",
    text: "Referral placed to *** for *** services. Client was provided with *** contact information and agreed to follow through.",
    placeholders: 3
  },
  {
    id: "cc_003", category: "care_coordination", label: "Community resource linkage",
    text: "Client linked to *** community resource for assistance with ***. Client demonstrated *** understanding of how to access the service.",
    placeholders: 3
  },
  {
    id: "cc_004", category: "care_coordination", label: "Case management activity",
    text: "Case management activities completed this session included ***. Outcome: ***. Follow-up needed: ***.",
    placeholders: 3
  },

  // ── Substance Use ──
  {
    id: "su_001", category: "substance_use", label: "Substance use review",
    text: "Substance use reviewed. Client reported using *** at a frequency of *** with last use ***. Client *** cravings and *** withdrawal symptoms.",
    placeholders: 5
  },
  {
    id: "su_002", category: "substance_use", label: "Sobriety/recovery",
    text: "Client reported *** days of sobriety from ***. Client is attending *** meetings and *** using support network.",
    placeholders: 4
  },
  {
    id: "su_003", category: "substance_use", label: "Relapse",
    text: "Client reported relapse involving *** use on ***. Triggers identified include ***. Relapse prevention plan reviewed and *** was updated.",
    placeholders: 4
  },
  {
    id: "su_004", category: "substance_use", label: "MAT review",
    text: "Medication-assisted treatment reviewed. Client is taking *** as prescribed with *** compliance. Side effects reported: ***. Coordination with prescriber: ***.",
    placeholders: 4
  },

  // ── Crisis ──
  {
    id: "cr_001", category: "crisis", label: "Crisis intervention",
    text: "Crisis intervention provided in response to ***. Risk level assessed as ***. De-escalation techniques included ***. Outcome: *** and follow-up plan: ***.",
    placeholders: 5
  },
  {
    id: "cr_002", category: "crisis", label: "Hospital/emergency contact",
    text: "Client was *** transported to *** for psychiatric evaluation. Clinician contacted *** and provided *** information. Follow-up appointment scheduled for ***.",
    placeholders: 5
  },
  {
    id: "cr_003", category: "crisis", label: "Crisis stabilized",
    text: "Crisis resolved by end of session. Client *** and agreed to ***. Safety plan reviewed and *** confirmed. Next appointment: ***.",
    placeholders: 4
  },

  // ── Discharge ──
  {
    id: "dc_001", category: "discharge", label: "Discharge planning initiated",
    text: "Discharge planning discussed with client. Client identified *** as criteria for discharge readiness. Anticipated discharge timeframe: ***. Aftercare plan includes ***.",
    placeholders: 3
  },
  {
    id: "dc_002", category: "discharge", label: "Transition to lower level of care",
    text: "Client transitioning to *** level of care based on ***. Referral placed to *** and client was provided with transition support including ***.",
    placeholders: 4
  }
];

// ─────────────────────────────────────────────
// PLACEHOLDER LOGIC (Smart Phrases with ***)
// ─────────────────────────────────────────────

const PLACEHOLDER_MARKER = "***";

/**
 * Returns array of placeholder positions in the phrase text.
 * Each item: { index, position, contextBefore, contextAfter }
 */
function getPlaceholderPositions(phraseText) {
  const positions = [];
  let searchFrom = 0;
  let idx = 0;

  while (true) {
    const pos = phraseText.indexOf(PLACEHOLDER_MARKER, searchFrom);
    if (pos === -1) break;

    const contextBefore = phraseText.slice(Math.max(0, pos - 30), pos).trim();
    const contextAfter = phraseText.slice(pos + PLACEHOLDER_MARKER.length, pos + PLACEHOLDER_MARKER.length + 30).trim();

    positions.push({
      index: idx++,
      position: pos,
      contextBefore,
      contextAfter
    });
    searchFrom = pos + PLACEHOLDER_MARKER.length;
  }

  return positions;
}

/**
 * Fill placeholders in a phrase with provided values.
 * values: array of strings. Unfilled placeholders remain as "___".
 */
function fillPlaceholders(phraseText, values) {
  let result = phraseText;
  let valueIdx = 0;

  result = result.replace(/\*\*\*/g, () => {
    const val = (values && values[valueIdx] !== undefined && values[valueIdx] !== "")
      ? values[valueIdx]
      : "___";
    valueIdx++;
    return val;
  });

  return result;
}

/**
 * Count the number of unfilled placeholders remaining.
 */
function countUnfilledPlaceholders(filledText) {
  return (filledText.match(/___/g) || []).length;
}

/**
 * Validate that all placeholders in a phrase are filled.
 */
function validatePhraseComplete(filledText) {
  const unfilled = countUnfilledPlaceholders(filledText);
  return {
    complete: unfilled === 0,
    unfilledCount: unfilled,
    message: unfilled > 0 ? `${unfilled} placeholder(s) still need to be filled.` : null
  };
}

// ─────────────────────────────────────────────
// PHRASE MANAGEMENT (Commands 7-8)
// ─────────────────────────────────────────────

/**
 * In-memory user phrase store.
 * In production this would be backed by Supabase (reusable_phrases table).
 */
let _userPhrases = [];

/**
 * Get all available phrases for a given context.
 * Merges built-in + user phrases, optionally filtered by category.
 */
function getPhrases({ category, visibility, role, orgId } = {}) {
  const allPhrases = [
    ...BUILT_IN_PHRASES.map(p => ({ ...p, source: "system" })),
    ..._userPhrases.map(p => ({ ...p, source: "user" }))
  ];

  return allPhrases.filter(p => {
    if (category && p.category !== category) return false;
    if (visibility === "private" && p.source !== "user") return false;
    if (p.visibility === "private" && p.source === "user") {
      // Only show private phrases to the creator
      // In production: filter by created_by === currentUserId
      return true;
    }
    if (p.visibility === "role_shared" && p.allowedRoles && role) {
      return p.allowedRoles.includes(role);
    }
    return true;
  });
}

/**
 * Search phrases by keyword.
 */
function searchPhrases(query, { category } = {}) {
  const q = query.toLowerCase().trim();
  return getPhrases({ category }).filter(p =>
    p.label.toLowerCase().includes(q) ||
    p.text.toLowerCase().includes(q) ||
    (p.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

/**
 * Save a new user phrase.
 * @param {object} phraseData
 */
function saveUserPhrase({
  label,
  text,
  category,
  visibility = "private",
  allowedRoles = [],
  tags = [],
  createdBy
}) {
  if (!label || !text || !category) throw new Error("label, text, and category are required");
  if (!PHRASE_CATEGORIES.some(c => c.id === category)) throw new Error(`Unknown category: ${category}`);
  if (!["private", "org_shared", "role_shared"].includes(visibility)) throw new Error("Invalid visibility value");

  const phrase = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label,
    text,
    category,
    visibility,
    allowedRoles,
    tags,
    createdBy,
    placeholders: (text.match(/\*\*\*/g) || []).length,
    createdAt: new Date().toISOString(),
    useCount: 0
  };

  _userPhrases.push(phrase);
  return phrase;
}

/**
 * Update an existing user phrase.
 */
function updateUserPhrase(phraseId, updates) {
  const idx = _userPhrases.findIndex(p => p.id === phraseId);
  if (idx === -1) throw new Error(`Phrase not found: ${phraseId}`);
  _userPhrases[idx] = { ..._userPhrases[idx], ...updates, updatedAt: new Date().toISOString() };
  return _userPhrases[idx];
}

/**
 * Delete a user phrase.
 */
function deleteUserPhrase(phraseId) {
  const idx = _userPhrases.findIndex(p => p.id === phraseId);
  if (idx === -1) throw new Error(`Phrase not found: ${phraseId}`);
  _userPhrases.splice(idx, 1);
  return true;
}

/**
 * Increment use count for a phrase (call when inserted into note).
 */
function trackPhraseUse(phraseId) {
  const phrase = _userPhrases.find(p => p.id === phraseId);
  if (phrase) phrase.useCount = (phrase.useCount || 0) + 1;
}

/**
 * Load phrases from external source (e.g., Supabase response).
 */
function loadUserPhrasesFromDB(dbRows) {
  _userPhrases = (dbRows || []).map(row => ({
    id: row.id,
    label: row.label,
    text: row.phrase_text,
    category: row.category_id,
    visibility: row.visibility,
    allowedRoles: row.allowed_roles || [],
    tags: row.tags || [],
    createdBy: row.created_by,
    placeholders: row.placeholder_count || 0,
    useCount: row.use_count || 0,
    createdAt: row.created_at
  }));
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PHRASE_CATEGORIES,
    BUILT_IN_PHRASES,
    PLACEHOLDER_MARKER,
    getPlaceholderPositions,
    fillPlaceholders,
    countUnfilledPlaceholders,
    validatePhraseComplete,
    getPhrases,
    searchPhrases,
    saveUserPhrase,
    updateUserPhrase,
    deleteUserPhrase,
    trackPhraseUse,
    loadUserPhrasesFromDB
  };
} else if (typeof window !== "undefined") {
  window.PhraseLibrary = {
    PHRASE_CATEGORIES,
    BUILT_IN_PHRASES,
    PLACEHOLDER_MARKER,
    getPlaceholderPositions,
    fillPlaceholders,
    countUnfilledPlaceholders,
    validatePhraseComplete,
    getPhrases,
    searchPhrases,
    saveUserPhrase,
    updateUserPhrase,
    deleteUserPhrase,
    trackPhraseUse,
    loadUserPhrasesFromDB
  };
}
