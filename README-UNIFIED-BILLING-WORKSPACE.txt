THERASSISTANT CLEAN - UNIFIED BILLING WORKSPACE ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\billing\page.tsx
- app\billing\claims\[id]\page.tsx

Routes:
- /billing
- /billing/claims/[id]

What changed:
- billing is now one operational workspace instead of fragmented pages
- adds clickable KPI summary bar
- adds primary workqueue panel
- adds claim-first queue rows with inline actions
- adds unified claim detail lifecycle view
- models the flow:
  Workqueue -> Claim -> Action -> Auto-routing -> Resolution

Note:
- this is a structural workspace shell with sample operational data
- next step would be wiring queues and claim detail to your real tables
