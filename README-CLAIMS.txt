THERASSISTANT CLEAN - CLAIMS ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\claims\page.tsx
- app\claims\create\page.tsx
- lib\types\index.ts

This ZIP adds:
- claims list page
- basic draft claim creation page
- claim types

Routes:
- http://localhost:3000/claims
- http://localhost:3000/claims/create

Assumptions in this starter:
- claims table exists
- encounters, encounter_diagnoses, and encounter_service_lines already exist
- draft claim creation inserts into claims with:
  organization_id
  encounter_id
  client_id
  insurance_policy_id
  claim_status
  claim_number
  total_charge_amount

If you get a column error, send me the exact message and I will correct it to your real claims schema.
