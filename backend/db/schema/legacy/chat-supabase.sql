-- ============================================================
-- THERASSISTANT Chat System — Supabase Migration
-- Run this in the Supabase SQL Editor to enable live chat
-- ============================================================

-- ── Conversations ────────────────────────────────────────────
create table if not exists public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users not null,
  topic                 text check (topic in (
                          'Billing','Credentialing','Coding','Claims','Denials',
                          'Payments','Technical Support','Subscription Question','General Question'
                        )) default 'General Question',
  status                text check (status in (
                          'Open','Assigned','Waiting on Client',
                          'Waiting on Support','Waiting on Insurance','Escalated','Closed'
                        )) default 'Open',
  priority              text check (priority in ('Routine','High Priority','Urgent')) default 'Routine',
  assigned_staff_id     uuid references auth.users,
  unread_count_clinician int default 0,
  unread_count_staff    int default 0,
  last_message_at       timestamptz,
  last_message_preview  text,
  is_urgent             boolean default false,
  tags                  text[],
  linked_ticket_id      text,
  closed_at             timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table public.conversations enable row level security;

create policy "Clinicians see own conversations"
  on public.conversations for all
  using (auth.uid() = user_id);

create policy "Admins see all conversations"
  on public.conversations for all
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
    )
  );

-- ── Messages ─────────────────────────────────────────────────
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references public.conversations on delete cascade not null,
  sender_id        uuid references auth.users not null,
  sender_role      text check (sender_role in ('clinician','support','system')) not null,
  content          text not null,
  message_type     text check (message_type in ('text','file','system','ticket_created')) default 'text',
  is_urgent        boolean default false,
  read_at          timestamptz,
  sent_at          timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Participants can see messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid()
          or exists (
            select 1 from auth.users
            where id = auth.uid()
              and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
          )
        )
    )
  );

create policy "Participants can insert messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

-- ── Message Attachments ──────────────────────────────────────
create table if not exists public.message_attachments (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.messages on delete cascade not null,
  file_name   text not null,
  file_type   text,
  file_url    text not null,
  file_size   integer,
  uploaded_at timestamptz default now()
);

alter table public.message_attachments enable row level security;

create policy "Same access as parent message"
  on public.message_attachments for select
  using (
    exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (c.user_id = auth.uid()
          or exists (
            select 1 from auth.users
            where id = auth.uid()
              and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
          )
        )
    )
  );

-- ── Internal Notes (admin-only) ──────────────────────────────
create table if not exists public.chat_internal_notes (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references public.conversations on delete cascade not null,
  staff_id         uuid references auth.users not null,
  content          text not null,
  created_at       timestamptz default now()
);

alter table public.chat_internal_notes enable row level security;

create policy "Only staff can access internal notes"
  on public.chat_internal_notes for all
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' in ('admin','billing_staff','super_admin')
    )
  );

-- ── Presence Status ──────────────────────────────────────────
create table if not exists public.chat_presence (
  user_id         uuid primary key references auth.users,
  online_status   text check (online_status in ('online','idle','offline')) default 'offline',
  current_page    text,
  current_activity text,
  last_active_at  timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.chat_presence enable row level security;

create policy "Users can update own presence"
  on public.chat_presence for all
  using (auth.uid() = user_id);

create policy "All authenticated users can read presence"
  on public.chat_presence for select
  using (auth.role() = 'authenticated');

-- ── Realtime subscriptions (enable for live chat) ────────────
-- Run in Supabase dashboard → Database → Replication:
-- Enable realtime for: conversations, messages, chat_presence

-- ── Storage bucket for chat attachments ─────────────────────
-- Create in Supabase dashboard → Storage → New bucket:
--   Name: chat-attachments
--   Public: false
--   File size limit: 20MB
--   Allowed MIME types: image/*, application/pdf, text/plain

-- ── Indexes for performance ──────────────────────────────────
create index if not exists idx_conversations_user on public.conversations(user_id);
create index if not exists idx_conversations_status on public.conversations(status);
create index if not exists idx_conversations_assigned on public.conversations(assigned_staff_id);
create index if not exists idx_messages_conv on public.messages(conversation_id, sent_at);
create index if not exists idx_messages_sender on public.messages(sender_id);
