-- 1.16: read RPCs (docs/05_Schema.md section 6). All SECURITY INVOKER: RLS decides what is visible.

create function public.get_event_tree(p_event uuid)
returns table (id uuid, parent_id uuid, type public.node_type, title text, description text,
               assignee_id uuid, assignee_name text, assignee_avatar text, status public.task_status,
               priority public.priority_level, due_at timestamptz, weight smallint, "position" int,
               depth smallint, progress numeric, submitted_at timestamptz, verified_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select n.id, n.parent_id, n.type, n.title, n.description,
         n.assignee_id, p.full_name, p.avatar_url, n.status,
         n.priority, n.due_at, n.weight, n.position,
         n.depth, n.progress_cached, n.submitted_at, n.verified_at
    from public.nodes n
    left join public.profiles p on p.id = n.assignee_id
   where n.event_id = p_event
   order by n.depth, n.position, n.created_at $$;

create function public.get_my_tasks()
returns table (node_id uuid, title text, status public.task_status, priority public.priority_level,
               due_at timestamptz, event_id uuid, event_title text, event_status public.event_status,
               org_slug text)
language sql stable security invoker set search_path = public as $$
  select n.id, n.title, n.status, n.priority, n.due_at, n.event_id, e.title, s.event_status, o.slug
    from public.nodes n
    join public.nodes e on e.id = n.event_id
    join public.event_settings s on s.event_id = n.event_id
    join public.organizations o on o.id = n.org_id
   where n.type = 'task' and n.assignee_id = (select auth.uid())
     and s.event_status in ('draft', 'active')
   order by (n.due_at is not null and n.due_at < now() and n.status <> 'verified') desc,
            n.due_at asc nulls last $$;

create function public.get_review_queue()
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
     and s.event_status = 'active'
   order by n.submitted_at asc $$;

revoke execute on function public.get_event_tree(uuid), public.get_my_tasks(), public.get_review_queue()
  from public, anon;
grant execute on function public.get_event_tree(uuid), public.get_my_tasks(), public.get_review_queue()
  to authenticated;
