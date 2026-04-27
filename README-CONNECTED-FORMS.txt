THERASSISTANT CLEAN - CONNECTED FORMS ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\scheduling\new\page.tsx
- app\encounters\new\page.tsx
- app\encounters\diagnoses\new\page.tsx
- app\encounters\service-lines\new\page.tsx

What changed:
- removes raw foreign-key typing where it should be selected from live records
- appointment form uses client/provider selectors and derives policy from selected client
- encounter form selects appointment and auto-fills client/provider from that appointment
- diagnosis and service line forms select encounter from live records

Note:
- provider options are currently demo options unless you wire a real providers table next
