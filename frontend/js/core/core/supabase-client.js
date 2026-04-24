/**
 * core/supabase-client.js
 * Canonical Supabase bootstrap for browser pages.
 *
 * Expected globals:
 *   window.__THERA_CONFIG__ = {
 *     supabaseUrl: string,
 *     supabaseAnonKey: string
 *   }
 *
 * Exports:
 *   window.TheraSupabase.getClient()
 *   window.TheraSupabase.requireClient()
 */
(function (global) {
  'use strict';

  function readConfig() {
    var cfg = global.__THERA_CONFIG__ || {};
    return {
      supabaseUrl: cfg.supabaseUrl || '',
      supabaseAnonKey: cfg.supabaseAnonKey || ''
    };
  }

  function hasSdk() {
    return !!(global.supabase && typeof global.supabase.createClient === 'function');
  }

  var client = null;

  function getClient() {
    if (client) return client;
    if (!hasSdk()) return null;

    var cfg = readConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;

    client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  }

  function requireClient() {
    var db = getClient();
    if (!db) {
      throw new Error('Supabase client is not configured. Set window.__THERA_CONFIG__.');
    }
    return db;
  }

  global.TheraSupabase = Object.freeze({
    getClient: getClient,
    requireClient: requireClient
  });
})(window);
