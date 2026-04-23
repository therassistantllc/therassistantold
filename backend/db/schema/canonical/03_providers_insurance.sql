CREATE TABLE IF NOT EXISTS providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  display_name text,
  email text,
  phone text,
  credential text,
  npi text,
  taxonomy_code text,
  medicaid_id text,
  provider_type text NOT NULL DEFAULT 'clinician',
  can_bill_independently boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, npi)
);

CREATE TABLE IF NOT EXISTS provider_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  location_name text NOT NULL,
  office_number text,
  place_of_service_code text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, provider_id, location_name)
);

CREATE TABLE IF NOT EXISTS insurance_payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  payer_name text NOT NULL,
  payer_id text NOT NULL,
  payer_category text,
  claims_address text,
  remit_address text,
  eligibility_endpoint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, payer_id)
);

CREATE TABLE IF NOT EXISTS insurance_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  external_subscriber_ref text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  relationship_to_client text NOT NULL,
  member_id text NOT NULL,
  group_number text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, member_id, group_number)
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  subscriber_id uuid NOT NULL REFERENCES insurance_subscribers(id) ON DELETE RESTRICT,
  payer_id uuid NOT NULL REFERENCES insurance_payers(id) ON DELETE RESTRICT,
  priority insurance_policy_priority NOT NULL DEFAULT 'primary',
  plan_name text,
  policy_number text,
  effective_date date NOT NULL,
  termination_date date,
  copay_amount numeric(12,2),
  coinsurance_percent numeric(5,2),
  deductible_amount numeric(12,2),
  out_of_pocket_max numeric(12,2),
  active_flag boolean NOT NULL DEFAULT true,
  legacy_availity_plan_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  CHECK (termination_date IS NULL OR termination_date >= effective_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_policy_per_client
  ON insurance_policies (organization_id, client_id)
  WHERE priority = 'primary' AND archived_at IS NULL;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_provider_id_fkey,
  ADD CONSTRAINT appointments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS appointments_provider_location_id_fkey,
  ADD CONSTRAINT appointments_provider_location_id_fkey FOREIGN KEY (provider_location_id) REFERENCES provider_locations(id) ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS appointments_insurance_policy_id_fkey,
  ADD CONSTRAINT appointments_insurance_policy_id_fkey FOREIGN KEY (insurance_policy_id) REFERENCES insurance_policies(id) ON DELETE SET NULL;

SELECT apply_updated_at_trigger('providers');
SELECT apply_updated_at_trigger('provider_locations');
SELECT apply_updated_at_trigger('insurance_payers');
SELECT apply_updated_at_trigger('insurance_subscribers');
SELECT apply_updated_at_trigger('insurance_policies');
