THERASSISTANT CLEAN - APPOINTMENTS ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\scheduling\page.tsx
- lib\types\index.ts

What it does:
- reads real rows from Supabase table: appointments
- shows loading, error, search, and status filter
- gives you a clean scheduling foundation for the EHR rebuild

After copying files:
1. make sure .env.local is already set
2. run npm run dev
3. open http://localhost:3000/scheduling

Notes:
- this expects a table named appointments
- if loading fails, it is usually a Supabase permission issue
- this version keeps the UI simple on purpose
