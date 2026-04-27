THERASSISTANT CLEAN - ENCOUNTERS ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\encounters\page.tsx
- lib\types\index.ts

This version reads your real encounters table and is meant to sit
between scheduling and claims in the revenue cycle flow.

It expects these encounter columns:
- id
- organization_id
- appointment_id
- client_id
- provider_id
- insurance_policy_id
- claim_id
- encounter_date
- status
- cpt_code
- place_of_service_code
- archived_at

After copying:
1. replace the files
2. run npm run dev
3. open http://localhost:3000/encounters

If you get a column error, send me the exact message and I will correct the ZIP to your real schema.
