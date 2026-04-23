CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  external_client_ref text,
  mrn text,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  preferred_name text,
  date_of_birth date NOT NULL,
  sex_at_birth text,
  gender_identity text,
  pronouns text,
  phone text,
  email text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  preferred_language text,
  primary_clinician_user_id uuid,
  deceased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, mrn),
  UNIQUE (organization_id, external_client_ref)
);

CREATE INDEX IF NOT EXISTS idx_clients_org_name ON clients (organization_id, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_clients_org_dob ON clients (organization_id, date_of_birth);

CREATE TABLE IF NOT EXISTS client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_type text NOT NULL CHECK (contact_type IN ('mobile','home','work','email','emergency','guarantor')),
  label text,
  value text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  provider_id uuid,
  provider_location_id uuid,
  insurance_policy_id uuid,
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NOT NULL,
  appointment_status appointment_status NOT NULL DEFAULT 'scheduled',
  appointment_type text,
  reason text,
  check_in_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  telehealth_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  CHECK (scheduled_end_at > scheduled_start_at)
);

CREATE INDEX IF NOT EXISTS idx_appt_org_start ON appointments (organization_id, scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_appt_org_client ON appointments (organization_id, client_id, scheduled_start_at);

SELECT apply_updated_at_trigger('clients');
SELECT apply_updated_at_trigger('client_contacts');
SELECT apply_updated_at_trigger('appointments');
