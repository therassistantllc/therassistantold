/**
 * core/permissions.js
 * Canonical role and permission source for THERASSISTANT.
 *
 * Exports:
 *   window.TheraPermissions
 */
(function (global) {
  'use strict';

  var ROLE_RANK = {
    patient: 0,
    front_desk: 1,
    clinician: 2,
    supervisor: 3,
    credentialing_specialist: 3,
    billing_specialist: 3,
    billing_staff: 3,
    admin: 4,
    super_admin: 5
  };

  var GROUPS = {
    all_staff: ['admin', 'super_admin', 'billing_specialist', 'billing_staff', 'credentialing_specialist', 'supervisor', 'front_desk', 'clinician'],
    admin_only: ['admin', 'super_admin'],
    billing: ['admin', 'super_admin', 'billing_specialist', 'billing_staff'],
    clinical: ['clinician', 'supervisor'],
    ops: ['admin', 'super_admin', 'billing_specialist', 'billing_staff', 'supervisor', 'front_desk'],
    leadership: ['admin', 'super_admin', 'supervisor']
  };

  var PERMISSIONS = {
    'clients.read': GROUPS.ops.concat(['clinician']),
    'clients.write': GROUPS.all_staff,
    'appointments.read': ['admin', 'super_admin', 'clinician', 'supervisor', 'front_desk'],
    'appointments.write': ['admin', 'super_admin', 'clinician', 'supervisor', 'front_desk'],
    'encounters.read': GROUPS.clinical.concat(['admin', 'super_admin', 'billing_specialist', 'billing_staff']),
    'encounters.write': GROUPS.clinical,
    'notes.write': GROUPS.clinical,
    'claims.read': GROUPS.billing.concat(['supervisor']),
    'claims.write': GROUPS.billing,
    'eligibility.read': GROUPS.billing.concat(['front_desk']),
    'eligibility.run': GROUPS.billing.concat(['front_desk']),
    'payments.read': GROUPS.billing,
    'payments.post': GROUPS.billing,
    'workqueue.read': GROUPS.billing.concat(['supervisor', 'front_desk']),
    'workqueue.write': GROUPS.billing.concat(['supervisor']),
    'tickets.read': GROUPS.all_staff,
    'tickets.write': GROUPS.all_staff,
    'admin.read': GROUPS.admin_only,
    'admin.write': GROUPS.admin_only
  };

  function uniq(list) {
    return Array.from(new Set(list));
  }

  function expandRoleGroup(groupOrRole) {
    return GROUPS[groupOrRole] ? GROUPS[groupOrRole].slice() : [groupOrRole];
  }

  function getRole() {
    return (global.__THERA_USER__ && global.__THERA_USER__.role) || 'patient';
  }

  function hasRole() {
    var current = getRole();
    var wanted = Array.prototype.slice.call(arguments).flatMap(expandRoleGroup);
    return uniq(wanted).indexOf(current) >= 0;
  }

  function can(permission, role) {
    var currentRole = role || getRole();
    var roles = PERMISSIONS[permission] || [];
    return roles.indexOf(currentRole) >= 0;
  }

  function rank(role) {
    return ROLE_RANK[role] || 0;
  }

  function meetsMinRole(minRole, currentRole) {
    return rank(currentRole || getRole()) >= rank(minRole);
  }

  function apply(root) {
    var doc = root || global.document;

    doc.querySelectorAll('[data-roles]').forEach(function (el) {
      var raw = String(el.getAttribute('data-roles') || '').trim();
      if (!raw) return;
      var allowed = raw.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
      var ok = allowed.some(function (value) { return hasRole(value); });
      el.hidden = !ok;
    });

    doc.querySelectorAll('[data-perm]').forEach(function (el) {
      var perm = String(el.getAttribute('data-perm') || '').trim();
      el.hidden = !can(perm);
    });

    doc.querySelectorAll('[data-min-role]').forEach(function (el) {
      var minRole = String(el.getAttribute('data-min-role') || '').trim();
      el.hidden = !meetsMinRole(minRole);
    });
  }

  global.TheraPermissions = Object.freeze({
    ROLE_RANK: ROLE_RANK,
    GROUPS: GROUPS,
    PERMISSIONS: PERMISSIONS,
    getRole: getRole,
    hasRole: hasRole,
    can: can,
    rank: rank,
    meetsMinRole: meetsMinRole,
    apply: apply
  });
})(window);
