CREATE TABLE IF NOT EXISTS workqueue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  source_object_type source_object_type NOT NULL,
  source_object_id uuid NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE RESTRICT,
  encounter_id uuid REFERENCES encounters(id) ON DELETE RESTRICT,
  claim_id uuid REFERENCES claims(id) ON DELETE RESTRICT,
  priority workqueue_priority NOT NULL DEFAULT 'normal',
  status workqueue_status NOT NULL DEFAULT 'open',
  work_type text NOT NULL,
  title text NOT NULL,
  description text,
  assigned_to_user_id uuid,
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  context_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_workqueue_org_status ON workqueue_items (organization_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_workqueue_org_source ON workqueue_items (organization_id, source_object_type, source_object_id);

CREATE TABLE IF NOT EXISTS billing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  source_object_type source_object_type NOT NULL,
  source_object_id uuid NOT NULL,
  workqueue_item_id uuid REFERENCES workqueue_items(id) ON DELETE SET NULL,
  alert_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('blocker','warning')),
  status billing_alert_status NOT NULL DEFAULT 'open',
  title text NOT NULL,
  message text NOT NULL,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  snoozed_until timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  workqueue_item_id uuid REFERENCES workqueue_items(id) ON DELETE SET NULL,
  source_object_type source_object_type,
  source_object_id uuid,
  requestor_user_id uuid,
  assigned_to_user_id uuid,
  status support_ticket_status NOT NULL DEFAULT 'open',
  category text NOT NULL,
  priority workqueue_priority NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  description text,
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS support_ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  support_ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid,
  comment_body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz
);

SELECT apply_updated_at_trigger('workqueue_items');
SELECT apply_updated_at_trigger('billing_alerts');
SELECT apply_updated_at_trigger('support_tickets');
SELECT apply_updated_at_trigger('support_ticket_comments');
