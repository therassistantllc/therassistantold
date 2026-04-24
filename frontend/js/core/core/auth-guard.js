/**
 * core/auth-guard.js
 * Canonical page auth guard. Uses TheraSupabase and TheraPermissions.
 *
 * Optional global:
 *   window.__THERA_ROUTE_RULES__ = { "page-name.html": "claims.read" }
 *   window.__THERA_ROUTES__ = { login: "/login.html", forbidden: "/forbidden.html" }
 *
 * Exports:
 *   window.TheraAuthGuard.init()
 *   window.TheraAuthGuard.getSessionUser()
 */
(function (global) {
  'use strict';

  var cachedUser = null;

  function pathname() {
    var parts = global.location.pathname.split('/');
    return parts[parts.length - 1] || 'index.html';
  }

  function getRouteRules() {
    return global.__THERA_ROUTE_RULES__ || {};
  }

  function getRoutes() {
    return Object.assign({
      login: '/login.html',
      forbidden: '/forbidden.html'
    }, global.__THERA_ROUTES__ || {});
  }

  function setCurrentUser(user) {
    cachedUser = user || null;
    global.__THERA_USER__ = cachedUser;
    return cachedUser;
  }

  async function getSessionUser() {
    if (cachedUser) return cachedUser;

    var api = global.TheraSupabase;
    if (!api || typeof api.getClient !== 'function') return null;

    var db = api.getClient();
    if (!db || !db.auth || typeof db.auth.getUser !== 'function') return null;

    try {
      var result = await db.auth.getUser();
      var user = result && result.data ? result.data.user : null;
      return setCurrentUser(user);
    } catch (_err) {
      return null;
    }
  }

  function userRole(user) {
    var meta = (user && user.user_metadata) || {};
    return meta.role || meta.app_role || 'patient';
  }

  async function enforcePageAccess() {
    var user = await getSessionUser();
    var routes = getRoutes();

    if (!user) {
      global.location.replace(routes.login);
      return false;
    }

    setCurrentUser({
      id: user.id,
      email: user.email || '',
      role: userRole(user),
      raw: user
    });

    var perms = global.TheraPermissions;
    if (!perms) return true;

    var page = pathname();
    var requiredPerm = getRouteRules()[page];
    if (requiredPerm && !perms.can(requiredPerm, global.__THERA_USER__.role)) {
      global.location.replace(routes.forbidden);
      return false;
    }

    perms.apply();
    return true;
  }

  async function init() {
    return enforcePageAccess();
  }

  global.TheraAuthGuard = Object.freeze({
    init: init,
    getSessionUser: getSessionUser
  });
})(window);
