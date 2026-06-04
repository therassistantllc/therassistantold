-- Revenue-cycle workqueue bottleneck fixes: allow deferred items and canonical source object values.

alter type public.workqueue_status add value if not exists 'deferred';
alter type public.source_object_type add value if not exists 'professional_claim';
alter type public.source_object_type add value if not exists 'vcc_payment';
alter type public.source_object_type add value if not exists 'patient_checkin';
