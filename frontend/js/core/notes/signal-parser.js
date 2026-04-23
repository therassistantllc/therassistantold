/**
 * notes/signal-parser.js
 * Canonical parser that consumes TheraSignalLibrary instead of redefining its own library.
 *
 * Exports:
 *   window.TheraSignalParser
 */
(function (global) {
  'use strict';

  function normalize(text) {
    return String(text || '').toLowerCase();
  }

  function walkSignals(library) {
    var rows = [];
    Object.keys(library).forEach(function (groupKey) {
      var group = library[groupKey];
      Object.keys(group).forEach(function (signalKey) {
        var entry = group[signalKey];
        rows.push({
          path: groupKey + '.' + signalKey,
          label: entry.label,
          signals: entry.signals || []
        });
      });
    });
    return rows;
  }

  function parseText(text) {
    var lib = global.TheraSignalLibrary;
    if (!lib) throw new Error('TheraSignalLibrary is required.');

    var haystack = normalize(text);
    var matches = walkSignals(lib.categories).map(function (entry) {
      var hits = entry.signals.filter(function (term) {
        return haystack.indexOf(normalize(term)) >= 0;
      });
      return {
        path: entry.path,
        label: entry.label,
        hits: hits,
        count: hits.length
      };
    }).filter(function (entry) {
      return entry.count > 0;
    });

    return {
      matches: matches,
      totalHits: matches.reduce(function (sum, row) { return sum + row.count; }, 0)
    };
  }

  function scoreCodes(text) {
    var lib = global.TheraSignalLibrary;
    if (!lib) throw new Error('TheraSignalLibrary is required.');

    var parsed = parseText(text);
    var matchedPaths = parsed.matches.map(function (row) { return row.path; });

    var results = Object.keys(lib.codeRules).map(function (code) {
      var rule = lib.codeRules[code];
      var hits = (rule.requiredSignals || []).filter(function (path) {
        return matchedPaths.indexOf(path) >= 0;
      });

      return {
        code: code,
        matchedRequiredSignals: hits,
        score: hits.length,
        thresholdMet: hits.length >= (rule.minHits || 0),
        exclusions: rule.exclusions || []
      };
    });

    return {
      parsed: parsed,
      codeResults: results
    };
  }

  global.TheraSignalParser = Object.freeze({
    parseText: parseText,
    scoreCodes: scoreCodes
  });
})(window);
