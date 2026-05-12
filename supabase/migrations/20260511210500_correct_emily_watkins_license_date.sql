do $$
begin
  if to_regclass('public.provider_credentialing_profiles') is not null then
    update public.provider_credentialing_profiles
    set
      primary_license_effective_date = '2023-09-14',
      updated_at = now()
    where provider_name = 'Emily Watkins'
      and individual_npi = '1114590809'
      and primary_license_number = 'CSW.09929735'
      and archived_at is null;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
