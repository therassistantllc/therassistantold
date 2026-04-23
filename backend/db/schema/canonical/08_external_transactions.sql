CREATE TABLE IF NOT EXISTS eligibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  insurance_policy_id uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES appointments(id) ON DELETE RESTRICT,
  encounter_id uuid REFERENCES encounters(id) ON DELETE RESTRICT,
  eligibility_status eligibility_status NOT NULL DEFAULT 'not_checked',
  checked_at timestamptz,
  coverage_start_date date,
  coverage_end_date date,
  copay_amount numeric(12,2),
  deductible_remaining numeric(12,2),
  out_of_pocket_remaining numeric(12,2),
  raw_status_text text,
  response_summary jsonb,
  external_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS authorization_or_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  insurance_policy_id uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES appointments(id) ON DELETE RESTRICT,
  encounter_id uuid REFERENCES encounters(id) ON DELETE RESTRICT,
  auth_type text NOT NULL CHECK (auth_type IN ('authorization','referral')),
  authorization_status authorization_status NOT NULL DEFAULT 'pending',
  authorization_number text,
  referral_number text,
  service_code text,
  units_authorized integer,
  units_used integer NOT NULL DEFAULT 0,
  valid_from date,
  valid_to date,
  requested_at timestamptz,
  approved_at timestamptz,
  denied_at timestamptz,
  denial_reason text,
  external_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  CHECK (units_used >= 0),
  CHECK (units_authorized IS NULL OR units_authorized >= 0),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS external_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  transaction_type transaction_type NOT NULL,
  payload_type text NOT NULL,
  payload_version text NOT NULL,
  message_format message_format NOT NULL,
  envelope_format envelope_format NOT NULL,
  processing_mode processing_mode NOT NULL,
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  core_rule_version text,
  payload_id text,
  request_timestamp timestamptz NOT NULL DEFAULT now(),
  response_timestamp timestamptz,
  provider_office_number text,
  provider_transaction_id text,
  session_id text,
  external_transaction_id text,
  availity_transaction_id text,
  environment_flag environment_flag NOT NULL DEFAULT 'production',
  raw_outbound_payload text,
  raw_inbound_response text,
  parsed_response_summary jsonb,
  attempt_count integer NOT NULL DEFAULT 0,
  duplicate_detection_key text NOT NULL,
  retry_after timestamptz,
  defer_until timestamptz,
  error_class text,
  error_cause_code text,
  error_description text,
  processing_status external_transaction_status NOT NULL DEFAULT 'queued',
  source_object_type source_object_type,
  source_object_id uuid,
  legacy_availity_xml_request text,
  legacy_availity_xml_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, duplicate_detection_key)
);

CREATE TABLE IF NOT EXISTS external_transaction_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  external_transaction_id uuid NOT NULL REFERENCES external_transactions(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  status external_attempt_status NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  ended_at timestamptz,
  http_status_code integer,
  transport_error_code text,
  transport_error_message text,
  request_headers jsonb,
  response_headers jsonb,
  outbound_payload text,
  inbound_payload text,
  retry_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, external_transaction_id, attempt_number),
  CHECK (attempt_number > 0)
);

CREATE TABLE IF NOT EXISTS external_message_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  external_transaction_attempt_id uuid NOT NULL REFERENCES external_transaction_attempts(id) ON DELETE CASCADE,
  isa01 text, isa02 text, isa03 text, isa04 text, isa05 text, isa06 text, isa07 text, isa08 text,
  isa09 text, isa10 text, isa11 text, isa12 text, isa13 text, isa14 text, isa15 text, isa16 text,
  iea01 text, iea02 text,
  gs01 text, gs02 text, gs03 text, gs04 text, gs05 text, gs06 text, gs07 text, gs08 text,
  ge01 text, ge02 text,
  envelope_valid boolean NOT NULL DEFAULT false,
  envelope_error_code text,
  envelope_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, external_transaction_attempt_id),
  CHECK ((isa13 IS NULL OR iea02 IS NULL OR isa13 = iea02)),
  CHECK ((gs06 IS NULL OR ge02 IS NULL OR gs06 = ge02))
);

ALTER TABLE claim_submissions
  DROP CONSTRAINT IF EXISTS claim_submissions_external_transaction_id_fkey,
  ADD CONSTRAINT claim_submissions_external_transaction_id_fkey FOREIGN KEY (external_transaction_id) REFERENCES external_transactions(id) ON DELETE SET NULL;

ALTER TABLE claim_status_inquiries
  DROP CONSTRAINT IF EXISTS claim_status_inquiries_external_transaction_id_fkey,
  ADD CONSTRAINT claim_status_inquiries_external_transaction_id_fkey FOREIGN KEY (external_transaction_id) REFERENCES external_transactions(id) ON DELETE SET NULL;

ALTER TABLE eligibility_checks
  DROP CONSTRAINT IF EXISTS eligibility_checks_external_transaction_id_fkey,
  ADD CONSTRAINT eligibility_checks_external_transaction_id_fkey FOREIGN KEY (external_transaction_id) REFERENCES external_transactions(id) ON DELETE SET NULL;

ALTER TABLE authorization_or_referrals
  DROP CONSTRAINT IF EXISTS authorization_or_referrals_external_transaction_id_fkey,
  ADD CONSTRAINT authorization_or_referrals_external_transaction_id_fkey FOREIGN KEY (external_transaction_id) REFERENCES external_transactions(id) ON DELETE SET NULL;

SELECT apply_updated_at_trigger('eligibility_checks');
SELECT apply_updated_at_trigger('authorization_or_referrals');
SELECT apply_updated_at_trigger('external_transactions');
SELECT apply_updated_at_trigger('external_transaction_attempts');
SELECT apply_updated_at_trigger('external_message_envelopes');
