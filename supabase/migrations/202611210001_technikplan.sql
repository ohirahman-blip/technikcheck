begin;

create table if not exists public.technikplan_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"customers":[],"appointments":[],"tasks":[]}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint valid_workspace_data check (
    jsonb_typeof(data) = 'object'
    and data ?& array['customers','appointments','tasks']
    and jsonb_typeof(data->'customers') = 'array'
    and jsonb_typeof(data->'appointments') = 'array'
    and jsonb_typeof(data->'tasks') = 'array'
  )
);

alter table public.technikplan_workspaces enable row level security;
revoke all on public.technikplan_workspaces from anon;
grant select, insert, update on public.technikplan_workspaces to authenticated;

drop policy if exists own_workspace_select on public.technikplan_workspaces;
create policy own_workspace_select on public.technikplan_workspaces for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists own_workspace_insert on public.technikplan_workspaces;
create policy own_workspace_insert on public.technikplan_workspaces for insert to authenticated
with check ((select auth.uid()) = owner_id);
drop policy if exists own_workspace_update on public.technikplan_workspaces;
create policy own_workspace_update on public.technikplan_workspaces for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

commit;
