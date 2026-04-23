/**
 * signal-library.js — THERASSISTANT Clinical Signal Library v1
 *
 * Purpose:  Normalize clinician free-text and structured responses into
 *           categorized clinical signals that drive billing code inference,
 *           medical necessity support, documentation gap detection, and
 *           longitudinal pattern analysis.
 *
 * Exports:
 *   signalLibrary    — 24 top-level clinical categories with subcategories
 *                      and synonym phrase lists for each signal.
 *   codeRules        — Per-code documentation requirements, signal thresholds,
 *                      exclusions, gap warnings, and addendum suggestions for
 *                      16 H-codes and CPT psychotherapy codes.
 *   longitudinalRules — Pattern-based rules that fire across multiple sessions
 *                       to surface missed codes, overuse, and treatment plan gaps.
 *
 * Usage (browser script tag):
 *   <script src="signal-library.js"></script>
 *   // -> window.signalLibrary, window.codeRules, window.longitudinalRules
 *
 * Usage (CommonJS / Node):
 *   const { signalLibrary, codeRules, longitudinalRules } = require('./signal-library');
 *
 * Usage (ES module):
 *   import { signalLibrary, codeRules, longitudinalRules } from './signal-library.js';
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1 — SIGNAL LIBRARY
   ═══════════════════════════════════════════════════════════════════════════ */

const signalLibrary = {

  /* ── SYMPTOMS ─────────────────────────────────────────────────────────── */
  symptoms: {

    anxiety: {
      label: 'Anxiety / Worry',
      signals: [
        'anxiety', 'anxious', 'worried', 'worrying', 'worry', 'nervousness', 'nervous',
        'on edge', 'keyed up', 'restless', 'tense', 'tension', 'apprehensive', 'apprehension',
        'excessive worry', 'uncontrollable worry', 'fear', 'fearful', 'panic', 'panic attack',
        'panic attacks', 'racing heart', 'heart pounding', 'shortness of breath', 'chest tightness',
        'hyperventilating', 'hyperventilation', 'catastrophizing', 'worst-case thinking',
        'GAD symptoms', 'generalized anxiety', 'social anxiety', 'performance anxiety',
        'separation anxiety', 'health anxiety', 'phobia', 'agoraphobia', 'claustrophobia',
        'perseverating', 'ruminating', 'mind racing', 'unable to relax', 'constant worry',
        'overanalyzing', 'overthinking', 'anticipatory anxiety', 'trigger', 'triggered',
        'avoidance', 'avoidant behavior', 'safety behaviors', 'hyperarousal'
      ]
    },

    depression: {
      label: 'Depression / Low Mood',
      signals: [
        'depression', 'depressed', 'depressive', 'low mood', 'sad', 'sadness', 'down',
        'hopeless', 'hopelessness', 'worthless', 'worthlessness', 'helpless', 'helplessness',
        'empty', 'emptiness', 'numb', 'numbness', 'flat affect', 'anhedonia', 'no pleasure',
        'loss of interest', 'loss of motivation', 'unmotivated', 'withdrawn', 'withdrawal',
        'isolating', 'isolation', 'crying', 'crying spells', 'tearful', 'tearfulness',
        'grief-like symptoms', 'dysphoria', 'dysthymia', 'persistent sadness',
        'heavy feeling', 'weight on chest', 'foggy', 'brain fog', 'dragging', 'dragging self',
        'not wanting to get out of bed', 'everything feels pointless', 'nothing matters',
        'can\'t see the future', 'bleak', 'black hole feeling', 'darkness',
        'major depressive episode', 'MDD', 'PHQ-9 elevated', 'PHQ score elevated',
        'difficulty finding joy', 'no energy to do things enjoyed before'
      ]
    },

    anger: {
      label: 'Anger / Irritability',
      signals: [
        'anger', 'angry', 'irritable', 'irritability', 'agitated', 'agitation',
        'frustrated', 'frustration', 'rage', 'explosive', 'outburst', 'outbursts',
        'temper', 'short fuse', 'easily angered', 'snapping', 'snapping at others',
        'hostility', 'hostile', 'aggressive', 'aggression', 'verbal aggression',
        'physical aggression', 'punching walls', 'throwing things', 'threatening',
        'irritated', 'on edge', 'quick to anger', 'anger issues', 'anger problems',
        'disruptive', 'dysregulated', 'emotional dysregulation', 'lashing out',
        'road rage', 'conflict with others', 'volatile', 'impulsive anger',
        'intermittent explosive disorder', 'IED symptoms', 'anger at self'
      ]
    },

    grief: {
      label: 'Grief / Loss',
      signals: [
        'grief', 'grieving', 'grief process', 'bereavement', 'loss', 'loss of a loved one',
        'death of', 'death of a', 'recently lost', 'mourning', 'anticipatory grief',
        'complicated grief', 'prolonged grief', 'persistent grief', 'unable to accept loss',
        'missing', 'longing', 'yearning', 'empty without', 'life without them',
        'can\'t move on', 'anniversary reaction', 'grief trigger', 'loss of pet',
        'loss of job', 'loss of relationship', 'loss of identity', 'loss of health',
        'miscarriage grief', 'pregnancy loss', 'end of relationship grief',
        'disenfranchised grief', 'ambiguous loss', 'grief worsening', 'grief interfering',
        'not able to grieve', 'unprocessed grief', 'grief stuck', 'grief counseling'
      ]
    },

    trauma: {
      label: 'Trauma Response / PTSD',
      signals: [
        'trauma', 'traumatic', 'PTSD', 'post-traumatic', 'trauma history', 'trauma symptoms',
        'flashback', 'flashbacks', 'intrusive thoughts', 'intrusive memories', 'nightmares',
        'hypervigilance', 'hyperaroused', 'startle response', 'exaggerated startle',
        're-experiencing', 'triggered by trauma', 'avoidance of trauma reminders',
        'trauma anniversary', 'childhood abuse', 'abuse history', 'sexual assault', 'rape',
        'domestic violence', 'IPV', 'intimate partner violence', 'physical abuse',
        'emotional abuse', 'neglect', 'abandonment', 'complex trauma', 'complex PTSD',
        'C-PTSD', 'dissociation', 'dissociative', 'depersonalization', 'derealization',
        'feeling disconnected', 'feeling unreal', 'out of body', 'PCL-5 elevated',
        'trauma-informed', 'unresolved trauma', 'ACEs', 'adverse childhood experiences',
        'emotional numbing', 'difficulty trusting', 'hyperarousal', 'shame related to trauma'
      ]
    },

    sleepProblems: {
      label: 'Sleep Problems',
      signals: [
        'insomnia', 'sleep problems', 'sleep issues', 'sleep disturbance', 'can\'t sleep',
        'difficulty sleeping', 'trouble sleeping', 'not sleeping',
        'waking up at night', 'waking throughout the night', 'waking early', 'early awakening',
        'poor sleep quality', 'unrefreshing sleep', 'hypersomnia', 'sleeping too much',
        'oversleeping', 'sleeping all day', 'fatigue', 'exhausted', 'exhaustion',
        'tired all the time', 'tired despite sleep', 'nightmares disturbing sleep',
        'sleep anxiety', 'racing thoughts at bedtime', 'can\'t shut mind off',
        'sleep hygiene issues', 'irregular sleep schedule', 'day-night reversal',
        'chronic fatigue', 'sleep apnea concerns', 'restless legs',
        'difficulty staying asleep', 'difficulty falling asleep', 'broken sleep',
        'sleep deprivation', 'sleep-related impairment', 'sleep affecting functioning'
      ]
    },

    cognitiveImpairment: {
      label: 'Cognitive Impairment / Concentration',
      signals: [
        'concentration', 'difficulty concentrating', 'can\'t concentrate', 'focus problems',
        'difficulty focusing', 'brain fog', 'foggy', 'forgetful', 'forgetfulness',
        'memory problems', 'poor memory', 'short-term memory', 'cognitive difficulties',
        'mentally exhausted', 'mentally drained', 'thinking slowed', 'slow thinking',
        'processing speed', 'difficulty making decisions', 'indecisive', 'confusion',
        'disorganized thinking', 'distracted', 'easily distracted', 'inattentive',
        'racing thoughts', 'cluttered thoughts', 'can\'t think straight',
        'ADHD symptoms', 'attention issues', 'executive functioning', 'working memory',
        'word finding difficulty', 'losing train of thought'
      ]
    },

    psychoticSymptoms: {
      label: 'Psychotic / Reality Testing Symptoms',
      signals: [
        'hallucination', 'hallucinations', 'auditory hallucinations', 'hearing voices',
        'voices', 'visual hallucinations', 'seeing things', 'paranoia', 'paranoid',
        'delusions', 'delusional', 'grandiosity', 'grandiose', 'magical thinking',
        'ideas of reference', 'thought broadcasting', 'thought insertion',
        'thought withdrawal', 'persecutory beliefs', 'belief others are out to get me',
        'psychosis', 'psychotic', 'disorganized thinking', 'loose associations',
        'tangential thinking', 'circumstantial speech', 'reality testing impaired',
        'poor reality testing', 'first-break psychosis', 'decompensating',
        'decompensation', 'florid symptoms', 'medication-responsive psychosis'
      ]
    },

    maniaHypomania: {
      label: 'Mania / Hypomania',
      signals: [
        'mania', 'manic', 'manic episode', 'hypomania', 'hypomanic', 'elevated mood',
        'euphoria', 'euphoric', 'grandiosity', 'inflated self-esteem',
        'decreased need for sleep', 'not needing sleep', 'excessive energy',
        'racing thoughts', 'flight of ideas', 'pressured speech', 'excessive talking',
        'impulsivity', 'risky behavior', 'reckless spending', 'hypersexuality',
        'increased goal-directed activity', 'irritable mania', 'mixed state',
        'bipolar symptoms', 'bipolar episode', 'mood cycling', 'rapid cycling',
        'MDQ elevated', 'distractible', 'poor judgment during episode'
      ]
    },

    physicalSymptoms: {
      label: 'Physical / Somatic Symptoms',
      signals: [
        'somatic', 'somatization', 'physical symptoms', 'body complaints', 'headaches',
        'body pain', 'chronic pain', 'stomach aches', 'gastrointestinal symptoms',
        'nausea', 'appetite', 'appetite changes', 'weight changes', 'weight gain',
        'weight loss', 'eating too much', 'eating too little', 'digestive problems',
        'heart palpitations', 'sweating', 'trembling', 'shaking', 'dizziness',
        'chronic fatigue', 'fibromyalgia', 'medically unexplained symptoms',
        'physical manifestation of stress', 'stress-related physical complaints',
        'tension headaches', 'migraines', 'chronic health condition affecting mood'
      ]
    }

  },

  /* ── FUNCTIONING ──────────────────────────────────────────────────────── */
  functioning: {

    socialFunctioning: {
      label: 'Social Functioning',
      signals: [
        'social functioning', 'relationships', 'interpersonal', 'isolation', 'isolating',
        'withdrawn', 'withdrawing from others', 'avoiding people', 'social withdrawal',
        'difficulty with relationships', 'relationship problems', 'conflict with others',
        'poor interpersonal skills', 'difficulty maintaining friendships',
        'difficulty trusting others', 'pushing people away', 'social anxiety affecting relationships',
        'not engaging with family', 'estranged', 'cut off from family', 'loneliness',
        'no support system', 'no friends', 'social isolation'
      ]
    },

    occupationalFunctioning: {
      label: 'Occupational / School Functioning',
      signals: [
        'work', 'job', 'employment', 'school', 'academic performance', 'grades',
        'missing work', 'missing school', 'calling in sick', 'attendance issues',
        'difficulty maintaining employment', 'job loss', 'fired', 'laid off',
        'difficulty concentrating at work', 'performance decline', 'productivity issues',
        'conflict with coworkers', 'conflict with supervisors', 'workplace stress',
        'school performance declining', 'failing classes', 'unable to complete assignments',
        'dropping classes', 'academic probation', 'occupational functioning impaired',
        'work-related stress', 'on leave', 'medical leave', 'difficulty returning to work'
      ]
    },

    adlFunctioning: {
      label: 'Activities of Daily Living',
      signals: [
        'daily living', 'ADLs', 'activities of daily living', 'self-care', 'hygiene',
        'grooming', 'bathing', 'hygiene neglect', 'not showering', 'not eating',
        'difficulty with basic tasks', 'household tasks', 'cleaning', 'cooking',
        'paying bills', 'managing finances', 'difficulty getting out of bed',
        'staying in bed', 'not leaving the house', 'homebound', 'transportation issues',
        'mobility', 'independence', 'difficulty with independent living',
        'functional decline', 'functional impairment', 'decline in functioning',
        'unable to care for self', 'unable to care for children'
      ]
    },

    parentingFunctioning: {
      label: 'Parenting / Caregiving Role',
      signals: [
        'parenting', 'parenting stress', 'parenting skills', 'child discipline',
        'caring for children', 'caregiver', 'caregiving burden', 'caregiver fatigue',
        'difficulty managing children\'s behavior', 'inconsistent parenting',
        'concerns about parenting', 'DHS involvement', 'child protective services',
        'CPS involvement', 'parenting plan', 'custody', 'co-parenting conflict',
        'impact of symptoms on parenting', 'caring for parent', 'eldercare',
        'sandwich generation', 'caregiver burnout'
      ]
    }

  },

  /* ── PSYCHOSOCIAL STRESSORS ───────────────────────────────────────────── */
  psychosocialStressors: {

    financialStress: {
      label: 'Financial Stress',
      signals: [
        'financial stress', 'financial problems', 'financial instability', 'money issues',
        'money problems', 'debt', 'in debt', 'overdue bills', 'bills unpaid', 'eviction',
        'eviction notice', 'low income', 'poverty', 'food insecurity', 'not enough food',
        'going without food', 'unable to afford', 'can\'t afford medication',
        'can\'t afford therapy', 'can\'t afford housing', 'utilities shut off',
        'financial crisis', 'bankruptcy', 'garnished wages', 'collections',
        'child support arrears', 'financial burden', 'stressed about money',
        'worried about bills', 'unemployed and worried', 'Z59.6 low income',
        'can\'t make ends meet', 'financial hardship'
      ]
    },

    housingInstability: {
      label: 'Housing Instability / Homelessness',
      signals: [
        'housing', 'housing instability', 'housing insecurity', 'homeless', 'homelessness',
        'unhoused', 'living in car', 'couch surfing', 'staying with others',
        'transitional housing', 'shelter', 'at shelter', 'eviction risk', 'facing eviction',
        'recently evicted', 'can\'t afford rent', 'overcrowded housing',
        'unsafe living conditions', 'moving frequently', 'residential instability',
        'no stable housing', 'housing-related stress', 'housing application pending',
        'Section 8', 'waiting list for housing', 'temporary housing', 'Z59.0 homelessness',
        'Z59.819 housing instability'
      ]
    },

    legalProblems: {
      label: 'Legal / Involvement with Justice System',
      signals: [
        'legal problems', 'legal issues', 'probation', 'on probation', 'parole',
        'court ordered', 'court-ordered treatment', 'DUI', 'drug charges',
        'criminal history', 'arrest', 'incarceration', 'recently released',
        'justice-involved', 'pending charges', 'restraining order', 'domestic violence charges',
        'CPS case', 'DCW involvement', 'child welfare', 'legal stress', 'restitution',
        'community service', 'legal fees', 'legal mandate to attend treatment',
        'treatment as condition of probation'
      ]
    },

    familyConflict: {
      label: 'Family Conflict / Relationship Stress',
      signals: [
        'family conflict', 'family stress', 'relationship conflict', 'marital problems',
        'divorce', 'separation', 'relationship ending', 'break up', 'breakup',
        'custody dispute', 'co-parenting conflict', 'conflict with partner',
        'conflict with spouse', 'conflict with parent', 'conflict with sibling',
        'family estrangement', 'cut off from family', 'lack of family support',
        'toxic relationship', 'controlling partner', 'emotional abuse from partner',
        'DV history', 'IPV history', 'difficult family dynamics',
        'family not supportive of treatment', 'family pressure'
      ]
    },

    discriminationStressors: {
      label: 'Discrimination / Identity-Based Stressors',
      signals: [
        'discrimination', 'racism', 'racial trauma', 'racial stress', 'microaggressions',
        'LGBTQ+ stress', 'identity-based stress', 'gender dysphoria',
        'discrimination related to disability', 'ableism', 'xenophobia',
        'immigration stress', 'acculturation stress', 'cultural isolation',
        'religious persecution', 'minority stress', 'minority stress model',
        'marginalization', 'internalized stigma', 'stigma around mental health',
        'stigma around substance use', 'felt judged', 'feel unsafe due to identity'
      ]
    }

  },

  /* ── INTERVENTIONS ────────────────────────────────────────────────────── */
  interventions: {

    cbt: {
      label: 'Cognitive Behavioral Therapy (CBT)',
      signals: [
        'CBT', 'cognitive behavioral therapy', 'cognitive restructuring', 'thought challenging',
        'thought records', 'automatic thoughts', 'cognitive distortions', 'reframing',
        'behavioral activation', 'graduated exposure', 'exposure and response prevention',
        'ERP', 'ABC model', 'cognitive model', 'thought patterns', 'unhelpful thoughts',
        'challenging beliefs', 'core beliefs', 'schema work', 'disputing thoughts',
        'Socratic questioning', 'socratic dialogue', 'identifying cognitive errors',
        'mind reading', 'fortune telling', 'all-or-nothing thinking', 'decatastrophizing'
      ]
    },

    dbt: {
      label: 'Dialectical Behavior Therapy (DBT)',
      signals: [
        'DBT', 'dialectical behavior therapy', 'distress tolerance', 'emotion regulation',
        'interpersonal effectiveness', 'mindfulness skills', 'TIPP', 'DEARMAN',
        'GIVE skills', 'FAST skills', 'opposite action', 'radical acceptance',
        'TIP skills', 'half-smile', 'willingness vs willfulness', 'wise mind',
        'emotional mind', 'reasonable mind', 'chain analysis', 'behavioral chain',
        'diary card', 'DBT skills group', 'dialectical strategies'
      ]
    },

    motivationalInterviewing: {
      label: 'Motivational Interviewing (MI)',
      signals: [
        'motivational interviewing', 'MI', 'motivational enhancement',
        'exploring ambivalence', 'ambivalence', 'change talk', 'sustain talk',
        'rolling with resistance', 'reflective listening', 'OARS', 'open-ended questions',
        'affirmations', 'reflections', 'summarizing', 'scaling readiness',
        'readiness to change', 'stage of change', 'contemplation', 'pre-contemplation',
        'action stage', 'maintenance stage', 'decisional balance', 'pros and cons of change',
        'enhancing motivation', 'exploring values', 'discrepancy', 'normalizing ambivalence',
        'eliciting motivation', 'self-efficacy enhancement'
      ]
    },

    psychoeducation: {
      label: 'Psychoeducation',
      signals: [
        'psychoeducation', 'education about diagnosis', 'explained diagnosis',
        'taught about symptoms', 'explained coping', 'provided information',
        'education on medication', 'explained treatment options',
        'handout provided', 'worksheets provided', 'material provided',
        'educated on warning signs', 'taught relaxation', 'explained triggers',
        'explained the stress response', 'fight or flight', 'nervous system education',
        'education on the cycle of addiction', 'education on trauma responses',
        'explained thought-feeling connection', 'psychoeducation on grief',
        'explained sleep hygiene', 'provided coping strategies',
        'reviewed relapse warning signs', 'discussed medication adherence'
      ]
    },

    mindfulnessRelaxation: {
      label: 'Mindfulness / Relaxation Techniques',
      signals: [
        'mindfulness', 'mindfulness practice', 'mindfulness-based', 'MBSR',
        'breathing exercises', 'deep breathing', 'diaphragmatic breathing',
        '4-7-8 breathing', 'box breathing', 'paced breathing', 'controlled breathing',
        'progressive muscle relaxation', 'PMR', 'body scan', 'grounding',
        'grounding techniques', '5-4-3-2-1', 'sensory grounding', 'present-moment awareness',
        'guided imagery', 'visualization', 'relaxation response', 'meditation',
        'mindfulness meditation', 'STOP technique', 'RAIN technique',
        'loving-kindness meditation', 'acceptance-based strategies'
      ]
    },

    relapsePreventionIntervention: {
      label: 'Relapse Prevention',
      signals: [
        'relapse prevention', 'relapse prevention planning', 'high-risk situations',
        'high-risk people', 'high-risk places', 'relapse warning signs', 'relapse triggers',
        'coping with cravings', 'urge surfing', 'craving management',
        'refusal skills', 'drink refusal', 'drug refusal', 'peer pressure refusal',
        'HALT', 'hungry angry lonely tired', 'recovery plan', 'sobriety planning',
        'abstinence goal', 'harm reduction goal', 'moderation goal',
        'relapse cycle', 'lapse vs relapse', 'recovery toolkit',
        'reviewed relapse plan', 'updated relapse plan', 'coping with urges',
        'challenging permission-giving thoughts', 'avoiding high-risk situations'
      ]
    },

    traumaFocusedIntervention: {
      label: 'Trauma-Focused Interventions',
      signals: [
        'trauma-focused', 'trauma-focused CBT', 'TF-CBT', 'EMDR',
        'eye movement desensitization', 'CPT', 'cognitive processing therapy',
        'prolonged exposure', 'somatic experiencing', 'trauma informed care',
        'trauma narrative', 'exposure work', 'trauma processing',
        'trauma stabilization', 'grounding for trauma', 'trauma-informed',
        'safety stabilization', 'titrated exposure', 'window of tolerance',
        'resourcing', 'internal resources', 'safe place visualization',
        'processing traumatic memories', 'mind-body', 'titration of trauma work'
      ]
    },

    crisisIntervention: {
      label: 'Crisis Intervention / Safety Planning',
      signals: [
        'crisis intervention', 'safety planning', 'safety plan', 'safety plan updated',
        'safety plan reviewed', 'crisis plan', 'de-escalation', 'crisis de-escalation',
        'CALM', 'warm line', 'crisis line', '988 provided', '988 discussed',
        'emergency contacts', 'lethal means counseling', 'means restriction',
        'hospital levels of care discussed', 'hospitalization considered',
        'mobile crisis', 'crisis team', 'crisis stabilization', 'risk and safety discussion',
        'method restriction', 'contract for safety', 'collaborative safety assessment',
        'Stanley Brown safety planning', 'evaluated SI', 'evaluated HI', 'evaluated self-harm'
      ]
    },

    caseManagement: {
      label: 'Case Management / Care Coordination',
      signals: [
        'case management', 'care coordination', 'coordination with providers',
        'referral', 'referral made', 'referral to', 'linked to resources',
        'community resources', 'resource navigation', 'benefit navigation',
        'insurance navigation', 'collateral contact', 'contacted', 'outreach',
        'advocate', 'advocacy', 'collaborated with', 'coordination with',
        'warm handoff', 'interagency communication', 'consultation with',
        'concurrent treatment coordination', 'coordinating with prescriber',
        'coordinating with PCP', 'coordinating with psychiatrist',
        'coordinating with school', 'coordinating with DHS',
        'release of information', 'ROI signed', 'care team communication'
      ]
    },

    peerSupport: {
      label: 'Peer Support / Lived Experience',
      signals: [
        'peer support', 'peer specialist', 'peer mentor', 'lived experience',
        'shared experience', 'WRAP', 'wellness recovery action plan',
        'recovery-oriented', 'recovery coaching', 'peer coaching',
        'mutual support', 'recovery community', 'AA', 'NA', 'SMART recovery',
        'sponsorship', 'recovery milestones', 'sober community',
        'peer navigation', 'systems navigation', 'peer-led group',
        'peer support group', 'certified peer specialist', 'CPS',
        'mentoring in recovery', 'hope-focused', 'strength-based peer work'
      ]
    },

    groupTherapy: {
      label: 'Group Therapy / Psychoeducational Group',
      signals: [
        'group therapy', 'group session', 'group treatment', 'group work',
        'process group', 'skills group', 'psychoeducation group',
        'DBT group', 'CBT group', 'relapse prevention group', 'SUD group',
        'trauma group', 'anger management group', 'parenting group',
        'grief group', 'support group', 'group attended', 'participated in group',
        'group cohesion', 'group dynamics', 'group facilitation',
        'group member', 'shared in group', 'processing in group context'
      ]
    },

    familyTherapy: {
      label: 'Family / Couples Therapy',
      signals: [
        'family therapy', 'family session', 'family involved in session',
        'collateral session', 'couples therapy', 'relationship session',
        'family systems', 'family dynamics addressed', 'communication skills with family',
        'boundary setting with family', 'family conflict resolution',
        'conjoint session', 'partner present', 'family member present',
        'parent-child session', 'dyadic session', 'parent coaching in session'
      ]
    }

  },

  /* ── RISK ─────────────────────────────────────────────────────────────── */
  risk: {

    suicidalIdeation: {
      label: 'Suicidal Ideation',
      signals: [
        'suicidal ideation', 'SI', 'suicidal', 'suicidal thoughts', 'thoughts of suicide',
        'thinking about suicide', 'wants to die', 'wish I was dead', 'wish I were dead',
        'death wish', 'passive SI', 'active SI', 'suicidal plan', 'means identified',
        'intention to attempt', 'attempt history', 'prior attempt', 'previous attempt',
        'suicide attempt', 'C-SSRS completed', 'C-SSRS score', 'Columbia scale',
        'ideation without plan', 'ideation with plan', 'lethality', 'protective factors',
        'insufficient protective factors', 'safety risk', 'no-harm contract',
        'R45.851', 'suicidal ideations', 'HI assessed in context of SI'
      ]
    },

    homicidalIdeation: {
      label: 'Homicidal Ideation / Aggression Risk',
      signals: [
        'homicidal ideation', 'HI', 'thoughts of harming others', 'violence risk',
        'aggressive ideation', 'plans to harm', 'intent to harm', 'threatening statements',
        'recent acts of violence', 'history of violence', 'risk to others',
        'Tarasoff', 'duty to warn', 'identified victim', 'weapon access',
        'talked about hurting someone', 'violent thoughts', 'violence toward others',
        'impulsive aggressive acts', 'anger escalating to threat', 'domestic violence perpetration'
      ]
    },

    selfHarm: {
      label: 'Non-Suicidal Self-Injury (NSSI)',
      signals: [
        'self-harm', 'self harm', 'NSSI', 'non-suicidal self-injury', 'cutting',
        'scratching', 'burning', 'hitting self', 'head banging', 'self-injurious behavior',
        'skin picking', 'hair pulling', 'trichotillomania', 'excoriation',
        'self-inflicted', 'self-inflicted wounds', 'wounds from self-harm',
        'scars from self-cutting', 'urges to self-harm', 'history of NSSI',
        'NSSI as coping', 'NSSI to feel', 'NSSI to release pain', 'recent self-harm',
        'R45.88 non-suicidal self-harm', 'reported NSSI'
      ]
    },

    substanceUseRisk: {
      label: 'Substance Use Risk / Relapse',
      signals: [
        'relapse', 'relapsed', 'used again', 'slip', 'slipped', 'lapse',
        'recent use', 'active use', 'using again', 'returned to use',
        'overdose', 'overdose risk', 'overdose history', 'near overdose',
        'high-risk use', 'risky use', 'injection drug use', 'IV drug use',
        'sharing needles', 'fentanyl risk', 'naloxone', 'Narcan',
        'withdrawal risk', 'severe withdrawal', 'alcohol withdrawal', 'opiate withdrawal',
        'DTs', 'delirium tremens', 'risk of medical complications from use',
        'poly-drug use', 'AUDC elevated', 'DAST elevated'
      ]
    },

    abuseNeglect: {
      label: 'Abuse / Neglect / Exploitation',
      signals: [
        'abuse', 'child abuse', 'suspected abuse', 'mandatory report', 'mandated report',
        'mandated reporter', 'neglect', 'child neglect', 'adult neglect',
        'elder abuse', 'domestic abuse', 'sexual abuse', 'physical abuse',
        'exploitation', 'trafficking', 'human trafficking',
        'abuse disclosed', 'new disclosure', 'victim of abuse', 'current abuse',
        'unsafe home', 'safety concern', 'reportable concern', 'APS referral',
        'DHS report made', 'CPS report made', 'duty to report', 'CDHS notification'
      ]
    }

  },

  /* ── RESPONSE TO INTERVENTION ─────────────────────────────────────────── */
  responseToIntervention: {

    positiveResponse: {
      label: 'Positive Response to Intervention',
      signals: [
        'responded well', 'positive response', 'benefited from', 'helpful',
        'found helpful', 'engaged with', 'applied skills', 'used skills',
        'practiced skills', 'able to use strategy', 'tolerated intervention',
        'engaged in therapy', 'motivated', 'open to intervention',
        'receptive to', 'agreed to try', 'completed homework', 'did the exercise',
        'used breathing technique', 'used grounding', 'reported feeling better after',
        'expressed relief', 'found meaning in', 'connected with intervention',
        'endorsed benefit', 'showed insight', 'demonstrated understanding',
        'reported it was helpful', 'improved affect during session'
      ]
    },

    limitedResponse: {
      label: 'Limited / Partial Response to Intervention',
      signals: [
        'limited response', 'partial response', 'not fully engaging',
        'struggling to engage', 'resistant to', 'resistant', 'resistive',
        'noncompliant', 'not following through', 'not doing homework',
        'not practicing skills', 'skills not generalizing', 'skills not being used outside session',
        'inconsistent engagement', 'attendance issues', 'missed sessions',
        'ambivalent about treatment', 'unsure about treatment',
        'not connecting with approach', 'flat response', 'detached during session',
        'intellectualizing', 'avoidant of therapeutic content', 'deflecting',
        'reports interventions not helping', 'no change reported'
      ]
    },

    noResponse: {
      label: 'No Response / Deterioration',
      signals: [
        'no response', 'not responding', 'decompensating', 'decompensation',
        'worsening', 'symptoms worsening', 'condition deteriorating', 'declining',
        'clinically declined', 'not benefiting from current level of care',
        'treatment not effective', 'consider higher level of care',
        'consider level of care change', 'LOC change indicated',
        'not meeting treatment goals', 'not making progress', 'flat trajectory',
        'plateau in treatment', 'treatment stuck', 'need to reassess treatment approach',
        'crisis despite treatment', 'hospitalizations despite treatment'
      ]
    }

  },

  /* ── PROGRESS ─────────────────────────────────────────────────────────── */
  progress: {

    improving: {
      label: 'Progress / Improvement',
      signals: [
        'progress', 'improving', 'improvement', 'making progress', 'doing better',
        'symptoms reduced', 'symptoms improving', 'functional improvement',
        'better able to cope', 'using coping skills', 'increased insight',
        'more stable', 'stabilizing', 'mood stable', 'mood improved',
        'anxiety reduced', 'depression improving', 'sleeping better',
        'less conflict', 'improved relationships', 'returning to work',
        'returning to school', 'meeting goals', 'achieved objective',
        'goal met', 'goal achieved', 'milestone reached', 'sober days increasing',
        'increased sobriety', 'consecutive days sober', 'consecutive sober days',
        'positive change reported', 'strengths building', 'self-efficacy increased'
      ]
    },

    maintaining: {
      label: 'Maintaining / Stable',
      signals: [
        'maintaining', 'maintaining progress', 'maintaining stability', 'stable',
        'holding steady', 'no significant change', 'no major change',
        'symptoms stable', 'managed well', 'functioning maintained',
        'continued progress', 'ongoing improvement', 'consistent with last session',
        'similar presentation', 'no new concerns', 'well-managed',
        'continuing to work on goals', 'engaged in recovery', 'no relapse'
      ]
    }

  },

  /* ── BARRIERS ─────────────────────────────────────────────────────────── */
  barriers: {

    accessBarriers: {
      label: 'Access to Care Barriers',
      signals: [
        'missed session', 'missed appointment', 'no-show', 'late cancellation',
        'transportation problem', 'no transportation', 'can\'t get here',
        'childcare issue', 'no childcare', 'work conflict', 'schedule conflict',
        'insurance denial', 'prior authorization denied', 'coverage lapsed',
        'can\'t afford copay', 'cost barrier', 'financial barrier to treatment',
        'no phone', 'lost phone', 'can\'t access telehealth', 'technology barrier',
        'digital literacy barrier', 'language barrier', 'interpreter needed',
        'no interpreter', 'literacy barrier'
      ]
    },

    motivationalBarriers: {
      label: 'Motivational Barriers',
      signals: [
        'motivation', 'low motivation', 'unmotivated', 'ambivalent', 'ambivalence',
        'not ready to change', 'not willing to change', 'in denial', 'denying',
        'minimizing', 'rationalizing', 'externalizing blame', 'not seeing a problem',
        'not sure about treatment', 'questioning whether therapy helps', 'hopeless about recovery',
        'demoralized', 'burned out', 'treatment fatigue', 'frustrated with lack of progress',
        'lost hope', 'giving up', 'considering dropping out', 'thinking about quitting treatment'
      ]
    },

    systemicBarriers: {
      label: 'Systemic / Social Barriers',
      signals: [
        'systemic barrier', 'social determinants', 'SDOH', 'poverty barrier',
        'housing barrier', 'food insecurity barrier', 'lack of support',
        'no support system', 'caregiver responsibilities limiting treatment',
        'cultural barrier', 'stigma barrier', 'distrust of system', 'distrust of providers',
        'prior negative treatment experience', 'trauma from system',
        'safety concern preventing attendance', 'domestic violence affecting attendance',
        'immigration status affecting access', 'fear of deportation', 'legal barrier'
      ]
    }

  },

  /* ── GOALS ────────────────────────────────────────────────────────────── */
  goals: {

    treatmentGoals: {
      label: 'Treatment Goal Discussion',
      signals: [
        'treatment goals', 'therapy goals', 'goals discussed', 'goal setting',
        'goals reviewed', 'goals updated', 'new goal', 'new goal added',
        'goal achieved', 'goal modified', 'goal revised', 'goal removed',
        'objectives', 'objective set', 'short-term goal', 'long-term goal',
        'working toward', 'goal progress', 'goal tracking', 'goal-directed',
        'identified goal', 'client identified goal', 'mutually agreed goal',
        'collaborative goal setting', 'person-centered goal', 'recovery goal',
        'functional goal', 'symptom reduction goal', 'quality of life goal'
      ]
    },

    dischargeGoals: {
      label: 'Discharge Planning / Step-Down',
      signals: [
        'discharge', 'discharge planning', 'step down', 'step-down plan',
        'level of care reduction', 'transitioning to less intensive',
        'transitioning to maintenance', 'decreasing frequency', 'frequency change',
        'biweekly', 'monthly sessions planned', 'independence from services',
        'criteria for discharge', 'treatment completion criteria',
        'aftercare plan', 'aftercare planning', 'post-discharge support',
        'alumni support', 'continuing care plan'
      ]
    }

  },

  /* ── TREATMENT PLANNING ───────────────────────────────────────────────── */
  treatmentPlanning: {

    initial: {
      label: 'Initial Treatment Plan Development',
      signals: [
        'initial treatment plan', 'first treatment plan', 'treatment plan developed',
        'new treatment plan', 'intake treatment plan', 'treatment plan completed',
        'initial plan written', 'CSSP', 'comprehensive service plan',
        'opening a plan', 'plan of care developed', 'enrolled in treatment',
        'treatment plan opened', 'plan established', 'initial care plan'
      ]
    },

    review: {
      label: 'Treatment Plan Review / Update',
      signals: [
        'treatment plan review', 'treatment plan updated', 'plan reviewed',
        'plan update', 'quarterly review', 'annual review', '90-day review',
        'reviewed and updated plan', 'signed updated plan', 'plan modification',
        'updated goals', 'updated interventions', 'updated objectives',
        'added new problem', 'added new diagnosis', 'changed focus',
        'reviewed progress toward goals', 'modified treatment approach',
        'changed modality', 'treatment plan signed by client'
      ]
    },

    barrierDocumentation: {
      label: 'Barrier Documentation in Plan',
      signals: [
        'documented barriers', 'barriers to goals', 'barriers to treatment',
        'barriers identified', 'obstacles documented', 'obstacles to progress',
        'plan addresses barriers', 'strategies to address barriers',
        'problem list updated', 'updated problem list', 'new barrier added'
      ]
    },

    frequencyChange: {
      label: 'Frequency / Level of Care Change',
      signals: [
        'frequency change', 'changed frequency', 'increasing frequency', 'decreasing frequency',
        'increased sessions', 'reduced sessions', 'step up', 'step down',
        'referred to higher level of care', 'referred to IOP', 'referred to PHP',
        'referred to residential', 'referred to detox', 'level of care change',
        'LOC change', 'changed from weekly to biweekly', 'changed to weekly',
        'added telehealth', 'telehealth initiated', 'modality change'
      ]
    }

  },

  /* ── SUBSTANCE USE ────────────────────────────────────────────────────── */
  substanceUse: {

    alcohol: {
      label: 'Alcohol Use',
      signals: [
        'alcohol', 'drinking', 'alcohol use', 'beer', 'wine', 'liquor', 'spirits',
        'hard liquor', 'shots', 'drinks per day', 'drinks per week', 'binge drinking',
        'heavy drinking', 'alcohol dependence', 'alcohol use disorder', 'AUD',
        'AUDIT elevated', 'AUDIT-C elevated', 'CAGE positive', 'blackouts',
        'drinking to cope', 'using alcohol to manage anxiety', 'alcohol and depression',
        'alcohol and sleep', 'alcohol and relationship problems', 'drunk', 'intoxicated',
        'alcohol withdrawal', 'DTs', 'delirium tremens', 'alcohol-related',
        'days since last drink', 'last drink on', 'reported drinking'
      ]
    },

    opioids: {
      label: 'Opioid Use',
      signals: [
        'opioid', 'opioids', 'heroin', 'fentanyl', 'oxycodone', 'oxycontin',
        'hydrocodone', 'Vicodin', 'morphine', 'codeine', 'tramadol',
        'opioid use disorder', 'OUD', 'opiate use', 'opioid dependence',
        'MOUD', 'medication-assisted treatment', 'MAT', 'buprenorphine', 'Suboxone',
        'methadone', 'naltrexone', 'Vivitrol', 'opioid overdose', 'overdose',
        'naloxone prescribed', 'Narcan', 'opioid withdrawal', 'COWS score',
        'cravings for opioids', 'opioid cravings', 'using opioids to cope',
        'IV drug use', 'shooting up', 'injecting'
      ]
    },

    stimulants: {
      label: 'Stimulant Use',
      signals: [
        'cocaine', 'crack', 'crack cocaine', 'methamphetamine', 'meth', 'crystal meth',
        'stimulant', 'stimulant use', 'stimulant use disorder', 'amphetamine',
        'Adderall misuse', 'ADHD medication misuse', 'speed', 'ecstasy', 'MDMA',
        'molly', 'stimulant cravings', 'stimulant-related', 'cocaine dependence',
        'cocaine use disorder', 'meth abuse', 'stimulant-induced psychosis',
        'stimulant and sleep', 'stimulant and paranoia', 'DAST elevated for stimulants'
      ]
    },

    cannabis: {
      label: 'Cannabis Use',
      signals: [
        'cannabis', 'marijuana', 'weed', 'pot', 'THC', 'edibles', 'vaping cannabis',
        'vaping weed', 'cannabis use', 'cannabis use disorder', 'CUD',
        'heavy cannabis use', 'daily cannabis use', 'cannabis dependence',
        'cannabis as self-medication', 'using marijuana for anxiety',
        'using marijuana for sleep', 'using marijuana for pain',
        'cannabis withdrawal', 'cannabis craving', 'dabs', 'concentrate',
        'high potency THC', 'cannabis-induced anxiety', 'cannabis-induced paranoia',
        'DAST elevated for cannabis'
      ]
    },

    cravings: {
      label: 'Cravings / Urges',
      signals: [
        'craving', 'cravings', 'urge', 'urges', 'urge to use', 'craving to use',
        'strong desire to use', 'pull to use', 'urge surfing', 'managing cravings',
        'cravings triggered by', 'craving intensity', 'craving duration',
        'craving frequency', 'craving and relapse risk', 'urge not to use',
        'successful urge management', 'urge to drink', 'urge to use opioids',
        'urge to use meth', 'urge to smoke', 'substance craving', 'scored cravings'
      ]
    },

    recoveryStatus: {
      label: 'Recovery Status / Abstinence',
      signals: [
        'sober', 'sobriety', 'abstinent', 'abstinence', 'in recovery', 'recovery',
        'clean time', 'sober time', 'days sober', 'months sober', 'years sober',
        'clean since', 'last use was', 'consecutive days sober', 'sobriety milestone',
        'maintaining sobriety', 'recovery support', 'recovery community',
        'recovery-oriented lifestyle', 'early recovery', 'sustained recovery',
        'recovery maintenance', 'relapse prevention strategies working'
      ]
    }

  },

  /* ── SCREENING ────────────────────────────────────────────────────────── */
  screening: {

    mentalHealthScreening: {
      label: 'Mental Health Screening',
      signals: [
        'PHQ-9', 'PHQ9', 'GAD-7', 'GAD7', 'MDQ', 'BAI', 'BDI', 'Beck Anxiety',
        'Beck Depression', 'HAM-D', 'HAM-A', 'CDRS', 'MADRS',
        'depression screening', 'anxiety screening', 'mood screening',
        'mental health screening', 'screening completed', 'screening administered',
        'validated tool completed', 'screening score', 'PHQ score', 'GAD score',
        'MDQ positive', 'MDQ score', 'bipolar screening', 'mood disorder screening'
      ]
    },

    substanceUseScreening: {
      label: 'Substance Use Screening',
      signals: [
        'AUDIT', 'AUDIT-C', 'CAGE', 'DAST', 'DAST-10', 'TWEAK', 'CRAFFT',
        'ASSIST', 'SDS', 'severity of dependence scale', 'alcohol screening',
        'drug screening', 'substance use screening', 'screening for SUD',
        'brief intervention', 'SBIRT', 'screening brief intervention referral',
        'positive screen for substance use', 'AUDIT score', 'DAST score'
      ]
    },

    riskScreening: {
      label: 'Risk / Safety Screening',
      signals: [
        'C-SSRS', 'Columbia scale', 'Columbia Suicide Severity Rating Scale',
        'ASQ', 'safety screener', 'suicidal ideation screening',
        'suicide risk screening', 'SBQ-R', 'SLAP', 'risk assessment tool',
        'violence risk assessment', 'VRS', 'HCR-20', 'PCL-SV',
        'dangerousness assessment', 'lethality assessment',
        'safety assessment completed', 'suicide risk rated', 'C-SSRS completed',
        'risk level determined', 'low risk', 'moderate risk', 'high risk'
      ]
    },

    traumaScreening: {
      label: 'Trauma Screening',
      signals: [
        'PCL-5', 'PCL5', 'TSC-40', 'CTQ', 'ACE questionnaire', 'ACE score',
        'adverse childhood experiences questionnaire', 'trauma screener', 'SPRINT',
        'trauma history screen', 'PC-PTSD-5', 'PC-PTSD', 'PTSD screening',
        'trauma symptoms screening', 'PTSD screen completed', 'PCL elevated',
        'trauma assessment tool', 'TSI', 'Trauma Symptom Inventory'
      ]
    }

  },

  /* ── CARE COORDINATION ────────────────────────────────────────────────── */
  careCoordination: {

    referrals: {
      label: 'Referrals Made',
      signals: [
        'referral', 'referral to', 'referred to', 'referral made',
        'referral to psychiatrist', 'referral to prescriber', 'referral to PCP',
        'referral to primary care', 'referral to specialist', 'referral to IOP',
        'referral to PHP', 'referral to residential', 'referral to detox',
        'referral to housing services', 'referral to legal aid', 'referral to food bank',
        'community referral', 'warm handoff', 'warm handoff to', 'referral accepted',
        'client agreed to referral', 'referral documentation completed'
      ]
    },

    providerContact: {
      label: 'Contact with Other Providers',
      signals: [
        'contacted prescriber', 'contacted psychiatrist', 'contacted PCP',
        'contacted primary care', 'contacted specialist', 'contacted school counselor',
        'contacted probation officer', 'contacted DHS worker', 'contacted case manager',
        'collateral contact', 'coordination with', 'called and spoke with',
        'emailed provider', 'faxed provider', 'consultation with', 'consulted',
        'provider to provider', 'interagency coordination', 'concurrent provider coordination',
        'shared care plan', 'release of information used', 'ROI used'
      ]
    },

    communityResources: {
      label: 'Community Resource Linkage',
      signals: [
        'community resources', 'linked to resources', 'resource referral',
        'food bank', 'food pantry', 'SNAP benefits', 'Medicaid enrollment',
        'helped with benefits', 'benefits navigation', 'housing resources',
        'shelter referral', 'transitional housing', 'transportation resources',
        'Medicaid transportation', 'bus pass', 'legal aid', 'legal resources',
        'interpreter services', 'employment resources', 'job placement',
        'vocational rehabilitation', 'workforce center', 'family court resources',
        'DV shelter', 'domestic violence resources', 'child welfare resources'
      ]
    }

  },

  /* ── DIAGNOSIS ────────────────────────────────────────────────────────── */
  diagnosis: {

    diagnosticReview: {
      label: 'Diagnostic Rule-Out / Clarification',
      signals: [
        'differential diagnosis', 'rule out', 'rule-out', 'considering diagnosis',
        'diagnostic clarification', 'diagnostic formulation', 'diagnostic impression',
        'diagnostic update', 'revised diagnosis', 'diagnosis changed',
        'updated diagnostic code', 'ICD-10 code updated', 'DSM criteria reviewed',
        'DSM-5 criteria', 'diagnostic criteria', 'subthreshold criteria',
        'provisional diagnosis', 'diagnosis confirmed', 'diagnosis ruling in',
        'additional diagnostic criteria explored', 'considering comorbid diagnosis'
      ]
    },

    comorbidity: {
      label: 'Comorbidity Review',
      signals: [
        'comorbid', 'comorbidity', 'co-occurring', 'co-occurring disorder',
        'dual diagnosis', 'complex presentation', 'multiple diagnoses',
        'MH and SUD', 'depression and substance use', 'anxiety and PTSD',
        'depression and anxiety', 'PTSD and SUD', 'personality disorder and depression',
        'BPD and PTSD', 'ADHD and addiction', 'bipolar and substance use',
        'comorbid conditions reviewed', 'comorbidity addressed in treatment plan'
      ]
    }

  },

  /* ── FOLLOW-UP PLAN ───────────────────────────────────────────────────── */
  followUpPlan: {

    nextSession: {
      label: 'Next Session Planning',
      signals: [
        'follow-up', 'follow up', 'next session', 'next appointment', 'see next week',
        'scheduled for', 'return in', 'return appointment', 'follow-up scheduled',
        'next meeting', 'plan for next session', 'homework assigned',
        'practice between sessions', 'assigned to practice', 'agreed to work on',
        'to complete before next session', 'bring to next session',
        'monitoring plan', 'check-in scheduled', 'phone check-in scheduled'
      ]
    },

    emergencyPlan: {
      label: 'Emergency / Crisis Plan for Follow-Up',
      signals: [
        'crisis plan for follow-up', 'if worsening call', 'emergency contact plan',
        'given crisis line', 'given 988', '988 hotline', '911 instructions',
        'go to ER if', 'ER instructions', 'hospital if worsening',
        'if SI increases', 'if risk escalates', 'escalation plan',
        'warm line number given', 'after-hours contact provided',
        'step up plan if needed', 'crisis response plan'
      ]
    }

  },

  /* ── STRENGTHS AND SUPPORTS ───────────────────────────────────────────── */
  strengthsAndSupports: {

    personalStrengths: {
      label: 'Personal Strengths',
      signals: [
        'strength', 'strengths', 'resilience', 'resilient', 'coping resources',
        'coping skills', 'insight', 'insightful', 'self-awareness', 'motivated',
        'motivation for treatment', 'hopeful', 'optimistic', 'determined',
        'follow-through', 'engaging in therapy', 'open to feedback',
        'uses humor', 'creative', 'problem-solver', 'self-sufficient',
        'employed', 'stable employment', 'educated', 'skilled',
        'history of overcoming adversity', 'prior treatment success',
        'positive coping history', 'past ability to manage'
      ]
    },

    socialSupports: {
      label: 'Social Support System',
      signals: [
        'support system', 'social support', 'supportive family', 'supportive partner',
        'supportive friend', 'supportive community', 'engaged with AA',
        'engaged with NA', 'sponsor', 'peer support', 'faith community',
        'church support', 'religious support', 'cultural community',
        'sober support network', 'positive relationships', 'connected to others',
        'not isolated', 'community connections'
      ]
    }

  },

  /* ── MENTAL STATUS ────────────────────────────────────────────────────── */
  mentalStatus: {

    appearance: {
      label: 'Appearance / Grooming',
      signals: [
        'appearance', 'grooming', 'well-groomed', 'disheveled', 'unkempt',
        'poor hygiene', 'hygiene declined', 'casually dressed', 'appropriately dressed'
      ]
    },

    affect: {
      label: 'Affect / Mood',
      signals: [
        'affect', 'mood', 'flat affect', 'blunted affect', 'constricted affect',
        'restricted affect', 'labile affect', 'appropriate affect', 'euthymic',
        'dysphoric', 'euphoric', 'anxious affect', 'sad affect',
        'elevated mood', 'depressed mood', 'irritable mood', 'mood congruent'
      ]
    },

    thoughtProcess: {
      label: 'Thought Process / Speech',
      signals: [
        'thought process', 'linear', 'goal-directed', 'tangential', 'circumstantial',
        'loose associations', 'organized', 'disorganized', 'pressured speech',
        'slow speech', 'soft speech', 'loud speech', 'flight of ideas',
        'thought blocking', 'speechless'
      ]
    },

    orientation: {
      label: 'Orientation / Cognition',
      signals: [
        'oriented', 'oriented x3', 'oriented x4', 'disoriented', 'alert',
        'alert and oriented', 'cognitive functioning', 'cognition intact',
        'confusion', 'confused', 'memory intact', 'poor recall', 'concentration intact'
      ]
    },

    insight: {
      label: 'Insight and Judgment',
      signals: [
        'insight', 'good insight', 'poor insight', 'limited insight', 'insight intact',
        'no insight', 'judgment', 'good judgment', 'poor judgment',
        'impaired judgment', 'judgment impaired', 'impulse control',
        'fair insight', 'improving insight'
      ]
    }

  },

  /* ── TRAUMA ───────────────────────────────────────────────────────────── */
  trauma: {

    traumaHistory: {
      label: 'Trauma History Review',
      signals: [
        'trauma history', 'reviewed trauma history', 'past trauma', 'history of abuse',
        'history of neglect', 'childhood adversity', 'ACEs', 'adverse childhood experiences',
        'reviewed adverse experiences', 'trauma timeline', 'first trauma disclosure',
        'new disclosure', 'discussed trauma for the first time', 'opened up about abuse',
        'trauma history collected', 'trauma-focused intake', 'historical trauma'
      ]
    },

    traumaResponse: {
      label: 'Active Trauma Response',
      signals: [
        'active PTSD symptoms', 'trauma symptoms active', 'trauma triggered',
        'triggered by current events', 'trauma anniversary', 'trauma re-activated',
        'body memory', 'somatic trauma response', 'dissociating in session',
        'trauma flooding', 'trauma resurfacing', 'trauma-related avoidance active',
        'trauma-related hyperarousal', 'intrusions reported'
      ]
    },

    traumaInTreatmentPlan: {
      label: 'Trauma Addressed in Treatment Plan',
      signals: [
        'trauma in treatment plan', 'trauma goal', 'trauma objective',
        'trauma processing goal', 'trauma-focused treatment plan',
        'PTSD treatment plan', 'TF-CBT plan', 'EMDR planned',
        'CPT planned', 'prolonged exposure planned', 'trauma work scheduled',
        'plan includes trauma', 'addressing trauma in treatment'
      ]
    }

  },

  /* ── FAMILY DYNAMICS ──────────────────────────────────────────────────── */
  familyDynamics: {

    familyRoles: {
      label: 'Family Roles / Dynamics',
      signals: [
        'family of origin', 'family role', 'parentified child', 'scapegoat',
        'identified patient', 'family system', 'family patterns', 'enmeshment',
        'enmeshed family', 'disengaged family', 'triangulation', 'family triangulation',
        'parentification', 'role reversal', 'family boundaries', 'diffuse boundaries',
        'rigid boundaries', 'codependency', 'codependent relationship'
      ]
    },

    familyTrauma: {
      label: 'Intergenerational / Family Trauma',
      signals: [
        'intergenerational trauma', 'generational trauma', 'family trauma',
        'family history of mental health', 'family history of addiction',
        'parent with mental illness', 'parent with addiction', 'grew up with violence',
        'witnessed violence', 'domestic violence in childhood', 'chaotic home',
        'unstable upbringing', 'family trauma history', 'multigenerational patterns'
      ]
    }

  },

  /* ── EMPLOYMENT ───────────────────────────────────────────────────────── */
  employment: {

    employmentStatus: {
      label: 'Employment Status',
      signals: [
        'employed', 'employment', 'job', 'work', 'unemployed', 'not working',
        'looking for work', 'job searching', 'laid off', 'fired', 'terminated',
        'quit job', 'self-employed', 'part-time', 'full-time', 'disability benefits',
        'SSI', 'SSDI', 'social security disability', 'unable to work',
        'on medical leave', 'work accommodation', 'return to work plan',
        'Z56.9 employment problems'
      ]
    },

    vocationalRehab: {
      label: 'Vocational / Educational Goals',
      signals: [
        'vocational rehabilitation', 'voc rehab', 'job training', 'job skills',
        'returning to school', 'GED', 'diploma', 'college', 'trade school',
        'CTE', 'vocational goals', 'occupational goals', 'career goals',
        'job readiness', 'resume building', 'interview skills',
        'workforce center referral', 'employment support', 'supported employment'
      ]
    }

  },

  /* ── HOUSING ──────────────────────────────────────────────────────────── */
  housing: {

    housingStatus: {
      label: 'Housing Status',
      signals: [
        'housing status', 'living situation', 'currently housed', 'stable housing',
        'recently housed', 'housing obtained', 'moved in', 'new apartment',
        'new home', 'renting', 'owns home', 'living with family', 'couch surfing',
        'shelter', 'emergency shelter', 'transitional housing', 'permanent supportive housing',
        'housing voucher', 'section 8 voucher', 'HUD VASH', 'rapid rehousing',
        'housing first', 'Z59.0 homelessness', 'Z59.819 housing instability'
      ]
    },

    housingBarriers: {
      label: 'Housing-Related Barriers',
      signals: [
        'eviction', 'eviction notice', 'eviction proceedings', 'landlord conflict',
        'lease violation', 'lease ending', 'lost housing', 'moving soon',
        'housing search', 'on waitlist for housing', 'waiting for housing',
        'housing application pending', 'background check issue',
        'credit history barrier to housing', 'debt preventing housing',
        'no rental history', 'substance use history affecting housing',
        'mental health history affecting housing'
      ]
    }

  },

  /* ── FINANCIAL STRESS ─────────────────────────────────────────────────── */
  financialStress: {

    urgentFinancialNeed: {
      label: 'Urgent Financial Need',
      signals: [
        'utility shutoff', 'utilities disconnected', 'no heat', 'no electricity',
        'no water', 'hungry', 'food insecure', 'no food', 'children without food',
        'rent due', 'behind on rent', 'behind on mortgage', 'foreclosure',
        'car about to be repossessed', 'no transportation', 'medical bills unpaid',
        'can\'t afford medication', 'medication cost barrier', 'uninsured',
        'lost insurance', 'insurance lapsed', 'Z56.9', 'Z59.6'
      ]
    },

    benefitsAssistance: {
      label: 'Benefits / Financial Assistance',
      signals: [
        'applied for benefits', 'Medicaid application', 'SNAP application',
        'SNAP benefits', 'EBT', 'applied for SSDI', 'applied for SSI',
        'food assistance', 'TANF', 'WIC', 'utility assistance', 'LEAP',
        'rental assistance', 'housing assistance', 'emergency financial assistance',
        'benefit denied', 'benefit appeal', 'financial planner referral',
        'financial counseling', 'benefit navigation', 'assisted with application'
      ]
    }

  },

  /* ── MEDICAL ISSUES ───────────────────────────────────────────────────── */
  medicalIssues: {

    chronicConditions: {
      label: 'Chronic Medical Conditions',
      signals: [
        'chronic condition', 'diabetes', 'hypertension', 'high blood pressure',
        'heart disease', 'cardiovascular', 'COPD', 'asthma', 'chronic pain',
        'fibromyalgia', 'autoimmune', 'lupus', 'rheumatoid arthritis',
        'HIV', 'AIDS', 'hepatitis C', 'liver disease', 'kidney disease',
        'cancer', 'neurological condition', 'epilepsy', 'seizures',
        'multiple sclerosis', 'TBI', 'traumatic brain injury',
        'chronic illness affecting mood', 'medical comorbidity'
      ]
    },

    medicalMentalHealthInterface: {
      label: 'Medical-Mental Health Interface',
      signals: [
        'medical and mental health interaction', 'chronic illness and depression',
        'chronic pain and mental health', 'psychiatric effects of medical condition',
        'medication side effects affecting mood', 'medical causing psychiatric symptoms',
        'pain management and addiction', 'pain clinic referral',
        'integrative care', 'behavioral health and primary care integration',
        'co-locate services', 'primary care consultation', 'psychiatry consult',
        'coordinating with medical team', 'coordinating around medical'
      ]
    }

  },

  /* ── MEDICATIONS ──────────────────────────────────────────────────────── */
  medications: {

    psychotropicMedications: {
      label: 'Psychotropic Medication Review',
      signals: [
        'medication', 'medications', 'prescribed medication', 'psych meds',
        'antidepressant', 'SSRI', 'SNRI', 'antipsychotic', 'mood stabilizer',
        'benzodiazepine', 'anxiolytic', 'stimulant medication', 'ADHD medication',
        'sleeping medication', 'sleep medication', 'Sertraline', 'Zoloft',
        'Escitalopram', 'Lexapro', 'Fluoxetine', 'Prozac', 'Bupropion', 'Wellbutrin',
        'Venlafaxine', 'Effexor', 'Quetiapine', 'Seroquel', 'Aripiprazole', 'Abilify',
        'Lithium', 'Lamotrigine', 'Lamictal', 'Valproate', 'Depakote',
        'Lorazepam', 'Ativan', 'Clonazepam', 'Klonopin', 'Alprazolam', 'Xanax'
      ]
    },

    medicationAdherence: {
      label: 'Medication Adherence / Compliance',
      signals: [
        'medication compliance', 'medication adherence', 'taking medications as prescribed',
        'not taking medications', 'stopped medication', 'discontinued medication',
        'forgot to take', 'inconsistent medication use', 'missed doses',
        'taking as directed', 'medication working', 'medication not working',
        'medication side effects', 'requesting medication change', 'wants off medication',
        'wants to try medication', 'medication review indicated', 'medication management'
      ]
    },

    sudTreatmentMedications: {
      label: 'SUD Treatment Medications (MOUD)',
      signals: [
        'buprenorphine', 'Suboxone', 'Subutex', 'Zubsolv', 'methadone',
        'naltrexone', 'Vivitrol', 'MOUD', 'medication-assisted treatment', 'MAT',
        'acamprosate', 'Campral', 'disulfiram', 'Antabuse',
        'naloxone', 'Narcan', 'on Suboxone', 'on methadone', 'on Vivitrol',
        'MOUD compliance', 'MOUD adherence', 'missed MOUD dose',
        'urine drug screen', 'UDS', 'drug test required', 'supervised UDS'
      ]
    }

  }

};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2 — CODE RULES
   Purpose: For each billing code, define required/optional signal categories,
   minimum signal thresholds, exclusions, gap warnings, medical necessity
   language, and addendum suggestions.
   ═══════════════════════════════════════════════════════════════════════════ */

const codeRules = {

  H0031: {
    code: 'H0031',
    label: 'Behavioral Health Assessment',
    description: 'A comprehensive BH assessment covering diagnosis, functioning, risk, history, and strengths to establish or update a clinical picture.',
    requiredCategories: [],
    optionalCategories: [
      'symptoms', 'functioning', 'risk', 'diagnosis', 'strengths_and_supports',
      'psychosocial_stressors', 'mental_status', 'family_dynamics', 'trauma',
      'substance_use', 'medical_issues', 'medications'
    ],
    minimumSignalCount: 4,
    exclusions: [
      'Do not bill if only supportive therapy or coping skills were discussed',
      'Do not bill if no assessment of symptoms, diagnosis, risk, or functioning occurred',
      'Do not bill solely on the basis that psychotherapy occurred'
    ],
    conflictingCodes: [],
    documentationGaps: [
      'No risk assessment documented',
      'No diagnostic impression documented',
      'No review of current symptoms documented',
      'No functioning review (social, occupational, or ADL) documented',
      'No treatment history or prior diagnosis documented',
      'No strengths or supports documented'
    ],
    missingElementWarnings: {
      noRisk: 'Risk assessment is required to support H0031. Document SI/HI review, safety, and outcome.',
      noDiagnosis: 'Diagnostic impression must be documented including ICD-10 code and clinical basis.',
      noFunctioning: 'Document how symptoms are affecting work, school, relationships, or daily living.',
      noSymptoms: 'Document current presenting symptoms using specific clinical language.',
      noHistory: 'Document relevant treatment history, prior diagnoses, and history of present illness.'
    },
    medicalNecessityLanguage: [
      'Client presents with clinically significant symptoms that impair functioning across multiple domains.',
      'A comprehensive behavioral health assessment is medically necessary to establish diagnostic clarity, assess risk, and inform treatment planning.',
      'Current presentation warrants a reassessment due to changes in symptom severity, functional status, or diagnostic picture.',
      'Assessment is indicated to differentiate between diagnostic presentations and establish an evidence-based treatment approach.',
      'Client reports NEW onset or worsening of symptoms warranting a formal clinical assessment.',
      'Risk factors have increased since the last formal assessment, warranting a structured clinical evaluation.'
    ],
    addendumSuggestions: [
      'Document the specific symptoms assessed and their onset, frequency, intensity, and impact.',
      'Include a formal risk assessment section covering SI, HI, self-harm, and safety.',
      'Document how the assessment findings will inform the treatment plan or modify interventions.',
      'Include diagnostic impressions with differential diagnoses considered if applicable.',
      'Document client strengths and supports identified during the assessment.'
    ]
  },

  H0032: {
    code: 'H0032',
    label: 'Treatment Plan Development or Review',
    description: 'Development, review, or modification of a behavioral health treatment plan including goals, objectives, interventions, progress, and barriers.',
    requiredCategories: [],
    optionalCategories: [
      'treatment_planning', 'goals', 'barriers', 'progress', 'interventions',
      'psychosocial_stressors', 'functioning', 'care_coordination'
    ],
    minimumSignalCount: 2,
    exclusions: [
      'Do not bill if only progress was mentioned without any goal or planning activity',
      'Do not bill for a supportive session with no goal-directed planning',
      'Do not bill if no goals, objectives, or interventions were reviewed or modified'
    ],
    conflictingCodes: [],
    documentationGaps: [
      'No treatment goals reviewed or documented',
      'No barriers to goal achievement documented',
      'No client participation in planning documented',
      'No record of which goals remain active vs. achieved',
      'No documentation of why plan was changed'
    ],
    missingElementWarnings: {
      noGoals: 'At least one treatment goal must be identified, reviewed, or updated to support H0032.',
      noBarriers: 'Document barriers to progress and how they are being addressed in the plan.',
      noClientInput: 'Client collaboration in treatment planning must be documented.',
      noRationale: 'If goals or interventions were modified, document the clinical rationale.'
    },
    medicalNecessityLanguage: [
      'Treatment plan review is medically necessary due to changes in client symptom presentation or functional status.',
      'A plan update is indicated to address newly identified barriers to progress.',
      'Client is not meeting treatment objectives; plan modification is needed to address lack of progress.',
      'This treatment plan review incorporates updated diagnostic information and evidence-based intervention modifications.',
      'Quarterly treatment plan review is consistent with Medicaid requirements and clinical best practices.'
    ],
    addendumSuggestions: [
      'List each goal reviewed and whether it is active, modified, achieved, or discontinued.',
      'Document specific barriers discussed and how the plan was modified to address them.',
      'Include client response to the plan review including consent and stated priorities.',
      'If frequency of services changed, document the clinical rationale.',
      'Reference screening scores, risk level, or functional assessment as the basis for plan changes.'
    ]
  },

  H0001: {
    code: 'H0001',
    label: 'Alcohol and/or Drug Assessment',
    description: 'A comprehensive substance use assessment covering type of use, frequency, quantity, duration, relapse history, diagnosis, ASAM dimensions, and level of care.',
    requiredCategories: [],
    optionalCategories: [
      'substance_use', 'risk', 'diagnosis', 'functioning', 'treatment_planning',
      'screening', 'medications', 'psychosocial_stressors'
    ],
    minimumSignalCount: 3,
    exclusions: [
      'Do not bill if only one brief substance use question was asked',
      'Do not bill if substance use was merely mentioned without clinical assessment',
      'Do not bill if no diagnostic impression or level of care determination was documented'
    ],
    conflictingCodes: [],
    documentationGaps: [
      'No substance type, frequency, quantity, or duration documented',
      'No relapse history or treatment history documented',
      'No diagnostic impression for SUD documented',
      'No ASAM dimension review or level of care determination documented',
      'No documentation of impact of use on functioning, relationships, or health',
      'No cravings, triggers, or withdrawal assessment documented'
    ],
    missingElementWarnings: {
      noSubstanceDetail: 'Document the specific substance(s) assessed including frequency, quantity, and route of use.',
      noDiagnosis: 'A SUD diagnostic impression or ICD-10 code for substance use must be documented.',
      noASAM: 'Document ASAM dimension review or level of care determination.',
      noCravings: 'Document cravings, triggers, and any withdrawal symptoms reviewed.',
      noFunctionImpact: 'Document how substance use affects legal, occupational, social, or health functioning.'
    },
    medicalNecessityLanguage: [
      'Client presents with symptoms consistent with a substance use disorder warranting a formal ASAM assessment.',
      'A comprehensive substance use assessment is medically necessary to determine appropriate level of care.',
      'Client has relapsed and requires a formal reassessment of SUD severity and LOC needs.',
      'Substance use is significantly impairing functioning across multiple domains, warranting formal assessment.',
      'Court-ordered assessment requires a comprehensive clinical evaluation of substance use patterns and severity.'
    ],
    addendumSuggestions: [
      'Document all substances assessed, including primary substance and polysubstance use.',
      'Include frequency, quantity, route, and duration for each substance assessed.',
      'Document relapse history, prior treatment attempts, and longest period of abstinence.',
      'Include ASAM dimension ratings and level of care recommendation.',
      'Document client\'s readiness to change using motivational stage of change model.'
    ]
  },

  H0002: {
    code: 'H0002',
    label: 'Behavioral Health Screening',
    description: 'Administration and interpretation of a validated behavioral health or substance use screening instrument.',
    requiredCategories: ['screening'],
    optionalCategories: ['symptoms', 'substance_use', 'risk', 'diagnosis', 'follow_up_plan'],
    minimumSignalCount: 1,
    exclusions: [
      'Do not bill if no formal validated screening instrument was used',
      'Do not bill if only informal questions about symptoms were asked',
      'Do not bill if results were not documented with a score or interpretation'
    ],
    conflictingCodes: [],
    documentationGaps: [
      'No screening tool name documented',
      'No screening score or result documented',
      'No interpretation of results documented',
      'No documentation of how results affected clinical decisions',
      'Screening administered but no action or follow-up documented'
    ],
    missingElementWarnings: {
      noToolName: 'Document the specific validated screening tool used (e.g., PHQ-9, GAD-7, AUDIT, C-SSRS).',
      noScore: 'Document the score or result from the screening instrument.',
      noInterpretation: 'Document clinical interpretation and what the score indicates.',
      noAction: 'Document what clinical action was taken based on screening results.'
    },
    medicalNecessityLanguage: [
      'Validated behavioral health screening is medically necessary as part of routine health monitoring.',
      'Screening was administered due to new or worsening symptoms to quantify severity.',
      'Screening results indicate clinically significant symptoms requiring clinical response.',
      'Screening is required under integrated care protocols and Medicaid preventive care standards.'
    ],
    addendumSuggestions: [
      'Document the exact screening tool name, administration date, and total score.',
      'Include interpretation of score (e.g., PHQ-9 score of 17 indicates moderate-severe depression).',
      'Document clinical response to the result, such as referral, level of care adjustment, or monitoring plan.',
      'Note whether this was a repeat screening and compare to prior scores to show trajectory.'
    ]
  },

  H2014: {
    code: 'H2014',
    label: 'Skills Training and Development',
    description: 'Teaching and practicing functional skills in areas such as social skills, living skills, ADLs, communication, and community integration.',
    requiredCategories: ['interventions'],
    optionalCategories: ['functioning', 'barriers', 'progress', 'goals'],
    minimumSignalCount: 2,
    exclusions: [
      'Do not bill for psychotherapy or counseling',
      'Do not bill if only clinical assessment occurred without skill teaching',
      'Do not bill for case management activities alone'
    ],
    conflictingCodes: ['90837', '90834'],
    documentationGaps: [
      'No specific skill taught or practiced documented',
      'No documentation of client participation in skill practice',
      'No documentation of skill generalization to real-world settings',
      'No measurable objective for skill development documented',
      'No progress on skill development documented'
    ],
    missingElementWarnings: {
      noSkillSpecified: 'Document the specific skill taught, modeled, or practiced during the session.',
      noParticipation: 'Document whether the client actively practiced the skill during the session.',
      noGeneralization: 'Document how the client plans to use the skill in daily life or real-world settings.',
      noObjective: 'Link the skill to a measurable treatment plan objective.'
    },
    medicalNecessityLanguage: [
      'Client requires skills training to address functional deficits due to behavioral health diagnosis.',
      'Skills training is medically necessary to improve community integration and independent living.',
      'Client has significant deficits in [specify domain] skills that affect their ability to function independently.',
      'Skill development is necessary to achieve treatment plan goals and reduce reliance on intensive services.'
    ],
    addendumSuggestions: [
      'Name the specific skill(s) targeted: e.g., medication self-management, budgeting, emotion regulation.',
      'Describe how the skill was practiced (role play, in vivo, worksheets, practice assignment).',
      'Document client response and level of mastery during skill practice.',
      'Note real-world application plan and any homework related to skill generalization.'
    ]
  },

  T1017: {
    code: 'T1017',
    label: 'Targeted Case Management',
    description: 'Services to link and coordinate care between providers, community resources, and systems on behalf of the client.',
    requiredCategories: ['care_coordination'],
    optionalCategories: ['psychosocial_stressors', 'barriers', 'housing', 'employment', 'financial_stress', 'medications'],
    minimumSignalCount: 2,
    exclusions: [
      'Do not bill if only brief verbal check-in about resources occurred without action',
      'Do not bill for therapy or clinical assessment',
      'Do not bill if no specific coordination action was documented'
    ],
    conflictingCodes: [],
    documentationGaps: [
      'No specific coordination activity documented',
      'No provider or agency contacted or coordinated with documented',
      'No resource linkage activity with outcome documented',
      'No documentation of client consent for coordination',
      'No documentation of outcome of coordination efforts'
    ],
    missingElementWarnings: {
      noAction: 'Document the specific case management action taken (referral made, contact attempted, resource linked).',
      noProvider: 'Document the specific provider, agency, or resource involved in coordination.',
      noOutcome: 'Document the outcome of coordination efforts (referral accepted, contact made, resource confirmed).',
      noConsent: 'Document client consent for release of information used in coordination.'
    },
    medicalNecessityLanguage: [
      'Targeted case management is medically necessary to address significant unmet needs that are barriers to recovery.',
      'Client requires coordination across multiple systems including [specify: housing, legal, medical, SUD] to support treatment.',
      'Social determinants of health are significantly contributing to psychiatric symptoms and require active case management.',
      'Client is unable to independently navigate treatment systems due to symptom severity, literacy, or functional limitations.'
    ],
    addendumSuggestions: [
      'Document the unmet need addressed and how it relates to the BH diagnosis.',
      'List which provider or community system was contacted and the date and outcome.',
      'Note whether an ROI was used and with which agency.',
      'Document client response to the coordination effort and any follow-up required.'
    ]
  },

  H0006: {
    code: 'H0006',
    label: 'Pre-Treatment Substance Use Consultation',
    description: 'Consultation to determine client readiness and appropriateness for substance use treatment prior to admission.',
    requiredCategories: ['substance_use'],
    optionalCategories: ['risk', 'diagnosis', 'functioning', 'care_coordination'],
    minimumSignalCount: 2,
    exclusions: [
      'Do not bill for ongoing treatment sessions',
      'Do not bill if full SUD assessment (H0001) was completed in the same encounter',
      'Do not bill if no determination about treatment readiness was documented'
    ],
    conflictingCodes: ['H0001'],
    documentationGaps: [
      'No treatment readiness determination documented',
      'No substance use history in consultation context documented',
      'No recommendation for treatment level documented'
    ],
    missingElementWarnings: {
      noReadiness: 'Document clinical determination of readiness for SUD treatment.',
      noRecommendation: 'Document the recommended level of care or next steps resulting from the consultation.'
    },
    medicalNecessityLanguage: [
      'Pre-treatment consultation is medically necessary to determine appropriate level of care for this client.',
      'Client is being considered for SUD treatment and requires a pre-admission consultation to determine fit.'
    ],
    addendumSuggestions: [
      'Document the referral source and reason for pre-treatment consultation.',
      'Include a summary of substance use history gathered during consultation.',
      'Document treatment readiness determination and recommended next steps.'
    ]
  },

  '90791': {
    code: '90791',
    label: 'Psychiatric Diagnostic Evaluation',
    description: 'Initial psychiatric/psychological diagnostic evaluation without medical services.',
    requiredCategories: ['diagnosis', 'symptoms', 'mental_status'],
    optionalCategories: [
      'risk', 'functioning', 'trauma', 'family_dynamics', 'substance_use',
      'medications', 'psychosocial_stressors', 'screening'
    ],
    minimumSignalCount: 4,
    exclusions: [
      'Cannot be billed with 90792 on same date',
      'Do not bill for follow-up diagnostic work; use 99202-99205 or H0031',
      'Typically limited to two per year per payer'
    ],
    conflictingCodes: ['90792', 'H0031'],
    documentationGaps: [
      'No formal mental status examination documented',
      'No diagnostic formulation with ICD-10 code documented',
      'No psychiatric/personal/social history documented',
      'No risk assessment documented',
      'No treatment recommendations based on evaluation documented'
    ],
    missingElementWarnings: {
      noMSE: 'A formal mental status examination is required to support 90791.',
      noDxFormulation: 'Diagnostic formulation must be clearly documented with ICD-10 codes and supporting clinical evidence.',
      noHistory: 'Psychiatric history, personal history, and family history are required for 90791 documentation.',
      noRisk: 'Risk assessment is a required element of a full diagnostic evaluation.',
      noRecommendations: 'Treatment recommendations based on the evaluation must be documented.'
    },
    medicalNecessityLanguage: [
      'Initial psychiatric diagnostic evaluation is indicated due to new psychiatric symptoms with functional impairment.',
      'Client presents with complex and overlapping diagnostic presentation requiring formal evaluation.',
      'Diagnostic evaluation is necessary to establish clinical baseline and develop a clinically appropriate treatment plan.',
      'Client has had no prior psychiatric evaluation in the past [X] years and clinical presentation has changed significantly.'
    ],
    addendumSuggestions: [
      'Include a structured mental status examination with all standard domains.',
      'Document diagnostic formulation with rationale for principal and secondary diagnoses.',
      'Include a brief developmental/psychiatric/social history.',
      'Document risk assessment findings and safety planning if indicated.',
      'Include initial treatment recommendations including level of care and modalities.'
    ]
  },

  '90785': {
    code: '90785',
    label: 'Interactive Complexity (Add-On)',
    description: 'Add-on code for sessions with interactive complexity factors such as crisis, guardianship, mandated treatment, or need for third-party collateral.',
    requiredCategories: [],
    optionalCategories: ['risk', 'family_dynamics', 'care_coordination', 'barriers'],
    minimumSignalCount: 1,
    exclusions: [
      'Must be billed with a primary psychotherapy code (90832, 90834, or 90837)',
      'Do not bill if no qualifying complexity factor is present',
      'Do not bill more than once per session'
    ],
    conflictingCodes: [],
    documentationGaps: [
      'No interactive complexity factor documented',
      'No third-party involvement or collateral contact documented',
      'No documentation of crisis, mandated treatment, or communication complications'
    ],
    missingElementWarnings: {
      noComplexityFactor: 'Document the specific complexity factor: crisis stabilization, third-party collateral, mandated treatment, guardianship, or other qualifying factor.'
    },
    medicalNecessityLanguage: [
      'Interactive complexity is present due to active crisis requiring de-escalation and safety planning.',
      'Session involved significant third-party collateral communication affecting clinical decision-making.',
      'Client is under a mandated treatment order adding complexity to the therapeutic relationship and clinical management.',
      'Session required communication with multiple providers, agencies, or guardians to coordinate care.'
    ],
    addendumSuggestions: [
      'Explicitly name the interactive complexity factor (e.g., active SI, court order, guardian present, collateral contact required).',
      'Document how the complexity factor affected the session length, content, or therapeutic approach.',
      'Note any communications with third parties that occurred as part of addressing complexity.'
    ]
  },

  '90832': {
    code: '90832',
    label: 'Psychotherapy — 16 to 37 Minutes',
    description: 'Individual psychotherapy session of 16 to 37 minutes in duration.',
    requiredCategories: ['interventions'],
    optionalCategories: ['symptoms', 'progress', 'barriers', 'response_to_intervention', 'follow_up_plan'],
    minimumSignalCount: 1,
    exclusions: [
      'Do not bill if session exceeds 37 minutes (use 90834 or 90837)',
      'Do not bill if session was less than 16 minutes',
      'Do not bill for case management or skills training activities only'
    ],
    conflictingCodes: ['90834', '90837'],
    documentationGaps: [
      'No intervention or therapeutic approach documented',
      'No session duration documented',
      'No therapeutic content documented',
      'No client response to intervention documented'
    ],
    missingElementWarnings: {
      noTime: 'Document exact session start and end time or total minutes to support time-based code.',
      noIntervention: 'Document the specific therapeutic intervention(s) used during the session.',
      noResponse: 'Document client response to interventions and any progress or lack thereof.'
    },
    medicalNecessityLanguage: [
      'Brief psychotherapy session is medically necessary to provide symptom management support between more intensive sessions.',
      'Client presentation can be adequately addressed within a shorter session time given current stability.',
      'Session was appropriately brief due to client fatigue, medical limitations, or clinical presentation.'
    ],
    addendumSuggestions: [
      'Document session start time, end time, and total minutes.',
      'Name the specific therapeutic approach used.',
      'Document primary themes addressed and client response.',
      'Note clinical rationale if session was shorter than typical.'
    ]
  },

  '90834': {
    code: '90834',
    label: 'Psychotherapy — 38 to 52 Minutes',
    description: 'Individual psychotherapy session of 38 to 52 minutes in duration.',
    requiredCategories: ['interventions'],
    optionalCategories: ['symptoms', 'progress', 'barriers', 'response_to_intervention', 'follow_up_plan'],
    minimumSignalCount: 2,
    exclusions: [
      'Do not bill if session was less than 38 minutes (use 90832)',
      'Do not bill if session exceeds 52 minutes (use 90837)',
      'Do not bill for case management or non-therapy activities only'
    ],
    conflictingCodes: ['90832', '90837'],
    documentationGaps: [
      'No exact session time documented',
      'No clinical content or themes addressed documented',
      'No therapeutic approach documented',
      'No client engagement or response documented'
    ],
    missingElementWarnings: {
      noTime: 'Document exact start/end time or total minutes to verify time-based code.',
      noContent: 'Document specific clinical themes addressed and therapeutic interventions used.',
      noResponse: 'Document client engagement and response to treatment during the session.'
    },
    medicalNecessityLanguage: [
      'A 45-minute psychotherapy session is medically necessary to address multiple clinical themes requiring therapeutic attention.',
      'Session duration is consistent with clinical needs of this client and the complexity of presenting issues.'
    ],
    addendumSuggestions: [
      'Document exact session start and end time.',
      'List 2–3 specific clinical themes addressed during the session.',
      'Describe therapeutic interventions and modalities used.',
      'Note progress, setbacks, and plan for next session.'
    ]
  },

  '90837': {
    code: '90837',
    label: 'Psychotherapy — 53 Minutes or More',
    description: 'Individual psychotherapy session of 53 minutes or longer in duration.',
    requiredCategories: ['interventions'],
    optionalCategories: [
      'symptoms', 'progress', 'barriers', 'response_to_intervention',
      'follow_up_plan', 'risk', 'treatment_planning'
    ],
    minimumSignalCount: 3,
    exclusions: [
      'Do not bill if session was less than 53 minutes (use 90834)',
      'Do not bill for brief 15-minute check-ins regardless of context',
      'Do not bill if only case management occurred'
    ],
    conflictingCodes: ['90832', '90834'],
    documentationGaps: [
      'No exact session time documented or time is below 53 minutes',
      'Clinical documentation does not justify 53+ minute session',
      'No therapeutic content sufficient to support full-hour session documented',
      'Multiple sessions per day documented as 90837 without clear justification'
    ],
    missingElementWarnings: {
      noTime: 'Session duration of 53+ minutes must be documented with start and end time.',
      insufficientContent: 'Clinical documentation should reflect the depth and breadth of a full therapeutic session consistent with 53+ minutes.',
      overuse: 'Frequent 90837 usage may trigger audit. Ensure each session genuinely required 53+ minutes and is fully documented.'
    },
    medicalNecessityLanguage: [
      'A full 60-minute session is medically necessary due to the complexity and acuity of this client\'s presenting issues.',
      'Session length is clinically justified by the need to address multiple interconnected clinical themes.',
      'Active crisis content, safety planning, and therapeutic intervention required the full session time.',
      'Trauma processing work requires extended uninterrupted session time to allow for stabilization before session end.'
    ],
    addendumSuggestions: [
      'Document session start and end time to confirm 53+ minutes.',
      'List all clinical themes addressed and therapeutic work completed to justify session length.',
      'Include response to intervention and any clinical decisions made during the extended session.',
      'If addressing trauma, crisis, or complex diagnostic content, explicitly document why full session time was required.'
    ]
  },

  '90839': {
    code: '90839',
    label: 'Psychotherapy for Crisis — First 60 Minutes',
    description: 'First 60 minutes of crisis-focused psychotherapy during a mental health crisis.',
    requiredCategories: ['risk'],
    optionalCategories: ['symptoms', 'interventions', 'care_coordination', 'follow_up_plan'],
    minimumSignalCount: 2,
    exclusions: [
      'Do not bill unless an active psychiatric emergency or crisis is documented',
      'Do not bill for routine sessions even if the client presents distressed',
      'Do not bill without documenting the specific crisis indicators and intervention'
    ],
    conflictingCodes: ['90840'],
    documentationGaps: [
      'No clear crisis indicator documented (SI, HI, psychosis, acute intoxication, etc.)',
      'No crisis intervention or de-escalation documented',
      'No safety planning or outcome of crisis response documented',
      'No documentation of why standard session was insufficient'
    ],
    missingElementWarnings: {
      noCrisisIndicator: 'Document the specific psychiatric emergency (active SI, HI, acute psychosis, overdose risk, etc.).',
      noIntervention: 'Document the crisis intervention performed: de-escalation, safety planning, risk assessment, hospitalization consideration.',
      noOutcome: 'Document crisis outcome: client stabilized, hospitalization initiated, safety plan updated, etc.'
    },
    medicalNecessityLanguage: [
      'Client presented in acute psychiatric crisis requiring immediate therapeutic intervention.',
      'Active suicidal ideation with plan was disclosed, requiring full crisis assessment and safety planning.',
      'Session was unplanned and initiated in response to a psychiatric emergency.',
      'Client\'s safety was at imminent risk and crisis psychotherapy was the appropriate intervention to avert hospitalization.'
    ],
    addendumSuggestions: [
      'Document the specific crisis presentation and what triggered the crisis session.',
      'Include risk assessment findings and their direct impact on the session\'s clinical decisions.',
      'Document the specific crisis intervention performed.',
      'Record outcome of crisis intervention and follow-up plan (discharge to outpatient, voluntary hospital, etc.).'
    ]
  },

  '90840': {
    code: '90840',
    label: 'Psychotherapy for Crisis — Additional 30 Minutes (Add-On)',
    description: 'Each additional 30-minute increment of crisis psychotherapy beyond the initial 60 minutes.',
    requiredCategories: ['risk'],
    optionalCategories: ['interventions', 'care_coordination'],
    minimumSignalCount: 1,
    exclusions: [
      'Must be billed with 90839',
      'Do not bill more than twice per session',
      'Document clinical justification for each additional 30-minute increment'
    ],
    conflictingCodes: [],
    documentationGaps: [
      'No additional time documented beyond initial 60-minute crisis session',
      'No clinical justification for additional time documented'
    ],
    missingElementWarnings: {
      noAdditionalTime: 'Document additional time spent beyond 60 minutes and specific clinical work performed in that additional time.',
      noJustification: 'Document why the crisis required more than 60 minutes of active intervention.'
    },
    medicalNecessityLanguage: [
      'Crisis resolution required additional time beyond the initial 60 minutes due to ongoing instability.',
      'Extended crisis intervention was necessary to stabilize client prior to safe transition to lower level of care.'
    ],
    addendumSuggestions: [
      'Document additional time with start and end times for the extended period.',
      'Describe the clinical work that occurred during the additional time.',
      'Document how the crisis status changed during the additional time.'
    ]
  },

  H2011: {
    code: 'H2011',
    label: 'Crisis Intervention',
    description: 'Crisis intervention services for clients in acute psychiatric or substance use crises intended to stabilize and prevent hospitalization.',
    requiredCategories: ['risk'],
    optionalCategories: ['interventions', 'care_coordination', 'substance_use', 'follow_up_plan'],
    minimumSignalCount: 2,
    exclusions: [
      'Do not bill for routine therapy sessions even if emotionally intense',
      'Do not bill without documented active crisis indicator',
      'Do not bill if crisis was resolved before service was initiated'
    ],
    conflictingCodes: [],
    documentationGaps: [
      'No active crisis indicator documented',
      'No crisis stabilization or de-escalation activity documented',
      'No safety assessment outcome documented',
      'No post-crisis plan documented'
    ],
    missingElementWarnings: {
      noCrisisIndicator: 'Specify the acute crisis that triggered this service (SI, HI, acute intoxication, psychotic break, domestic violence, etc.).',
      noStabilization: 'Document the specific stabilization activities performed.',
      noOutcome: 'Document outcome: safety achieved, referral to higher level, voluntary or involuntary hospitalization, or returned to community with plan.'
    },
    medicalNecessityLanguage: [
      'Client presented in acute psychiatric crisis requiring immediate stabilization to prevent harm.',
      'Crisis intervention is medically necessary to avert hospitalization and stabilize client in the community.',
      'Acute safety risk was identified requiring clinical response beyond standard therapeutic services.'
    ],
    addendumSuggestions: [
      'Document the triggering event and acute crisis presentation.',
      'Describe stabilization activities and clinical techniques used.',
      'Include post-crisis safety plan.',
      'Document disposition decision and follow-up plan.'
    ]
  },

  H0038: {
    code: 'H0038',
    label: 'Self-Help / Peer Services',
    description: 'Services provided by a certified peer specialist using their own lived experience to support another individual\'s recovery.',
    requiredCategories: ['interventions'],
    optionalCategories: [
      'strengths_and_supports', 'barriers', 'goals', 'substance_use', 'care_coordination'
    ],
    minimumSignalCount: 2,
    exclusions: [
      'Must be provided by a certified peer specialist (CPS)',
      'Do not bill for activities that constitute therapy or clinical assessment',
      'Do not bill for case management activities that do not involve lived experience sharing',
      'Must document how lived experience was used to support recovery'
    ],
    conflictingCodes: ['90837', '90834', '90832'],
    documentationGaps: [
      'No documentation of peer specialist credentials',
      'No documentation of how lived experience was shared to support client',
      'No recovery-oriented activity or goal documented',
      'No documentation of client\'s response to peer support services'
    ],
    missingElementWarnings: {
      noCredentials: 'Document that service was provided by a Certified Peer Specialist (CPS) per Colorado requirements.',
      noLivedExperience: 'Document how lived experience was used to support the client\'s recovery (e.g., sharing personal recovery story, modeled coping).',
      noRecoveryGoal: 'Connect service to a specific recovery goal in the client\'s care plan.',
      noResponse: 'Document client engagement with and response to peer support activities.'
    },
    medicalNecessityLanguage: [
      'Peer support services are medically necessary to support long-term recovery and reduce relapse risk.',
      'Client benefits from engagement with a peer specialist who has lived experience with similar challenges.',
      'Peer services are instrumental in building hope, motivation, and engagement with treatment.',
      'Client has limited social support and benefits from structured peer mentoring to build recovery capital.'
    ],
    addendumSuggestions: [
      'Document the peer specialist\'s CPS credential and supervising licensed professional.',
      'Describe how lived experience was integrated into the session content.',
      'List specific recovery activities, recovery planning, or WRAP work completed.',
      'Document client strengths identified and recovery milestones reviewed.'
    ]
  }

};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3 — LONGITUDINAL RULES
   Purpose: Pattern-based rules that analyze trends across multiple sessions
   to surface missed billing opportunities, overuse risks, and documentation gaps.
   ═══════════════════════════════════════════════════════════════════════════ */

const longitudinalRules = {

  repeatedAnxietyWithoutH0032: {
    id: 'repeatedAnxietyWithoutH0032',
    label: 'Anxiety Themes Without Treatment Plan Update',
    description: 'Client has presented with anxiety-related signals in multiple consecutive sessions, but no H0032 (treatment plan review) has been billed.',
    triggerCondition: {
      categoryPresent: 'symptoms.anxiety',
      minimumOccurrences: 3,
      lookbackSessionCount: 5,
      missingCode: 'H0032'
    },
    severity: 'warning',
    message: 'Anxiety themes have appeared in 3 or more recent sessions without a documented treatment plan review. Consider whether goals, objectives, or interventions should be updated to address the persistent anxiety focus.',
    suggestedAction: 'Review and update the treatment plan to address persistent anxiety. Document goal modification or rationale for no change.',
    missedCodeOpportunity: 'H0032',
    documentationGapMessage: 'Treatment plan goals related to anxiety management may be out of date or not reflecting the current clinical focus.'
  },

  repeatedCareCoordinationWithoutT1017: {
    id: 'repeatedCareCoordinationWithoutT1017',
    label: 'Care Coordination Without T1017 Billing',
    description: 'Multiple sessions contain care coordination signals (referrals, provider contacts, resource linkage), but T1017 has not been billed.',
    triggerCondition: {
      categoryPresent: 'care_coordination',
      minimumOccurrences: 2,
      lookbackSessionCount: 4,
      missingCode: 'T1017'
    },
    severity: 'opportunity',
    message: 'Care coordination activities have been documented in multiple recent sessions. If targeted case management was performed, T1017 may be billable.',
    suggestedAction: 'Review care coordination documentation. If T1017 criteria are met (linking to services, provider contact, resource navigation on behalf of client), bill accordingly.',
    missedCodeOpportunity: 'T1017',
    documentationGapMessage: 'Case management activities may be underdocumented. Document each coordination action with provider/agency name, action taken, and outcome.'
  },

  repeatedRelapsePreventionWithoutH0001: {
    id: 'repeatedRelapsePreventionWithoutH0001',
    label: 'Relapse Prevention Without Substance Use Assessment',
    description: 'Relapse prevention content has appeared repeatedly across sessions but no H0001 (substance use assessment) has been billed in the past 90 days.',
    triggerCondition: {
      categoryPresent: 'interventions.relapsePreventionIntervention',
      minimumOccurrences: 3,
      lookbackSessionCount: 6,
      missingCode: 'H0001',
      lookbackDays: 90
    },
    severity: 'warning',
    message: 'Relapse prevention is a recurring clinical focus, but no substance use assessment (H0001) has been documented recently. If substance use has been formally assessed, consider documenting an updated SUD assessment.',
    suggestedAction: 'If the clinical picture warrants it, conduct or document an H0001 assessment. If already completed, verify it is documented in the record.',
    missedCodeOpportunity: 'H0001',
    documentationGapMessage: 'Frequency, quantity, recency, and clinical severity of substance use are not documented alongside relapse prevention interventions.'
  },

  repeatedScreeningsWithoutH0002: {
    id: 'repeatedScreeningsWithoutH0002',
    label: 'Validated Screenings Without H0002 Billing',
    description: 'Session notes contain references to screening instruments (PHQ-9, GAD-7, AUDIT, C-SSRS, etc.) but H0002 has not been billed.',
    triggerCondition: {
      categoryPresent: 'screening',
      minimumOccurrences: 1,
      lookbackSessionCount: 2,
      missingCode: 'H0002'
    },
    severity: 'opportunity',
    message: 'A validated screening instrument was referenced in recent sessions but H0002 was not billed. Confirm that a formal scoring and interpretation occurred; if so, H0002 may be billable.',
    suggestedAction: 'Verify whether a validated screening instrument was formally administered with a score documented. If yes, bill H0002 and ensure documentation includes tool name, score, interpretation, and clinical action.',
    missedCodeOpportunity: 'H0002',
    documentationGapMessage: 'Screening tool name, score, interpretation, and action taken are not fully documented.'
  },

  repeatedReassessmentContentWithoutH0031: {
    id: 'repeatedReassessmentContentWithoutH0031',
    label: 'Reassessment Content Without H0031 Billing',
    description: 'Multiple sessions contain clinical reassessment language (updated symptoms, diagnostic review, functioning changes, risk changes) without H0031 being billed.',
    triggerCondition: {
      categoryPresent: ['symptoms', 'diagnosis', 'risk', 'functioning'],
      minimumCategoriesPresent: 3,
      minimumOccurrences: 1,
      lookbackSessionCount: 2,
      missingCode: 'H0031'
    },
    severity: 'opportunity',
    message: 'Session contains multiple assessment elements (symptoms, diagnosis, risk, functioning) indicative of a clinical reassessment. If H0031 criteria are met, this service may be billable.',
    suggestedAction: 'Review whether the session constitutes a billable reassessment. H0031 requires review of symptoms, functioning, risk, and/or diagnostic impression. If those elements are present, bill H0031.',
    missedCodeOpportunity: 'H0031',
    documentationGapMessage: 'Assessment content across symptoms, risk, diagnosis, and functioning is present but may not be documented with sufficient clinical depth to support H0031.'
  },

  overuseOf90837: {
    id: 'overuseOf90837',
    label: '90837 Frequent Use Pattern',
    description: 'Client has been consistently billed at 90837 (53+ minutes) for most or all recent sessions. Payers may flag this as statistically unusual.',
    triggerCondition: {
      codePresent: '90837',
      minimumOccurrences: 5,
      lookbackSessionCount: 6,
      threshold: 0.83
    },
    severity: 'audit_risk',
    message: '90837 has been billed in the majority of recent sessions. While appropriate, high frequency of 90837 use is an audit risk. Ensure all sessions are fully documented with exact start/end time and sufficient clinical content to justify 53+ minutes.',
    suggestedAction: 'Audit session documentation for the flagged sessions. Confirm each session has start/end time, clinical content justifying 53+ minutes, and documented client response. Consider whether some sessions may be more accurately billed as 90834.',
    auditRiskLevel: 'moderate',
    documentationGapMessage: 'Session notes for 90837 sessions may lack specific start/end times or sufficient clinical depth to justify full session length.'
  },

  underuseOfH2014: {
    id: 'underuseOfH2014',
    label: 'Skills Training Content Without H2014 Billing',
    description: 'Session notes frequently reference skills teaching (coping skills, emotion regulation, DBT skills, relaxation) but H2014 (skills training) has not been billed.',
    triggerCondition: {
      categoryPresent: [
        'interventions.mindfulnessRelaxation',
        'interventions.dbt',
        'interventions.cbt'
      ],
      minimumOccurrences: 3,
      lookbackSessionCount: 5,
      missingCode: 'H2014'
    },
    severity: 'opportunity',
    message: 'Skills-based intervention content is present in multiple sessions but H2014 has not been billed. If skills were actively taught and practiced (not just discussed), H2014 may be billable.',
    suggestedAction: 'Review whether sessions involved formal skill instruction and practice. H2014 requires teaching, modeling, or practicing a specific skill — not just discussion. If so, bill H2014 and document the skill name, how it was practiced, and the client\'s response.',
    missedCodeOpportunity: 'H2014',
    documentationGapMessage: 'Skills training documentation may lack specificity about which skill was taught, how it was practiced, and how the client plans to use it in daily life.'
  },

  repeatedTraumaWithoutPlanUpdate: {
    id: 'repeatedTraumaWithoutPlanUpdate',
    label: 'Repeated Trauma Themes Without Treatment Plan Update',
    description: 'Trauma-related themes have surfaced in multiple sessions without a corresponding update to the treatment plan to address trauma-focused work.',
    triggerCondition: {
      categoryPresent: ['trauma', 'symptoms.trauma'],
      minimumOccurrences: 3,
      lookbackSessionCount: 6,
      missingPlanElement: 'trauma_in_treatment_plan'
    },
    severity: 'clinical_gap',
    message: 'Trauma content has appeared in multiple sessions, but the treatment plan does not appear to include a trauma-specific goal or trauma-focused treatment approach. If trauma is a clinical focus, the treatment plan should reflect this.',
    suggestedAction: 'Update the treatment plan to include a trauma-related goal, evidence-based trauma intervention (TF-CBT, EMDR, CPT), and trauma-specific objectives. Bill H0032 for the update.',
    clinicalGapMessage: 'Addressing repeated trauma themes without a trauma-informed treatment plan creates a clinical documentation gap and may undermine medical necessity support for ongoing services.',
    documentationGapMessage: 'No trauma goal, trauma-informed objective, or specific trauma intervention is documented in the active treatment plan despite repeated clinical focus on trauma content.',
    missedCodeOpportunity: 'H0032'
  },

  repeatedDepressionWithoutH0031: {
    id: 'repeatedDepressionWithoutH0031',
    label: 'Worsening Depression Without Reassessment',
    description: 'Depression signals have increased in severity or frequency across recent sessions without a formal reassessment (H0031).',
    triggerCondition: {
      categoryPresent: 'symptoms.depression',
      minimumOccurrences: 3,
      trendDirection: 'worsening',
      lookbackSessionCount: 5,
      missingCode: 'H0031'
    },
    severity: 'clinical_gap',
    message: 'Depression appears to be worsening or persistent across recent sessions without a documented clinical reassessment. A reassessment is clinically indicated and may be billable as H0031.',
    suggestedAction: 'Conduct and document a formal reassessment of depressive symptoms including severity, functional impact, risk, and diagnostic impression. Bill H0031 if criteria are met.',
    clinicalGapMessage: 'Persistently worsening depression without formal clinical reassessment creates a medical necessity documentation gap.',
    documentationGapMessage: 'Depression severity, PHQ-9 scores, functional impact, and diagnostic impression may not be updated in the record.',
    missedCodeOpportunity: 'H0031'
  }

};

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════════════════ */

// Universal module export pattern — works in browser (window.*), CommonJS, and ES modules
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS / Node.js
    module.exports = factory();
  } else {
    // Browser global
    var exports = factory();
    root.signalLibrary    = exports.signalLibrary;
    root.codeRules        = exports.codeRules;
    root.longitudinalRules = exports.longitudinalRules;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  return { signalLibrary, codeRules, longitudinalRules };
}));
