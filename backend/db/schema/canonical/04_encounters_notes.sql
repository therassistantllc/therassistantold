CREATE TABLE IF NOT EXISTS encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  encounter_status encounter_status NOT NULL DEFAULT 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  service_date date GENERATED ALWAYS AS ((scheduled_start_at AT TIME ZONE 'UTC')::date) STORED,
  required_billing_fields_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  UNIQUE (organization_id, appointment_id),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

-- generated column cannot see appointments, so replace with service_date physical field
ALTER TABLE encounters DROP COLUMN IF EXISTS service_date;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS service_date date;

CREATE TABLE IF NOT EXISTS encounter_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  encounter_id uuid NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  note_status note_status NOT NULL DEFAULT 'not_started',
  note_type text NOT NULL DEFAULT 'progress_note',
  note_body text,
  signed_at timestamptz,
  signed_by_provider_id uuid REFERENCES providers(id) ON DELETE RESTRICT,
  amended_from_note_id uuid REFERENCES encounter_notes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS encounter_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  encounter_id uuid NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  diagnosis_code text NOT NULL,
  diagnosis_description text,
  is_primary boolean NOT NULL DEFAULT false,
  sequence_number integer NOT NULL,
  present_on_claim boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  CHECK (sequence_number > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_dx_sequence ON encounter_diagnoses (organization_id, encounter_id, sequence_number);

CREATE TABLE IF NOT EXISTS encounter_service_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  encounter_id uuid NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  cpt_hcpcs_code text NOT NULL,
  modifier_1 text,
  modifier_2 text,
  modifier_3 text,
  modifier_4 text,
  units numeric(10,2) NOT NULL,
  charge_amount numeric(12,2) NOT NULL,
  rendering_provider_id uuid REFERENCES providers(id) ON DELETE RESTRICT,
  place_of_service_code text,
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_encounter_service_sequence ON encounter_service_lines (organization_id, encounter_id, sequence_number);

SELECT apply_updated_at_trigger('encounters');
SELECT apply_updated_at_trigger('encounter_notes');
SELECT apply_updated_at_trigger('encounter_diagnoses');
SELECT apply_updated_at_trigger('encounter_service_lines');
