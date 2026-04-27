THERASSISTANT CLEAN - PATIENT CHART REFACTOR ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\patients\[id]\layout.tsx
- app\patients\[id]\page.tsx
- app\patients\[id]\documents\page.tsx
- app\patients\[id]\billing-settings\page.tsx
- app\patients\[id]\patient-billing\page.tsx

What changed:
- patient chart now behaves more like the central system of record
- persistent chart header with patient identity and quick actions
- clearer separation of:
  - Patient Info / Profile
  - Documents
  - Billing Settings
  - Patient Billing
- Documents acts as the legal medical record view
- Patient Billing acts as the mini patient A/R ledger
- Billing Settings stays as insurance and billing configuration
