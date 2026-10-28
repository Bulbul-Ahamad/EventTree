-- 1.10: progress roll-up (BR-06), docs/05_Schema.md section 3.4 (nodes_06_rollup)

create function app_private.recompute_progress_upwards(p_node uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cur uuid := p_node; v numeric;
begin
  while cur is not null loop
    select coalesce(sum(progress_cached * weight) / nullif(sum(weight), 0), 0)
      into v from public.nodes where parent_id = cur;
    update public.nodes set progress_cached = round(v, 2)
     where id = cur and progress_cached is distinct from round(v, 2);
    select parent_id into cur from public.nodes where id = cur;   -- NULL when not found or root
  end loop;
end $$;

create function app_private.nodes_rollup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform app_private.recompute_progress_upwards(
    case when tg_op = 'DELETE' then old.parent_id else new.parent_id end);
  return coalesce(new, old);
end $$;

-- Updating progress_cached does not re-fire this trigger (it is UPDATE OF status, weight).
create trigger nodes_06_rollup
  after insert or delete or update of status, weight on public.nodes
  for each row execute function app_private.nodes_rollup();
