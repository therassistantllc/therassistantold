THERASSISTANT HOME COMMAND CENTER
=================================

ZIP name:
therassistant-home-command-center.zip

WHAT THIS ADDS
--------------
- redesigned therapy-first home screen
- role-aware unified dashboard layout
- command bar with clickable metrics
- reusable dashboard card components
- dashboard API routes
- migrations for:
  - dashboard_widgets
  - dashboard_user_preferences
  - operational_alerts
- demo seed SQL
- loading, empty, and error states

FILES INCLUDED
--------------
- app/page.tsx
- app/api/dashboard/*
- components/dashboard/*
- lib/dashboard/homeData.ts
- supabase/migrations/20260424_home_command_center.sql
- supabase/seed/home_command_center_seed.sql

INSTALL
-------
1. Copy the ZIP contents into:
   C:\Users\Thera\therassistant-clean

2. Run migration:
   supabase/migrations/20260424_home_command_center.sql

3. Optionally run demo seed:
   supabase/seed/home_command_center_seed.sql

4. Restart:
   npm run dev

TEST
----
1. Open /
2. Confirm the home command center loads
3. Change the role selector:
   - Admin / biller
   - Clinician
   - Credentialing user
   - Owner / executive
4. Confirm widgets change by role
5. Click command bar metrics and dashboard actions
6. Confirm routes go to matching workspaces

NOTES
-----
- This build uses live API fetch behavior with a role-aware dashboard payload generator.
- It avoids dead decorative charts and focuses on operational action routing.
- The dashboard payload is intentionally shaped so it can later be wired to more real Supabase tables without changing the UI contract.
