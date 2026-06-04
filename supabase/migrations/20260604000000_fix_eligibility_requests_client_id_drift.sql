-- Fix eligibility_requests schema drift: canonical client_id, not patient_id.

create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'eligibility_requests'
      and column_name = 'patient_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'eligibility_requests'
      and column_name = 'client_id'
  ) then
    alter table public.eligibility_requests rename column patient_id to client_id;
  end if;
end $$;

alter table if exists public.eligibility_requests
  add column if not exists client_id uuid;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'eligibility_requests'
      and column_name = 'patient_id'
  ) then
    update public.eligibility_requests
    set client_id = coalesce(client_id, patient_id)
    where client_id is null
      and patient_id is not null;

    alter table public.eligibility_requests drop column patient_id;
  end if;
end $$;

drop index if exists public.idx_eligibility_requests_patient_id;
create index if not exists idx_eligibility_requests_client_id
  on public.eligibility_requests (client_id);

do $$
begin
  if to_regclass('public.clients') is not null
     and to_regclass('public.eligibility_requests') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'eligibility_requests_client_id_fkey'
         and conrelid = 'public.eligibility_requests'::regclass
     ) then
    alter table public.eligibility_requests
      add constraint eligibility_requests_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null
      not valid;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
