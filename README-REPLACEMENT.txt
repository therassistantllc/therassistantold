Billing replacement files

Copy these files into your project, replacing the existing ones:

1. lib/api/canonical.ts
   -> C:\Users\Thera\therassistant ehr\lib\api\canonical.ts

2. backend/src/routes/workqueue.ts
   -> C:\Users\Thera\therassistant ehr\backend\src\routes\workqueue.ts

3. backend/src/services/factories.ts
   -> C:\Users\Thera\therassistant ehr\backend\src\services\factories.ts

4. backend/src/services/repositories.ts
   -> C:\Users\Thera\therassistant ehr\backend\src\services\repositories.ts

5. backend/src/repositories/supabase/ticket-repository.ts
   -> C:\Users\Thera\therassistant ehr\backend\src\repositories\supabase\ticket-repository.ts

6. backend/src/repositories/supabase/workqueue-repository.ts
   -> C:\Users\Thera\therassistant ehr\backend\src\repositories\supabase\workqueue-repository.ts

What this changes:
- Route to Biller still creates a work queue item.
- Route to Biller also creates a linked support ticket.
- The work queue item now uses work_type "route_to_biller" instead of "claim_creation".
- Extra context can be sent from the frontend in context_payload.
- The created work queue item stores support_ticket_id in context_payload after the support ticket is created.

Important:
- Your app runs from backend/src, not backend-dist.
- Back up the existing files before replacing them.
- I could not verify compile/runtime against your full private repo, so treat this as a best-effort replacement set based on the files you uploaded.
