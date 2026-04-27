THERASSISTANT CLEAN - WORKFLOW SPINE ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\clients\[id]\page.tsx

Route:
- /clients/[id]

What changed:
- patient chart is the anchor record
- appointment is the parent object for the encounter
- encounter note is created inside the chart
- completed/signed note drives charge generation
- charge drives claim creation
- workflow is now aligned to:
  Patient -> Appointment -> Encounter/Note -> Charge -> Claim -> Payment

Important:
- this assumes encounters already have:
  - session_summary
  - soap_note
- if any update or insert fails, paste the exact error
