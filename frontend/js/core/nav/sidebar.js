/**
 * nav/sidebar.js
 * Canonical unified sidebar. Replaces admin-sidebar.js, clinician-sidebar.js, and sidebar-nav.js.
 *
 * Requires:
 *   - core/shared.js
 *   - core/permissions.js
 *
 * Root selector:
 *   .dashboard-sidebar
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = (global.TheraShared && global.TheraShared.SAFE_KEYS.sidebar) || 'therassistant:sidebar';
  var DEFAULT_STATE = {
    collapsedSections: [],
    iconOnly: false,
    pinned: []
  };

  var NAV = {
    admin: [
      {
        id: 'overview',
        label: 'Overview',
        children: [{ label: 'Dashboard', href: 'admin-overview.html', perm: 'admin.read' }]
      },
      {
        id: 'revenue',
        label: 'Revenue',
        children: [
          { label: 'Claims', href: 'admin-claims.html', perm: 'claims.read' },
          { label: 'Work Queue', href: 'admin-workqueue.html', perm: 'workqueue.read' },
          { label: 'Payments', href: 'admin-payment-posting.html', perm: 'payments.read' },
          { label: 'Eligibility', href: 'admin-eligibility.html', perm: 'eligibility.read' }
        ]
      },
      {
        id: 'ops',
        label: 'Operations',
        children: [
          { label: 'Billing Alerts', href: 'admin-billing-alerts.html', perm: 'workqueue.read' },
          { label: 'Support Tickets', href: 'support-center.html', perm: 'tickets.read' }
        ]
      }
    ],
    clinician: [
      {
        id: 'clinical',
        label: 'Clinical',
        children: [
          { label: 'Patients', href: 'patients.html', perm: 'clients.read' },
          { label: 'Scheduling', href: 'scheduling.html', perm: 'appointments.read' },
          { label: 'Encounter Workspace', href: 'encounter-workspace.html', perm: 'encounters.read' }
        ]
      },
      {
        id: 'documentation',
        label: 'Documentation',
        children: [
          { label: 'New Note', href: 'coder-home.html', perm: 'notes.write' },
          { label: 'Saved Notes', href: 'saved-notes.html', perm: 'encounters.read' }
        ]
      }
    ],
    billing_specialist: [
      {
        id: 'billing',
        label: 'Billing',
        children: [
          { label: 'Claims', href: 'admin-claims.html', perm: 'claims.read' },
          { label: 'Claim Status', href: 'admin-claim-status.html', perm: 'claims.read' },
          { label: 'Payment Posting', href: 'admin-payment-posting.html', perm: 'payments.read' }
        ]
      },
      {
        id: 'ops',
        label: 'Operations',
        children: [
          { label: 'Work Queue', href: 'admin-workqueue.html', perm: 'workqueue.read' },
          { label: 'Support Tickets', href: 'support-center.html', perm: 'tickets.read' }
        ]
      }
    ]
  };

  function getRole() {
    return (global.TheraPermissions && global.TheraPermissions.getRole()) || 'patient';
  }

  function navForRole(role) {
    if (NAV[role]) return NAV[role];
    if (role === 'super_admin') return NAV.admin;
    if (role === 'billing_staff') return NAV.billing_specialist;
    if (role === 'supervisor') return NAV.clinician;
    return [];
  }

  function loadState() {
    if (!global.TheraShared) return Object.assign({}, DEFAULT_STATE);
    return Object.assign({}, DEFAULT_STATE, global.TheraShared.readLocal(STORAGE_KEY, DEFAULT_STATE));
  }

  function saveState(state) {
    if (global.TheraShared) global.TheraShared.writeLocal(STORAGE_KEY, state);
  }

  function visibleChildren(children) {
    var perms = global.TheraPermissions;
    if (!perms) return children.slice();
    return children.filter(function (item) {
      return !item.perm || perms.can(item.perm);
    });
  }

  function isActive(href) {
    return global.location.pathname.endsWith('/' + href) || global.location.pathname.endsWith(href);
  }

  function renderSection(section, state) {
    var visible = visibleChildren(section.children || []);
    if (!visible.length) return '';

    var open = state.collapsedSections.indexOf(section.id) === -1;
    var itemsHtml = visible.map(function (item) {
      return [
        '<a class="ta-sidebar-link',
        isActive(item.href) ? ' is-active' : '',
        '" href="', item.href, '">',
        '<span>', item.label, '</span>',
        '</a>'
      ].join('');
    }).join('');

    return [
      '<section class="ta-sidebar-section" data-section-id="', section.id, '">',
      '<button type="button" class="ta-sidebar-toggle" data-toggle-section="', section.id, '">', section.label, '</button>',
      '<div class="ta-sidebar-items" ', open ? '' : 'hidden', '>', itemsHtml, '</div>',
      '</section>'
    ].join('');
  }

  function bindToggles(root, state) {
    root.querySelectorAll('[data-toggle-section]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-toggle-section');
        var content = btn.nextElementSibling;
        var idx = state.collapsedSections.indexOf(id);

        if (idx >= 0) {
          state.collapsedSections.splice(idx, 1);
          content.hidden = false;
        } else {
          state.collapsedSections.push(id);
          content.hidden = true;
        }

        saveState(state);
      });
    });
  }

  function render() {
    var root = global.document.querySelector('.dashboard-sidebar');
    if (!root) return;

    var state = loadState();
    var sections = navForRole(getRole());
    root.innerHTML = sections.map(function (section) {
      return renderSection(section, state);
    }).join('');

    bindToggles(root, state);
  }

  global.TheraSidebar = Object.freeze({
    render: render
  });

  if (global.TheraShared) {
    global.TheraShared.onReady(render);
  } else {
    global.document.addEventListener('DOMContentLoaded', render, { once: true });
  }
})(window);
