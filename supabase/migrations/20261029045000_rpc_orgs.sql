-- 1.13: organization RPCs (docs/05_Schema.md section 6)

create function public.create_organization(p_name text, p_slug text, p_kind public.org_kind)
returns public.organizations
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); o public.organizations; v_name text := trim(p_name);
begin
  if uid is null then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if v_name is null or char_length(v_name) not between 2 and 100
     or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) not between 3 and 48
     or p_kind is null then
    raise exception 'E_VALIDATION' using errcode = 'P0001';
  end if;
  begin
    insert into public.organizations (name, slug, kind, created_by)
    values (v_name, p_slug, p_kind, uid) returning * into o;
  exception when unique_violation then
    raise exception 'E_SLUG_TAKEN' using errcode = 'P0001';
  end;
  insert into public.org_members (org_id, user_id, role) values (o.id, uid, 'admin');
  return o;
end $$;

create function public.join_org_by_code(p_code text)
returns public.organizations
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); o public.organizations;
begin
  if uid is null then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  select * into o from public.organizations where join_code = upper(trim(p_code));
  if not found then raise exception 'E_INVALID_JOIN_CODE' using errcode = 'P0001'; end if;
  insert into public.org_members (org_id, user_id) values (o.id, uid) on conflict do nothing;
  return o;
end $$;

create function public.rotate_join_code(p_org uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); v_code text;
begin
  if uid is null then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if not app_private.is_org_admin(p_org) then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  update public.organizations set join_code = app_private.generate_join_code()
   where id = p_org returning join_code into v_code;
  return v_code;
end $$;

create function public.set_org_member_role(p_org uuid, p_user uuid, p_role public.org_role)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if not app_private.is_org_admin(p_org) then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  update public.org_members set role = p_role where org_id = p_org and user_id = p_user;  -- E_LAST_ADMIN via trigger
  if not found then raise exception 'E_NOT_FOUND' using errcode = 'P0001'; end if;
end $$;

create function public.remove_org_member(p_org uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if not (app_private.is_org_admin(p_org) or uid = p_user) then
    raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  delete from public.org_members where org_id = p_org and user_id = p_user;  -- guards via triggers
  if not found then raise exception 'E_NOT_FOUND' using errcode = 'P0001'; end if;
end $$;

revoke execute on function
  public.create_organization(text, text, public.org_kind), public.join_org_by_code(text),
  public.rotate_join_code(uuid), public.set_org_member_role(uuid, uuid, public.org_role),
  public.remove_org_member(uuid, uuid)
  from public, anon;
grant execute on function
  public.create_organization(text, text, public.org_kind), public.join_org_by_code(text),
  public.rotate_join_code(uuid), public.set_org_member_role(uuid, uuid, public.org_role),
  public.remove_org_member(uuid, uuid)
  to authenticated;
