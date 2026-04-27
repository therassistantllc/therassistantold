THERASSISTANT CLEAN - WORKFLOW AUTOMATION ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- app\claims\create\page.tsx
- app\claims\submissions\page.tsx
- app\claims\status\page.tsx
- app\payments\page.tsx

What this adds:
- automated claim creation from encounter + diagnoses + service lines + primary policy
- submission automation that marks claim_submissions as submitted and updates claim status
- status automation that marks inquiries as received and advances claim status
- payment automation that marks payment_postings as posted and updates claim status to paid

Notes:
- this is workflow automation inside the existing app flow, not background jobs
- if any page shows a table, permission, or column error, send the exact message
