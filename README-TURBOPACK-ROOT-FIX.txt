THERASSISTANT CLEAN - TURBOPACK ROOT FIX

Put this file into:
C:\Users\Thera\therassistant-clean

Files included:
- next.config.ts

What it fixes:
- tells Next.js / Turbopack to use:
  C:\Users\Thera\therassistant-clean
- removes the workspace root warning caused by the extra package-lock.json one folder above

After copying:
1. stop the dev server
2. run:
   cd C:\Users\Thera\therassistant-clean
   npm run dev
