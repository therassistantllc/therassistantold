/**
 * notes/signal-library.js
 * Canonical clinical signal library.
 *
 * Exports:
 *   window.TheraSignalLibrary
 */
(function (global) {
  'use strict';

  var categories = {
    symptoms: {
      anxiety: {
        label: 'Anxiety / Worry',
        signals: ['anxiety', 'anxious', 'worried', 'restless', 'panic', 'hypervigilance']
      },
      depression: {
        label: 'Depression / Low Mood',
        signals: ['depression', 'depressed', 'sad', 'hopeless', 'worthless', 'anhedonia']
      },
      trauma: {
        label: 'Trauma Response / PTSD',
        signals: ['trauma', 'ptsd', 'flashbacks', 'nightmares', 'dissociation', 'hyperarousal']
      }
    },
    risk: {
      suicide: {
        label: 'Suicide Risk',
        signals: ['suicidal ideation', 'suicidal thoughts', 'passive si', 'active si', 'self harm']
      },
      violence: {
        label: 'Violence Risk',
        signals: ['homicidal ideation', 'violent thoughts', 'aggressive behavior']
      }
    },
    function: {
      impairment: {
        label: 'Functional Impairment',
        signals: ['missed work', 'unable to function', 'relationship conflict', 'adl impairment']
      }
    }
  };

  var codeRules = {
    H0031: {
      requiredSignals: ['symptoms.anxiety', 'risk.suicide'],
      exclusions: ['H0001'],
      minHits: 2
    },
    '90837': {
      requiredSignals: ['symptoms.depression', 'function.impairment'],
      exclusions: [],
      minHits: 2
    }
  };

  global.TheraSignalLibrary = Object.freeze({
    categories: categories,
    codeRules: codeRules
  });
})(window);
