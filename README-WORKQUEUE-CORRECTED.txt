THERASSISTANT CLEAN - CORRECTED WORKQUEUE ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\billing\workqueue\page.tsx
- lib\types\index.ts

This corrected version reads your real tables:
- workqueue_items
- support_tickets

It uses these columns:
- workqueue_items: id, status, priority, work_type, title, description, client_id, claim_id, encounter_id, created_at, archived_at
- support_tickets: workqueue_item_id, title, category, archived_at

After copying:
1. replace the files
2. run npm run dev
3. open http://localhost:3000/billing/workqueue
