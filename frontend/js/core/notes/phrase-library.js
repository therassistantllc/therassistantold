/**
 * notes/phrase-library.js
 * Canonical reusable phrase library.
 *
 * Exports:
 *   window.TheraPhraseLibrary
 */
(function (global) {
  'use strict';

  var categories = [
    { id: 'subjective', label: 'Subjective' },
    { id: 'progress', label: 'Progress' },
    { id: 'interventions', label: 'Interventions' },
    { id: 'risk', label: 'Risk' },
    { id: 'mse', label: 'Mental Status' },
    { id: 'treatment_plan', label: 'Treatment Plan' }
  ];

  var phrases = [
    {
      id: 'subj_001',
      category: 'subjective',
      label: 'Presenting concern',
      text: 'Client reported *** symptoms related to ***. Symptoms have been present for *** and continue to impact ***.',
      placeholders: 4
    },
    {
      id: 'prog_001',
      category: 'progress',
      label: 'Positive progress',
      text: 'Client demonstrated *** progress toward goal of *** and was able to *** since the last session.',
      placeholders: 3
    },
    {
      id: 'risk_001',
      category: 'risk',
      label: 'No acute safety concern',
      text: 'Client denied suicidal ideation, homicidal ideation, and other acute safety concerns during this encounter.',
      placeholders: 0
    }
  ];

  function byCategory(categoryId) {
    return phrases.filter(function (item) { return item.category === categoryId; });
  }

  global.TheraPhraseLibrary = Object.freeze({
    categories: categories,
    phrases: phrases,
    byCategory: byCategory
  });
})(window);
