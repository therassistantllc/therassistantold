/**
 * core/shared.js
 * Thin shared helpers only. No PHI persistence and no app-specific business logic.
 *
 * Exports:
 *   window.TheraShared
 */
(function (global) {
  'use strict';

  var NS = 'therassistant';
  var SAFE_KEYS = {
    sidebar: NS + ':sidebar',
    ui: NS + ':ui'
  };

  function safeJsonParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function readLocal(key, fallback) {
    try {
      return safeJsonParse(global.localStorage.getItem(key), fallback);
    } catch (_err) {
      return fallback;
    }
  }

  function writeLocal(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function removeLocal(key) {
    try {
      global.localStorage.removeItem(key);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function byId(id) {
    return global.document.getElementById(id);
  }

  function onReady(fn) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function nowIso() {
    return new Date().toISOString();
  }

  global.TheraShared = Object.freeze({
    SAFE_KEYS: SAFE_KEYS,
    esc: esc,
    byId: byId,
    onReady: onReady,
    readLocal: readLocal,
    writeLocal: writeLocal,
    removeLocal: removeLocal,
    toArray: toArray,
    nowIso: nowIso
  });
})(window);
