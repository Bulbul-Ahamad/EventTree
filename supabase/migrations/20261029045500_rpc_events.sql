-- 1.14: event and node RPCs (docs/05_Schema.md section 6; lifecycle per docs/02_AppFlow.md section 6)

create function public.create_event(
  p_org uuid, p_title text, p_description text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_location text, p_review_mode public.review_mode)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); v_id uuid := gen_random_uuid(); v_title text := trim(p_title);
begin
  if uid is null or not app_private.is_org_member(p_org) then
    raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if v_title is null or char_length(v_title) not between 1 and 200
     or char_length(p_description) > 5000 or char_length(p_location) > 200
     or (p_starts_at is not null and p_ends_at is not null and p_ends_at < p_starts_at) then
    raise exception 'E_VALIDATION' using errcode = 'P0001'; end if;

  insert into public.nodes (id, org_id, type, title, description, assignee_id, created_by)
  values (v_id, p_org, 'event', v_title, p_description, uid, uid);
  insert into public.event_settings (event_id, review_mode, starts_at, ends_at, location)
  values (v_id, coalesce(p_review_mode, 'assignee_submits'), p_starts_at, p_ends_at, p_location);
  insert into public.event_members (event_id, user_id) values (v_id, uid) on conflict do nothing;
  return v_id;
end $$;

-- SECURITY INVOKER: the RLS insert policy and the triggers enforce everything.
create function public.create_node(
  p_parent uuid, p_type public.node_type, p_title text, p_description text, p_assignee uuid,
  p_due_at timestamptz, p_priority public.priority_level, p_weight smallint)
returns public.nodes
language plpgsql security invoker set search_path = public, extensions as $$
declare n public.nodes;
begin
  if auth.uid() is null then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if p_type is null or p_type not in ('segment', 'task') then
    raise exception 'E_VALIDATION' using errcode = 'P0001'; end if;
  begin
    insert into public.nodes (parent_id, type, title, description, assignee_id, due_at, priority, weight)
    values (p_parent, p_type, trim(p_title), p_description, p_assignee, p_due_at,
            coalesce(p_priority, 'medium'), coalesce(p_weight, 1))
    returning * into n;
  exception
    when insufficient_privilege then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001';
    when check_violation or string_data_right_truncation then
      raise exception 'E_VALIDATION' using errcode = 'P0001';
  end;
  return n;
end $$;

create function public.set_event_status(p_event uuid, p_to public.event_status)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); v_from public.event_status;
begin
  if uid is null then raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  select event_status into v_from from public.event_settings where event_id = p_event for update;
  if not found then raise exception 'E_NOT_FOUND' using errcode = 'P0001'; end if;
  if not app_private.is_event_owner(p_event) then
    raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  if not ((v_from = 'draft'     and p_to = 'active')
       or (v_from = 'active'    and p_to = 'completed')
       or (v_from = 'completed' and p_to in ('active', 'archived'))
       or (v_from = 'archived'  and p_to = 'completed')) then
    raise exception 'E_INVALID_TRANSITION' using errcode = 'P0001'; end if;

  update public.event_settings
     set event_status = p_to,
         completed_at = case when p_to = 'completed' then now()
                             when v_from = 'completed' and p_to = 'active' then null
                             else completed_at end
   where event_id = p_event;
end $$;

revoke execute on function
  public.create_event(uuid, text, text, timestamptz, timestamptz, text, public.review_mode),
  public.create_node(uuid, public.node_type, text, text, uuid, timestamptz, public.priority_level, smallint),
  public.set_event_status(uuid, public.event_status)
  from public, anon;
grant execute on function
  public.create_event(uuid, text, text, timestamptz, timestamptz, text, public.review_mode),
  public.create_node(uuid, public.node_type, text, text, uuid, timestamptz, public.priority_level, smallint),
  public.set_event_status(uuid, public.event_status)
  to authenticated;
