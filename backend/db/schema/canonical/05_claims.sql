CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  encounter_id uuid NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  insurance_policy_id uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
  claim_number text NOT NULL,
  claim_status claim_status NOT NULL DEFAULT 'draft',
  claim_frequency_code text NOT NULL DEFAULT '1',
  total_charge_amount numeric(12,2) NOT NULL DEFAULT 0,
  patient_responsibility_amount numeric(12,2) NOT NULL DEFAULT 0,
  payer_responsibility_amount numeric(12,2) NOT NULL DEFAULT 0,
  date_of_service_from date NOT NULL,
  date_of_service_to date NOT NULL,
  ready_to_submit_at timestamptz,
  submitted_at timestamptz,
  accepted_at timestamptz,
  denied_at timestamptz,
  paid_at timestamptz,
  last_blocker_codes text[] NOT NULL DEFAULT '{}',
  duplicate_detection_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, claim_number),
  UNIQUE (organization_id, encounter_id),
  UNIQUE (organization_id, duplicate_detection_key),
  CHECK (date_of_service_to >= date_of_service_from),
  CHECK (total_charge_amount >= 0),
  CHECK (patient_responsibility_amount >= 0),
  CHECK (payer_responsibility_amount >= 0)
);

CREATE TABLE IF NOT EXISTS claim_service_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  encounter_service_line_id uuid REFERENCES encounter_service_lines(id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  cpt_hcpcs_code text NOT NULL,
  modifier_1 text,
  modifier_2 text,
  modifier_3 text,
  modifier_4 text,
  units numeric(10,2) NOT NULL,
  charge_amount numeric(12,2) NOT NULL,
  allowed_amount numeric(12,2),
  paid_amount numeric(12,2),
  sequence_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  CHECK (units > 0),
  CHECK (charge_amount >= 0),
  CHECK (sequence_number > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_claim_service_sequence ON claim_service_lines (organization_id, claim_id, sequence_number);

CREATE TABLE IF NOT EXISTS claim_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
  submission_status claim_submission_status NOT NULL DEFAULT 'queued',
  submission_sequence integer NOT NULL DEFAULT 1,
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  payer_claim_reference text,
  clearinghouse_reference text,
  external_transaction_id uuid,
  duplicate_detection_key text NOT NULL,
  response_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, claim_id, submission_sequence),
  UNIQUE (organization_id, duplicate_detection_key),
  CHECK (submission_sequence > 0)
);

CREATE TABLE IF NOT EXISTS claim_status_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
  inquiry_status claim_status_inquiry_status NOT NULL DEFAULT 'queued',
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  payer_status_code text,
  payer_status_text text,
  response_summary jsonb,
  external_transaction_id uuid,
  duplicate_detection_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, duplicate_detection_key)
);

CREATE INDEX IF NOT EXISTS idx_claims_org_status ON claims (organization_id, claim_status);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_org_status ON claim_submissions (organization_id, submission_status);
CREATE INDEX IF NOT EXISTS idx_claim_inquiries_org_status ON claim_status_inquiries (organization_id, inquiry_status);

SELECT apply_updated_at_trigger('claims');
SELECT apply_updated_at_trigger('claim_service_lines');
SELECT apply_updated_at_trigger('claim_submissions');
SELECT apply_updated_at_trigger('claim_status_inquiries');
