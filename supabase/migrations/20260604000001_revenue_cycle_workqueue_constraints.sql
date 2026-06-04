-- Keep the compatibility check constraint aligned with enum values used by workqueue actions.

alter table if exists public.workqueue_items drop constraint if exists workqueue_items_status_chk;
alter table if exists public.workqueue_items
  add constraint workqueue_items_status_chk
  check (status in ('open', 'in_progress', 'blocked', 'resolved', 'closed', 'deferred'));

select pg_notify('pgrst', 'reload schema');
