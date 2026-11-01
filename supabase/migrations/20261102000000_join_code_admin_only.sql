-- 4.08: the join code is for organization admins only, in the database and not just on screen.
-- Found by the adversarial RLS suite: any member could read `organizations.join_code` through
-- PostgREST. A code in a member's hands lets anyone they pass it to join the organization.
--
-- The table keeps its rows visible to members (name, slug, kind), minus the code. Admins read
-- the code with get_join_code(); joining and rotating still go through their RPCs.

revoke select on public.organizations from authenticated;
grant select (id, name, slug, kind, created_by, created_at) on public.organizations to authenticated;

create function public.get_join_code(p_org uuid)
returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if not app_private.is_org_admin(p_org) then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  select join_code into v_code from public.organizations where id = p_org;
  if not found then raise exception 'E_NOT_FOUND' using errcode = 'P0001'; end if;
  return v_code;
end $$;

revoke execute on function public.get_join_code(uuid) from public, anon;
grant execute on function public.get_join_code(uuid) to authenticated;
