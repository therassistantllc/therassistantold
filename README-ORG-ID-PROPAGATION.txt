THERASSISTANT CLEAN - ORG ID PROPAGATION ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- .env.local.example
- app\insurance\policies\new\page.tsx
- app\scheduling\new\page.tsx
- app\encounters\new\page.tsx
- app\encounters\diagnoses\new\page.tsx
- app\encounters\service-lines\new\page.tsx

What changed:
- propagates NEXT_PUBLIC_ORGANIZATION_ID into inserts
- keeps forms aligned with your real schema
- mirrors the fix that already made client intake save correctly

Reminder:
- your real .env.local should contain:
  NEXT_PUBLIC_ORGANIZATION_ID=11111111-1111-1111-1111-111111111111
