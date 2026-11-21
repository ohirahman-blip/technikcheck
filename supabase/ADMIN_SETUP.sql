-- After both migrations: create your user in Supabase > Authentication > Users.
-- Replace the email below with that account's email and run this once in SQL Editor.
-- Never put a password, service-role key, or database password into this file.
begin;
do $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email)=lower('DEINE-ADMIN-EMAIL-HIER');
  if admin_id is null then raise exception 'Admin-Benutzer nicht gefunden. Zuerst in Authentication > Users anlegen und die E-Mail in diesem Skript ersetzen.'; end if;
  insert into public.technik_admins(user_id) values(admin_id) on conflict do nothing;
  if exists(select 1 from technik_private.portal_settings where owner_id<>admin_id) then
    raise exception 'Das Portal ist bereits einem anderen Verwaltungskonto zugeordnet.';
  end if;
  insert into technik_private.portal_settings(singleton,owner_id) values(true,admin_id) on conflict(singleton) do nothing;
end; $$;
commit;
