THERASSISTANT CLEAN - SCHEMA ALIGNMENT ZIP

Put these files into:
C:\Users\Thera\therassistant-clean

Files included:
- lib\types\index.ts
- app\billing\eligibility\page.tsx
- app\clients\new\page.tsx
- app\insurance\policies\new\page.tsx
- app\encounters\service-lines\page.tsx
- app\encounters\service-lines\new\page.tsx
- app\claims\submissions\page.tsx
- app\claims\status\page.tsx
- app\payments\page.tsx

What this aligns:
- clients uses phone instead of phone_home/phone_mobile
- insurance_policies uses policy_number and priority
- encounter_service_lines uses rendering_provider_id and sequence_number
- claim_submissions uses clearinghouse_reference and external_transaction_id
- claim_status_inquiries uses responded_at and payer status fields
- payment_postings uses total_posted_amount, posting_reference, and payment_import_item_id
- eligibility_checks uses checked_at, external_transaction_id, and response_summary
