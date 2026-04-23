CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION apply_updated_at_trigger(table_name regclass)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_set_updated_at ON %s;
     CREATE TRIGGER trg_set_updated_at
     BEFORE UPDATE ON %s
     FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
    table_name, table_name
  );
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM ('scheduled','checked_in','in_progress','completed','no_show','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'encounter_status') THEN
    CREATE TYPE encounter_status AS ENUM ('scheduled','in_progress','completed','ready_to_bill','billed','voided');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_status') THEN
    CREATE TYPE note_status AS ENUM ('not_started','in_progress','signed','amended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_status') THEN
    CREATE TYPE claim_status AS ENUM ('draft','ready_to_submit','submitted','accepted','rejected','denied','paid','partially_paid','voided');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_submission_status') THEN
    CREATE TYPE claim_submission_status AS ENUM ('queued','sent','accepted_by_clearinghouse','rejected_by_clearinghouse','accepted_by_payer','rejected_by_payer','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_status_inquiry_status') THEN
    CREATE TYPE claim_status_inquiry_status AS ENUM ('queued','sent','received','no_response','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workqueue_status') THEN
    CREATE TYPE workqueue_status AS ENUM ('open','in_progress','blocked','resolved','closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workqueue_priority') THEN
    CREATE TYPE workqueue_priority AS ENUM ('low','normal','high','urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_alert_status') THEN
    CREATE TYPE billing_alert_status AS ENUM ('open','snoozed','resolved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_ticket_status') THEN
    CREATE TYPE support_ticket_status AS ENUM ('open','pending','waiting_on_client','waiting_on_payer','resolved','closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insurance_policy_priority') THEN
    CREATE TYPE insurance_policy_priority AS ENUM ('primary','secondary','tertiary');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eligibility_status') THEN
    CREATE TYPE eligibility_status AS ENUM ('not_checked','active','inactive','pending','error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'authorization_status') THEN
    CREATE TYPE authorization_status AS ENUM ('not_required','pending','approved','denied','expired','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_object_type') THEN
    CREATE TYPE source_object_type AS ENUM ('appointment','encounter','claim','eligibility_check','authorization_or_referral','payment_import_item','payment_posting','client','insurance_policy','workqueue_item');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('270','276','278','837');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_mode') THEN
    CREATE TYPE processing_mode AS ENUM ('realtime','batch');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_format') THEN
    CREATE TYPE message_format AS ENUM ('x12','json','xml');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'envelope_format') THEN
    CREATE TYPE envelope_format AS ENUM ('x12','none','xml_wrapper');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environment_flag') THEN
    CREATE TYPE environment_flag AS ENUM ('test','production');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_transaction_status') THEN
    CREATE TYPE external_transaction_status AS ENUM ('queued','in_flight','succeeded','failed','deferred','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_attempt_status') THEN
    CREATE TYPE external_attempt_status AS ENUM ('queued','sent','succeeded','failed','timeout','retry_scheduled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_import_status') THEN
    CREATE TYPE payment_import_status AS ENUM ('imported','parsed','needs_review','ready_to_post','posted','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_posting_status') THEN
    CREATE TYPE payment_posting_status AS ENUM ('pending','posted','partially_posted','reversed','failed');
  END IF;
END $$;
