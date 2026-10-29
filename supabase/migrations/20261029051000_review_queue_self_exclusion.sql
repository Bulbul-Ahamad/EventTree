-- 1.16 follow-up (approved by Bulbul, logged in 06_Plan.md Decisions): a user who is the assignee of a
-- submitted task does not see it in their own review queue, unless they are the event owner
-- (matches the self-verify rule in transition_task_status).

create or replace function public.get_review_queue()
returns table (node_id uuid, title text, assignee_name text, submitted_at timestamptz,
               event_id uuid, event_title text, org_slug text)
language sql stable security invoker set search_path = public as $$
  select n.id, n.title, p.full_name, n.submitted_at, n.event_id, e.title, o.slug
    from public.nodes n
    join public.nodes e on e.id = n.event_id
    join public.event_settings s on s.event_id = n.event_id
    join public.organizations o on o.id = n.org_id
    left join public.profiles p on p.id = n.assignee_id
   where n.type = 'task' and n.status = 'submitted'
     and app_private.is_strict_manager_of(n.id)
     and (n.assignee_id is distinct from (select auth.uid()) or app_private.is_event_owner(n.event_id))
     and s.event_status = 'active'
   order by n.submitted_at asc $$;
