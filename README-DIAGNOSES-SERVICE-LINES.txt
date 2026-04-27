THERASSISTANT CLEAN - DIAGNOSES AND SERVICE LINES ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\encounters\diagnoses\page.tsx
- app\encounters\service-lines\page.tsx
- lib\types\index.ts

This ZIP adds:
- encounter diagnoses page
- encounter service lines page
- supporting types

Expected tables:
- encounter_diagnoses
- encounter_service_lines

Expected diagnosis columns:
- id
- encounter_id
- diagnosis_code
- diagnosis_description
- is_primary
- sequence_number
- present_on_claim
- archived_at

Expected service line columns:
- id
- encounter_id
- cpt_hcpcs_code
- units
- charge_amount
- place_of_service_code
- ready_for_claim
- archived_at

After copying:
1. replace the files
2. run npm run dev
3. open:
   - http://localhost:3000/encounters/diagnoses
   - http://localhost:3000/encounters/service-lines

If either page shows a column error, send me the exact message and I will correct it to your real schema.
