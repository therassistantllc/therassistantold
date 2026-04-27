THERASSISTANT CLEAN - SCHEMA VERIFICATION ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\admin\schema-verification\page.tsx

Route added:
- /admin/schema-verification

What it does:
- checks core tables the clean app expects
- shows missing columns, extra columns, and table access errors
- helps you compare live Supabase behavior to the current app assumptions

Important:
- this version infers returned columns from a live row
- if a table has zero rows, it may show "No row returned"
- that still helps because permission errors and table access issues will be visible
