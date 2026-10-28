-- 1.11: RLS helper functions (docs/05_Schema.md section 4).
-- All STABLE SECURITY DEFINER; executable by authenticated only.

-- org helpers (avoid RLS recursion)
create function app_private.is_org_member(p_org uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.org_members where org_id = p_org and user_id = (select auth.uid())) $$;

create function app_private.is_org_admin(p_org uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.org_members
                 where org_id = p_org and user_id = (select auth.uid()) and role = 'admin') $$;

create function app_private.shares_org_with(p_user uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.org_members a join public.org_members b on a.org_id = b.org_id
                 where a.user_id = (select auth.uid()) and b.user_id = p_user) $$;

-- BR-03 visibility
create function app_private.can_view_event(p_event uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.event_members em
                 where em.event_id = p_event and em.user_id = (select auth.uid()))
      or exists (select 1 from public.nodes n join public.org_members om on om.org_id = n.org_id
                 where n.id = p_event and n.type = 'event'
                   and om.user_id = (select auth.uid()) and om.role = 'admin') $$;

-- Manager of node: assignee of the node itself (if event/segment) or any ancestor event/segment
create function app_private.is_manager_of(p_node uuid) returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.nodes t join public.nodes a on a.path @> t.path
                 where t.id = p_node and a.type in ('event','segment')
                   and a.assignee_id = (select auth.uid())) $$;

-- Strict manager: assignee of any proper ancestor
create function app_private.is_strict_manager_of(p_node uuid) returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.nodes t join public.nodes a on a.path @> t.path and a.id <> t.id
                 where t.id = p_node and a.type in ('event','segment')
                   and a.assignee_id = (select auth.uid())) $$;

create function app_private.is_event_owner(p_event uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.nodes where id = p_event and type = 'event'
                 and assignee_id = (select auth.uid())) $$;

revoke execute on function
  app_private.is_org_member(uuid), app_private.is_org_admin(uuid), app_private.shares_org_with(uuid),
  app_private.can_view_event(uuid), app_private.is_manager_of(uuid),
  app_private.is_strict_manager_of(uuid), app_private.is_event_owner(uuid)
  from public, anon;

grant execute on function
  app_private.is_org_member(uuid), app_private.is_org_admin(uuid), app_private.shares_org_with(uuid),
  app_private.can_view_event(uuid), app_private.is_manager_of(uuid),
  app_private.is_strict_manager_of(uuid), app_private.is_event_owner(uuid)
  to authenticated;
