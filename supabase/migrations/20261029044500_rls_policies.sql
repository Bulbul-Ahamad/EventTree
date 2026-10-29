-- 1.12: enable RLS, base privileges, column grants, policies (docs/05_Schema.md section 5)

alter table public.profiles       enable row level security;
alter table public.organizations  enable row level security;
alter table public.org_members    enable row level security;
alter table public.nodes          enable row level security;
alter table public.event_settings enable row level security;
alter table public.event_members  enable row level security;
alter table public.node_updates   enable row level security;

-- Base privileges
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.profiles, public.organizations, public.org_members,
                public.nodes, public.event_settings, public.event_members, public.node_updates
  to authenticated;
grant update (full_name, avatar_url)                         on public.profiles       to authenticated;
grant update (name, kind)                                    on public.organizations  to authenticated;
grant insert (parent_id, type, title, description, assignee_id, priority, due_at, weight, position)
                                                             on public.nodes          to authenticated;
grant update (title, description, assignee_id, priority, due_at, weight, position)
                                                             on public.nodes          to authenticated;
grant delete                                                 on public.nodes          to authenticated;
grant update (review_mode, starts_at, ends_at, location)     on public.event_settings to authenticated;
grant insert (node_id, kind, body, link_url)                 on public.node_updates   to authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app_private.shares_org_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- organizations (INSERT/DELETE: none, use RPC create_organization)
create policy organizations_select on public.organizations for select to authenticated
  using (app_private.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (app_private.is_org_admin(id)) with check (app_private.is_org_admin(id));

-- org_members (writes: none, use RPCs)
create policy org_members_select on public.org_members for select to authenticated
  using (app_private.is_org_member(org_id));

-- nodes
create policy nodes_select on public.nodes for select to authenticated
  using (app_private.can_view_event(event_id));
create policy nodes_insert on public.nodes for insert to authenticated
  with check (type in ('segment','task') and parent_id is not null
              and created_by = (select auth.uid()) and app_private.is_manager_of(parent_id));
create policy nodes_update on public.nodes for update to authenticated
  using (case when type = 'event' then assignee_id = (select auth.uid())
              else app_private.is_strict_manager_of(id) end)
  with check (case when type = 'event' then assignee_id = (select auth.uid())
                   else app_private.is_strict_manager_of(id) end);
create policy nodes_delete on public.nodes for delete to authenticated
  using (case when type = 'event' then assignee_id = (select auth.uid())
              else app_private.is_strict_manager_of(id) end);

-- event_settings (INSERT/DELETE: none)
create policy event_settings_select on public.event_settings for select to authenticated
  using (app_private.can_view_event(event_id));
create policy event_settings_update on public.event_settings for update to authenticated
  using (app_private.is_event_owner(event_id)) with check (app_private.is_event_owner(event_id));

-- event_members (writes: trigger only)
create policy event_members_select on public.event_members for select to authenticated
  using (app_private.can_view_event(event_id));

-- node_updates (UPDATE/DELETE: none)
create policy node_updates_select on public.node_updates for select to authenticated
  using (app_private.can_view_event(event_id));
create policy node_updates_insert on public.node_updates for insert to authenticated
  with check (kind in ('comment','proof_link') and user_id = (select auth.uid())
              and exists (select 1 from public.nodes n
                           where n.id = node_id
                             and (n.assignee_id = (select auth.uid()) or app_private.is_manager_of(n.id))));
