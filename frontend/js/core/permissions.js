/**
 * permissions.js — THERASSISTANT Unified Permission System
 *
 * Roles: admin, super_admin, billing_specialist, billing_staff,
 *        credentialing_specialist, supervisor, front_desk,
 *        clinician, patient
 *
 * Usage:
 *   AppPermissions.can('view:claims')           → boolean
 *   AppPermissions.hasRole('admin','super_admin')→ boolean
 *   AppPermissions.currentRole()                → string
 *   AppPermissions.roleLabel()                  → display string
 *   AppPermissions.apply()                      → process data-roles / data-perm attrs
 *
 * HTML gating attributes (processed automatically on DOMContentLoaded):
 *   data-roles="admin,super_admin"   — show element only to listed roles
 *   data-roles="staff"               — show to all staff (non-patient) roles
 *   data-roles="all"                 — show to any authenticated user
 *   data-perm="view:claims"          — show if user has that permission
 *   data-min-role="supervisor"       — show if user rank >= that role's rank
 *
 * Include AFTER shared.js.
 */
'use strict';

(function () {

  /* ── Role rank (higher = more permissive) ───────────────────────────────── */
  var ROLE_RANK = {
    patient:                  0,
    front_desk:               1,
    clinician:                2,
    supervisor:               3,
    credentialing_specialist: 3,
    billing_specialist:       3,
    billing_staff:            3,
    admin:                    4,
    super_admin:              5
  };

  /* ── Shorthand role groups ──────────────────────────────────────────────── */
  var G = {
    all_staff: ['admin', 'super_admin', 'billing_specialist', 'billing_staff',
                'credentialing_specialist', 'supervisor', 'front_desk', 'clinician'],
    admin_only:  ['admin', 'super_admin'],
    billing:     ['admin', 'super_admin', 'billing_specialist', 'billing_staff'],
    clinical:    ['clinician', 'supervisor'],
    ops:         ['admin', 'super_admin', 'billing_specialist', 'billing_staff', 'supervisor', 'front_desk'],
    leadership:  ['admin', 'super_admin', 'supervisor']
  };

  /* ── Permission definitions ─────────────────────────────────────────────── */
  /* Key format: 'domain:action' */
  var PERMISSIONS = {
    // ── Patient data ──────────────────────────────────────────────────────
    'view:all_patients':        G.ops.concat(['clinician']),
    'view:own_patients':        G.clinical,
    'edit:patient':             G.all_staff,
    'delete:patient':           G.admin_only,

    // ── Clinical tools ────────────────────────────────────────────────────
    'view:clinical_tools':      G.clinical,
    'action:write_note':        G.clinical,
    'action:route_to_biller':   G.clinical,
    'action:new_session':       G.clinical,

    // ── Scheduling ────────────────────────────────────────────────────────
    'view:scheduling':          ['admin', 'super_admin', 'clinician', 'supervisor', 'front_desk'],
    'action:schedule_appt':     ['admin', 'super_admin', 'clinician', 'supervisor', 'front_desk'],
    'action:cancel_appt':       ['admin', 'super_admin', 'supervisor', 'front_desk'],

    // ── Billing & claims ──────────────────────────────────────────────────
    'view:claims':              G.billing.concat(['supervisor']),
    'view:billing_alerts':      G.billing.concat(['clinician', 'supervisor']),
    'view:era':                 G.billing,
    'view:payment_posting':     G.billing,
    'view:work_queue':          G.billing.concat(['supervisor']),
    'view:revenue':             G.billing.concat(['supervisor']),
    'action:submit_claim':      G.billing,
    'action:post_payment':      G.billing,
    'action:write_off':         G.billing,
    'action:approve_adjustment':['admin', 'super_admin', 'billing_specialist'],

    // ── Eligibility ───────────────────────────────────────────────────────
    'view:eligibility':         G.ops,
    'action:run_eligibility':   G.billing.concat(['front_desk']),

    // ── Credentialing ─────────────────────────────────────────────────────
    'view:credentialing':       ['admin', 'super_admin', 'credentialing_specialist'],
    'edit:credentialing':       ['admin', 'super_admin', 'credentialing_specialist'],

    // ── Reports & analytics ───────────────────────────────────────────────
    'view:reports':             G.billing.concat(['supervisor', 'clinician']),
    'view:analytics':           G.admin_only,
    'action:export_data':       G.billing,

    // ── Communication ─────────────────────────────────────────────────────
    'view:tickets':             G.ops.concat(['clinician']),
    'view:chat':                G.all_staff,
    'view:correspondence':      G.ops,

    // ── User & org management ─────────────────────────────────────────────
    'view:users':               G.admin_only,
    'action:manage_users':      G.admin_only,
    'view:staff':               G.leadership,
    'view:subscriptions':       G.admin_only,
    'view:notifications':       G.admin_only,
    'view:client_accounts':     G.ops,

    // ── System ────────────────────────────────────────────────────────────
    'view:system_settings':     G.admin_only,
    'action:system_settings':   G.admin_only,
    'view:platform_docs':       G.admin_only,
    'view:code_rules':          G.billing,
    'view:qa_queue':            G.billing.concat(['supervisor']),

    // ── Personal settings (all staff) ─────────────────────────────────────
    'view:own_settings':        G.all_staff,
    'view:own_subscription':    ['clinician', 'supervisor', 'front_desk'],
    'view:own_payments':        ['clinician', 'supervisor', 'front_desk'],

    // ── Patient portal ────────────────────────────────────────────────────
    'view:patient_portal':      ['patient'],
    'view:own_appointments':    ['patient'],
    'view:own_invoices':        ['patient'],
    'view:own_forms':           ['patient'],
    'view:own_messages':        ['patient'],
    'view:telehealth_link':     ['patient']
  };

  /* ── Role display labels ────────────────────────────────────────────────── */
  var ROLE_LABELS = {
    admin:                    'Admin',
    super_admin:              'Super Admin',
    billing_specialist:       'Billing Specialist',
    billing_staff:            'Billing Staff',
    credentialing_specialist: 'Credentialing Specialist',
    clinician:                'Clinician',
    supervisor:               'Clinical Supervisor',
    front_desk:               'Front Desk',
    patient:                  'Patient'
  };

  /* ── Role portal badge labels ───────────────────────────────────────────── */
  var PORTAL_LABELS = {
    admin:                    'Admin Portal',
    super_admin:              'Admin Portal',
    billing_specialist:       'Billing',
    billing_staff:            'Billing',
    credentialing_specialist: 'Credentialing',
    clinician:                'Clinician Portal',
    supervisor:               'Supervisor',
    front_desk:               'Front Desk',
    patient:                  'My Portal'
  };

  /* ── Current role ───────────────────────────────────────────────────────── */
  function currentRole() {
    if (document.body && document.body.dataset.role) return document.body.dataset.role;
    try {
      var raw = JSON.parse(localStorage.getItem('sb-kozdkixjhtbfhktpvzvk-auth-token') || '{}');
      return (raw && raw.user && raw.user.user_metadata && raw.user.user_metadata.role) || 'clinician';
    } catch (e) { return 'clinician'; }
  }

  /* ── Public helpers ─────────────────────────────────────────────────────── */
  function hasRole(/* ...roleNames */) {
    var role = currentRole();
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] === role) return true;
    }
    return false;
  }

  function can(action) {
    var roles = PERMISSIONS[action];
    if (!roles) return false;
    return roles.indexOf(currentRole()) !== -1;
  }

  function roleLabel(role) {
    return ROLE_LABELS[role || currentRole()] || role || 'User';
  }

  function portalLabel(role) {
    return PORTAL_LABELS[role || currentRole()] || 'Portal';
  }

  /* ── DOM permission application ─────────────────────────────────────────── */
  /**
   * Process all [data-roles], [data-perm], and [data-min-role] elements.
   * Called automatically on DOMContentLoaded and also exposed as .apply().
   */
  function applyPermissions() {
    var role = currentRole();

    /* data-roles="role1,role2" | "staff" | "all" */
    document.querySelectorAll('[data-roles]').forEach(function (el) {
      var raw     = el.getAttribute('data-roles') || '';
      var allowed = raw.split(',').map(function (r) { return r.trim(); });
      var visible;
      if (allowed[0] === 'all')   { visible = true; }
      else if (allowed[0] === 'staff') { visible = G.all_staff.indexOf(role) !== -1; }
      else { visible = allowed.indexOf(role) !== -1; }
      el.style.display = visible ? '' : 'none';
    });

    /* data-perm="action:name" */
    document.querySelectorAll('[data-perm]').forEach(function (el) {
      el.style.display = can(el.getAttribute('data-perm')) ? '' : 'none';
    });

    /* data-min-role="role" */
    document.querySelectorAll('[data-min-role]').forEach(function (el) {
      var minRole  = el.getAttribute('data-min-role');
      var userRank = ROLE_RANK[role]    || 0;
      var minRank  = ROLE_RANK[minRole] || 0;
      el.style.display = userRank >= minRank ? '' : 'none';
    });
  }

  /* ── Auto-apply ─────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPermissions);
  } else {
    applyPermissions();
  }

  /* ── Export ─────────────────────────────────────────────────────────────── */
  window.AppPermissions = {
    can:          can,
    hasRole:      hasRole,
    currentRole:  currentRole,
    roleLabel:    roleLabel,
    portalLabel:  portalLabel,
    apply:        applyPermissions,
    PERMISSIONS:  PERMISSIONS,
    ROLE_RANK:    ROLE_RANK,
    G:            G
  };

}());
