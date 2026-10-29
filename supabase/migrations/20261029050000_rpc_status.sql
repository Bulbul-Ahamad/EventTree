-- 1.15: transition_task_status (docs/05_Schema.md section 6.1, transitions T1-T7 in docs/02_AppFlow.md)

create or replace function public.transition_task_status(
  p_node uuid, p_from public.task_status, p_to public.task_status, p_comment text default null)
returns public.nodes language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  n public.nodes; s public.event_settings;
  is_assignee boolean; is_mgr boolean; is_owner boolean; can_verify boolean; ok boolean := false;
begin
  if uid is null then raise exception 'E_NOT_AUTHORIZED' using errcode='P0001'; end if;
  select * into n from public.nodes where id = p_node and type = 'task' for update;   -- row lock serializes concurrent changes
  if not found or not app_private.can_view_event(n.event_id) then
    raise exception 'E_NOT_FOUND' using errcode='P0001'; end if;
  select * into s from public.event_settings where event_id = n.event_id;
  if s.event_status <> 'active' then raise exception 'E_EVENT_NOT_ACTIVE' using errcode='P0001'; end if;
  if n.status is distinct from p_from then raise exception 'E_STALE_STATE' using errcode='P0001'; end if;

  is_assignee := n.assignee_id = uid;
  is_mgr      := app_private.is_strict_manager_of(n.id);
  is_owner    := app_private.is_event_owner(n.event_id);
  can_verify  := is_mgr and (n.assignee_id is distinct from uid or is_owner);

  ok := case
    when p_from='todo'        and p_to='in_progress' then is_assignee or is_mgr                         -- T1
    when p_from='in_progress' and p_to='todo'        then is_assignee or is_mgr                         -- T2
    when p_from='in_progress' and p_to='submitted'   then is_assignee and s.review_mode='assignee_submits' -- T3
    when p_from='submitted'   and p_to='verified'    then can_verify                                    -- T4
    when p_from='submitted'   and p_to='in_progress' then is_mgr                                        -- T5
    when p_from in ('todo','in_progress') and p_to='verified'
                                                      then can_verify and s.review_mode='head_only'     -- T6
    when p_from='verified'    and p_to='in_progress' then is_mgr                                        -- T7
    else false end;
  if not ok then raise exception 'E_INVALID_TRANSITION' using errcode='P0001'; end if;

  if ((p_from='submitted' and p_to='in_progress') or (p_from='verified' and p_to='in_progress'))
     and (p_comment is null or char_length(trim(p_comment)) = 0) then
    raise exception 'E_COMMENT_REQUIRED' using errcode='P0001'; end if;

  update public.nodes set
    status       = p_to,
    submitted_at = case when p_to='submitted' then now() else submitted_at end,
    verified_at  = case when p_to='verified'  then now() when p_from='verified' then null else verified_at end,
    verified_by  = case when p_to='verified'  then uid   when p_from='verified' then null else verified_by end
  where id = n.id returning * into n;                       -- fires progress triggers

  insert into public.node_updates (event_id, node_id, user_id, kind, body, from_status, to_status)
  values (n.event_id, n.id, uid, 'status_change', nullif(trim(p_comment),''), p_from, p_to);
  return n;
end $$;

revoke execute on function public.transition_task_status(uuid, public.task_status, public.task_status, text)
  from public, anon;
grant execute on function public.transition_task_status(uuid, public.task_status, public.task_status, text)
  to authenticated;
