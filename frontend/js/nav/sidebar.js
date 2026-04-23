/**
 * sidebar.js — THERASSISTANT Unified Role-Based Sidebar v2
 *
 * Features:
 *   · 3-level NAV tree: top-section → group/subsection → leaf items
 *   · Role-based filtering at every level
 *   · Deeply nested collapsible groups with animated chevrons
 *   · Icons on all top-level sections; chevrons on expandable sub-groups
 *   · Badge counts: Billing Alerts, Claims, Tickets, Denials, Messages
 *   · Recently viewed clients/clinicians pinned near top
 *   · Favorites / pin-to-top on any leaf item
 *   · Active page + active parent section highlighting
 *   · Collapse to icon-only mode (all labels hidden, tooltips on hover)
 *   · Floating tooltip on icon-only hover
 *   · Backward-compatible: window.AppSidebar, window.AdminSidebar, window.ClinicianSidebar
 *
 * Activates on any .dashboard-sidebar element.
 * Include AFTER shared.js and permissions.js.
 */
'use strict';

(function () {

  /* ── Storage keys ──────────────────────────────────────────────────────── */
  var SK_GROUPS    = 'ta_usb2_groups_v1';   // {id: open:bool}
  var SK_PINS      = 'ta_usb2_pins_v1';     // [href, ...]
  var SK_ICONONLY  = 'ta_usb2_icononly_v1'; // bool
  var SK_RECENT    = 'ta_usb2_recent_v1';   // [{type,id,label,href}, ...]
  var MAX_RECENT   = 5;

  /* ── Sections collapsed by default (top-level ids) ─────────────────────── */
  var DEFAULT_COLLAPSED_SECTIONS = ['operations'];
  /* ── Sub-groups collapsed by default ───────────────────────────────────── */
  var DEFAULT_COLLAPSED_GROUPS   = [];

  /* ── Badge store ────────────────────────────────────────────────────────── */
  var BADGES = {
    'billing-alerts':  0,
    'claims':          0,
    'tickets':         0,
    'denials':         0,
    'messages':        0,
    'claims-ready':    0,
    'claims-rejected': 0,
    'claims-denials':  0,
    'tickets-new':     0,
    'tickets-working': 0
  };

  /* ── Role shorthand groups ─────────────────────────────────────────────── */
  var R = {
    all:      ['admin','super_admin','billing_specialist','billing_staff','credentialing_specialist','supervisor','front_desk','clinician'],
    admin:    ['admin','super_admin'],
    billing:  ['admin','super_admin','billing_specialist','billing_staff'],
    clinical: ['clinician','supervisor'],
    ops:      ['admin','super_admin','billing_specialist','billing_staff','supervisor','front_desk'],
    lead:     ['admin','super_admin','supervisor'],
    cred:     ['admin','super_admin','credentialing_specialist'],
    staff:    ['admin','super_admin','billing_specialist','billing_staff','credentialing_specialist','supervisor','front_desk']
  };

  /* ── SVG icons ─────────────────────────────────────────────────────────── */
  var IC = {
    calendar:    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="2" width="14" height="13" rx="2"/><path d="M5 1v2M11 1v2M1 7h14"/></svg>',
    clients:     '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="5" r="3"/><path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>',
    billing:     '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="3.5" width="14" height="9" rx="2"/><path d="M1 7.5h14"/></svg>',
    clinicians:  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="4.5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M11 9l1.5 1.5L15 8"/></svg>',
    practices:   '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="4" width="14" height="11" rx="1.5"/><path d="M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4"/><path d="M8 8v4M6 10h4"/></svg>',
    reports:     '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 13h2V8h-2v5zM6.5 13h2V4h-2v9zM10.5 13h2V6h-2v7z"/><path d="M14 13H2"/></svg>',
    dashboard:   '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
    alerts:      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.5L1.5 13.5h13L8 1.5z"/><path d="M8 6.5V9.5"/><circle cx="8" cy="11.5" r=".6" fill="currentColor"/></svg>',
    claims_ic:   '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="1" width="12" height="14" rx="1.5"/><path d="M5 5.5h6M5 8.5h6M5 11.5h4"/></svg>',
    payment_ic:  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="3.5" width="14" height="9" rx="2"/><path d="M1 7.5h14"/></svg>',
    invoice:     '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 1.5h10v13L10 13l-2 1.5L6 13l-3 1.5V1.5z"/><path d="M5 6h6M5 9h4"/></svg>',
    ticket:      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 5.5h14v3a2 2 0 000 4V14H1v-1.5a2 2 0 000-4V5.5z"/></svg>',
    message:     '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13.5 2.5h-11a1 1 0 00-1 1v8l3-2h9a1 1 0 001-1V3.5a1 1 0 00-1-1z"/><path d="M5 6.5h6M5 9.5h4"/></svg>',
    doc:         '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M11.5 1.5H4a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V4.5l-2.5-3z"/><path d="M10 1v4h4M5 9h6M5 12h4"/></svg>',
    insurance:   '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.5l6 2.5v4C14 11.5 11.5 14 8 14.5 4.5 14 2 11.5 2 8V4L8 1.5z"/><path d="M5.5 8l2 2 3-3"/></svg>',
    check:       '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M5 8l2 2 4-4"/></svg>',
    cred:        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="1" width="10" height="14" rx="1.5"/><path d="M6 5h4M6 8h4M6 11h2"/><path d="M10 12l1.5 1.5L14 11" stroke-linejoin="round"/></svg>',
    contract:    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="1" width="12" height="14" rx="1.5"/><path d="M5 5.5h6M5 8.5h6M5 11.5h3"/><path d="M10.5 12l1 1 2-1.5"/></svg>',
    stripe_ic:   '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="3.5" width="14" height="9" rx="2"/><path d="M5.5 11c0-1.4 1.1-2.5 2.5-2.5h3"/></svg>',
    note:        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M11.5 1.5H4a2 2 0 00-2 2v10a2 2 0 002 2h8l3-3V3.5a2 2 0 00-2-2z"/><path d="M11.5 15v-3h3M5 6h6M5 9h6M5 12h3"/></svg>',
    plan:        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="2" width="14" height="12" rx="2"/><path d="M4 7l2 2 4-4M4 11h5"/></svg>',
    pin_ic:      '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M7 1L3.5 4.5 1 5l1 1L1 8l2.5-1 1 1L5 5.5z"/><line x1="7" y1="1" x2="10" y2="4"/></svg>',
    star_fill:   '<svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M5.5 1l1.4 2.7 3 .4-2.2 2.1.5 3L5.5 7.7 2.8 9.2l.5-3L1.1 4.1l3-.4z"/></svg>',
    chev_d:      '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5l3 3 3-3"/></svg>',
    collapse_b:  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3H3v10h7M9 6L6 8l3 2"/></svg>',
    expand_b:    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v10H6M7 6l3 2-3 2"/></svg>',
    logout_ic:   '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3v10h3M10 5.5L13.5 8 10 10.5M7 8h6.5"/></svg>',
    recent_ic:   '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="5.5" cy="5.5" r="4"/><path d="M5.5 3v2.5l1.5 1"/></svg>'
  };

  /*
   * NAV TREE STRUCTURE
   * ─────────────────────────────────────────────────────────────────────
   * Top-level sections (id, label, icon, roles)
   *   └─ items[]  — can be:
   *       · leaf:  { label, href, roles, badgeKey? }
   *       · group: { label, id, roles, items[] }  ← collapsible sub-group
   *           └─ items[]  — leaf items (no further nesting rendered)
   * ─────────────────────────────────────────────────────────────────────
   */
  var NAV = [
    {
      id: 'dashboard', label: 'Dashboard', icon: 'dashboard',
      roles: R.all,
      items: [
        { label: 'Overview', href: 'admin-dashboard.html', roles: R.all }
      ]
    },
    {
      id: 'claims', label: 'Claims', icon: 'claims_ic',
      roles: R.billing.concat(['supervisor']),
      items: [
        { label: 'Overview',    href: 'admin-claims.html?tab=overview',   roles: R.billing.concat(['supervisor']), badgeKey: 'claims' },
        { label: 'Claims List', href: 'admin-claims.html?tab=list',       roles: R.billing.concat(['supervisor']) },
        { label: 'Workqueues',  href: 'admin-claims.html?tab=workqueues', roles: R.billing.concat(['supervisor']) },
        { label: 'Denials',     href: 'admin-claims.html?tab=denials',    roles: R.billing.concat(['supervisor']), badgeKey: 'denials' },
        { label: 'Appeals',     href: 'admin-claims.html?tab=appeals',    roles: R.billing.concat(['supervisor']) },
        { label: 'Reports',     href: 'admin-claims.html?tab=reports',    roles: R.billing.concat(['supervisor']) }
      ]
    },
    {
      id: 'payments', label: 'Payments', icon: 'payment_ic',
      roles: R.billing.concat(['supervisor']),
      items: [
        { label: 'ERA Imports',        href: 'admin-payments.html?tab=era-imports',        roles: R.billing.concat(['supervisor']) },
        { label: 'Unmatched Payments', href: 'admin-payments.html?tab=unmatched-payments', roles: R.billing.concat(['supervisor']) },
        { label: 'Payment Posting',    href: 'admin-payments.html?tab=payment-posting',    roles: R.billing.concat(['supervisor']) },
        { label: 'Reconciliation',     href: 'admin-payments.html?tab=reconciliation',     roles: R.billing.concat(['supervisor']) },
        { label: 'Refunds',            href: 'admin-payments.html?tab=refunds',            roles: R.billing.concat(['supervisor']) },
        { label: 'Reporting',          href: 'admin-payments.html?tab=reporting',          roles: R.billing.concat(['supervisor']) }
      ]
    },
    {
      id: 'patients', label: 'Patients', icon: 'clients',
      roles: R.staff,
      items: [
        { label: 'Demographics',    href: 'admin-patients.html?tab=demographics',   roles: R.staff },
        { label: 'Appointments',    href: 'admin-patients.html?tab=appointments',   roles: R.staff },
        { label: 'Insurance',       href: 'admin-patients.html?tab=insurance',      roles: R.staff },
        { label: 'Authorizations',  href: 'admin-patients.html?tab=authorizations', roles: R.staff },
        { label: 'Notes',           href: 'admin-patients.html?tab=notes',          roles: R.staff },
        { label: 'Claims',          href: 'admin-patients.html?tab=claims',         roles: R.staff },
        { label: 'Payments',        href: 'admin-patients.html?tab=payments',       roles: R.staff },
        { label: 'Communications',  href: 'admin-patients.html?tab=communications', roles: R.staff, badgeKey: 'messages' }
      ]
    },
    {
      id: 'clients', label: 'Clients', icon: 'practices',
      roles: R.staff,
      items: [
        { label: 'Active Clients',  href: 'admin-clients.html?tab=active-clients', roles: R.staff },
        { label: 'Onboarding',      href: 'admin-clients.html?tab=onboarding',     roles: R.staff },
        { label: 'Financials',      href: 'admin-clients.html?tab=financials',     roles: R.staff },
        { label: 'Credentialing',   href: 'admin-clients.html?tab=credentialing',  roles: R.staff },
        { label: 'Communications',  href: 'admin-clients.html?tab=communications', roles: R.staff, badgeKey: 'messages' },
        { label: 'Tasks',           href: 'admin-clients.html?tab=tasks',          roles: R.staff, badgeKey: 'tickets' }
      ]
    },
    {
      id: 'scheduling', label: 'Scheduling', icon: 'calendar',
      roles: R.all,
      items: [
        { label: 'Day',      href: 'admin-scheduling.html?view=day',      roles: R.all },
        { label: 'Week',     href: 'admin-scheduling.html?view=week',     roles: R.all },
        { label: 'Month',    href: 'admin-scheduling.html?view=month',    roles: R.all },
        { label: 'Team',     href: 'admin-scheduling.html?view=team',     roles: R.all },
        { label: 'Provider', href: 'admin-scheduling.html?view=provider', roles: R.all }
      ]
    },
    {
      id: 'communications', label: 'Communications', icon: 'message',
      roles: R.staff,
      items: [
        { label: 'Internal Chat',    href: 'admin-communications.html?tab=internal-chat',   roles: R.staff, badgeKey: 'messages' },
        { label: 'Patient Messages', href: 'admin-communications.html?tab=patient-messages',roles: R.staff, badgeKey: 'messages' },
        { label: 'Client Messages',  href: 'admin-communications.html?tab=client-messages', roles: R.staff, badgeKey: 'messages' },
        { label: 'Email Templates',  href: 'admin-communications.html?tab=email-templates', roles: R.staff },
        { label: 'Document History', href: 'admin-communications.html?tab=document-history',roles: R.staff }
      ]
    },
    {
      id: 'operations', label: 'Compliance / Operations', icon: 'cred',
      roles: R.ops.concat(R.cred),
      items: [
        { label: 'Credentialing', href: 'admin-operations.html?tab=credentialing', roles: R.ops.concat(R.cred) },
        { label: 'Licenses',      href: 'admin-operations.html?tab=licenses',      roles: R.ops.concat(R.cred) },
        { label: 'Code Rules',    href: 'admin-operations.html?tab=code-rules',    roles: R.ops.concat(R.cred) },
        { label: 'Audits',        href: 'admin-operations.html?tab=audits',        roles: R.ops.concat(R.cred) },
        { label: 'Alerts',        href: 'admin-operations.html?tab=alerts',        roles: R.ops.concat(R.cred), badgeKey: 'billing-alerts' },
        { label: 'Policies',      href: 'admin-operations.html?tab=policies',      roles: R.ops.concat(R.cred) },
        { label: 'Content',       href: 'admin-operations.html?tab=content',       roles: R.ops.concat(R.cred) }
      ]
    }
  ]; /* end NAV */

  /* ── localStorage helpers ──────────────────────────────────────────────── */
  function lsGet(key, fallback) {
    try { var v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch(e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }

  /* ── Current role ───────────────────────────────────────────────────────── */
  function currentRole() {
    if (typeof AppPermissions !== 'undefined' && AppPermissions.currentRole) return AppPermissions.currentRole();
    if (document.body && document.body.dataset.role) return document.body.dataset.role;
    try {
      var raw = JSON.parse(localStorage.getItem('sb-kozdkixjhtbfhktpvzvk-auth-token') || '{}');
      return (raw && raw.user && raw.user.user_metadata && raw.user.user_metadata.role) || 'clinician';
    } catch(e) { return 'clinician'; }
  }

  /* ── Portal badge label ─────────────────────────────────────────────────── */
  var PORTAL_LABELS = {
    admin:'Admin Portal', super_admin:'Admin Portal',
    billing_specialist:'Billing Portal', billing_staff:'Billing Portal',
    credentialing_specialist:'Credentialing', clinician:'Clinician Portal',
    supervisor:'Supervisor Portal', front_desk:'Front Desk', patient:'My Portal'
  };

  /* ── Role check ─────────────────────────────────────────────────────────── */
  function canSee(roles, role) {
    return roles && roles.indexOf(role) !== -1;
  }

  /* ── Item/group has any visible content ─────────────────────────────────── */
  function anyVisible(items, role) {
    return items.some(function(it) {
      if (it.items) return canSee(it.roles, role) && anyVisible(it.items, role);
      return canSee(it.roles, role);
    });
  }

  /* ── Current page (filename + query) ────────────────────────────────────── */
  function currentPage() {
    var loc = window.location;
    return (loc.pathname.split('/').pop() || 'index.html') + loc.search;
  }
  function pageBase() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  /* ── Badge helper ───────────────────────────────────────────────────────── */
  function badge(key) {
    return key ? (BADGES[key] || 0) : 0;
  }

  /* ── Collapse state for sections and sub-groups ─────────────────────────── */
  var sectionState = lsGet(SK_GROUPS + '_s', null) || (function(){
    var s = {};
    NAV.forEach(function(sec){ s[sec.id] = DEFAULT_COLLAPSED_SECTIONS.indexOf(sec.id) === -1; });
    return s;
  }());
  var groupState = lsGet(SK_GROUPS + '_g', null) || (function(){
    var s = {};
    // walk and seed every sub-group id
    function seed(items) {
      items.forEach(function(it) {
        if (it.items) {
          if (it.id) s[it.id] = DEFAULT_COLLAPSED_GROUPS.indexOf(it.id) === -1;
          seed(it.items);
        }
      });
    }
    NAV.forEach(function(sec){ seed(sec.items || []); });
    return s;
  }());

  /* ── Active-path tracking (which sections/groups contain the active page) ─ */
  var activePaths = {}; // id → true if this group contains active page

  function computeActivePaths(pg_base) {
    activePaths = {};
    function walk(items, sectionId) {
      return items.some(function(it) {
        if (it.items) {
          var hit = walk(it.items, sectionId);
          if (hit) { activePaths[it.id] = true; }
          return hit;
        }
        var href_base = (it.href || '').split('?')[0].split('#')[0];
        return href_base === pg_base;
      });
    }
    NAV.forEach(function(sec){
      var hit = walk(sec.items || [], sec.id);
      if (hit) activePaths[sec.id] = true;
    });
  }

  /* ── Find a pinned leaf item anywhere in the tree ────────────────────────── */
  function findLeafByHref(href) {
    function walk(items) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].items) { var r = walk(items[i].items); if (r) return r; }
        else if (items[i].href === href) return items[i];
      }
      return null;
    }
    for (var si = 0; si < NAV.length; si++) {
      var r = walk(NAV[si].items || []);
      if (r) return r;
    }
    return null;
  }

  /* ── CSS injection ──────────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('usb2-css')) return;
    var css = [
      /* layout */
      '.usb-toggle-btn{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;',
      'border:1px solid rgba(255,255,255,.13);border-radius:9px;background:rgba(255,255,255,.05);',
      'color:rgba(233,244,255,.65);cursor:pointer;font-size:11.5px;font-weight:600;font-family:inherit;',
      'margin-bottom:12px;text-align:left;transition:all .15s;}',
      '.usb-toggle-btn:hover{background:rgba(255,255,255,.10);color:#fff;}',
      '.usb-portal-badge{display:inline-block;background:rgba(251,191,36,.16);',
      'border:1px solid rgba(251,191,36,.32);color:#fbbf24;font-size:9.5px;font-weight:700;',
      'letter-spacing:.09em;text-transform:uppercase;padding:2px 9px;border-radius:999px;margin-bottom:9px;}',
      /* recent viewed + favorites */
      '.usb-recents{margin-bottom:4px;}',
      '.usb-section-hdr{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;',
      'color:rgba(255,255,255,.28);padding:1px 12px 3px;}',
      '.usb-divider{border:none;border-top:1px solid rgba(255,255,255,.09);margin:6px 0 8px;}',
      /* top-level section */
      '.usb-section{margin-bottom:1px;}',
      '.usb-section-btn{display:flex;align-items:center;gap:9px;width:100%;padding:9px 10px;',
      'border:1px solid transparent;border-radius:10px;background:none;cursor:pointer;',
      'color:rgba(233,244,255,.82);font-size:13px;font-weight:600;font-family:inherit;',
      'text-align:left;transition:all .14s;position:relative;}',
      '.usb-section-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.14);color:#fff;}',
      '.usb-section-btn.active-section{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.2);color:#fff;}',
      '.usb-section-btn.active-section::before{content:"";position:absolute;left:0;top:20%;bottom:20%;',
      'width:3px;background:#7dd3fc;border-radius:99px;}',
      '.usb-sec-icon{width:16px;height:16px;flex-shrink:0;opacity:.75;display:flex;align-items:center;}',
      '.usb-section-btn:hover .usb-sec-icon,.usb-section-btn.active-section .usb-sec-icon{opacity:1;}',
      '.usb-sec-label{flex:1;line-height:1;}',
      '.usb-sec-chev{color:rgba(255,255,255,.35);flex-shrink:0;display:flex;',
      'transition:transform .2s cubic-bezier(.4,0,.2,1);}',
      '.usb-section.usb-collapsed .usb-sec-chev{transform:rotate(-90deg);}',
      '.usb-section-badge{font-size:9px;font-weight:800;background:rgba(239,68,68,.88);color:#fff;',
      'padding:1px 5px;border-radius:99px;min-width:16px;text-align:center;flex-shrink:0;}',
      /* section body */
      '.usb-section-body{overflow:hidden;max-height:2000px;',
      'transition:max-height .28s cubic-bezier(.4,0,.2,1),opacity .18s;}',
      '.usb-section.usb-collapsed .usb-section-body{max-height:0!important;opacity:0;}',
      /* leaf item */
      '.usb-item{display:flex;align-items:center;gap:9px;padding:7px 10px 7px 28px;border-radius:8px;',
      'cursor:pointer;text-decoration:none;color:rgba(233,244,255,.72);font-size:12.5px;',
      'font-weight:500;transition:all .13s;border:1px solid transparent;position:relative;',
      '-webkit-font-smoothing:antialiased;}',
      '.usb-item.depth-2{padding-left:44px;}',
      '.usb-item.depth-3{padding-left:58px;}',
      '.usb-item:hover,.usb-item.active{background:rgba(255,255,255,.10);',
      'border-color:rgba(255,255,255,.15);color:#fff;}',
      '.usb-item.active{background:rgba(255,255,255,.14);font-weight:600;}',
      '.usb-item.active::before{content:"";position:absolute;left:6px;top:25%;bottom:25%;',
      'width:2px;background:#7dd3fc;border-radius:99px;}',
      '.usb-item-text{flex:1;line-height:1;}',
      '.usb-item-badge{font-size:9px;font-weight:800;background:rgba(239,68,68,.88);color:#fff;',
      'padding:1px 5px;border-radius:99px;min-width:16px;text-align:center;flex-shrink:0;}',
      '.usb-pin-btn{opacity:0;width:18px;height:18px;padding:3px;border:none;background:none;',
      'cursor:pointer;color:rgba(255,255,255,.38);border-radius:4px;',
      'transition:opacity .12s,color .12s;flex-shrink:0;display:flex;align-items:center;justify-content:center;}',
      '.usb-item:hover .usb-pin-btn{opacity:1;}',
      '.usb-pin-btn.usb-pinned{opacity:1;color:#fbbf24;}',
      '.usb-pin-btn:hover{color:#fbbf24!important;background:rgba(255,255,255,.09);}',
      /* sub-group */
      '.usb-subgroup{margin:0;}',
      '.usb-subgroup-btn{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px 7px 18px;',
      'border:none;background:none;cursor:pointer;color:rgba(233,244,255,.72);',
      'font-size:12.5px;font-weight:600;font-family:inherit;text-align:left;border-radius:8px;',
      'transition:background .12s,color .12s;}',
      '.usb-subgroup-btn.depth-2{padding-left:32px;}',
      '.usb-subgroup-btn:hover{background:rgba(255,255,255,.07);color:#fff;}',
      '.usb-subgroup-btn.active-parent{color:#93c5fd;}',
      '.usb-sg-chev{color:rgba(255,255,255,.28);flex-shrink:0;display:flex;',
      'transition:transform .2s cubic-bezier(.4,0,.2,1);}',
      '.usb-subgroup.usb-collapsed .usb-sg-chev{transform:rotate(-90deg);}',
      '.usb-sg-label{flex:1;line-height:1;}',
      '.usb-sg-badge{font-size:9px;font-weight:800;background:rgba(239,68,68,.88);color:#fff;',
      'padding:1px 5px;border-radius:99px;min-width:16px;text-align:center;flex-shrink:0;}',
      '.usb-subgroup-body{overflow:hidden;max-height:1200px;',
      'transition:max-height .22s cubic-bezier(.4,0,.2,1),opacity .16s;}',
      '.usb-subgroup.usb-collapsed .usb-subgroup-body{max-height:0!important;opacity:0;}',
      /* tooltip */
      '.usb-float-tip{position:fixed;background:#0b2d47;color:#e9f4ff;font-size:11.5px;',
      'font-weight:600;padding:5px 11px;border-radius:8px;white-space:nowrap;',
      'display:none;z-index:9999;pointer-events:none;',
      'box-shadow:0 4px 16px rgba(0,0,0,.38);border:1px solid rgba(255,255,255,.12);}',
      /* logout */
      '.usb-logout{margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.09);}',
      '.usb-role-info{padding:5px 12px 8px;font-size:10px;color:rgba(255,255,255,.33);font-weight:600;letter-spacing:.05em;text-transform:uppercase;}',
      /* icon-only mode */
      '.dashboard-sidebar.usb-icononly{padding:14px 6px 40px!important;}',
      '.dashboard-sidebar.usb-icononly .sidebar-logo,',
      '.dashboard-sidebar.usb-icononly .sidebar-product,',
      '.dashboard-sidebar.usb-icononly .usb-portal-badge{display:none!important;}',
      '.dashboard-sidebar.usb-icononly .usb-toggle-btn{justify-content:center;padding:8px;margin-bottom:8px;}',
      '.dashboard-sidebar.usb-icononly .usb-toggle-text{display:none;}',
      '.dashboard-sidebar.usb-icononly .usb-recents,',
      '.dashboard-sidebar.usb-icononly .usb-divider{display:none;}',
      '.dashboard-sidebar.usb-icononly .usb-section-body{display:none!important;}',
      '.dashboard-sidebar.usb-icononly .usb-sec-label,',
      '.dashboard-sidebar.usb-icononly .usb-sec-chev,',
      '.dashboard-sidebar.usb-icononly .usb-section-badge{display:none;}',
      '.dashboard-sidebar.usb-icononly .usb-section-btn{justify-content:center;padding:9px;}',
      '.dashboard-sidebar.usb-icononly .usb-sec-icon{width:18px;height:18px;opacity:.9;}',
      '.dashboard-sidebar.usb-icononly .usb-section-btn::before{display:none;}',
      '.dashboard-sidebar.usb-icononly .usb-logout .usb-item{justify-content:center;padding:9px;}',
      '.dashboard-sidebar.usb-icononly .usb-item-text,',
      '.dashboard-sidebar.usb-icononly .usb-pin-btn{display:none!important;}',
      '.dashboard-sidebar.usb-icononly .usb-role-info{display:none;}'
    ].join('');
    var el = document.createElement('style');
    el.id  = 'usb2-css';
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ── Floating tooltip ───────────────────────────────────────────────────── */
  var floatTip = null;
  function showTip(ev) {
    if (!lsGet(SK_ICONONLY, false)) return;
    var btn  = ev.currentTarget;
    var text = btn.getAttribute('data-tip') || '';
    if (!text) return;
    if (!floatTip) {
      floatTip = document.createElement('div');
      floatTip.className = 'usb-float-tip';
      document.body.appendChild(floatTip);
    }
    floatTip.textContent = text;
    floatTip.style.display = 'block';
    var r = btn.getBoundingClientRect();
    floatTip.style.top  = Math.round(r.top + r.height / 2 - floatTip.offsetHeight / 2) + 'px';
    floatTip.style.left = Math.round(r.right + 10) + 'px';
  }
  function hideTip() { if (floatTip) floatTip.style.display = 'none'; }

  /* ── Build leaf item HTML ───────────────────────────────────────────────── */
  function buildLeaf(item, pg_full, pg_base, pins, depth) {
    var depth_cls = depth >= 3 ? 'depth-3' : depth === 2 ? 'depth-2' : '';
    var href_base  = (item.href || '').split('?')[0].split('#')[0];
    var isActive   = item.href === pg_full || (href_base === pg_base && !pg_full.includes('?') && !pg_full.includes('#'));
    var isPinned   = pins.indexOf(item.href) !== -1;
    var badgeCount = badge(item.badgeKey);
    var cls        = 'usb-item nav-link' + (isActive ? ' active' : '') + (depth_cls ? ' ' + depth_cls : '');
    return [
      '<a class="', cls, '" href="', item.href || '#', '">',
      '<span class="usb-item-text">', item.label, '</span>',
      badgeCount ? '<span class="usb-item-badge" data-badge-key="' + item.badgeKey + '">' + badgeCount + '</span>' : '',
      '<button class="usb-pin-btn', isPinned ? ' usb-pinned' : '',
        '" onclick="AppSidebar.togglePin(event,\'', (item.href||'').replace(/'/g,"\\'"), '\')"',
        ' title="', isPinned ? 'Unpin' : 'Pin', '">',
        isPinned ? IC.star_fill : IC.pin_ic,
      '</button>',
      '</a>'
    ].join('');
  }

  /* ── Build sub-group HTML (recursive) ──────────────────────────────────── */
  function buildSubGroup(grp, pg_full, pg_base, pins, role, depth) {
    if (!canSee(grp.roles, role)) return '';
    if (!anyVisible(grp.items, role)) return '';

    var isOpen    = groupState[grp.id] !== undefined ? groupState[grp.id] : DEFAULT_COLLAPSED_GROUPS.indexOf(grp.id) === -1;
    var isAParent = activePaths[grp.id];
    var badgeCount= badge(grp.badgeKey);
    var depth_cls = depth >= 2 ? 'depth-2' : '';

    var innerHtml = grp.items.map(function(it) {
      if (it.items) return buildSubGroup(it, pg_full, pg_base, pins, role, depth + 1);
      if (!canSee(it.roles, role)) return '';
      return buildLeaf(it, pg_full, pg_base, pins, depth + 1);
    }).join('');

    return [
      '<div class="usb-subgroup', isOpen ? '' : ' usb-collapsed', '" data-sg="', grp.id, '">',
      '<button class="usb-subgroup-btn', depth_cls ? ' ' + depth_cls : '',
        isAParent ? ' active-parent' : '',
        '" onclick="AppSidebar.toggleSubGroup(\'', grp.id, '\')">',
      '<span class="usb-sg-label">', grp.label, '</span>',
      badgeCount ? '<span class="usb-sg-badge" data-badge-key="' + grp.badgeKey + '">' + badgeCount + '</span>' : '',
      '<span class="usb-sg-chev">', IC.chev_d, '</span>',
      '</button>',
      '<div class="usb-subgroup-body">', innerHtml, '</div>',
      '</div>'
    ].join('');
  }

  /* ── Build top-level section HTML ───────────────────────────────────────── */
  function buildSection(sec, pg_full, pg_base, pins, role) {
    if (!canSee(sec.roles, role)) return '';
    if (!anyVisible(sec.items, role)) return '';

    var isOpen    = sectionState[sec.id] !== undefined ? sectionState[sec.id] : DEFAULT_COLLAPSED_SECTIONS.indexOf(sec.id) === -1;
    var isAParent = activePaths[sec.id];
    var secBadge  = badge(sec.badgeKey);

    var bodyHtml = sec.items.map(function(it) {
      if (it.items) return buildSubGroup(it, pg_full, pg_base, pins, role, 1);
      if (!canSee(it.roles, role)) return '';
      return buildLeaf(it, pg_full, pg_base, pins, 1);
    }).join('');

    return [
      '<div class="usb-section', isOpen ? '' : ' usb-collapsed', '" data-sec="', sec.id, '">',
      '<button class="usb-section-btn', isAParent ? ' active-section' : '',
        '" data-tip="', sec.label,
        '" onclick="AppSidebar.toggleSection(\'', sec.id, '\')"',
        ' onmouseenter="if(window.AppSidebar)AppSidebar._showTip(event)"',
        ' onmouseleave="if(window.AppSidebar)AppSidebar._hideTip()">',
      '<span class="usb-sec-icon">', IC[sec.icon] || '', '</span>',
      '<span class="usb-sec-label">', sec.label, '</span>',
      secBadge ? '<span class="usb-section-badge" data-badge-key="' + sec.badgeKey + '">' + secBadge + '</span>' : '',
      '<span class="usb-sec-chev">', IC.chev_d, '</span>',
      '</button>',
      '<div class="usb-section-body">', bodyHtml, '</div>',
      '</div>'
    ].join('');
  }

  /* ── Recently viewed row ─────────────────────────────────────────────────── */
  function buildRecentRow(entry, pg_full, pg_base, pins) {
    var isActive = entry.href === pg_full;
    var isPinned = pins.indexOf(entry.href) !== -1;
    var cls = 'usb-item' + (isActive ? ' active' : '');
    var icon = entry.type === 'clinician' ? IC.clinicians : IC.clients;
    return [
      '<a class="', cls, '" href="', entry.href, '" style="padding-left:12px">',
      '<span class="usb-sec-icon" style="width:14px;height:14px">', icon, '</span>',
      '<span class="usb-item-text" style="font-size:12px">', entry.label, '</span>',
      '<button class="usb-pin-btn', isPinned ? ' usb-pinned' : '',
        '" onclick="AppSidebar.togglePin(event,\'', entry.href.replace(/'/g,"\\'"), '\')"',
        ' title="', isPinned ? 'Unpin' : 'Pin', '">', isPinned ? IC.star_fill : IC.pin_ic,
      '</button>',
      '</a>'
    ].join('');
  }

  /* ── Main render ────────────────────────────────────────────────────────── */
  function render() {
    var sidebar = document.querySelector('.dashboard-sidebar');
    if (!sidebar) return;
    injectStyles();

    var role     = currentRole();
    var pg_full  = currentPage();
    var pg_base  = pageBase();
    var pins     = lsGet(SK_PINS, []);
    var iconOnly = lsGet(SK_ICONONLY, false);
    var recents  = lsGet(SK_RECENT, []);
    var shell    = document.querySelector('.dashboard-shell');

    computeActivePaths(pg_base);

    /* Sync grid width */
    if (iconOnly) {
      sidebar.classList.add('usb-icononly');
      if (shell) shell.style.gridTemplateColumns = '58px 1fr';
    } else {
      sidebar.classList.remove('usb-icononly');
      if (shell) shell.style.gridTemplateColumns = '280px 1fr';
    }

    /* Logo */
    var logoHtml = '';
    var logoEl   = sidebar.querySelector('.sidebar-logo');
    var prodEl   = sidebar.querySelector('.sidebar-product');
    if (logoEl) logoHtml += logoEl.outerHTML;
    if (prodEl) logoHtml += prodEl.outerHTML;
    logoHtml += '<div class="usb-portal-badge">' + (PORTAL_LABELS[role] || 'Portal') + '</div>';

    /* Favorites */
    var pinsHtml = '';
    var pinnedRows = pins.map(function(href){
      var it = findLeafByHref(href);
      return (it && canSee(it.roles, role)) ? buildLeaf(it, pg_full, pg_base, pins, 1) : '';
    }).filter(Boolean);
    if (pinnedRows.length) {
      pinsHtml = '<div class="usb-recents"><div class="usb-section-hdr">Favorites</div>'
               + pinnedRows.join('') + '</div><hr class="usb-divider">';
    }

    /* Recently viewed */
    var recentHtml = '';
    var visibleRecents = recents.filter(function(e){ return e && e.href; }).slice(0, MAX_RECENT);
    if (visibleRecents.length && !iconOnly) {
      recentHtml = '<div class="usb-recents"><div class="usb-section-hdr">'
        + '<span style="display:inline-flex;align-items:center;gap:4px">' + IC.recent_ic + ' Recently Viewed</span>'
        + '</div>'
        + visibleRecents.map(function(e){ return buildRecentRow(e, pg_full, pg_base, pins); }).join('')
        + '</div><hr class="usb-divider">';
    }

    /* Toggle btn */
    var toggleHtml = [
      '<button class="usb-toggle-btn" onclick="AppSidebar.toggleIconOnly()"',
      ' data-tip="', iconOnly ? 'Expand' : 'Collapse', '"',
      ' onmouseenter="if(window.AppSidebar)AppSidebar._showTip(event)"',
      ' onmouseleave="if(window.AppSidebar)AppSidebar._hideTip()">',
      '<span class="usb-sec-icon">', iconOnly ? IC.expand_b : IC.collapse_b, '</span>',
      '<span class="usb-toggle-text">', iconOnly ? 'Expand' : 'Collapse', '</span>',
      '</button>'
    ].join('');

    /* All sections */
    var sectionsHtml = NAV.map(function(sec){ return buildSection(sec, pg_full, pg_base, pins, role); }).join('');

    /* Logout */
    var logoutHtml = [
      '<div class="usb-logout">',
      '<div class="usb-role-info" id="usb-role-label"></div>',
      '<button class="usb-item nav-logout" id="logoutBtn" type="button" style="width:100%;border:1px solid transparent;padding:8px 10px">',
      '<span class="usb-sec-icon">', IC.logout_ic, '</span>',
      '<span class="usb-item-text">Logout</span>',
      '</button></div>'
    ].join('');

    sidebar.innerHTML = logoHtml + '<nav class="sidebar-nav">'
      + toggleHtml + pinsHtml + recentHtml + sectionsHtml + logoutHtml + '</nav>';

    /* Wire logout */
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && typeof logout === 'function') logoutBtn.addEventListener('click', logout);

    /* Role label */
    var roleEl = document.getElementById('usb-role-label');
    if (roleEl) {
      var labelMap = { admin:'Admin', super_admin:'Super Admin', billing_specialist:'Billing Specialist',
        billing_staff:'Billing Staff', credentialing_specialist:'Credentialing', clinician:'Clinician',
        supervisor:'Supervisor', front_desk:'Front Desk', patient:'Patient' };
      roleEl.textContent = labelMap[role] || role;
    }

    /* Permissions gating */
    if (typeof AppPermissions !== 'undefined' && AppPermissions.apply) AppPermissions.apply();
  }

  /* ── Toggle handlers ────────────────────────────────────────────────────── */
  function toggleSection(id) {
    sectionState[id] = !sectionState[id];
    lsSet(SK_GROUPS + '_s', sectionState);
    var el = document.querySelector('.usb-section[data-sec="' + id + '"]');
    if (el) el.classList.toggle('usb-collapsed', !sectionState[id]);
  }

  function toggleSubGroup(id) {
    groupState[id] = !groupState[id];
    lsSet(SK_GROUPS + '_g', groupState);
    var el = document.querySelector('.usb-subgroup[data-sg="' + id + '"]');
    if (el) el.classList.toggle('usb-collapsed', !groupState[id]);
  }

  function togglePin(e, href) {
    e.preventDefault();
    e.stopPropagation();
    var pins = lsGet(SK_PINS, []);
    var idx  = pins.indexOf(href);
    if (idx === -1) { pins.unshift(href); } else { pins.splice(idx, 1); }
    lsSet(SK_PINS, pins);
    render();
  }

  function toggleIconOnly() {
    lsSet(SK_ICONONLY, !lsGet(SK_ICONONLY, false));
    render();
  }

  function setBadge(key, count) {
    BADGES[key] = count;
    document.querySelectorAll('[data-badge-key="' + key + '"]').forEach(function(el) {
      el.textContent = count || '';
      el.style.display = count ? '' : 'none';
    });
  }

  /* Legacy setBadge(href, count) compatibility — also accept full hrefs */
  var HREF_BADGE_MAP = {
    'admin-billing-alerts.html':     'billing-alerts',
    'clinician-billing-alerts.html': 'billing-alerts',
    'admin-chat.html':               'messages',
    'admin-communications.html':     'messages',
    'support-center.html':           'tickets',
    'admin-qa.html':                 'tickets',
    'admin-workqueue.html':          'claims',
    'admin-claims.html':             'claims',
    'admin-operations.html':         'billing-alerts'
  };

  function setBadgeLegacy(hrefOrKey, count) {
    var key = HREF_BADGE_MAP[hrefOrKey] || hrefOrKey;
    setBadge(key, count);
  }

  /* ── Recently viewed API ─────────────────────────────────────────────────── */
  function trackRecent(type, id, label, href) {
    var list = lsGet(SK_RECENT, []);
    list = list.filter(function(e){ return e.href !== href; });
    list.unshift({ type: type, id: id, label: label, href: href });
    list = list.slice(0, MAX_RECENT);
    lsSet(SK_RECENT, list);
    /* Re-render recents section without full redraw if possible */
    render();
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */
  var api = {
    toggleSection:  toggleSection,
    toggleSubGroup: toggleSubGroup,
    /* Legacy toggleGroup compatibility */
    toggleGroup:    function(id) {
      if (sectionState.hasOwnProperty(id)) toggleSection(id);
      else toggleSubGroup(id);
    },
    togglePin:      togglePin,
    toggleIconOnly: toggleIconOnly,
    setBadge:       setBadgeLegacy,
    setBadgeByKey:  setBadge,
    trackRecent:    trackRecent,
    render:         render,
    /* Tooltip hooks exposed for inline onmouseenter */
    _showTip:       showTip,
    _hideTip:       hideTip
  };

  window.AppSidebar       = api;
  window.AdminSidebar     = api;
  window.ClinicianSidebar = api;

  /* ── Init ───────────────────────────────────────────────────────────────── */
  function init() {
    if (!document.querySelector('.dashboard-sidebar')) return;
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());