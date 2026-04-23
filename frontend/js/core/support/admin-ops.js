/**
 * support/admin-ops.js
 * Canonical operations constants for work queue and support views.
 *
 * Exports:
 *   window.TheraOps
 */
(function (global) {
  'use strict';

  var WORKQUEUE_STAGES = [
    'new',
    'triage',
    'assigned',
    'researching',
    'waiting_client',
    'waiting_payer',
    'waiting_provider',
    'waiting_documentation',
    'ready_review',
    'completed',
    'archived'
  ];

  var WORK_TYPES = [
    'claim_correction',
    'payer_follow_up',
    'client_follow_up',
    'provider_follow_up',
    'documentation_review',
    'appeal',
    'payment_posting',
    'eligibility_verification',
    'credentialing_follow_up'
  ];

  var RESOLUTION_CODES = [
    'resolved_internal',
    'resolved_payer_action',
    'resolved_client_input',
    'resolved_provider_input',
    'duplicate_request',
    'no_action_needed',
    'system_issue',
    'appeal_submitted',
    'claim_corrected_resubmitted',
    'payment_posted'
  ];

  var SLA_RULES = {
    urgent: { overdueAfterHours: 24, atRiskPct: 0.75 },
    high: { overdueAfterHours: 72, atRiskPct: 0.75 },
    normal: { overdueAfterHours: 168, atRiskPct: 0.75 }
  };

  function hoursSince(iso) {
    if (!iso) return 0;
    return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
  }

  function getSlaState(priority, createdAt) {
    var rule = SLA_RULES[String(priority || 'normal').toLowerCase()] || SLA_RULES.normal;
    var elapsed = hoursSince(createdAt);
    if (elapsed >= rule.overdueAfterHours) return 'overdue';
    if (elapsed >= rule.overdueAfterHours * rule.atRiskPct) return 'at_risk';
    return 'within_sla';
  }

  global.TheraOps = Object.freeze({
    WORKQUEUE_STAGES: WORKQUEUE_STAGES,
    WORK_TYPES: WORK_TYPES,
    RESOLUTION_CODES: RESOLUTION_CODES,
    SLA_RULES: SLA_RULES,
    getSlaState: getSlaState
  });
})(window);
