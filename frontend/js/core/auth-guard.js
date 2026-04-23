// THERASSISTANT — auth-guard.js
// Client-side authentication, role-based access control, preview mode, and multi-tab sync.
// Include on every protected page AFTER the Supabase CDN script and shared.js.

(function () {
  'use strict';

  // ── Role → permission matrix ─────────────────────────────────────────────────
  // Namespace.action format.  '*' = all permissions.
  // Wildcard suffix 'billing.*' matches any 'billing.X'.
  const ROLE_PERMISSIONS = {
    super_admin:              ['*'],
    admin:                    ['admin.*', 'billing.*', 'credentialing.*', 'supervisor.*', 'front_desk.*', 'clinician.*', 'patient.read'],
    clinician:                ['clinician.*', 'patient.read'],
    billing_specialist:       ['billing.*', 'patient.read'],
    credentialing_specialist: ['credentialing.*', 'patient.read', 'clinician.read'],
    supervisor:               ['supervisor.*', 'clinician.read', 'patient.read'],
    front_desk:               ['front_desk.*', 'patient.read', 'patient.create', 'patient.schedule'],
    patient:                  ['patient.self'],
  };

  // Page filename → minimum permission required to access it
  // A missing entry means the page is accessible to any authenticated user.
  const PAGE_PERMISSIONS = {
    'admin-overview.html':             'admin.*',
    'admin-dashboard.html':            'admin.*',
    'admin-users.html':                'admin.*',
    'admin-sessions.html':             'admin.*',
    'admin-settings.html':             'admin.*',
    'admin-permissions.html':          'admin.*',
    'admin-subscriptions.html':        'admin.*',
    'admin-ops.js':                    'admin.*',

    'admin-staff.html':                'credentialing.*',

    'admin-financial.html':            'billing.*',
    'admin-reports.html':              'billing.*',
    'admin-billing-alerts.html':       'billing.*',
    'admin-eligibility.html':          'billing.*',
    'admin-era-imports.html':          'billing.*',
    'admin-era-detail.html':           'billing.*',
    'admin-payment-posting.html':      'billing.*',
    'admin-revenue-dashboard.html':    'billing.*',
    'admin-analytics.html':            'billing.*',
    'admin-claims.html':               'billing.*',
    'admin-claim-detail.html':         'billing.*',
    'admin-workqueue.html':            'billing.*',
    'admin-workqueue-detail.html':     'billing.*',

    'admin-qa.html':                   'supervisor.*',
    'admin-notes.html':                'supervisor.*',

    'admin-clients.html':              'front_desk.*',
    'admin-client-detail.html':        'front_desk.*',
    'admin-patient-detail.html':       'front_desk.*',
    'admin-patient-imports.html':      'front_desk.*',
    'admin-simplepractice-imports.html': 'front_desk.*',

    'dashboard.html':                  'clinician.*',
    'patients.html':                   'clinician.*',
    'scheduling.html':                 'clinician.*',
    'agenda.html':                     'clinician.*',
    'Coder.html':                      'clinician.*',
    'coder-home.html':                 'clinician.*',
    'saved-notes.html':                'clinician.*',
    'saved-reports.html':              'clinician.*',
    'H0001.html':                      'clinician.*',
    'H0031.html':                      'clinician.*',
    'H0032.html':                      'clinician.*',
    'SUDCoder.html':                   'clinician.*',
    'Psychotherapy.html':              'clinician.*',
    'settings.html':                   'clinician.*',
    'subscription.html':               'clinician.*',
    'support-center.html':             'clinician.*',
    'support-request.html':            'clinician.*',
    'admin-correspondence.html':       'clinician.*',
    'admin-chat.html':                 'clinician.*',
    'admin-notifications.html':        'clinician.*',
    'admin-content.html':              'clinician.*',
  };

  // Default landing page per role after login
  var ROLE_HOME = {
    super_admin:              'admin-overview.html',
    admin:                    'admin-dashboard.html',
    clinician:                'dashboard.html',
    billing_specialist:       'admin-financial.html',
    credentialing_specialist: 'admin-staff.html',
    supervisor:               'admin-qa.html',
    front_desk:               'admin-clients.html',
    patient:                  'patient-portal.html',
  };

  // ── Multi-tab session sync via BroadcastChannel ──────────────────────────────
  // When one tab logs out (or a role change is forced), all other open tabs are
  // notified and redirected to login.
  var _channel = null;
  try {
    _channel = new BroadcastChannel('therassistant_session');
    _channel.onmessage = function (e) {
      if (!e.data) return;
      if (e.data.type === 'LOGOUT') {
        supabaseClient.auth.signOut().then(function () {
          window.location.href = 'login.html';
        });
      }
      if (e.data.type === 'ROLE_CHANGED') {
        // Refresh the page so the new role takes effect in this tab as well.
        window.location.reload();
      }
    };
  } catch (_) {}

  // ── Permission helpers ───────────────────────────────────────────────────────
  function hasPermission(role, required) {
    if (!role || !required) return false;
    var perms = ROLE_PERMISSIONS[role] || [];
    if (perms.indexOf('*') !== -1) return true;
    if (perms.indexOf(required) !== -1) return true;
    // Wildcard namespace match: 'billing.*' satisfies 'billing.read'
    var reqNs = required.split('.')[0];
    for (var i = 0; i < perms.length; i++) {
      var parts = perms[i].split('.');
      if (parts[0] === reqNs && parts[1] === '*') return true;
    }
    return false;
  }

  // ── Admin preview mode (tab-scoped via sessionStorage) ───────────────────────
  // Admins can browse the app as any other role WITHOUT affecting their session.
  // Preview is isolated to the current tab using sessionStorage.
  function getPreviewRole() {
    return sessionStorage.getItem('therassistant_preview_role') || null;
  }

  function getEffectiveRole(actualRole) {
    var preview = getPreviewRole();
    if (!preview) return actualRole;
    // Only super_admin and admin may use preview mode
    if (actualRole === 'super_admin' || actualRole === 'admin') return preview;
    return actualRole;
  }

  function injectPreviewBanner(previewRole) {
    if (document.getElementById('ta-preview-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'ta-preview-bar';
    bar.setAttribute('role', 'alert');
    bar.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:9999',
      'background:#f59e0b;color:#1a1a1a',
      'text-align:center;padding:6px 16px',
      'font-size:13px;font-weight:600;font-family:sans-serif',
      'box-shadow:0 2px 6px rgba(0,0,0,.25)',
    ].join(';');
    var displayRole = String(previewRole).replace(/_/g, ' ');
    bar.innerHTML =
      'ADMIN PREVIEW \u2014 viewing as <strong>' + displayRole + '</strong>' +
      '\u2002|\u2002<a href="#" id="ta-exit-preview" style="color:#1a1a1a;text-decoration:underline;">Exit Preview</a>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.style.paddingTop = (parseInt(document.body.style.paddingTop || '0', 10) + 34) + 'px';
    document.getElementById('ta-exit-preview').addEventListener('click', function (e) {
      e.preventDefault();
      sessionStorage.removeItem('therassistant_preview_role');
      window.location.reload();
    });
  }

  // ── Main guard ───────────────────────────────────────────────────────────────
  async function runGuard() {
    // 1. Require an active Supabase session
    var sessionResult = await supabaseClient.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if (!session) {
      window.location.href = 'login.html';
      return;
    }

    // 2. If the user has enrolled TOTP/MFA but hasn't completed it this session,
    //    send them to the MFA verification page.
    try {
      var aalResult = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
      var aal = aalResult && aalResult.data;
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        window.location.href = 'mfa-verify.html';
        return;
      }
    } catch (_) {}

    var user = session.user;
    var actualRole = (user.user_metadata && user.user_metadata.role) || 'clinician';
    var effectiveRole = getEffectiveRole(actualRole);

    // 3. Expose resolved identity to page scripts
    window.THERASSISTANT_USER = {
      id:        user.id,
      email:     user.email,
      role:      effectiveRole,
      actualRole: actualRole,
      isPreview: effectiveRole !== actualRole,
      org_id:    (user.user_metadata && user.user_metadata.org_id) || null,
      session:   session,
    };

    // 4. Check page-level permission
    var page = (window.location.pathname.split('/').pop() || 'index.html');
    var required = PAGE_PERMISSIONS[page];
    if (required && !hasPermission(effectiveRole, required)) {
      window.location.href = ROLE_HOME[effectiveRole] || 'login.html';
      return;
    }

    // 5. Preview banner for admins browsing as another role
    if (window.THERASSISTANT_USER.isPreview) {
      injectPreviewBanner(effectiveRole);
    }

    // 6. Populate common UI placeholders if present
    var emailEl = document.getElementById('nav-user-email');
    if (emailEl) emailEl.textContent = user.email;
    var roleEl = document.getElementById('nav-user-role');
    if (roleEl) roleEl.textContent = effectiveRole.replace(/_/g, ' ');
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Check whether a role has a given permission string. */
  window.guardHasPermission = hasPermission;

  /** Full permission map (read-only reference). */
  window.GUARD_ROLE_PERMISSIONS = ROLE_PERMISSIONS;

  /** Home-page map (read-only reference). */
  window.GUARD_ROLE_HOME = ROLE_HOME;

  /**
   * Start admin preview mode for the current tab.
   * Only admins and super_admins may call this.
   * Optionally records a server-side audit event.
   *
   * @param {string} targetRole — the role to preview as
   */
  window.startAdminPreview = async function (targetRole) {
    var u = window.THERASSISTANT_USER;
    if (!u || (u.actualRole !== 'super_admin' && u.actualRole !== 'admin')) {
      alert('Admin Preview requires admin or super_admin role.');
      return;
    }
    if (!ROLE_HOME[targetRole]) {
      alert('Unknown role: ' + targetRole);
      return;
    }
    // Server-side audit
    try {
      var tok = (u.session && u.session.access_token) || '';
      await fetch('/api/auth/preview-role/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ targetRole: targetRole }),
      });
    } catch (_) {}
    sessionStorage.setItem('therassistant_preview_role', targetRole);
    window.location.reload();
  };

  /** Exit preview and reload. */
  window.stopAdminPreview = function () {
    sessionStorage.removeItem('therassistant_preview_role');
    window.location.reload();
  };

  /**
   * Broadcast a logout event to all other open tabs, then sign out
   * and redirect to login.
   */
  window.broadcastLogout = async function () {
    if (_channel) _channel.postMessage({ type: 'LOGOUT' });
    // Record audit event
    try {
      var u = window.THERASSISTANT_USER;
      var tok = u && u.session && u.session.access_token;
      if (tok) {
        await fetch('/api/auth/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
          body: JSON.stringify({ event: 'logout' }),
        });
      }
    } catch (_) {}
    await supabaseClient.auth.signOut();
    localStorage.removeItem('docusistant.rememberMe');
    sessionStorage.clear();
    window.location.href = 'login.html';
  };

  // ── Run guard on DOMContentLoaded ────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runGuard);
  } else {
    runGuard();
  }

})();
