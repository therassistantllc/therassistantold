THERASSISTANT CLEAN STARTER

What this ZIP is:
- a very small clean starter for your new app
- built for Next.js + Supabase
- only includes the first safe pages:
  - home
  - scheduling
  - work queue

Where to put it:
- copy these files into your NEW clean project folder:
  C:\Users\Thera\therassistant-clean

Before running:
1. make sure you already created the new Next app
2. create a file named .env.local in your project root
3. put in:
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

Then run:
- npm install @supabase/supabase-js
- npm run dev

Pages included:
- /
- /scheduling
- /workqueue

Next step after this:
- connect scheduling page to real Supabase data
- then build patient/session page
- then Route to Biller
- then biller queue
