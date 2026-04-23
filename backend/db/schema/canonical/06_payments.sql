CREATE TABLE IF NOT EXISTS payment_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  import_source text NOT NULL,
  payment_import_status payment_import_status NOT NULL DEFAULT 'imported',
  source_file_name text,
  source_file_hash text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  total_item_count integer NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  parse_errors_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS payment_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES payment_import_batches(id) ON DELETE CASCADE,
  payment_import_status payment_import_status NOT NULL DEFAULT 'imported',
  imported_item_ref text,
  payment_date date,
  payer_id uuid REFERENCES insurance_payers(id) ON DELETE RESTRICT,
  claim_id uuid REFERENCES claims(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES clients(id) ON DELETE RESTRICT,
  service_line_ref text,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  unapplied_amount numeric(12,2) NOT NULL DEFAULT 0,
  posting_ready boolean NOT NULL DEFAULT false,
  raw_item_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS payment_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  payment_import_item_id uuid REFERENCES payment_import_items(id) ON DELETE RESTRICT,
  posting_status payment_posting_status NOT NULL DEFAULT 'pending',
  posted_at timestamptz,
  reversed_at timestamptz,
  posting_reference text NOT NULL,
  total_posted_amount numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, posting_reference)
);

CREATE TABLE IF NOT EXISTS payment_posting_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  payment_posting_id uuid NOT NULL REFERENCES payment_postings(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES claims(id) ON DELETE RESTRICT,
  claim_service_line_id uuid REFERENCES claim_service_lines(id) ON DELETE RESTRICT,
  encounter_id uuid REFERENCES encounters(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES clients(id) ON DELETE RESTRICT,
  allocation_type text NOT NULL CHECK (allocation_type IN ('insurance_payment','patient_payment','adjustment','writeoff')),
  allocated_amount numeric(12,2) NOT NULL,
  allocation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  CHECK (allocated_amount <> 0),
  CHECK (
    (claim_id IS NOT NULL)::int +
    (claim_service_line_id IS NOT NULL)::int +
    (encounter_id IS NOT NULL)::int +
    (client_id IS NOT NULL)::int >= 1
  )
);

SELECT apply_updated_at_trigger('payment_import_batches');
SELECT apply_updated_at_trigger('payment_import_items');
SELECT apply_updated_at_trigger('payment_postings');
SELECT apply_updated_at_trigger('payment_posting_allocations');
