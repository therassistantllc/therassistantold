# THERASSISTANT Navigation & Layout Refactoring

## Executive Summary

Complete refactoring of THERASSISTANT EHR navigation, layout hierarchy, and workflow structure to function as a mature practice management platform similar to SimplePractice, while preserving billing-heavy operational workflows.

**Completed:** April 20, 2026

---

## Core Improvements

### ✅ Reduced Clutter & Duplication
- Eliminated duplicate navigation items (patients, claims, payments now appear only once)
- Consolidated related pages into tab-based interfaces
- Removed redundant menu structures

### ✅ Workflow-Based Organization
- Navigation grouped by workflow instead of data type
- 9 main sections: Dashboard, Scheduling, Patients, Clinical, Billing, Credentialing, Operations, Communications, Admin
- Only one major navigation section expanded at a time

### ✅ Improved Task Accessibility
- Frequently used tasks within 1-2 clicks
- Quick Add button in top bar
- Command Palette (Ctrl+K) for instant navigation
- Recently viewed items in sidebar

### ✅ Enhanced Usability
- Role-appropriate dashboards (clinicians, billers, credentialing staff, admin)
- Consistent design patterns across all pages
- Sticky headers and persistent filters
- Reduced white space and increased information density

---

## Architecture

### Global Layout Components

#### **AppShell** (`components/layout/AppShell.tsx`)
Main layout wrapper that combines TopBar, SidebarNav, CommandPalette, and page content.

**Features:**
- Fixed positioning for navigation elements
- Content area with proper margins (ml-64 mt-16)
- Keyboard shortcut management (Ctrl+K for command palette)
- Responsive layout structure

#### **TopBar** (`components/layout/TopBar.tsx`)
Fixed top navigation bar spanning full width.

**Features:**
- Logo and branding
- Global search trigger (opens CommandPalette)
- Quick Add dropdown menu
- Current clinician selector
- Current location/practice selector
- Notifications dropdown
- User profile menu

**Elements:**
- Search bar: Opens command palette on click or Ctrl+K
- Quick Add: New appointment, claim, payment, note, task, ticket
- Clinician Selector: Filter views by provider
- Location Selector: Filter by practice location
- Notifications: Real-time alerts with badges
- Profile Menu: Settings, help, sign out

#### **SidebarNav** (`components/layout/SidebarNav.tsx`)
Collapsible navigation sidebar (264px wide) with grouped sections.

**Features:**
- Accordion-style expandable sections
- Only one section expanded at a time
- Icon indicators for each section
- Active state highlighting
- Recently viewed items section at bottom

**Navigation Sections:**
1. **Dashboard** - Overview and home
2. **Scheduling** - Calendar, appointments, waitlist, no-shows
3. **Patients** - Directory, insurance, eligibility, documents
4. **Clinical** - Notes, treatment plans, assessments, outcomes
5. **Billing** - Claims, payments, ERA, aging, reports
6. **Credentialing** - Providers, CAQH, payers, contracts
7. **Operations** - Tickets, tasks, queues, templates
8. **Communications** - Chat, messages, letters
9. **Admin** - Users, settings, integrations, billing config

#### **CommandPalette** (`components/layout/CommandPalette.tsx`)
Global search and command interface triggered by Ctrl+K.

**Features:**
- Fuzzy search across commands
- Keyboard navigation (arrows, enter, escape)
- Grouped by category (Navigation, Quick Actions, Search)
- Instant execution of commands

**Command Categories:**
- **Navigation**: Jump to any major page
- **Quick Actions**: Create appointment, claim, payment, note, ticket, task
- **Search**: Find patients, claims, payments, notes

---

## Reusable UI Components

### **TabNavigation** (`components/ui/TabNavigation.tsx`)
Consistent tab interface for multi-view pages.

**Props:**
- `tabs`: Array of tab objects with id, label, href, optional count/badge
- `activeTab`: Currently active tab id

**Features:**
- Count badges for tab items
- Alert badges (red) for urgent tabs
- Active state with bottom border
- Hover states

### **PageHeader** (`components/ui/PageHeader.tsx`)
Standardized page header with title, subtitle, actions, breadcrumbs.

**Props:**
- `title`: Page title
- `subtitle`: Optional subtitle
- `actions`: React node for action buttons
- `breadcrumbs`: Array of breadcrumb objects

**Features:**
- Consistent spacing and typography
- Action button area on right
- Breadcrumb navigation
- Responsive layout

### **FilterSidebar** (`components/ui/FilterSidebar.tsx`)
Reusable left filter panel for list pages.

**Props:**
- `children`: Filter form elements
- `onApply`: Apply filters callback
- `onReset`: Reset filters callback

**Features:**
- Sticky positioning (top-24)
- 264px fixed width
- Apply and Reset buttons
- Consistent styling

### **StatusBadge** (`components/ui/StatusBadge.tsx`)
Color-coded status indicators.

**Props:**
- `status`: Status text
- `variant`: default, success, warning, error, info
- `size`: sm, md, lg

**Variants:**
- **default**: Gray
- **success**: Green
- **warning**: Yellow
- **error**: Red
- **info**: Blue

### **DataTable** (`components/ui/DataTable.tsx`)
Generic data table with sorting, selection, row actions.

**Props:**
- `data`: Array of data objects
- `columns`: Column definitions
- `selectable`: Enable row selection
- `selectedRows`: Set of selected row IDs
- `onSelectRow`: Selection callback
- `onSelectAll`: Select all callback
- `onRowClick`: Row click handler

**Features:**
- Checkbox selection column
- Custom cell renderers
- Sortable columns (configurable)
- Hover states
- Empty state display

---

## Page Refactorings

### **Dashboard** (`app/dashboard/page.tsx`)
Central landing page with overview metrics and quick actions.

**Sections:**
1. **Quick Stats Grid** (4 cards):
   - Today's Appointments (with checked-in/no-shows)
   - Claims Ready (count and value)
   - Unposted Payments (count and value)
   - Open Tasks (with high priority count)

2. **Main Content** (2-column):
   - **Left**: Alerts, Recent Activity, Quick Actions
   - **Right**: Today's Schedule, Revenue Metrics, Top Priorities

**Features:**
- Clickable stat cards navigate to relevant pages
- Color-coded alerts by severity
- Real-time activity feed
- Quick action buttons for common tasks
- Revenue progress bars
- Priority task list

### **Scheduling** (`app/scheduling/page.tsx`)
Complete scheduling interface with calendar, filters, and sidebars.

**Layout:**
1. **KPI Cards** (6 cards across top):
   - Today's Appointments
   - Checked In
   - No Shows
   - Pending Confirmations
   - Waitlist Count
   - Utilization %

2. **Tab Navigation**:
   - Day View
   - Week View (default)
   - Month View
   - Provider View

3. **Three-Column Layout**:
   - **Left Sidebar (264px)**: Filters for provider, appointment type, status, location, insurance
   - **Center Panel**: Calendar toolbar + week grid with time slots
   - **Right Sidebar (320px)**: Waitlist, appointment requests, alerts, provider utilization

**Features:**
- Drag-and-drop appointment slots (placeholder)
- Color-coded appointments by type
- Hover cards for appointment details (placeholder)
- Real-time availability updates
- Waitlist management
- Provider utilization charts

### **Patient Profile** (`app/patients/[id]/page.tsx`)
Unified patient profile with tabbed navigation.

**Header:**
- Patient avatar (initials)
- Name with status badges
- Key demographics (DOB, age, insurance)
- Last and next appointments
- Quick action buttons (Schedule, New Note, Message, Create Claim)

**Tabs:**
1. **Overview**: Quick stats, contact info, recent appointments, notes, claims, tasks
2. **Demographics**: Editable patient information form
3. **Insurance**: Primary/secondary insurance, eligibility, authorizations
4. **Appointments**: Appointment history and upcoming
5. **Notes**: Progress notes, treatment plans, assessments
6. **Claims**: All claims for patient
7. **Balances**: Patient balance, payment history, invoices
8. **Documents**: Uploaded files, forms, consent docs
9. **Communications**: Message history, emails, letters
10. **Tasks**: Open and completed tasks

**Features:**
- Sticky header with patient context
- Tab navigation with count badges
- Recently viewed items
- Quick stats sidebar
- Action buttons always visible

### **Claim Center** (`app/billing/claims/page.tsx`)
Consolidated claims management with tab-based workflow.

**KPI Cards** (6 cards):
- Ready to Submit
- Submitted
- Rejected
- Denied
- Appeals
- Aging 90+

**Tabs:**
1. Ready to Submit (47 claims)
2. Submitted (156 claims)
3. Rejected (8 claims) - Alert badge
4. Denied (12 claims) - Alert badge
5. Appeals (5 claims)
6. Aging (23 claims)
7. Closed

**Three-Column Layout:**
- **Left Sidebar**: Date range, provider, insurance, aging, biller filters
- **Center Panel**: Claims data table with bulk actions toolbar
- **Right Sidebar**: Summary stats, quick actions, alerts

**Features:**
- Bulk claim selection and actions (submit, assign, export)
- Filter persistence
- Sortable columns
- Status badges
- Aging indicators
- Click to view claim details

### **Payment Center** (`app/billing/payment-posting/page.tsx`)
Consolidated payment posting with tab-based workflow.

**KPI Cards** (6 cards):
- Unposted
- Posted Today
- ERA Imports
- Needs Review
- Overpayments
- Recoupments

**Tabs:**
1. Unposted (23 payments)
2. Posted (345 payments)
3. ERA Imports (12 files)
4. EFT/CHK (8 payments)
5. Refunds (5 payments)
6. Recoupments (3 payments) - Alert badge
7. Overpayments (7 payments)

**Three-Column Layout:**
- **Left Sidebar**: Date range, payment type, insurance, status, staff filters
- **Center Panel**: Payments data table with bulk actions
- **Right Sidebar**: Summary stats, quick actions, alerts, posting activity

**Features:**
- Bulk payment selection and actions (post, match, assign)
- Auto-match payments to claims
- ERA file import
- Match confidence indicators
- CARC/RARC code display
- Payment posting audit trail

### **Provider Profile** (`app/credentialing/providers/[id]/page.tsx`)
Unified provider profile with tabs.

**Header:**
- Provider avatar
- Name, title, status
- NPI, license, specialties
- Contact information
- Quick actions (View Schedule, Message, Update Credentialing)

**Tabs:**
1. **Overview**: Quick stats, credentialing status, schedule, claims, productivity, tasks
2. **Schedule**: Weekly/monthly schedule view
3. **Credentialing**: Payer enrollments, CAQH, licenses, contracts
4. **Claims**: Provider's claim history
5. **Productivity**: Revenue, utilization, session metrics
6. **Documents**: License, certifications, contracts
7. **Contracts**: Payer contracts and fee schedules
8. **Tasks**: Credentialing renewals and action items
9. **Messages**: Internal communications

**Features:**
- Credentialing expiration alerts
- Productivity charts
- Payer panel status
- Contract management
- CAQH integration (placeholder)

---

## Navigation State Management

### **Sidebar State Persistence**
- Expanded section saved to localStorage
- Restored on page load
- Only one section expanded at a time

### **Filter State Persistence**
- Filter values saved per page
- Restored when returning to page
- Reset button clears saved state

### **Recently Viewed**
- Track last 5-10 viewed items
- Display in sidebar
- Click to quickly navigate back

### **Saved Views** (Future Enhancement)
- Save filter + sort combinations
- Role-specific default views
- Share views with team members

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` (or `Cmd+K`) | Open Command Palette |
| `↑` / `↓` | Navigate command palette |
| `Enter` | Execute selected command |
| `Esc` | Close command palette |

---

## Design System

### **Color Palette**
- **Primary**: Blue-600
- **Success**: Green-600
- **Warning**: Yellow-600
- **Error**: Red-600
- **Info**: Blue-600
- **Neutral**: Gray-50 to Gray-900

### **Typography**
- **Headers**: Font-bold, 1.5rem to 2rem
- **Body**: Font-normal, 0.875rem to 1rem
- **Labels**: Font-medium, 0.75rem uppercase tracking-wide

### **Spacing**
- **Tight**: 0.25rem to 0.5rem
- **Normal**: 1rem to 1.5rem
- **Loose**: 2rem to 3rem

### **Components**
- **Cards**: White bg, border-gray-200, rounded-lg
- **Buttons**: Rounded-lg, px-4 py-2
- **Badges**: Rounded-full, px-2 py-1
- **Tables**: Striped rows, hover states

---

## Responsive Behavior

### **Desktop (1800px+)**
- Full three-column layouts
- All sidebars visible
- Expanded calendar grids

### **Laptop (1200px - 1800px)**
- Maintain three-column on most pages
- Slightly narrower sidebars
- Collapsed calendar grids

### **Tablet (768px - 1200px)** (Future)
- Two-column layouts
- Collapsible sidebars
- Stacked filters

### **Mobile (< 768px)** (Future)
- Single column
- Hamburger menu
- Bottom navigation bar
- Swipeable tabs

---

## Performance Optimizations

### **Code Splitting**
- Each page is a separate route
- Components lazy-loaded as needed
- Reduced initial bundle size

### **Data Loading**
- Mock data for development
- Pagination for large tables
- Infinite scroll for activity feeds

### **Caching**
- Filter state cached in localStorage
- Recently viewed cached
- Navigation state cached

---

## Future Enhancements

### **Phase 2 Features**
- [ ] Real backend integration (Supabase)
- [ ] WebSocket for real-time updates
- [ ] Advanced filtering (multi-select, date ranges)
- [ ] Saved views and reports
- [ ] Role-based dashboard customization
- [ ] Drag-and-drop appointment scheduling
- [ ] Inline editing in data tables
- [ ] Bulk operations confirmation modals
- [ ] Export to CSV/Excel/PDF
- [ ] Print-friendly views

### **Phase 3 Features**
- [ ] Mobile responsive layouts
- [ ] Dark mode
- [ ] Accessibility improvements (WCAG 2.1 AA)
- [ ] Multi-language support
- [ ] Custom branding per practice
- [ ] Widget-based dashboard builder
- [ ] Advanced analytics and reporting
- [ ] AI-powered insights and suggestions

---

## Migration Guide

### **For Developers**

#### **Updating Existing Pages**
1. Wrap page content in `PageHeader` component
2. Use `TabNavigation` for multi-view pages
3. Use `FilterSidebar` for list pages
4. Use `DataTable` for data grids
5. Use `StatusBadge` for status indicators

#### **Creating New Pages**
```typescript
import PageHeader from "@/components/ui/PageHeader";
import TabNavigation from "@/components/ui/TabNavigation";

export default function NewPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Page Title"
        subtitle="Description"
        actions={<button>Action</button>}
      />
      
      <div className="max-w-[1800px] mx-auto px-6">
        <TabNavigation tabs={tabs} activeTab={activeTab} />
        
        {/* Page content */}
      </div>
    </div>
  );
}
```

### **For Users**

#### **Navigation Changes**
- **Before**: Multiple menu items for patients, claims, payments scattered throughout sidebar
- **After**: Single navigation section for each workflow area, expandable on click

#### **Finding Features**
- **Command Palette**: Press `Ctrl+K` and type what you're looking for
- **Quick Add**: Click Quick Add button in top bar for common actions
- **Recently Viewed**: Check bottom of sidebar for recently accessed items

#### **Keyboard Shortcuts**
- `Ctrl+K`: Open command palette
- Type and navigate with arrows, press Enter to go

---

## Testing Checklist

### **Navigation**
- [ ] All sidebar sections expand/collapse
- [ ] Only one section expands at a time
- [ ] Active page highlighted correctly
- [ ] Recently viewed updates dynamically

### **Command Palette**
- [ ] Opens with Ctrl+K
- [ ] Search filters commands
- [ ] Keyboard navigation works
- [ ] Commands execute correctly

### **Pages**
- [ ] Dashboard loads with correct data
- [ ] Scheduling calendar renders properly
- [ ] Patient profile tabs work
- [ ] Claim Center tabs switch correctly
- [ ] Payment Center tabs switch correctly
- [ ] Provider profile displays data

### **Components**
- [ ] TabNavigation switches tabs
- [ ] FilterSidebar filters data
- [ ] DataTable displays and selects rows
- [ ] StatusBadge shows correct colors

---

## Known Issues & Limitations

### **Current Limitations**
- Mock data only (no backend integration yet)
- Navigation state management basic (needs Redux or Zustand)
- No real-time updates
- Limited keyboard shortcuts
- No mobile responsiveness yet
- No accessibility audit completed

### **Future Fixes**
- Connect to Supabase for real data
- Add Redux for global state management
- Implement WebSocket for real-time updates
- Expand keyboard shortcut system
- Complete responsive design
- Full WCAG 2.1 AA compliance

---

## Support & Documentation

### **Additional Resources**
- Component Storybook (coming soon)
- API Documentation (coming soon)
- User Guide (coming soon)
- Video Tutorials (coming soon)

### **Contact**
For questions or issues:
- Create a GitHub issue
- Contact development team
- Check internal wiki

---

**Built for:** THERASSISTANT EHR  
**Version:** 2.0.0  
**Date:** April 20, 2026  
**Technology Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
