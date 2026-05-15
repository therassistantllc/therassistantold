-- Migration to fix incorrect index on mailroom_items
-- Drops the invalid index referencing non-existent 'status' column and creates a correct index on 'mail_status'

-- Ensure mail_status column exists (table may have been created with legacy 'status' column)
alter table public.mailroom_items
  add column if not exists mail_status text not null default 'unsorted';

-- Migrate data from legacy 'status' column to 'mail_status' if applicable
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mailroom_items' and column_name = 'status'
  ) then
    update public.mailroom_items
    set mail_status = status
    where mail_status = 'unsorted' and status is not null;
  end if;
end;
$$;

drop index if exists public.idx_mailroom_items_status;

create index if not exists idx_mailroom_items_mail_status
  on public.mailroom_items (organization_id, mail_status, created_at desc)
  where archived_at is null;

-- notify pgrst to reload schema so API reflects changes
select pg_notify('pgrst', 'reload schema');
