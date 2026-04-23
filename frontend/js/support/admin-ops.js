/* =============================================================
   admin-ops.js  —  THERASSISTANT Operations Platform
   Shared constants, helpers, and logic for the admin portal.
   Include AFTER shared.js on any admin page that needs it.
   ============================================================= */

/* ────── Workflow Stages ────────────────────────────────────────── */
const WORKFLOW_STAGES = [
  'New Intake','Triage','Assigned','Researching',
  'Waiting on Client','Waiting on Insurance','Waiting on Provider',
  'Waiting on Documentation','Ready for Review','Completed','Archived'
];

/* ────── Work Types ─────────────────────────────────────────────── */
const WORK_TYPES = [
  'Research','Correction','Client Follow-Up','Provider Follow-Up',
  'Payer Follow-Up','Documentation Review','Appeal','Escalation',
  'Payment Posting','Eligibility Verification','Credentialing Follow-Up','Closure'
];

/* ────── Resolution Codes (required to close a ticket) ─────────── */
const RESOLUTION_CODES = [
  'Resolved Internally','Resolved with Payer Action','Resolved with Client Input',
  'Resolved with Provider Input','Duplicate Request','No Action Needed',
  'Referred Out','System Issue','Training Issue','Appeal Submitted',
  'Claim Corrected and Resubmitted','Payment Posted','Awaiting Final Payment'
];

/* ────── SLA Rules per priority ─────────────────────────────────── */
// overdueAfterHours: hours before a ticket is considered Overdue
// atRiskPct: percentage of SLA elapsed before At Risk
const SLA_RULES = {
  'Urgent':        { overdueAfterHours: 24,  atRiskPct: 0.75 },
  'High Priority': { overdueAfterHours: 72,  atRiskPct: 0.75 },
  'Routine':       { overdueAfterHours: 168, atRiskPct: 0.75 }
};

/* ────── Escalation Trigger Conditions ─────────────────────────── */
const ESCALATION_RULES = [
  { id: 'urgent_no_update_24h',      label: 'Urgent ticket — no update in 24 h',       severity: 'critical' },
  { id: 'waiting_insurance_14d',     label: 'Waiting on insurance 14+ days',            severity: 'high'     },
  { id: 'waiting_client_7d',         label: 'Waiting on client 7+ days',                severity: 'high'     },
  { id: 'failed_payment_5d',         label: 'Failed payment unresolved 5+ days',        severity: 'critical' },
  { id: 'repeated_coding_disputes',  label: 'Same provider: repeated coding disputes',  severity: 'high'     },
  { id: 'payer_multiple_open',       label: 'Same payer in 3+ open tickets',             severity: 'high'     },
  { id: 'reassigned_3x',             label: 'Ticket reassigned 3+ times',               severity: 'high'     },
  { id: 'qa_pending_7d',             label: 'QA item pending 7+ days without review',   severity: 'high'     }
];

/* ────── Internal Communication Templates ───────────────────────── */
const INTERNAL_TEMPLATES = {
  'Appeal Initiated':
    'Appeal has been initiated for this claim. Documentation submitted to payer on [DATE].',
  'Payer Called':
    'Payer contacted by phone on [DATE]. Reference #: [REF]. Next follow-up: [DATE].',
  'Client Follow-Up Sent':
    'Follow-up communication sent to client on [DATE]. Awaiting response.',
  'Provider Follow-Up Sent':
    'Follow-up communication sent to provider on [DATE] regarding [ISSUE]. Awaiting response.',
  'Documentation Received':
    'Documentation received from [SOURCE] on [DATE]. Attached and under review.',
  'Awaiting EOB':
    'Awaiting EOB from [PAYER]. Follow-up call scheduled for [DATE].',
  'Claim Resubmitted':
    'Claim [CLAIM_ID] corrected and resubmitted on [DATE]. Expected processing in [TIMEFRAME].',
  'Eligibility Verified':
    'Eligibility verified for [CLIENT] on [DATE]. Benefits: [BENEFITS_SUMMARY].',
  'Payment Posted':
    'Payment of $[AMOUNT] posted on [DATE] for [PAYER]. Reference #: [REF].',
  'Case Closed - Resolved':
    'Case closed [DATE]. Resolution: [RESOLUTION_CODE]. All actions completed.',
  'Escalation Notice':
    'This ticket has been escalated on [DATE] due to [REASON]. Escalation level: [LEVEL].'
};

/* ────── Correspondence Automation Prompts ──────────────────────── */
// Maps document type → suggested next workflow action
const CORR_AUTOMATION_PROMPTS = {
  'Denial Letter': {
    action:    'Appeal Workflow',
    steps:     ['Review denial reason code','Gather supporting clinical documentation','Draft appeal letter','Submit appeal within 30-day window'],
    workType:  'Appeal',
    urgency:   'High Priority'
  },
  'Recoupment Notice': {
    action:    'Refund / Rebuttal Workflow',
    steps:     ['Review recoupment calculation','Identify disputed claims','Draft rebuttal or arrange repayment','Respond within 30 days of notice date'],
    workType:  'Correction',
    urgency:   'High Priority'
  },
  'EOB': {
    action:    'Payment Variance Review',
    steps:     ['Compare paid amount vs. billed amount','Identify any underpayments or contractual adjustments','Post payment or initiate payment dispute','Document in payment log'],
    workType:  'Payment Posting',
    urgency:   'Routine'
  },
  'Prior Authorization Notice': {
    action:    'Appeal or Peer-to-Peer Request',
    steps:     ['Determine if PA was denied or approved','If denied: initiate peer-to-peer or formal appeal','Note appeal deadline','Coordinate with clinical staff'],
    workType:  'Appeal',
    urgency:   'Urgent'
  },
  'Credentialing Letter': {
    action:    'Credentialing Follow-Up',
    steps:     ['Review letter for action items','Update credentialing tracker','Contact payer credentialing department if needed','Set follow-up reminder for 30 days'],
    workType:  'Credentialing Follow-Up',
    urgency:   'Routine'
  },
  'Medical Records Request': {
    action:    'Documentation Submission',
    steps:     ['Pull requested records (check authorization)','Redact per HIPAA requirements','Submit within the stated compliance deadline','Document submission in chart'],
    workType:  'Documentation Review',
    urgency:   'High Priority'
  },
  'Appeal': {
    action:    'Appeal Tracking',
    steps:     ['Log appeal submission date and reference number','Set follow-up for expected decision date','Track outcome (approved/upheld/denied)','Escalate if no response within 45 days'],
    workType:  'Appeal',
    urgency:   'High Priority'
  },
  'Reconsideration': {
    action:    'Reconsideration Tracking',
    steps:     ['Log submission date and reference #','Follow up with payer at 30-day mark','Document outcome','Escalate to formal appeal if denied'],
    workType:  'Payer Follow-Up',
    urgency:   'Routine'
  },
  'Refund Request': {
    action:    'Refund Processing',
    steps:     ['Verify overpayment or billing error','Obtain write-off or refund approval','Process refund per policy','Update billing ledger and notify payer'],
    workType:  'Payment Posting',
    urgency:   'High Priority'
  }
};

/* ────── Staff Workload Thresholds ──────────────────────────────── */
const WORKLOAD_THRESHOLDS = {
  light:    { min: 0,  max: 5,  label: 'Light',    color: '#10b981' },
  moderate: { min: 6,  max: 12, label: 'Moderate', color: '#3b82f6' },
  heavy:    { min: 13, max: 20, label: 'Heavy',     color: '#f59e0b' },
  critical: { min: 21, max: Infinity, label: 'Critical', color: '#ef4444' }
};

/* ─────────────────────────────────────────────────────────────────
   HELPER FUNCTIONS
   ───────────────────────────────────────────────────────────────── */

/**
 * Returns SLA status for a ticket: 'under' | 'at-risk' | 'overdue'
 * Only applies to open tickets (Completed/Closed/Archived return null).
 */
function getSLAStatus(ticket) {
  const closedStatuses = ['Completed','Closed','Archived'];
  if (closedStatuses.includes(ticket.status)) return null;

  const rule = SLA_RULES[ticket.priority] || SLA_RULES['Routine'];
  const created = new Date(ticket.dateSubmitted || ticket.created || Date.now());
  const elapsedHours = (Date.now() - created.getTime()) / 3_600_000;
  const pctElapsed = elapsedHours / rule.overdueAfterHours;

  if (pctElapsed >= 1) return 'overdue';
  if (pctElapsed >= rule.atRiskPct) return 'at-risk';
  return 'under';
}

/**
 * Returns a human-readable aging label for a ticket.
 */
function getAgingLabel(ticket) {
  const created = new Date(ticket.dateSubmitted || ticket.created || Date.now());
  const hours = (Date.now() - created.getTime()) / 3_600_000;
  if (hours < 24)  return '< 1 day';
  if (hours < 72)  return '1–3 days';
  if (hours < 168) return '3–7 days';
  if (hours < 336) return '1–2 weeks';
  if (hours < 720) return '2–4 weeks';
  return '1+ month';
}

/**
 * Computes a workload object { count, tier, label, color } for a staff member.
 */
function calcWorkloadScore(staffName, tickets) {
  const open = tickets.filter(t =>
    (t.assignedTo || '').toLowerCase() === staffName.toLowerCase() &&
    !['Completed','Closed','Archived'].includes(t.status)
  );
  const count = open.length;
  let tier;
  if (count <= 5)  tier = 'light';
  else if (count <= 12) tier = 'moderate';
  else if (count <= 20) tier = 'heavy';
  else tier = 'critical';
  return { count, ...WORKLOAD_THRESHOLDS[tier] };
}

/**
 * Evaluates all escalation rules against the current ticket list.
 * Returns array of { ruleId, label, severity, ticketId? } objects.
 */
function checkEscalationTriggers(tickets) {
  const now = Date.now();
  const triggered = [];

  tickets.forEach(t => {
    const openStatuses = ['New','Pending','Waiting on Client','Waiting on Insurance',
                          'Waiting on Provider','Assigned','Researching',
                          'New Intake','Triage','Waiting on Documentation'];
    if (!openStatuses.includes(t.status)) return;

    const ageH = (now - new Date(t.dateSubmitted || t.created || now).getTime()) / 3_600_000;

    // Urgent no-update 24h
    if (t.priority === 'Urgent' && ageH >= 24) {
      const lastUpdate = new Date(t.lastUpdated || t.dateSubmitted || 0).getTime();
      if ((now - lastUpdate) / 3_600_000 >= 24) {
        triggered.push({ ruleId:'urgent_no_update_24h', severity:'critical', ticketId: t.id,
          label: `Urgent ticket ${t.id} — no update in 24h` });
      }
    }

    // Waiting on insurance 14 days
    const isWaitingIns = ['Waiting on Insurance','waiting-ins'].some(s =>
      t.status === s || t.workflowStage === 'Waiting on Insurance');
    if (isWaitingIns && ageH >= 336) {
      triggered.push({ ruleId:'waiting_insurance_14d', severity:'high', ticketId: t.id,
        label: `Ticket ${t.id} — waiting on insurance 14+ days` });
    }

    // Waiting on client 7 days
    const isWaitingClient = t.status === 'Waiting on Client' || t.workflowStage === 'Waiting on Client';
    if (isWaitingClient && ageH >= 168) {
      triggered.push({ ruleId:'waiting_client_7d', severity:'high', ticketId: t.id,
        label: `Ticket ${t.id} — waiting on client 7+ days` });
    }
  });

  // Reassigned 3+ times — check history if available
  // (requires caller to pass history array; skip here, handled in support-center.html)

  // Same payer in 3+ open tickets
  const payerCounts = {};
  tickets.filter(t => !['Completed','Closed','Archived'].includes(t.status))
    .forEach(t => { if (t.insurance) payerCounts[t.insurance] = (payerCounts[t.insurance]||0)+1; });
  Object.entries(payerCounts).forEach(([payer, count]) => {
    if (count >= 3) {
      triggered.push({ ruleId:'payer_multiple_open', severity:'high', ticketId: null,
        label: `${payer} — ${count} open tickets (payer volume alert)` });
    }
  });

  return triggered;
}

/* ────── Badge Renderers ────────────────────────────────────────── */

function workflowBadge(stage) {
  const map = {
    'New Intake':             { bg:'#dbeafe', color:'#1d4ed8' },
    'Triage':                 { bg:'#fef3c7', color:'#92400e' },
    'Assigned':               { bg:'#ede9fe', color:'#5b21b6' },
    'Researching':            { bg:'#dbeafe', color:'#1e40af' },
    'Waiting on Client':      { bg:'#fff7ed', color:'#c2410c' },
    'Waiting on Insurance':   { bg:'#fef9c3', color:'#713f12' },
    'Waiting on Provider':    { bg:'#fce7f3', color:'#9d174d' },
    'Waiting on Documentation':{ bg:'#fee2e2', color:'#991b1b' },
    'Ready for Review':       { bg:'#d1fae5', color:'#065f46' },
    'Completed':              { bg:'#dcfce7', color:'#166534' },
    'Archived':               { bg:'#f1f5f9', color:'#475569' }
  };
  const s = map[stage] || { bg:'#f1f5f9', color:'#475569' };
  const esc = String(stage||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:${s.bg};color:${s.color}">${esc}</span>`;
}

function workTypeBadge(type) {
  const esc = String(type||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:#e0f2fe;color:#0369a1">${esc}</span>`;
}

function slaBadge(status) {
  if (!status) return '';
  const map = {
    'under':    { bg:'#d1fae5', color:'#065f46', label:'Under SLA' },
    'at-risk':  { bg:'#fef3c7', color:'#92400e', label:'At Risk' },
    'overdue':  { bg:'#fee2e2', color:'#991b1b', label:'Overdue' }
  };
  const s = map[status] || map['under'];
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:${s.bg};color:${s.color}">${s.label}</span>`;
}

function agingBadge(label) {
  const esc = String(label||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const isOld = label && (label.includes('1+') || label.includes('2–4') || label.includes('1–2 weeks'));
  const bg = isOld ? '#fee2e2' : '#f1f5f9';
  const color = isOld ? '#991b1b' : '#475569';
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:${bg};color:${color}">${esc}</span>`;
}

function workloadBadge(tier) {
  const w = WORKLOAD_THRESHOLDS[tier] || WORKLOAD_THRESHOLDS.light;
  return `<span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${w.color}22;color:${w.color}">${w.label}</span>`;
}

/* ────── Automation Prompt Renderer (for correspondence) ─────────── */
function renderAutomationPrompt(docType) {
  const prompt = CORR_AUTOMATION_PROMPTS[docType];
  if (!prompt) return '';
  const stepsHtml = prompt.steps.map(s =>
    `<li style="margin-bottom:4px;font-size:12.5px;color:var(--ink-900)">${s.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</li>`
  ).join('');
  return `
    <div style="margin:14px 0;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#1d4ed8;margin-bottom:6px">
        ⚡ Suggested Workflow: ${prompt.action.replace(/&/g,'&amp;')}
      </div>
      <ol style="margin:0;padding-left:18px">${stepsHtml}</ol>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <span style="font-size:11px;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:99px;font-weight:700">
          Work Type: ${prompt.workType}
        </span>
        <span style="font-size:11px;background:#fef9c3;color:#713f12;padding:2px 8px;border-radius:99px;font-weight:700">
          Suggested Priority: ${prompt.urgency}
        </span>
      </div>
    </div>`;
}

/* ────── Template Quick-Insert ───────────────────────────────────── */
function insertTemplate(templateKey, targetInputId) {
  const text = INTERNAL_TEMPLATES[templateKey];
  if (!text) return;
  const el = document.getElementById(targetInputId);
  if (!el) return;
  const cur = el.value.trim();
  el.value = cur ? cur + '\n\n' + text : text;
  el.focus();
  el.dispatchEvent(new Event('input'));
}

function renderTemplateMenu(targetInputId) {
  const keys = Object.keys(INTERNAL_TEMPLATES);
  return `<div style="position:relative;display:inline-block">
    <button class="btn btn-outline btn-sm" type="button"
      onclick="document.getElementById('tmpl-menu-${targetInputId}').classList.toggle('open')"
      style="font-size:12px">
      📋 Templates ▾
    </button>
    <div id="tmpl-menu-${targetInputId}"
      style="display:none;position:absolute;bottom:calc(100% + 6px);left:0;z-index:100;
             background:#fff;border:1px solid var(--border);border-radius:10px;
             box-shadow:var(--shadow-md);min-width:240px;padding:6px 0;max-height:280px;overflow-y:auto">
      ${keys.map(k => `
        <div onclick="insertTemplate('${k.replace(/'/g,"\\'")}','${targetInputId}');document.getElementById('tmpl-menu-${targetInputId}').classList.remove('open')"
          style="padding:8px 14px;font-size:12.5px;cursor:pointer;white-space:nowrap;
                 color:var(--ink-900);font-weight:500"
          onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''">${k}</div>
      `).join('')}
    </div>
  </div>`;
}

// Close template menus on outside click
document.addEventListener('click', e => {
  if (!e.target.dataset.tmplTrigger) {
    document.querySelectorAll('[id^="tmpl-menu-"]').forEach(el => {
      if (!el.contains(e.target)) el.style.display = 'none';
    });
  }
});
