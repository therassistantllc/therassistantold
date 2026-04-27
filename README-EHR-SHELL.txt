Therassistant Clean EHR Shell

This ZIP is a clean shell for your mental health EHR / practice management app.

What it includes:
- App shell home page
- Scheduling page
- Clients page
- Encounters page
- Billing Work Queue page
- Shared nav
- Supabase client
- Shared TypeScript types

Put these files into:
C:\Users\Thera\therassistant-clean

Before running:
1. Make sure .env.local exists in therassistant-clean
2. It must contain:
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

Then run:
npm run dev

Routes included:
- /
- /scheduling
- /clients
- /encounters
- /billing/workqueue

Notes:
- This shell is built around your real EHR/PM structure
- It does not invent new database tables
- It is meant to be the clean front-end foundation
- The next step after this should be wiring one real table at a time
