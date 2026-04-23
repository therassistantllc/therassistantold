-- ============================================================
--  THERASSISTANT — Support Ticket & Live Chat Module Schema
--  Database: PostgreSQL (Supabase)
--  Generated: 2026-04-06
-- ============================================================

-- ──────────────────────────────────────────────────────────────
--  SUPPORT TICKETS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id                TEXT        PRIMARY KEY DEFAULT 'TKT-' || to_char(nextval('support_ticket_seq'), 'FM0000'),
  requestor         TEXT        NOT NULL,
  practice          TEXT,
  provider          TEXT        NOT NULL,
  client            TEXT,
  insurance         TEXT,
  category          TEXT        NOT NULL
    CHECK (category IN ('Claim Status','Coding','Correspondence','Eligibility Check','Patient Balance','Payments')),
  priority          TEXT        NOT NULL DEFAULT 'Routine'
    CHECK (priority IN ('Routine','High Priority','Urgent')),
  status            TEXT        NOT NULL DEFAULT 'New'
    CHECK (status IN ('New','Pending','Waiting on Client','Waiting on Insurance','Completed','Closed')),
  workflow_stage    TEXT        NOT NULL DEFAULT 'New Intake'
    CHECK (workflow_stage IN (
      'New Intake','Triage','Assigned','Researching',
      'Waiting on Client','Waiting on Insurance','Waiting on Provider',
      'Waiting on Documentation','Ready for Review','Completed','Archived'
    )),
  work_type         TEXT
    CHECK (work_type IN (
      'Research','Correction','Client Follow-Up','Provider Follow-Up',
      'Payer Follow-Up','Documentation Review','Appeal','Escalation',
      'Payment Posting','Eligibility Verification','Credentialing Follow-Up','Closure'
    )),
  description       TEXT        NOT NULL,
  assigned_to       TEXT,                          -- staff display name or user_id (FK optional)
  assigned_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date          DATE,
  resolution_code   TEXT,
  linked_billing_alert_id TEXT,                   -- FK to billing_alerts.id (soft ref)
  linked_conv_id    UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  submitted_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- SLA tracking
  sla_breached_at   TIMESTAMPTZ,
  sla_at_risk_notified_at TIMESTAMPTZ,
  -- Timestamps
  date_submitted    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  -- Full-text search index source
  search_text       TEXT GENERATED ALWAYS AS (
    coalesce(id,'') || ' ' ||
    coalesce(requestor,'') || ' ' ||
    coalesce(provider,'') || ' ' ||
    coalesce(client,'') || ' ' ||
    coalesce(insurance,'') || ' ' ||
    coalesce(description,'')
  ) STORED
);

CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1;

CREATE INDEX idx_support_tickets_status     ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority   ON support_tickets(priority);
CREATE INDEX idx_support_tickets_assigned   ON support_tickets(assigned_user_id);
CREATE INDEX idx_support_tickets_submitted  ON support_tickets(submitted_by);
CREATE INDEX idx_support_tickets_fts        ON support_tickets USING gin(to_tsvector('english', search_text));


-- ──────────────────────────────────────────────────────────────
--  TICKET ATTACHMENTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       TEXT        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  file_name       TEXT        NOT NULL,
  storage_path    TEXT        NOT NULL,   -- Supabase Storage bucket path
  mime_type       TEXT,
  file_size_bytes INTEGER,
  uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_attach_ticket ON ticket_attachments(ticket_id);


-- ──────────────────────────────────────────────────────────────
--  TICKET COMMENTS  (internal notes + staff replies)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     TEXT        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name   TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  is_internal   BOOLEAN     NOT NULL DEFAULT true,   -- false = visible to clinician
  tag           TEXT,                                -- e.g. 'Follow-Up Sent', 'Payer Called'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_author ON ticket_comments(author_id);


-- ──────────────────────────────────────────────────────────────
--  TICKET HISTORY  (audit trail)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     TEXT        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  changed_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  change_text   TEXT        NOT NULL,
  metadata      JSONB,                              -- optional: { old_value, new_value, field }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);


-- ──────────────────────────────────────────────────────────────
--  SAVED REPLIES  (reusable canned responses)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_replies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  category    TEXT,                               -- optional: 'Billing','Coding', etc.
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_global   BOOLEAN     NOT NULL DEFAULT true, -- false = personal; true = visible to all staff
  usage_count INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────
--  ESCALATION RULES  (configurable per deployment)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escalation_rules (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key               TEXT    UNIQUE NOT NULL,  -- matches JS ESCALATION_RULES[].id
  label                  TEXT    NOT NULL,
  severity               TEXT    NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  trigger_after_hours    INTEGER,                  -- null = evaluated per-ticket
  priority_scope         TEXT[],                   -- e.g. ARRAY['Urgent'] or NULL for all
  status_scope           TEXT[],                   -- e.g. ARRAY['Waiting on Insurance']
  notify_roles           TEXT[]  NOT NULL DEFAULT ARRAY['admin'],
  notify_email           BOOLEAN NOT NULL DEFAULT true,
  notify_browser         BOOLEAN NOT NULL DEFAULT true,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default escalation rules
INSERT INTO escalation_rules (rule_key, label, severity, trigger_after_hours, priority_scope, status_scope, notify_roles)
VALUES
  ('urgent_no_update_24h',     'Urgent ticket — no update in 24h',          'critical', 24,  ARRAY['Urgent'],        NULL,                               ARRAY['admin','billing_specialist']),
  ('waiting_insurance_14d',    'Waiting on insurance 14+ days',              'high',    336, NULL,                   ARRAY['Waiting on Insurance'],       ARRAY['admin']),
  ('waiting_client_7d',        'Waiting on client 7+ days',                  'high',    168, NULL,                   ARRAY['Waiting on Client'],          ARRAY['admin','billing_specialist']),
  ('failed_payment_5d',        'Failed payment unresolved 5+ days',          'critical', 120, NULL,                  ARRAY['Pending'],                    ARRAY['admin']),
  ('payer_multiple_open',      'Same payer in 3+ open tickets',              'high',    NULL, NULL,                  NULL,                               ARRAY['admin']),
  ('reassigned_3x',            'Ticket reassigned 3+ times',                 'high',    NULL, NULL,                  NULL,                               ARRAY['admin'])
ON CONFLICT (rule_key) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
--  SLA RULES  (per priority level)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sla_rules (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  priority            TEXT    UNIQUE NOT NULL CHECK (priority IN ('Urgent','High Priority','Routine')),
  overdue_after_hours INTEGER NOT NULL,
  at_risk_pct         NUMERIC(3,2) NOT NULL DEFAULT 0.75, -- 0.0 to 1.0
  target_response_h   INTEGER,
  target_resolution_h INTEGER,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sla_rules (priority, overdue_after_hours, at_risk_pct, target_response_h, target_resolution_h)
VALUES
  ('Urgent',        24,  0.75, 1,  24),
  ('High Priority', 72,  0.75, 4,  72),
  ('Routine',       168, 0.75, 24, 168)
ON CONFLICT (priority) DO UPDATE SET
  overdue_after_hours = EXCLUDED.overdue_after_hours,
  at_risk_pct         = EXCLUDED.at_risk_pct;


-- ──────────────────────────────────────────────────────────────
--  LIVE CHAT CONVERSATIONS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email                TEXT,
  user_display_name         TEXT,
  practice_name             TEXT,
  plan_name                 TEXT,
  topic                     TEXT,
  status                    TEXT        NOT NULL DEFAULT 'Open'
    CHECK (status IN ('Open','Assigned','Waiting on Client','Waiting on Support',
                      'Waiting on Insurance','Escalated','Closed')),
  priority                  TEXT        NOT NULL DEFAULT 'Routine'
    CHECK (priority IN ('Routine','High Priority','Urgent')),
  is_urgent                 BOOLEAN     NOT NULL DEFAULT false,
  assigned_staff_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_ticket_id          TEXT        REFERENCES support_tickets(id) ON DELETE SET NULL,
  tags                      TEXT[],
  last_message_at           TIMESTAMPTZ,
  last_message_preview      TEXT,
  unread_count_staff        INTEGER     NOT NULL DEFAULT 0,
  unread_count_clinician    INTEGER     NOT NULL DEFAULT 0,
  closed_at                 TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_convs_user       ON conversations(user_id);
CREATE INDEX idx_convs_staff      ON conversations(assigned_staff_id);
CREATE INDEX idx_convs_status     ON conversations(status);
CREATE INDEX idx_convs_updated    ON conversations(updated_at DESC);


-- ──────────────────────────────────────────────────────────────
--  CHAT MESSAGES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role       TEXT        NOT NULL CHECK (sender_role IN ('clinician','support','admin','system')),
  message_type      TEXT        NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','file','system','ticket_created','note')),
  content           TEXT        NOT NULL,
  file_name         TEXT,
  file_storage_path TEXT,       -- Supabase Storage path
  is_internal       BOOLEAN     NOT NULL DEFAULT false,  -- internal staff notes
  is_urgent         BOOLEAN     NOT NULL DEFAULT false,
  read_at           TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conv    ON messages(conversation_id);
CREATE INDEX idx_messages_sender  ON messages(sender_id);
CREATE INDEX idx_messages_sent    ON messages(sent_at DESC);


-- ──────────────────────────────────────────────────────────────
--  CHAT TYPING INDICATORS  (ephemeral — cleaned up by Edge Function)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS typing_indicators (
  conversation_id   UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  is_typing         BOOLEAN     NOT NULL DEFAULT true,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Auto-delete stale typing rows after 10 s (via pg_cron or edge function polling)


-- ──────────────────────────────────────────────────────────────
--  CHAT INTERNAL NOTES  (private staff-only notes per conversation)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_internal_notes (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  staff_id         UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  content          TEXT    NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_notes_conv ON chat_internal_notes(conversation_id);


-- ──────────────────────────────────────────────────────────────
--  STAFF PRESENCE  (online/offline/idle status)
-- ──────────────────────────────────────────────────────────────
--  NOTE: Supabase Realtime Presence is used for live tracking.
--  This table stores the *persisted* go-offline preference only.

CREATE TABLE IF NOT EXISTS staff_availability (
  user_id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'online'
    CHECK (status IN ('online','offline','busy','away')),
  status_message    TEXT,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────
--  NOTIFICATIONS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'info'
    CHECK (type IN ('info','warning','critical','sla_breach','escalation','chat','ticket','billing_alert')),
  entity_type   TEXT        CHECK (entity_type IN ('ticket','conversation','billing_alert')),
  entity_id     TEXT,                              -- ticket id, conv id, or BA id
  is_read       BOOLEAN     NOT NULL DEFAULT false,
  sent_email    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifs_user     ON notifications(user_id);
CREATE INDEX idx_notifs_unread   ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifs_created  ON notifications(created_at DESC);


-- ──────────────────────────────────────────────────────────────
--  BILLING ALERTS  (replicated from admin-billing-alerts schema)
--  Stores alerts converted from support tickets and direct entries.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_alerts (
  id                  TEXT        PRIMARY KEY,      -- e.g. BA-2026-001
  patient_name        TEXT,
  patient_dob         DATE,
  alert_type          TEXT        NOT NULL,
  priority            TEXT        NOT NULL DEFAULT 'Routine'
    CHECK (priority IN ('Routine','High Priority','Urgent')),
  status              TEXT        NOT NULL DEFAULT 'New'
    CHECK (status IN ('New','Viewed','In Progress','Waiting on Client',
                      'Waiting on Insurance','Resolved','Archived')),
  payer_name          TEXT,
  insurance_id        TEXT,
  related_claim_id    TEXT,
  due_date            DATE,
  assigned_staff      TEXT,
  assigned_user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_balance     NUMERIC(10,2),
  insurance_status    TEXT,
  description         TEXT,
  action_needed       TEXT,
  staff_notes         TEXT,
  linked_ticket_id    TEXT        REFERENCES support_tickets(id) ON DELETE SET NULL,
  linked_conv_id      UUID        REFERENCES conversations(id)   ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ba_status      ON billing_alerts(status);
CREATE INDEX idx_ba_priority    ON billing_alerts(priority);
CREATE INDEX idx_ba_patient     ON billing_alerts(patient_name);
CREATE INDEX idx_ba_payer       ON billing_alerts(payer_name);
CREATE INDEX idx_ba_assigned    ON billing_alerts(assigned_user_id);
CREATE INDEX idx_ba_due_date    ON billing_alerts(due_date) WHERE due_date IS NOT NULL;


-- ──────────────────────────────────────────────────────────────
--  BILLING ALERT COMMENTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_alert_comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id      TEXT        NOT NULL REFERENCES billing_alerts(id) ON DELETE CASCADE,
  author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name   TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  is_internal   BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ba_comments_alert ON billing_alert_comments(alert_id);


-- ──────────────────────────────────────────────────────────────
--  BILLING ALERT ATTACHMENTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_alert_attachments (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        TEXT    NOT NULL REFERENCES billing_alerts(id) ON DELETE CASCADE,
  file_name       TEXT    NOT NULL,
  storage_path    TEXT    NOT NULL,
  mime_type       TEXT,
  file_size_bytes INTEGER,
  uploaded_by     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────
--  ROW-LEVEL SECURITY  (RLS)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE support_tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history              ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_replies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators           ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_internal_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications               ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_alert_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_alert_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_rules                   ENABLE ROW LEVEL SECURITY;

-- Helper: check if the caller is an admin or billing_specialist
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin','billing_specialist','support_staff'),
    false
  );
$$;

-- Helper: check if the caller is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ── support_tickets ──
CREATE POLICY "staff_read_tickets"   ON support_tickets FOR SELECT USING (is_staff());
CREATE POLICY "staff_insert_tickets" ON support_tickets FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "staff_update_tickets" ON support_tickets FOR UPDATE USING (is_staff());
CREATE POLICY "admin_delete_tickets" ON support_tickets FOR DELETE USING (is_admin());

-- Clinicians can read ONLY their own tickets (submitted_by = auth.uid())
CREATE POLICY "clinician_read_own_tickets" ON support_tickets FOR SELECT
  USING (submitted_by = auth.uid());

-- ── ticket_comments (internal) ──
CREATE POLICY "staff_read_comments"   ON ticket_comments FOR SELECT USING (is_staff() OR (NOT is_internal AND submitted_by = auth.uid()));
CREATE POLICY "staff_insert_comments" ON ticket_comments FOR INSERT WITH CHECK (is_staff());
CREATE POLICY "staff_update_comments" ON ticket_comments FOR UPDATE USING (author_id = auth.uid() AND is_staff());

-- ── conversations ──
CREATE POLICY "staff_all_convs"         ON conversations FOR ALL USING (is_staff());
CREATE POLICY "clinician_own_convs"     ON conversations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "clinician_update_convs"  ON conversations FOR UPDATE USING (user_id = auth.uid());

-- ── messages ──
CREATE POLICY "staff_all_messages"      ON messages FOR ALL USING (is_staff());
CREATE POLICY "clinician_own_messages"  ON messages FOR SELECT
  USING (
    NOT is_internal
    AND conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );
CREATE POLICY "clinician_send_messages" ON messages FOR INSERT
  WITH CHECK (
    sender_role = 'clinician'
    AND conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

-- ── chat_internal_notes: staff only ──
CREATE POLICY "staff_internal_notes" ON chat_internal_notes FOR ALL USING (is_staff());

-- ── notifications: own only ──
CREATE POLICY "own_notifications" ON notifications FOR ALL USING (user_id = auth.uid());

-- ── billing_alerts ──
CREATE POLICY "staff_all_billing_alerts" ON billing_alerts FOR ALL USING (is_staff());

-- ── escalation / sla rules: admin write, staff read ──
CREATE POLICY "staff_read_rules"  ON escalation_rules FOR SELECT USING (is_staff());
CREATE POLICY "admin_write_rules" ON escalation_rules FOR ALL   USING (is_admin());
CREATE POLICY "staff_read_sla"    ON sla_rules         FOR SELECT USING (is_staff());
CREATE POLICY "admin_write_sla"   ON sla_rules         FOR ALL   USING (is_admin());


-- ──────────────────────────────────────────────────────────────
--  REALTIME (enable for live updates)
-- ──────────────────────────────────────────────────────────────

-- Run via Supabase Dashboard → Database → Replication:
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;


-- ──────────────────────────────────────────────────────────────
--  TRIGGERS
-- ──────────────────────────────────────────────────────────────

-- Auto-update updated_at on support_tickets
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_tickets_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_convs_updated
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_ba_updated
  BEFORE UPDATE ON billing_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-log ticket status changes to ticket_history
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_history (ticket_id, change_text, metadata)
    VALUES (NEW.id, 'Status: ' || OLD.status || ' → ' || NEW.status,
            jsonb_build_object('field','status','old',OLD.status,'new',NEW.status));
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO ticket_history (ticket_id, change_text, metadata)
    VALUES (NEW.id, 'Priority: ' || OLD.priority || ' → ' || NEW.priority,
            jsonb_build_object('field','priority','old',OLD.priority,'new',NEW.priority));
  END IF;
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO ticket_history (ticket_id, change_text)
    VALUES (NEW.id, 'Assigned to: ' || coalesce(NEW.assigned_to, '(unassigned)'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_ticket_audit
  AFTER UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_changes();
