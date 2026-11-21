-- Fix enrollment error: "missing FROM-clause entry for table portal_enroll".
-- Security-definer privileges and existing enrollments remain unchanged.
begin;

create or replace function public.portal_enroll(p_setup_code text,p_device_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  enrollment technik_private.enrollments;
  pc technik_private.portal_clients;
  v_secret_hash text;
begin
  if not technik_private.allow_request('enroll-global',60,300) then
    return jsonb_build_object('ok',false,'code','rate_limited');
  end if;
  if p_setup_code is null or p_setup_code !~ '^[a-f0-9]{48}$'
    or p_device_secret is null or p_device_secret !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok',false,'code','invalid_setup');
  end if;

  v_secret_hash := encode(extensions.digest(p_device_secret,'sha256'),'hex');

  select * into enrollment
  from technik_private.enrollments
  where code_hash = encode(extensions.digest(p_setup_code,'sha256'),'hex')
  for update;

  if enrollment.code_hash is null or enrollment.expires_at < now()
    or (enrollment.used_at is not null and enrollment.device_hash is distinct from v_secret_hash) then
    return jsonb_build_object('ok',false,'code','invalid_setup');
  end if;

  select * into pc
  from technik_private.portal_clients
  where id = enrollment.client_id and active;

  if pc.id is null then
    return jsonb_build_object('ok',false,'code','invalid_setup');
  end if;

  insert into technik_private.devices(secret_hash,client_id)
  values(v_secret_hash,pc.id)
  on conflict do nothing;

  if not exists (
    select 1
    from technik_private.devices d
    where d.secret_hash = v_secret_hash
      and d.client_id = pc.id
      and not d.revoked
  ) then
    return jsonb_build_object('ok',false,'code','invalid_setup');
  end if;

  update technik_private.enrollments
  set used_at = coalesce(used_at,now()), device_hash = v_secret_hash
  where code_hash = enrollment.code_hash;

  return jsonb_build_object('ok',true,'greeting',pc.greeting,'callback_code',pc.callback_code);
end;
$$;

-- Preserve anonymous enrollment access, but no public-wide or privileged table access.
revoke all on function public.portal_enroll(text,text) from public,anon,authenticated;
grant execute on function public.portal_enroll(text,text) to anon,authenticated;

commit;
