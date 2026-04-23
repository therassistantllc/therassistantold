/**
 * notes/note-engine.js
 * Canonical note engine for client-side form orchestration.
 *
 * Exports:
 *   window.TheraNoteEngine
 */
(function (global) {
  'use strict';

  var CONDITIONAL_FIELD_RULES = [
    {
      field: 'riskLevel',
      value: 'no_safety_concerns',
      hide: ['detailed_suicide_risk', 'si_plan_questions', 'si_intent_questions'],
      show: ['protective_factors_brief']
    },
    {
      field: 'riskLevel',
      value: 'active_si_plan',
      show: ['detailed_suicide_risk', 'si_plan_questions', 'si_intent_questions', 'safety_plan_review'],
      hide: []
    },
    {
      field: 'visitType',
      value: 'routine_followup',
      hide: ['full_intake_sections', 'asam_dimensions'],
      show: ['routine_progress', 'brief_risk', 'brief_mse']
    },
    {
      field: 'visitType',
      value: 'intake_assessment',
      show: ['full_intake_sections', 'diagnostic_impression_full', 'full_history', 'asam_dimensions'],
      hide: ['routine_progress']
    }
  ];

  function evaluateConditionalFields(noteState) {
    var visibleSections = new Set();
    var hiddenSections = new Set();

    CONDITIONAL_FIELD_RULES.forEach(function (rule) {
      if (noteState[rule.field] === rule.value) {
        (rule.show || []).forEach(function (item) { visibleSections.add(item); });
        (rule.hide || []).forEach(function (item) { hiddenSections.add(item); });
      }
    });

    visibleSections.forEach(function (item) { hiddenSections.delete(item); });

    return {
      visibleSections: Array.from(visibleSections),
      hiddenSections: Array.from(hiddenSections)
    };
  }

  function collectFormData(form) {
    var values = {};
    new FormData(form).forEach(function (value, key) {
      values[key] = value;
    });
    return values;
  }

  function buildSoapNote(data) {
    return [
      'S: ' + (data.subjective || ''),
      'O: ' + (data.objective || ''),
      'A: ' + (data.assessment || ''),
      'P: ' + (data.plan || '')
    ].join('\n\n').trim();
  }

  function generateNote(form, outputNode) {
    var data = collectFormData(form);
    var note = buildSoapNote(data);
    if (outputNode) outputNode.textContent = note;
    return { data: data, note: note };
  }

  global.TheraNoteEngine = Object.freeze({
    CONDITIONAL_FIELD_RULES: CONDITIONAL_FIELD_RULES,
    evaluateConditionalFields: evaluateConditionalFields,
    collectFormData: collectFormData,
    buildSoapNote: buildSoapNote,
    generateNote: generateNote
  });
})(window);
