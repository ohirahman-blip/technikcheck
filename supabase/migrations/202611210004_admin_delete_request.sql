-- Allow an authenticated Technikcheck admin to delete a callback request.
-- The operation is scoped to the current authenticated owner, with no anon permission.
begin;
create or replace function public.admin_delete_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_technik_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  delete from public.technik_requests
  where id=p_id and owner_id=auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
end; $$;
revoke all on function public.admin_delete_request(uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_request(uuid) to authenticated;
commit;
