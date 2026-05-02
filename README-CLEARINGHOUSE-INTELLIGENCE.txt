THERASSISTANT - CLEARINGHOUSE INTELLIGENCE
=========================================

ZIP name:
therassistant-clearinghouse-intelligence.zip

WHAT THIS PATCH ADDS
--------------------
1. Clearinghouse adapter layer with a mock vendor-neutral adapter.
2. 270/271 eligibility workflow.
3. 276/277 claim status workflow.
4. EDI transaction logging and clearinghouse response events.
5. Scheduling integration with eligibility visibility.
6. Patient chart Insurance & Eligibility section.
7. Claim detail claim-status panel and clearinghouse timeline.
8. Billing workqueue routing shell using clearinghouse response data.
9. Transaction log page at /clearinghouse/transactions.
10. Supabase migrations and demo seed SQL.

FILES INCLUDED
--------------
- types/clearinghouse.ts
- lib/supabase/server.ts
- lib/clearinghouse/*
- components/clearinghouse/*
- app/api/clearinghouse/*
- app/api/patients/[patientId]/eligibility/route.ts
- app/api/claims/[claimId]/status-history/route.ts
- app/scheduling/page.tsx
- app/patients/[id]/billing-settings/page.tsx
- app/billing/page.tsx
- app/billing/claims/[id]/page.tsx
- app/clearinghouse/transactions/page.tsx
- supabase/migrations/20260424_clearinghouse_intelligence.sql
- supabase/seed/clearinghouse_intelligence_seed.sql

REQUIRED ENV
------------
Add or confirm these values in your app:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

The server routes use SUPABASE_SERVICE_ROLE_KEY for database writes to:
- edi_transactions
- eligibility_checks
- claim_status_inquiries
- clearinghouse_response_events

INSTALL
-------
1. Copy the ZIP contents into:
   C:\Users\Thera\therassistant-clean

2. Run the migration in Supabase:
   supabase/migrations/20260424_clearinghouse_intelligence.sql

3. Optionally run the demo seed:
   supabase/seed/clearinghouse_intelligence_seed.sql

4. Restart the app:
   npm run dev

MOCK BEHAVIOR
-------------
Eligibility:
- member ID ending in 0 -> inactive
- member ID ending in 9 -> not found
- otherwise -> active

Claim status:
- claim amount > 1000 -> pending
- claim status already denied -> denied
- claim status already paid -> paid
- otherwise -> accepted

ACCEPTANCE TEST
---------------
1. Open /scheduling
2. Open an appointment detail
3. Click Run Real-Time Eligibility
4. Confirm status, copay, deductible, and latest eligibility display
5. Open /patients/<client-id>/billing-settings
6. Confirm Insurance & Eligibility section, history, and transaction log
7. Open /billing
8. Open a claim
9. Click Run Claim Status
10. Confirm latest 277-style status panel and clearinghouse timeline
11. Open /clearinghouse/transactions
12. Confirm raw request/response visibility

IMPLEMENTATION NOTES
--------------------
- The adapter layer is vendor-neutral and uses MockClearinghouseAdapter now.
- Real adapters can later be added:
  - OfficeAllyClearinghouseAdapter
  - AvailityClearinghouseAdapter
  - ChangeHealthcareClearinghouseAdapter
- Credentials are never rendered in the UI.
- Raw payloads are shown in the UI from transaction logs; secure these views with your role model.
- The billing workqueue page is wired to real claims plus clearinghouse-derived routing, but it remains a shell for deeper operational actions.

KNOWN LIMITS
------------
- The route handlers assume the app uses `clients`, `insurance_policies`, and `claims`.
- If your project uses different organization claims in JWT, update the RLS policy expression in the migration.
- The patient chart insurance/eligibility section is placed in Billing Settings to keep the chart tab structure compact.
