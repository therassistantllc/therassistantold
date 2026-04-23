// THERASSISTANT — Shared auth, logout, and sidebar helpers
// Include this on every dashboard page AFTER the Supabase CDN script.

const SUPABASE_URL = "https://kozdkixjhtbfhktpvzvk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvemRraXhqaHRiZmhrdHB2enZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTczMzUsImV4cCI6MjA4ODMzMzMzNX0.Wun2eWG5vRdPdkb2c_lsSfTcQ9Y5jJ42kvWGYRgRBVc";
const CODER_SAVED_REPORTS_KEY = "docusistant_saved_reports_v1";
const NOTES_SAVED_KEY = "docusistant_saved_notes_v1";
const SETTINGS_KEY = "docusistant_settings_v1";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function isPlaceholderSavedReport(report) {
  if (!report || typeof report !== "object") return true;
  const client = String(report.client || "").trim();
  const provider = String(report.provider || "").trim();
  const diag = String(report.diag || "").trim();
  const codes = String(report.codes || "").trim();
  return client === "Unspecified Client"
    || provider === "Current Provider"
    || diag === "Not specified"
    || codes === "No additional code suggestions fired";
}

function getStoredCoderReports() {
  try {
    const raw = localStorage.getItem(CODER_SAVED_REPORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const cleaned = list.filter((report) => !isPlaceholderSavedReport(report));
    if (cleaned.length !== list.length) {
      localStorage.setItem(CODER_SAVED_REPORTS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (err) {
    return [];
  }
}

function setStoredCoderReports(reports) {
  const next = Array.isArray(reports) ? reports : [];
  localStorage.setItem(CODER_SAVED_REPORTS_KEY, JSON.stringify(next));
}

// ── Saved Notes ───────────────────────────────────────────────────────────────

function getStoredNotes() {
  try {
    const raw = localStorage.getItem(NOTES_SAVED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) { return []; }
}

function setStoredNotes(notes) {
  localStorage.setItem(NOTES_SAVED_KEY, JSON.stringify(Array.isArray(notes) ? notes : []));
}

/**
 * Save a generated note from a doc tool.
 * Reads the client name from docusistant_doc_session if available.
 */
function saveDocNote(noteType, noteContent) {
  var client = '';
  try {
    var session = JSON.parse(localStorage.getItem('docusistant_doc_session') || '{}');
    client = session.clientName || '';
  } catch (e) {}
  if (!client) client = prompt('Client name for this note:') || 'Unnamed Client';
  var today = new Date().toISOString().slice(0, 10);
  var notes = getStoredNotes();
  notes.unshift({
    id: 'note-' + Date.now(),
    client: client,
    type: noteType || 'Progress Note',
    dos: today,
    modified: today,
    content: noteContent || '',
    status: 'Draft'
  });
  setStoredNotes(notes.slice(0, 500));
  alert('Note saved to Saved Notes.');
}

// ── Settings ──────────────────────────────────────────────────────────────────

function getDocSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function setDocSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings || {}));
}

function parseRevenueValue(text) {
  const matches = String(text || "").match(/\$\d+(?:\.\d+)?/g) || [];
  if (!matches.length) return 0;
  const nums = matches.map((value) => Number(value.replace("$", "")) || 0);
  return nums.length > 1 ? nums[1] : nums[0];
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Role-based routing ────────────────────────────────────────────────────────
// Maps each Supabase user metadata role to its home page destination.
const ROLE_DESTINATIONS = {
  super_admin:              'dashboard.html',
  admin:                    'dashboard.html',
  clinician:                'dashboard.html',
  billing_specialist:       'dashboard.html',
  billing_staff:            'dashboard.html',
  credentialing_specialist: 'dashboard.html',
  supervisor:               'dashboard.html',
  front_desk:               'dashboard.html',
  patient:                  'patient-portal.html',
};

// Role groups used by route guards.
const CLINICIAN_ROLES  = ['clinician'];
const ADMIN_ROLES      = ['admin', 'billing_staff', 'billing_specialist', 'credentialing_specialist', 'supervisor', 'front_desk', 'super_admin'];
const BILLING_ROLES    = ['admin', 'super_admin', 'billing_specialist', 'billing_staff'];
const SUPERVISOR_ROLES = ['admin', 'super_admin', 'supervisor'];
const FRONT_DESK_ROLES = ['admin', 'super_admin', 'front_desk'];
const STAFF_ROLES      = ['admin', 'super_admin', 'billing_specialist', 'billing_staff', 'credentialing_specialist', 'supervisor', 'front_desk', 'clinician'];
const CLINICAL_ROLES   = ['clinician', 'supervisor'];

/**
 * Read the role from Supabase user metadata.
 * Defaults to 'clinician' if not set.
 */
function getRole(user) {
  return String((user && user.user_metadata && user.user_metadata.role) || 'clinician');
}

/**
 * Return the home page URL for a given role string.
 */
function getRoleHome(role) {
  return ROLE_DESTINATIONS[role] || 'dashboard.html';
}

function getLocalDevBypassUser() {
  try {
    const host = window.location && window.location.hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') return null;

    const params = new URLSearchParams(window.location.search || '');
    const role = String(params.get('dev_role') || '').trim();
    if (!role) return null;

    const email = String(params.get('dev_email') || (role + '@local.test')).trim();
    return {
      id: 'local-dev-user',
      email,
      user_metadata: {
        role,
      },
    };
  } catch (_) {
    return null;
  }
}

/**
 * Call on every dashboard/app page.
 *
 * @param {string[]} [allowedRoles]  Optional. If provided, redirects to the
 *   user's role home page if they are not in the allowed list.  This is the
 *   primary route-guard mechanism.  Pass CLINICIAN_ROLES or ADMIN_ROLES (or a
 *   custom array) from the calling page.
 *
 * Redirects to login.html if no session exists.
 * Populates #welcomeName and #userLabel if present.
 * Marks the active nav link by href match.
 * Returns the Supabase user object (or null on redirect).
 */
async function initDashboard(allowedRoles) {
  const bypassUser = getLocalDevBypassUser();
  const user = bypassUser
    ? bypassUser
    : (await supabaseClient.auth.getUser()).data.user;

  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  // ── Route guard ──────────────────────────────────────────────────────────
  // If the page declared allowed roles and the user's role is not in the list,
  // redirect them silently to their own home page instead of showing an error.
  // Exception: admins in preview mode may browse clinician pages without redirect.
  const isAdminPreview = sessionStorage.getItem('docusistant_admin_preview') === '1';
  if (allowedRoles && allowedRoles.length && !isAdminPreview) {
    const role = getRole(user);
    if (!allowedRoles.includes(role)) {
      window.location.href = getRoleHome(role);
      return null;
    }
  }

  const email = user.email || "clinician@provider.org";
  const firstName = email.split("@")[0].split(".")[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const nameEl  = document.getElementById("welcomeName");
  const labelEl = document.getElementById("userLabel");
  if (nameEl)  nameEl.textContent  = displayName;
  if (labelEl) labelEl.textContent = email;

  // Expose role on the body element so CSS/JS can branch on it if needed
  document.body.dataset.role = getRole(user);
  if (window.AppSidebar && typeof window.AppSidebar.render === "function") {
    window.AppSidebar.render();
  }

  // Mark the active nav link by comparing hrefs
  const currentPage = window.location.pathname.split("/").pop();
  document.querySelectorAll(".nav-link").forEach(link => {
    const href = (link.getAttribute("href") || "").split("/").pop();
    link.classList.toggle("active", href === currentPage);
  });

  return user;
}

async function logout() {
  // Broadcast logout to all other open tabs
  try {
    const ch = new BroadcastChannel('therassistant_session');
    ch.postMessage({ type: 'LOGOUT' });
    ch.close();
  } catch (_) {}
  await supabaseClient.auth.signOut();
  localStorage.removeItem('docusistant.rememberMe');
  sessionStorage.clear();
  window.location.href = 'login.html';
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
});
