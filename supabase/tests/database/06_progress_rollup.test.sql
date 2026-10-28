begin;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a1', 'a@example.com', '{"full_name":"A"}');
insert into public.organizations (id, name, slug, created_by) values ('10000000-0000-0000-0000-000000000001', 'Robotics Club', 'robotics-club', '00000000-0000-0000-0000-0000000000a1');
insert into public.org_members (org_id, user_id, role) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'admin');

-- Oracle: recompute expected progress from scratch, level by level, rounding like the trigger.
create function pg_temp.expected_progress(p_id uuid) returns numeric
language plpgsql as $f$
declare n public.nodes; v numeric;
begin
  select * into n from public.nodes where id = p_id;
  if n.type = 'task' then
    return case when n.status = 'verified' then 100 else 0 end;
  end if;
  select coalesce(sum(pg_temp.expected_progress(c.id) * c.weight) / nullif(sum(c.weight), 0), 0)
    into v from public.nodes c where c.parent_id = p_id;
  return round(v, 2);
end $f$;

-- Tree:  EV
--          S1 (w2): a (w1), b (w3)
--          S2 (w1): empty
--          S3 (w1): c (w1), S3a (w2): d (w1)
insert into public.nodes (id, org_id, type, title, assignee_id, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'event', 'EV', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1');
insert into public.nodes (id, type, parent_id, title, weight, created_by) values
  ('30000000-0000-0000-0000-000000000001', 'segment', '20000000-0000-0000-0000-000000000001', 'S1', 2, '00000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-000000000002', 'segment', '20000000-0000-0000-0000-000000000001', 'S2', 1, '00000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-000000000003', 'segment', '20000000-0000-0000-0000-000000000001', 'S3', 1, '00000000-0000-0000-0000-0000000000a1');
insert into public.nodes (id, type, parent_id, title, weight, created_by) values
  ('30000000-0000-0000-0000-0000000000a1', 'segment', '30000000-0000-0000-0000-000000000003', 'S3a', 2, '00000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-00000000000a', 'task', '30000000-0000-0000-0000-000000000001', 'a', 1, '00000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-00000000000b', 'task', '30000000-0000-0000-0000-000000000001', 'b', 3, '00000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-00000000000c', 'task', '30000000-0000-0000-0000-000000000003', 'c', 1, '00000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-00000000000d', 'task', '30000000-0000-0000-0000-0000000000a1', 'd', 1, '00000000-0000-0000-0000-0000000000a1');

select has_function('app_private', 'recompute_progress_upwards', array['uuid'], 'roll-up function exists');
select is((select count(*) from public.nodes where progress_cached is distinct from pg_temp.expected_progress(id)),
          0::bigint, 'parity after inserts (empty segment S2 is 0)');

update public.nodes set status = 'verified' where id = '40000000-0000-0000-0000-00000000000a';
select is((select progress_cached from public.nodes where title = 'S1'), 25.00::numeric, 'S1 = 1/4 after verifying a');
select is((select count(*) from public.nodes where progress_cached is distinct from pg_temp.expected_progress(id)),
          0::bigint, 'parity after verifying a');

update public.nodes set status = 'verified' where id = '40000000-0000-0000-0000-00000000000b';
select is((select progress_cached from public.nodes where title = 'S1'), 100.00::numeric, 'S1 = 100 after verifying b');
select is((select progress_cached from public.nodes where title = 'EV'), 50.00::numeric, 'event rolls up weighted by segment weight');
select is((select count(*) from public.nodes where progress_cached is distinct from pg_temp.expected_progress(id)),
          0::bigint, 'parity after verifying b');

update public.nodes set status = 'todo' where id = '40000000-0000-0000-0000-00000000000b';
update public.nodes set weight = 3 where id = '40000000-0000-0000-0000-00000000000a';
select is((select progress_cached from public.nodes where title = 'S1'), 50.00::numeric, 'weight change re-weights the segment');
select is((select count(*) from public.nodes where progress_cached is distinct from pg_temp.expected_progress(id)),
          0::bigint, 'parity after weight change');

insert into public.nodes (id, type, parent_id, title, created_by)
values ('40000000-0000-0000-0000-00000000000e', 'task', '30000000-0000-0000-0000-000000000002', 'e', '00000000-0000-0000-0000-0000000000a1');
update public.nodes set status = 'verified' where id = '40000000-0000-0000-0000-00000000000e';
select is((select progress_cached from public.nodes where title = 'S2'), 100.00::numeric, 'formerly empty segment now 100');
select is((select progress_cached from public.nodes where title = 'EV'), 50.00::numeric, 'event after S2 completes');
select is((select count(*) from public.nodes where progress_cached is distinct from pg_temp.expected_progress(id)),
          0::bigint, 'parity after inserting into empty segment');

delete from public.nodes where id = '40000000-0000-0000-0000-00000000000e';
select is((select progress_cached from public.nodes where title = 'S2'), 0.00::numeric, 'segment back to 0 when its last task is deleted');
select is((select progress_cached from public.nodes where title = 'EV'), 25.00::numeric, 'event after deleting e');
select is((select count(*) from public.nodes where progress_cached is distinct from pg_temp.expected_progress(id)),
          0::bigint, 'parity after delete');

delete from public.nodes where id = '30000000-0000-0000-0000-000000000003';
select is((select progress_cached from public.nodes where title = 'EV'), 33.33::numeric, 'event after deleting a whole subtree');
select is((select count(*) from public.nodes where progress_cached is distinct from pg_temp.expected_progress(id)),
          0::bigint, 'parity after subtree delete');

update public.nodes set status = 'submitted' where id = '40000000-0000-0000-0000-00000000000a';
select is((select progress_cached from public.nodes where title = 'S1'), 0.00::numeric, 'submitted does not count until verified');
select is((select count(*) from public.nodes where progress_cached is distinct from pg_temp.expected_progress(id)),
          0::bigint, 'parity after status goes back from verified');

select * from finish();
rollback;
