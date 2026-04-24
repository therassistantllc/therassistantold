# THERASSISTANT — Sidebar Navigation Specification
**Document version:** 1.0  
**Date:** April 6, 2026  
**Status:** Implementation-ready frontend specification

---

## Table of Contents
1. [Navigation Design System Rules](#design-rules)
2. [Admin Sidebar](#admin)
3. [Clinician Sidebar](#clinician)
4. [Billing Specialist Sidebar](#billing-specialist)
5. [Credentialing Specialist Sidebar](#credentialing-specialist)
6. [Supervisor Sidebar](#supervisor)
7. [Front Desk Sidebar](#front-desk)
8. [Patient Portal Sidebar](#patient)
9. [Global Search Pages Reference](#global-search)
10. [Quick Filter Pages Reference](#quick-filters)
11. [Permission-Gated Items Reference](#permission-gates)

---

## 1. Navigation Design System Rules <a id="design-rules"></a>

### Sidebar Behavior
- **Default state:** expanded on desktop (≥1024px), collapsed on tablet/mobile
- **Persistence:** sidebar expand/collapse state stored in `localStorage`
- **Active item:** highlighted with primary brand color left border + background tint
- **Collapsible sections:** indicated by chevron icon; state persisted per-section in `localStorage`
- **Pinned items:** shown at top of sidebar above all sections; user-configurable (drag-to-pin)
- **Badge counts:** live-updated via Supabase real-time subscriptions (alerts, tickets, chats, unread messages)
- **Section labels:** uppercase, small caps, muted color; act as section headers only (not clickable)
- **Tooltip on collapsed:** show item label on hover when sidebar is in icon-only collapsed mode

### Icon System
- Use consistent icon library (e.g., Lucide or Heroicons outline)
- Every nav item must have an icon
- Badge overlays on icon when sidebar is collapsed

### Role Enforcement
- Nav items not permitted for a role are **omitted from the DOM entirely** (not hidden via CSS)
- Role is resolved server-side; nav structure JSON is role-scoped
- Frontend guard: `useRouteGuard(requiredRole)` on every page; redirect to `/unauthorized` if violated

---

## 2. Admin Sidebar <a id="admin"></a>

**Default landing page:** `/app/admin-dashboard`  
**Global search:** Available on all pages  
**Role:** `admin`

---

### 2.1 Pinned Items (always visible at top)

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Dashboard | LayoutDashboard | `/app/admin-dashboard` | — |
| Billing Alerts | BellAlert | `/app/billing-alerts` | `open_alerts_count` (red if critical) |
| Support Tickets | Ticket | `/app/support-tickets` | `open_tickets_count` |
| Live Chat | MessageCircle | `/app/chat` | `unread_chats_count` |

---

### 2.2 Main Navigation Sections

#### PATIENTS
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Patient Database | Users | `/app/patients` | Status, Payer, Clinician, Location |
| Patient Detail | User | `/app/patients/[id]` | — |
| Import Patients | Upload | `/app/patients/import` | — |

#### CLAIMS & BILLING
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Claim Tracker | FileText | `/app/claims` | Status, Payer, Clinician, DOS range |
| Claim Detail | FileMagnify | `/app/claims/[id]` | — |
| CARC/RARC Work Queues | AlertTriangle | `/app/work-queues/carc-rarc` | CARC code, Payer, Date range |
| Aging Work Queues | Clock | `/app/work-queues/aging` | Bucket (0-30/31-60/etc.), Payer, Clinician |
| Route to Biller Queue | ArrowRight | `/app/biller-queue` | Status, Clinician, Priority |
| ERA Imports | FileInput | `/app/era-imports` | Status, Date range |
| CSV Imports | Table | `/app/csv-imports` | Import type, Status |
| SimplePractice Imports | RefreshCcw | `/app/simplepractice-imports` | Sync status, Date |
| Payment Posting Queue | CreditCard | `/app/payment-posting` | Status, Payer, Date |

#### SCHEDULING *(Phase 2)*
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Appointment Calendar | Calendar | `/app/calendar` | Clinician, Location, Status |
| Appointment List | List | `/app/appointments` | Status, Clinician, Date range |
| Eligibility Verification | ShieldCheck | `/app/eligibility` | Status, Payer, Date |
| Batch Eligibility | Zap | `/app/eligibility/batch` | Run date, Status |

#### DOCUMENTATION *(Phase 3)*
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Progress Notes | BookOpen | `/app/notes` | Clinician, Status, Date |
| Treatment Plans | ClipboardList | `/app/treatment-plans` | Clinician, Status |
| Assessments | BarChart2 | `/app/assessments` | Tool type, Clinician, Date |
| Smart Phrases | Zap | `/app/smart-phrases` | Scope (personal/org) |
| Supervisor Queue | UserCheck | `/app/supervisor-queue` | Status, Clinician |

#### CODING & REVENUE
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Coding Engine | Code | `/app/coder` | CPT, Clinician |
| Coding Reports | PieChart | `/app/coding-reports` | Payer, Clinician, Date range |
| Revenue Dashboard | TrendingUp | `/app/revenue-dashboard` | Period, Payer, Clinician, Location |

#### CREDENTIALING *(Phase 4)*
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Credentialing Tracker | Briefcase | `/app/credentialing` | Payer, Status, Clinician |
| License Tracking | Award | `/app/licenses` | State, Expiry range, Status |
| DEA Tracking | Shield | `/app/dea` | State, Expiry range |
| CAQH Integration | Cloud | `/app/caqh` | Sync status |
| Contract Manager | FileSignature | `/app/contracts` | Payer, Expiry range |
| Provider Enrollment | UserCog | `/app/enrollment` | Payer, Status |

#### COMPLIANCE & REPORTING *(Phase 4)*
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Compliance Dashboard | ShieldAlert | `/app/compliance` | Period, Clinician |
| Audit Logs | ScrollText | `/app/audit-logs` | Actor, Resource type, Date range |
| Reporting Dashboards | BarChart | `/app/reports` | Report type, Date range |

#### ADMINISTRATION
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| Users & Staff | UsersRound | `/app/admin/users` | Manage roles and access |
| Subscriptions | Receipt | `/app/admin/subscriptions` | Stripe billing for practice |
| Settings | Settings | `/app/admin/settings` | Org, payer, notification config |
| White-Label *(Phase 4)* | Palette | `/app/admin/branding` | Super-admin only |
| Locations *(Phase 4)* | MapPin | `/app/admin/locations` | Multi-location config |

---

### 2.3 Dashboard Widgets (Admin)

| Widget | Data Source | Refresh | Action |
|--------|-------------|---------|--------|
| Revenue MTD / YTD | `/api/admin/dashboard/kpis` | 5 min | → Revenue Dashboard |
| Outstanding AR | `/api/admin/claims/aging` | 5 min | → Aging Work Queue |
| Claims Dentied (MTD) | `/api/admin/claims/denied` | 5 min | → CARC/RARC Queue |
| ERA Import Status | `/api/admin/era/status` | Real-time | → ERA Imports |
| Open Billing Alerts | `/api/admin/alerts/summary` | Real-time | → Billing Alerts |
| Open Support Tickets | `/api/admin/tickets/summary` | Real-time | → Support Tickets |
| Open Chats | `/api/admin/chats/summary` | Real-time | → Live Chat |
| Eligibility Failures | `/api/admin/eligibility/failures` | 15 min | → Eligibility |
| Unmatched Payments | `/api/admin/payments/unmatched` | 15 min | → Payment Posting |
| Recredentialing Due *(P4)* | `/api/admin/compliance/recredentialing` | Daily | → Credentialing |
| License Expirations *(P4)* | `/api/admin/compliance/licenses` | Daily | → Licenses |
| Active Users | `/api/admin/platform/active-users` | 1 hour | → Users & Staff |

---

### 2.4 Quick Actions Available from Admin Dashboard (No Page Navigation Required)

- Create new patient (slide-over form)
- Create new support ticket
- Start live chat
- Upload ERA file (modal)
- Route to biller (claim search → escalate)
- Dismiss billing alert
- Run batch eligibility (button → background job)

---

### 2.5 Notification Areas

| Area | Location | Trigger |
|------|----------|---------|
| Billing alert banner | Top of every page | Any `open` critical billing alert for org |
| Support ticket badge | Pinned nav item | Unresolved ticket count |
| Live chat badge | Pinned nav item | Unread message count |
| ERA error toast | Global | ERA import completes with exceptions |
| Eligibility failure toast | Global | Batch eligibility job finishes |

---

---

## 3. Clinician Sidebar <a id="clinician"></a>

**Default landing page:** `/app/clinician-dashboard`  
**Global search:** Available on patient, notes, claims pages only  
**Role:** `clinician`

---

### 3.1 Pinned Items

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| My Dashboard | LayoutDashboard | `/app/clinician-dashboard` | — |
| Billing Alerts | BellAlert | `/app/billing-alerts` | `my_open_alerts` (scoped to clinician) |
| Route to Biller | ArrowRight | `/app/route-to-biller` | `pending_escalations` |

---

### 3.2 Main Navigation Sections

#### MY PATIENTS
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| My Patients | Users | `/app/my-patients` | Active/Inactive, Payer, Alert flag |
| Patient Detail | User | `/app/patients/[id]` | — |

#### SCHEDULE *(Phase 2)*
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| My Agenda | CalendarClock | `/app/agenda` | Today-first view |
| My Calendar | Calendar | `/app/my-calendar` | Week/month view, own appointments only |
| Telehealth *(Phase 3)* | Video | `/app/telehealth` | Join/start session |

#### DOCUMENTATION *(Phase 3)*
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Progress Notes | BookOpen | `/app/my-notes` | Status (draft/pending/locked), Date |
| Treatment Plans | ClipboardList | `/app/my-treatment-plans` | Status, Patient |
| Assessments | BarChart2 | `/app/my-assessments` | Tool type, Patient, Date |
| Smart Phrases | Zap | `/app/smart-phrases` | personal scope only |

#### CODING & BILLING
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| Coding Engine | Code | `/app/coder` | Own sessions only |
| My Claims | FileText | `/app/my-claims` | Own claims, all statuses |
| Claim Detail | FileMagnify | `/app/claims/[id]` | Own claims only |
| Documentation Guidance | BookMarked | `/app/doc-guidance` | — |

#### SUPPORT
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| My Support Tickets | Ticket | `/app/my-tickets` | `my_open_tickets` |
| Live Chat | MessageCircle | `/app/chat` | `unread_chats` |

#### SETTINGS
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| My Settings | Settings | `/app/settings/clinician` | Profile, password, notification prefs |
| My Smart Phrases | Zap | `/app/smart-phrases` | Personal phrases management |

---

### 3.3 Dashboard Widgets (Clinician)

| Widget | Data Source | Refresh | Action |
|--------|-------------|---------|--------|
| Today's Appointments *(P2)* | `/api/clinician/agenda/today` | Real-time | → My Agenda |
| Outstanding Progress Notes *(P3)* | `/api/clinician/notes/outstanding` | Real-time | → Notes |
| My Open Billing Alerts | `/api/clinician/alerts` | Real-time | → Billing Alerts |
| My Recent Claims Status | `/api/clinician/claims/recent` | 10 min | → My Claims |
| Pending Escalations | `/api/clinician/escalations` | Real-time | → Route to Biller |
| Assessment Due *(P3)* | `/api/clinician/assessments/due` | Daily | → Assessments |

---

### 3.4 Quick Actions Available from Clinician Dashboard

- Start new progress note (modal → note builder)
- Start coding session (modal → coder)
- Route claim to biller (claim selector → escalate form)
- Open live chat
- View today's agenda

---

### 3.5 Hidden Items (permission-gated, not rendered for clinician)

- Revenue Dashboard
- All admin sections
- ERA/CSV imports
- Aging work queues
- CARC/RARC work queues
- Payment posting queue
- Credentialing tools
- Audit logs
- User management

---

---

## 4. Billing Specialist Sidebar <a id="billing-specialist"></a>

**Default landing page:** `/app/billing-dashboard`  
**Global search:** Available on claims, patients, ERA pages  
**Role:** `billing_specialist`

---

### 4.1 Pinned Items

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Billing Dashboard | LayoutDashboard | `/app/billing-dashboard` | — |
| Billing Alerts | BellAlert | `/app/billing-alerts` | `open_alerts_count` |
| Biller Queue | InboxIcon | `/app/biller-queue` | `pending_escalations` |
| Support Tickets | Ticket | `/app/support-tickets` | `assigned_to_me` |

---

### 4.2 Main Navigation Sections

#### PATIENTS
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Patient Database | Users | `/app/patients` | Payer, Balance, Alert flag |
| Patient Balances *(P2)* | Wallet | `/app/patient-balances` | Balance range, Payer |

#### CLAIMS
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Claim Tracker | FileText | `/app/claims` | Status, Payer, Clinician, DOS |
| CARC/RARC Work Queues | AlertTriangle | `/app/work-queues/carc-rarc` | CARC code, Payer |
| Aging Work Queues | Clock | `/app/work-queues/aging` | Bucket, Payer, Clinician |
| Claim Submission *(P2)* | Send | `/app/claim-submission` | Status, Payer |
| Claim Scrubbing *(P2)* | CheckSquare | `/app/claim-scrubbing` | Error type, Clinician |

#### PAYMENTS & ERA
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| ERA Imports | FileInput | `/app/era-imports` | Status, Date |
| Payment Posting Queue *(P2)* | CreditCard | `/app/payment-posting` | Status, Payer, Date |
| Refunds & Adjustments *(P2)* | RefreshCcw | `/app/refunds` | Type, Status, Date |
| CSV Imports | Table | `/app/csv-imports` | Import type |
| SimplePractice Imports | RefreshCcw | `/app/simplepractice-imports` | — |

#### ELIGIBILITY *(Phase 2)*
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Eligibility Verification | ShieldCheck | `/app/eligibility` | Status, Payer |
| Batch Eligibility | Zap | `/app/eligibility/batch` | Run date |
| Verification Reports | BarChart2 | `/app/eligibility/reports` | Payer, Failure type |

#### REVENUE & REPORTS
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Revenue Dashboard | TrendingUp | `/app/revenue-dashboard` | Period, Payer, Clinician |
| Coding Reports | PieChart | `/app/coding-reports` | Code, Clinician |

#### STATEMENTS *(Phase 2)*
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| Statements | FileText | `/app/statements` | Generate, preview, send |

#### SUPPORT
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Live Chat | MessageCircle | `/app/chat` | `unread_chats` |

---

### 4.3 Dashboard Widgets (Billing Specialist)

| Widget | Data Source | Action |
|--------|-------------|--------|
| Open Biller Escalations | `/api/billing/escalations` | → Biller Queue |
| Aging AR Summary | `/api/admin/claims/aging` | → Aging Work Queue |
| CARC/RARC Open Queue | `/api/billing/carc-queue` | → CARC/RARC Queue |
| ERA Import Status | `/api/admin/era/status` | → ERA Imports |
| Unmatched Payments | `/api/admin/payments/unmatched` | → Payment Posting |
| Open Billing Alerts | `/api/admin/alerts/summary` | → Billing Alerts |
| Claims Submitted Today *(P2)* | `/api/billing/claims/today` | → Claim Submission |
| Eligibility Failures *(P2)* | `/api/admin/eligibility/failures` | → Eligibility |

---

### 4.4 Quick Actions Available from Billing Dashboard

- Post ERA file (upload modal)
- Create billing alert
- Assign escalation to self
- Submit claim batch *(Phase 2)*
- Run batch eligibility *(Phase 2)*

---

---

## 5. Credentialing Specialist Sidebar <a id="credentialing-specialist"></a>

**Default landing page:** `/app/credentialing-dashboard`  
**Global search:** Available on credentialing, license, contract pages  
**Role:** `credentialing_specialist`  
**Phase availability:** Phase 4

---

### 5.1 Pinned Items

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Credentialing Dashboard | LayoutDashboard | `/app/credentialing-dashboard` | — |
| Expiring Licenses | Award | `/app/licenses?filter=expiring` | `expiring_soon_count` (orange/red) |
| Recredentialing Due | Briefcase | `/app/credentialing?filter=due` | `due_count` |

---

### 5.2 Main Navigation Sections

#### PROVIDER CREDENTIALING
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Credentialing Tracker | Briefcase | `/app/credentialing` | Payer, Status, Clinician |
| Provider Enrollment | UserCog | `/app/enrollment` | Payer, Status |
| CAQH Integration | Cloud | `/app/caqh` | Sync status, Clinician |

#### LICENSES & COMPLIANCE
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| License Tracking | Award | `/app/licenses` | State, Expiry range, License type |
| DEA Tracking | Shield | `/app/dea` | State, Expiry range |
| Contract Manager | FileSignature | `/app/contracts` | Payer, Expiry, Status |

#### REPORTS
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| Credentialing Reports | BarChart2 | `/app/credentialing/reports` | — |
| License Expiry Reports | Calendar | `/app/licenses/reports` | — |

#### SUPPORT
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Support Tickets | Ticket | `/app/my-tickets` | `my_open_tickets` |
| Live Chat | MessageCircle | `/app/chat` | `unread_chats` |

---

### 5.3 Dashboard Widgets (Credentialing Specialist)

| Widget | Data Source | Action |
|--------|-------------|--------|
| Licenses Expiring in 90 Days | `/api/credentialing/licenses/expiring` | → License Tracking |
| DEA Registrations Expiring | `/api/credentialing/dea/expiring` | → DEA Tracking |
| Recredentialing Due | `/api/admin/compliance/recredentialing` | → Credentialing Tracker |
| CAQH Sync Status | `/api/credentialing/caqh/status` | → CAQH Integration |
| Contracts Expiring in 90 Days | `/api/credentialing/contracts/expiring` | → Contract Manager |
| Enrollment Pending Actions | `/api/credentialing/enrollment/pending` | → Provider Enrollment |

---

### 5.4 Hidden Items

- Claims and billing sections
- Patient database
- Revenue dashboard
- ERA imports
- Scheduling
- Coding engine
- Audit logs (view only via compliance officer role)

---

---

## 6. Supervisor Sidebar <a id="supervisor"></a>

**Default landing page:** `/app/supervisor-dashboard`  
**Global search:** Available on patients (supervised only), notes, assessments pages  
**Role:** `supervisor`  
**Phase availability:** Phase 3

---

### 6.1 Pinned Items

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Supervisor Dashboard | LayoutDashboard | `/app/supervisor-dashboard` | — |
| Co-Sign Queue | PenLine | `/app/supervisor-queue` | `pending_cosign_count` (red if overdue) |
| Billing Alerts | BellAlert | `/app/billing-alerts` | `supervisee_alerts_count` |

---

### 6.2 Main Navigation Sections

#### MY SUPERVISEES
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Supervisee List | Users | `/app/supervisees` | Active/Inactive |
| Supervisee Patient List | User | `/app/supervisees/[id]/patients` | — |

#### CLINICAL REVIEW
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Co-Sign Queue | PenLine | `/app/supervisor-queue` | Supervisee, Overdue flag, Date |
| Progress Notes | BookOpen | `/app/supervisor/notes` | Supervisee, Status, Date |
| Treatment Plans | ClipboardList | `/app/supervisor/treatment-plans` | Supervisee, Status |
| Assessments | BarChart2 | `/app/supervisor/assessments` | Tool, Supervisee, Date |

#### MY OWN CASELOAD
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| My Patients | Users | `/app/my-patients` | Supervisor's direct caseload |
| My Notes | BookOpen | `/app/my-notes` | Supervisor's own progress notes |
| My Calendar *(P2)* | Calendar | `/app/my-calendar` | — |
| Coding Engine | Code | `/app/coder` | — |

#### SUPPORT
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Support Tickets | Ticket | `/app/my-tickets` | `my_open_tickets` |
| Live Chat | MessageCircle | `/app/chat` | `unread_chats` |

---

### 6.3 Dashboard Widgets (Supervisor)

| Widget | Data Source | Action |
|--------|-------------|--------|
| Pending Co-Signs | `/api/supervisor/queue/pending` | → Co-Sign Queue |
| Overdue Co-Signs (>24h) | `/api/supervisor/queue/overdue` | → Co-Sign Queue (overdue filter) |
| Supervisee Caseload Summary | `/api/supervisor/supervisees/summary` | → Supervisee List |
| Billing Alerts (Supervisees) | `/api/supervisor/alerts` | → Billing Alerts |

---

### 6.4 Quick Actions from Supervisor Dashboard

- Bulk co-sign notes (select list → sign all)
- Return note for revision (inline action on co-sign queue)
- View supervisee's patient

---

### 6.5 Hidden Items

- ERA/CSV imports
- Revenue dashboard
- CARC/RARC work queues
- Aging work queues
- Admin user management
- Credentialing tools
- Audit logs

---

---

## 7. Front Desk Sidebar <a id="front-desk"></a>

**Default landing page:** `/app/front-desk-dashboard`  
**Global search:** Available on patients and appointments pages only  
**Role:** `front_desk`

---

### 7.1 Pinned Items

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Front Desk Dashboard | LayoutDashboard | `/app/front-desk-dashboard` | — |
| Today's Schedule | CalendarClock | `/app/agenda/today` | `todays_appointments_count` |
| Appointment Requests *(P3)* | Bell | `/app/appointment-requests` | `pending_requests_count` |

---

### 7.2 Main Navigation Sections

#### PATIENTS
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Patient Database | Users | `/app/patients` | Active/Inactive, Clinician |
| Intake Forms *(P3)* | ClipboardCheck | `/app/intake-forms` | Status (pending/complete), Date |

#### SCHEDULING *(Phase 2)*
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Quick Filters |
|------|------|-------|--------------|
| Appointment Calendar | Calendar | `/app/calendar` | Clinician, Location, Status |
| Appointment List | List | `/app/appointments` | Date, Clinician, Status |
| Eligibility Verification | ShieldCheck | `/app/eligibility` | Patient, Payer, Status |

#### PAYMENTS
*Collapsible: Yes — Default: Expanded*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| Collect Copay | CreditCard | `/app/payments/collect` | Stripe-powered collection |
| Patient Balances *(P2)* | Wallet | `/app/patient-balances` | View only, own org patients |

#### SUPPORT
*Collapsible: Yes — Default: Collapsed*

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Support Tickets | Ticket | `/app/my-tickets` | `my_open_tickets` |
| Live Chat | MessageCircle | `/app/chat` | `unread_chats` |

---

### 7.3 Dashboard Widgets (Front Desk)

| Widget | Data Source | Action |
|--------|-------------|--------|
| Today's Appointments | `/api/frontdesk/appointments/today` | → Today's Schedule |
| Upcoming Eligibility Checks *(P2)* | `/api/frontdesk/eligibility/upcoming` | → Eligibility |
| Pending Intake Forms *(P3)* | `/api/frontdesk/intake/pending` | → Intake Forms |
| Appointment Requests *(P3)* | `/api/frontdesk/appointment-requests` | → Appointment Requests |

---

### 7.4 Quick Actions from Front Desk Dashboard

- Check in patient (appointment list → mark arrived)
- Collect copay (patient search → payment form)
- Create appointment *(Phase 2)*
- Send intake form link to patient *(Phase 3)*
- Verify eligibility (patient lookup → run check) *(Phase 2)*

---

### 7.5 Hidden Items (Front Desk)

- Claim tracker and work queues
- ERA imports
- Revenue dashboard
- Coding engine
- Progress notes / documentation
- Credentialing tools
- Admin settings
- Audit logs

---

---

## 8. Patient Portal Sidebar <a id="patient"></a>

**Default landing page:** `/portal/dashboard`  
**Global search:** Not available (scoped to own data only, use page-level search where needed)  
**Role:** `patient_portal`  
**Phase availability:** Phase 3  
**Note:** Patient portal is a separate authenticated app at `/portal/`; distinct from the main app nav.

---

### 8.1 Navigation Structure

*Patient portal uses a simplified top nav + minimal sidebar, not the full app sidebar.*

#### MY HEALTH
*Collapsible: No — always visible*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| Dashboard | Home | `/portal/dashboard` | Summary of upcoming appts, messages, balances |
| Appointments | Calendar | `/portal/appointments` | View upcoming; request new |
| Messages | MessageCircle | `/portal/messages` | Secure messages with care team |
| Documents | FolderOpen | `/portal/documents` | Uploaded files, statements |

#### INTAKE & FORMS
*Collapsible: No*

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| My Forms | ClipboardCheck | `/portal/forms` | `incomplete_forms_count` |

#### PAYMENTS
*Collapsible: No*

| Item | Icon | Route | Notes |
|------|------|-------|-------|
| My Balance | Wallet | `/portal/balance` | Outstanding balance |
| Make a Payment | CreditCard | `/portal/payments` | Stripe-powered |
| Payment History | Receipt | `/portal/payments/history` | — |

#### TELEHEALTH
*Collapsible: No*

| Item | Icon | Route | Badge |
|------|------|-------|-------|
| Join Session | Video | `/portal/telehealth` | Badge if session starting soon |

---

### 8.2 Dashboard Widgets (Patient Portal)

| Widget | Data Source | Action |
|--------|-------------|--------|
| Next Appointment | `/api/portal/appointments/next` | → Appointments |
| Unread Messages | `/api/portal/messages/unread` | → Messages |
| Outstanding Balance | `/api/portal/balance` | → Make a Payment |
| Incomplete Forms | `/api/portal/forms/incomplete` | → My Forms |
| Session Starting Soon | `/api/portal/telehealth/upcoming` | → Join Session |

---

### 8.3 Quick Actions from Patient Portal Dashboard

- Request appointment
- Send message to care team
- Pay balance (Stripe modal)
- Complete pending intake form
- Join telehealth session

---

### 8.4 Notification Areas (Patient Portal)

| Area | Trigger |
|------|---------|
| Appointment reminder banner | 24h and 1h before appointment (email + in-portal toast) |
| New message badge | On `messages` nav item; email notification |
| Form due banner | Incomplete intake form assigned before appointment |
| Payment due banner | Outstanding balance > $0 |
| Telehealth starting toast | 5 min before session start |

---

---

## 9. Global Search Pages Reference <a id="global-search"></a>

Global search (`Cmd+K` / `Ctrl+K` shortcut) is available on the following pages per role:

| Role | Pages with Global Search |
|------|--------------------------|
| Admin | All pages |
| Billing Specialist | Claims, Patients, ERA Imports, Work Queues, Revenue Dashboard |
| Clinician | My Patients, My Claims, My Notes, Coding Engine |
| Supervisor | Supervisee List, Notes, Treatment Plans, Assessments |
| Front Desk | Patients, Appointments |
| Credentialing Specialist | Credentialing Tracker, Licenses, Contracts |
| Patient Portal | Not available |

**Global search indexes:** patients (name, MRN, DOB), claims (claim ID, CPT, payer), notes (patient name), tickets (subject)

---

## 10. Quick Filter Pages Reference <a id="quick-filters"></a>

Quick filters appear as a persistent filter bar below the page header (not in a modal).  
They pre-populate from URL query params so filters are shareable via link.

| Page | Quick Filters |
|------|--------------|
| Patient Database | Status, Payer, Clinician, Location, Alert flag |
| Claim Tracker | Status, Payer, Clinician, DOS range, Denial flag |
| CARC/RARC Queue | CARC code, RARC code, Payer, Date range |
| Aging Work Queue | Bucket (0-30/31-60/61-90/91-120/120+), Payer, Clinician |
| ERA Imports | Status (matched/unmatched/error), Date range |
| Eligibility | Status (active/inactive/failed), Payer, Clinician, Date |
| Appointments | Status, Clinician, Location, Date range |
| Billing Alerts | Priority, Type, Status, Assigned to |
| Support Tickets | Category, Priority, Status, Assigned to |
| Progress Notes | Status (draft/pending/locked), Clinician, Date range |
| Revenue Dashboard | Period (MTD/QTD/YTD/custom), Payer, Clinician, Location |
| Credentialing Tracker | Payer, Status, Clinician, Review date range |
| License Tracking | State, License type, Expiry range, Status |

---

## 11. Permission-Gated Items Reference <a id="permission-gates"></a>

The following nav items and features are **not rendered** (removed from DOM) when the  
current user's role does not have access. Role is resolved server-side on session init  
and injected into the frontend nav config.

| Feature / Route | Visible To |
|-----------------|-----------|
| Revenue Dashboard | admin, billing_specialist |
| ERA Imports | admin, billing_specialist |
| CSV / SimplePractice Imports | admin, billing_specialist |
| CARC/RARC Work Queues | admin, billing_specialist |
| Aging Work Queues | admin, billing_specialist |
| Payment Posting Queue | admin, billing_specialist |
| Claim Submission & Scrubbing | admin, billing_specialist |
| Statements | admin, billing_specialist |
| Refunds & Adjustments | admin, billing_specialist |
| Route to Biller Queue (inbox side) | admin, billing_specialist |
| Route to Biller (initiate) | admin, billing_specialist, clinician |
| Coding Engine | admin, billing_specialist, clinician, supervisor |
| Documentation Guidance | admin, clinician, supervisor |
| Progress Notes (create/edit) | admin, clinician, supervisor |
| Supervisor Co-Sign Queue | supervisor, admin |
| Treatment Plans (create/edit) | admin, clinician, supervisor |
| Assessments (administer) | admin, clinician, supervisor |
| Credentialing tools (all) | admin, credentialing_specialist |
| Compliance Dashboard | admin, compliance_officer |
| Audit Logs | admin, compliance_officer |
| User Management | admin |
| Org Settings | admin |
| White-Label Settings | super_admin |
| Locations Management | admin, location_manager |
| Patient Portal | patient_portal (separate app) |
| Eligibility Verification | admin, billing_specialist, front_desk |
| Scheduling (create/edit) | admin, clinician (own), front_desk |
| Patient Balances (view) | admin, billing_specialist, front_desk |
| Stripe Payment Collection | admin, billing_specialist, front_desk |
