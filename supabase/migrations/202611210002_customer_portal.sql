begin;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists technik_private;
revoke all on schema technik_private from public, anon, authenticated;

-- Administrators are assigned only through the SQL editor, never through signup.
create table public.technik_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.technik_admins enable row level security;
revoke all on public.technik_admins from public, anon, authenticated;
create table technik_private.portal_settings (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null references public.technik_admins(user_id) on delete cascade
);
create or replace function public.is_technik_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.technik_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_technik_admin() from public, anon;
grant execute on function public.is_technik_admin() to authenticated;

-- Tighten the existing workspace policies: a session alone is not admin access.
drop policy if exists own_workspace_select on public.technikplan_workspaces;
drop policy if exists own_workspace_insert on public.technikplan_workspaces;
drop policy if exists own_workspace_update on public.technikplan_workspaces;
create policy own_workspace_select on public.technikplan_workspaces for select to authenticated
using (owner_id = (select auth.uid()) and (select public.is_technik_admin()));
create policy own_workspace_insert on public.technikplan_workspaces for insert to authenticated
with check (owner_id = (select auth.uid()) and (select public.is_technik_admin()));
create policy own_workspace_update on public.technikplan_workspaces for update to authenticated
using (owner_id = (select auth.uid()) and (select public.is_technik_admin()))
with check (owner_id = (select auth.uid()) and (select public.is_technik_admin()));

create table technik_private.portal_clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.technik_admins(user_id),
  customer_id bigint not null,
  callback_code text not null unique check (callback_code ~ '^[0-9]{4}$'),
  greeting text not null,
  customer_name text not null,
  phone text not null default '',
  address text not null default '',
  active boolean not null default true,
  unique(owner_id, customer_id)
);
create table technik_private.enrollments (
  code_hash text primary key,
  client_id uuid not null references technik_private.portal_clients(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz,
  device_hash text
);
create table technik_private.devices (
  secret_hash text primary key,
  client_id uuid not null references technik_private.portal_clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);
create table public.technik_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.technik_admins(user_id),
  client_id uuid references technik_private.portal_clients(id),
  customer_id bigint,
  callback_code text not null check (callback_code ~ '^[0-9]{4}$'),
  customer_name text not null default '',
  phone text not null default '',
  address text not null default '',
  status text not null default 'offen' check (status in ('offen','in_bearbeitung','erledigt')),
  notes text not null default '' check (length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_open_request_per_code on public.technik_requests(owner_id,callback_code) where status <> 'erledigt';
create index request_owner_date on public.technik_requests(owner_id,created_at desc);
alter table public.technik_requests enable row level security;
revoke all on public.technik_requests from public,anon,authenticated;
grant select on public.technik_requests to authenticated;
create policy admin_request_read on public.technik_requests for select to authenticated
using (owner_id = (select auth.uid()) and (select public.is_technik_admin()));

-- Atomic, server-side throttling; the code is a callback identifier, not a password.
create table technik_private.rate_limits (bucket text primary key, started_at timestamptz not null, hits integer not null);
create function technik_private.allow_request(p_bucket text, p_limit integer, p_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into technik_private.rate_limits(bucket,started_at,hits) values(p_bucket,now(),1)
  on conflict(bucket) do update set
    hits = case when rate_limits.started_at < now() - make_interval(secs=>p_seconds) then 1 else rate_limits.hits + 1 end,
    started_at = case when rate_limits.started_at < now() - make_interval(secs=>p_seconds) then now() else rate_limits.started_at end
  returning hits into n;
  return n <= p_limit;
end; $$;
revoke all on function technik_private.allow_request(text,integer,integer) from public,anon,authenticated;

create function public.admin_issue_setup(p_customer_id bigint, p_greeting text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c jsonb; pc technik_private.portal_clients; code text; secret text; i integer;
begin
  if not public.is_technik_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from technik_private.portal_settings where owner_id=auth.uid()) then raise exception 'PORTAL_NOT_CONFIGURED'; end if;
  select item into c from public.technikplan_workspaces w cross join lateral jsonb_array_elements(w.data->'customers') item
  where w.owner_id=auth.uid() and (item->>'id')::bigint=p_customer_id;
  if c is null or coalesce(c->>'archived','0') in ('1','true') then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended('technik-setup',0));
  select * into pc from technik_private.portal_clients where owner_id=auth.uid() and customer_id=p_customer_id;
  if pc.id is null then
    for i in 1..10000 loop
      code := lpad((floor(random()*10000)::integer)::text,4,'0');
      if not exists(select 1 from technik_private.portal_clients where callback_code=code) then exit; end if;
      code := null;
    end loop;
    if code is null then raise exception 'NO_CODES_AVAILABLE'; end if;
    insert into technik_private.portal_clients(owner_id,customer_id,callback_code,greeting,customer_name,phone,address)
    values(auth.uid(),p_customer_id,code,left(coalesce(nullif(trim(p_greeting),''),c->>'name'),120),c->>'name',coalesce(c->>'phone',''),coalesce(c->>'address','')) returning * into pc;
  else
    update technik_private.portal_clients set active=true,greeting=left(coalesce(nullif(trim(p_greeting),''),c->>'name'),120),customer_name=c->>'name',phone=coalesce(c->>'phone',''),address=coalesce(c->>'address','') where id=pc.id returning * into pc;
  end if;
  delete from technik_private.enrollments where client_id=pc.id;
  secret := encode(extensions.gen_random_bytes(24),'hex');
  insert into technik_private.enrollments(code_hash,client_id) values(encode(extensions.digest(secret,'sha256'),'hex'),pc.id);
  return jsonb_build_object('setup_code',secret,'callback_code',pc.callback_code,'greeting',pc.greeting,'expires_at',now()+interval '24 hours');
end; $$;

-- The device creates its secret before redeeming the one-use code. Retrying a lost
-- response with the same secret is safe; another device cannot reuse the code.
create function public.portal_enroll(p_setup_code text,p_device_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare enrollment technik_private.enrollments; pc technik_private.portal_clients; secret_hash text;
begin
  if not technik_private.allow_request('enroll-global',60,300) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
  if p_setup_code is null or p_setup_code !~ '^[a-f0-9]{48}$' or p_device_secret is null or p_device_secret !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'code','invalid_setup'); end if;
  secret_hash := encode(extensions.digest(p_device_secret,'sha256'),'hex');
  select * into enrollment from technik_private.enrollments where code_hash=encode(extensions.digest(p_setup_code,'sha256'),'hex') for update;
  if enrollment.code_hash is null or enrollment.expires_at<now() or (enrollment.used_at is not null and enrollment.device_hash is distinct from secret_hash) then return jsonb_build_object('ok',false,'code','invalid_setup'); end if;
  select * into pc from technik_private.portal_clients where id=enrollment.client_id and active;
  if pc.id is null then return jsonb_build_object('ok',false,'code','invalid_setup'); end if;
  insert into technik_private.devices(secret_hash,client_id) values(secret_hash,pc.id) on conflict do nothing;
  if not exists(select 1 from technik_private.devices d where d.secret_hash=portal_enroll.secret_hash and d.client_id=pc.id and not d.revoked) then return jsonb_build_object('ok',false,'code','invalid_setup'); end if;
  update technik_private.enrollments set used_at=coalesce(used_at,now()),device_hash=secret_hash where code_hash=enrollment.code_hash;
  return jsonb_build_object('ok',true,'greeting',pc.greeting,'callback_code',pc.callback_code);
end; $$;

create function public.portal_device_status(p_device_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pc technik_private.portal_clients; pending boolean;
begin
  if p_device_secret is null or length(p_device_secret)<>64 then return jsonb_build_object('ok',false,'code','invalid_device'); end if;
  select c.* into pc from technik_private.devices d join technik_private.portal_clients c on c.id=d.client_id
  where d.secret_hash=encode(extensions.digest(p_device_secret,'sha256'),'hex') and not d.revoked and c.active;
  if pc.id is null then return jsonb_build_object('ok',false,'code','invalid_device'); end if;
  select exists(select 1 from public.technik_requests where client_id=pc.id and status<>'erledigt') into pending;
  return jsonb_build_object('ok',true,'greeting',pc.greeting,'pending',pending);
end; $$;

create function public.portal_request_help(p_device_secret text default null,p_callback_code text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pc technik_private.portal_clients; service_owner uuid; code text; request_id uuid; c jsonb;
begin
  select owner_id into service_owner from technik_private.portal_settings where singleton;
  if service_owner is null then return jsonb_build_object('ok',false,'code','not_configured'); end if;
  if not technik_private.allow_request('help-global',120,300) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
  if p_device_secret is not null then
    if length(p_device_secret)<>64 then return jsonb_build_object('ok',false,'code','invalid_device'); end if;
    select c.* into pc from technik_private.devices d join technik_private.portal_clients c on c.id=d.client_id
    where d.secret_hash=encode(extensions.digest(p_device_secret,'sha256'),'hex') and not d.revoked and c.active;
    if pc.id is null then return jsonb_build_object('ok',false,'code','invalid_device'); end if;
    code := pc.callback_code;
  else
    if p_callback_code is null or p_callback_code !~ '^[0-9]{4}$' then return jsonb_build_object('ok',false,'code','invalid_code'); end if;
    code := p_callback_code;
    select * into pc from technik_private.portal_clients where callback_code=code and active and owner_id=service_owner;
  end if;
  if not technik_private.allow_request('code-'||code,12,3600) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
  perform pg_advisory_xact_lock(hashtextextended('request-'||code,0));
  select id into request_id from public.technik_requests where owner_id=service_owner and callback_code=code and status<>'erledigt';
  if request_id is not null then return jsonb_build_object('ok',true); end if;
  -- Unknown codes are also received as unassigned requests. The response never
  -- discloses whether a code exists, a customer's name, or another request's state.
  insert into public.technik_requests(owner_id,client_id,customer_id,callback_code,customer_name,phone,address)
  values(service_owner,pc.id,pc.customer_id,code,coalesce(pc.customer_name,''),coalesce(pc.phone,''),coalesce(pc.address,''));
  return jsonb_build_object('ok',true);
end; $$;

create function public.admin_update_request(p_id uuid,p_status text,p_notes text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_technik_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_status not in ('offen','in_bearbeitung','erledigt') or p_status is null or p_notes is null or length(p_notes)>5000 then raise exception 'INVALID_INPUT'; end if;
  update public.technik_requests set status=p_status,notes=p_notes,updated_at=now() where id=p_id and owner_id=auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
end; $$;
create function public.admin_revoke_customer_access(p_customer_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if not public.is_technik_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select id into cid from technik_private.portal_clients where customer_id=p_customer_id and owner_id=auth.uid();
  update technik_private.portal_clients set active=false where id=cid;
  update technik_private.devices set revoked=true where client_id=cid;
  delete from technik_private.enrollments where client_id=cid;
end; $$;

revoke all on all tables in schema technik_private from public,anon,authenticated;
revoke all on function public.admin_issue_setup(bigint,text), public.admin_update_request(uuid,text,text), public.admin_revoke_customer_access(bigint) from public,anon,authenticated;
grant execute on function public.admin_issue_setup(bigint,text), public.admin_update_request(uuid,text,text), public.admin_revoke_customer_access(bigint) to authenticated;
revoke all on function public.portal_enroll(text,text), public.portal_device_status(text), public.portal_request_help(text,text) from public,anon,authenticated;
grant execute on function public.portal_enroll(text,text), public.portal_device_status(text), public.portal_request_help(text,text) to anon,authenticated;
commit;
