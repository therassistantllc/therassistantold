THERASSISTANT CLEAN - ENCOUNTER NOTE COMPOSER ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\clients\[id]\page.tsx

Route:
- /clients/[id]

What changed:
- adds an encounter note composer inside the client chart
- lets you choose an active encounter
- adds SOAP-style note sections plus risk notes and session summary
- keeps diagnoses and service lines visible beside the note workflow

Important:
- this saves note content by updating the encounters row with:
  - session_summary
  - soap_note
- if your encounters table does not have those columns, paste the exact error
