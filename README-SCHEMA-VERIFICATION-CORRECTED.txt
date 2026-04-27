THERASSISTANT CLEAN - CORRECTED SCHEMA VERIFICATION ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\admin\schema-verification\page.tsx

Route:
- /admin/schema-verification

What changed:
- checks schema metadata instead of relying on a live row
- shows row count separately
- avoids false "missing columns" results when tables are empty

Important:
- this version expects an RPC named run_sql that can query information_schema.columns
- if your project does not expose run_sql, the page will show that error
