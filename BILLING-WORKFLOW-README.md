# Billing Workflow Modules

## Overview
This system implements comprehensive batch claim submission and unposted payment posting workflows designed for behavioral health billing operations.

## Module 1: Batch Claim Submission

### Pages Created

#### 1. **Ready to Submit** (`/billing/ready-to-submit`)
Shows all claims that have passed validation and are ready for submission.

**Features:**
- ✅ Validation scoring system (0-100%)
- ✅ Three-column layout: Filters | Claims Table | Summary
- ✅ Bulk selection and actions
- ✅ Real-time validation status badges
- ✅ Aging days tracking
- ✅ Insurance breakdown
- ✅ Provider filtering

**Validation Rules Checked:**
- Active eligibility
- Valid payer and member ID
- Rendering and billing providers linked
- CPT/HCPCS codes present
- Diagnosis pointers present
- Valid ICD-10 codes
- Place of service present
- Units and charges > 0
- Authorization if required
- No missing modifiers/NPIs
- No duplicate claims

**Bulk Actions:**
- Select All
- Submit Selected
- Export Selected
- Route to Biller
- Mark as Hold
- Add Note
- Assign Staff

#### 2. **Submission Batches** (`/billing/batches`)
View history of all submitted claim batches.

**Features:**
- ✅ Batch number tracking
- ✅ Submission timestamps
- ✅ Claim count and dollar totals
- ✅ Status tracking (pending, submitted, accepted, partially_rejected, failed)
- ✅ Failed claims counter
- ✅ Download 837 file button
- ✅ Retry failed claims
- ✅ View claims in batch

## Module 2: Unposted Payment Posting Queue

### Pages Created

#### 3. **Unposted Payments** (`/billing/unposted-payments`)
Central queue for all payments awaiting posting to claims.

**Features:**
- ✅ Three-column layout: Filters | Payments Table | Summary
- ✅ Payment type filtering (ERA, CHK, EFT, VCC, Manual)
- ✅ Status-based filtering
- ✅ Insurance company filtering
- ✅ Bulk selection and actions
- ✅ Click-to-open detail drawer
- ✅ Real-time matching indicators
- ✅ Posted vs remaining amounts

**Payment Types Supported:**
- ERA (Electronic Remittance Advice)
- VCC (Virtual Credit Card)
- CHK (Paper Check)
- EFT (Electronic Funds Transfer)
- Manual Entry

**Posting Statuses:**
- Unposted
- Partially Posted
- Fully Posted
- Needs Review
- Missing Claim Match
- Missing Patient Match
- Overpayment Detected
- Underpayment Detected
- Recoupment Detected

**Bulk Actions:**
- Post Selected Payments
- Match Claims
- Route to Biller
- Assign Staff
- Mark for Review
- Export Payment Data
- Add Internal Note
- Reopen Payment
- Split Payment Across Claims

#### 4. **Payment Detail Drawer**
Side drawer that opens when clicking a payment row.

**Features:**
- ✅ Payment information display
- ✅ Financial summary (Payment/Posted/Remaining)
- ✅ Matched claims list with confidence scores
- ✅ CARC/RARC adjustment codes
- ✅ Patient responsibility breakdown
- ✅ Post payment button per claim
- ✅ Auto-match suggestion system
- ✅ Match confidence indicators (exact, high, medium, low, no_match)

**Auto-Matching Logic:**
Matches based on:
- Claim number
- DOS (Date of Service)
- Patient name
- Subscriber ID
- Billed amount
- CPT code
- Insurance company
- Provider
- ERA claim reference number

## Module 3: Billing Dashboard

#### 5. **Billing Dashboard** (`/billing`)
Central dashboard with key billing metrics.

**Widgets:**
- ✅ Ready Claims Count & Dollar Amount
- ✅ Unposted Payments Count & Dollar Amount
- ✅ Failed Submission Count
- ✅ Rejected Claims Count
- ✅ Payments Needing Review
- ✅ Overpayments Detected
- ✅ Recoupments Pending
- ✅ Quick action links

## Additional Components Created

### Claim Details Page (`/claims/[id]`)
Comprehensive CMS-1500 style claim workspace.

**Sections:**
1. **Claim Header** - Fixed top bar with status and actions
2. **Claim Overview Card** - Claim metadata and identifiers
3. **Patient Information Card** - Demographics and contacts
4. **Insurance Information Card** - Coverage and eligibility
5. **Diagnosis Table** - ICD-10 codes with drag-drop ordering
6. **Service Line Table** - CMS-1500 style line items
7. **Financial Summary** - Payment and balance cards
8. **Claim Notes Panel** - Internal notes, payer calls, appeals
9. **Claim Timeline** - Chronological history
10. **Sticky Sidebar** - Status, alerts, quick actions

## Data Types & Structures

### Core Types Created (`lib/types/`)
- `Claim` - Complete claim entity
- `ReadyClaimValidation` - Validation scoring
- `SubmissionBatch` - Batch submission tracking
- `UnpostedPayment` - Payment entity
- `ClaimPaymentMatch` - Payment-to-claim matching
- `PaymentAdjustment` - CARC/RARC codes
- `BillingDashboardMetrics` - Dashboard KPIs

### Mock Data Generators (`lib/data/`)
- `getMockClaim()` - Generate sample claims
- `getReadyClaimsList()` - Ready claims queue
- `getMockSubmissionBatches()` - Batch history
- `getMockUnpostedPayments()` - Payment queue
- `getMockBillingDashboardMetrics()` - Dashboard data

## Integration Points (Future)

### Office Ally Clearinghouse
- 837 file generation
- Batch submission API
- Real-time status updates
- ERA import automation

### ERA Posting
- Automatic ERA parsing
- CARC/RARC code library
- Payment auto-matching
- Posting audit trails

### Ticket System
- Route claims to staff
- Create follow-up tickets
- Track resolution
- SLA monitoring

## UI/UX Features

✅ **Responsive Design** - Works on desktop, tablet, laptop
✅ **Sticky Headers** - Fixed headers for long scrolling
✅ **Color-Coded Badges** - Visual status indicators
✅ **Bulk Actions** - Multi-select workflows
✅ **Filter Panels** - Persistent filtering
✅ **Summary Panels** - Real-time totals
✅ **Hover Tooltips** - Contextual information
✅ **Validation Indicators** - Green/Yellow/Red badges
✅ **Match Confidence Scores** - Percentage-based matching

## Navigation Structure

```
/billing
  ├── Dashboard (Main landing page)
  ├── /ready-to-submit (Ready claims queue)
  ├── /batches (Submission history)
  └── /unposted-payments (Payment posting queue)

/claims/[id]
  └── Claim Details (CMS-1500 workspace)
```

## Key Workflows

### Submit Claims Workflow
1. Navigate to Ready to Submit
2. Review validation scores
3. Filter by insurance/provider
4. Select claims
5. Review summary panel
6. Submit batch
7. Track in Batches page

### Post Payments Workflow
1. Navigate to Unposted Payments
2. Click payment row
3. Review matched claims in drawer
4. Verify CARC/RARC codes
5. Confirm posting amounts
6. Post to claim
7. System updates balances

## Performance Optimizations

- Mock data for fast development
- Component-based architecture
- Lazy loading for large tables
- Sticky positioning for headers
- Efficient state management
- Modular file structure

## Next Steps

1. Connect to Supabase backend
2. Implement Office Ally API integration
3. Add ERA file parsing
4. Build CARC/RARC code library
5. Create appeals workflow
6. Add reporting and analytics
7. Implement audit logging
8. Add real-time notifications
9. Build staff assignment system
10. Create denial management workflow

---

**Built for:** THERASSISTANT EHR  
**Date:** April 20, 2026  
**Technology:** Next.js 16, TypeScript, Tailwind CSS
