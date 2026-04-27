THERASSISTANT CLEAN - STRUCTURED INTAKE ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\clients\new\page.tsx

Route:
- /clients/new

What changed:
- client intake is now structured into sections
- layout is better organized for downstream billing accuracy
- patient demographic data is separated conceptually from subscriber/policy data
- form includes billing guidance for 837P-friendly workflow

Important:
- this does not fix your Supabase RLS policy by itself
- if you still get an RLS error, the form is reaching the database but insert policy is blocking it
