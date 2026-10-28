begin;
select plan(18);

-- Users: A (admin, owns event), B/C (members), D (not in org), E (second admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@example.com', '{"full_name":"C"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@example.com', '{"full_name":"D"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'e@example.com', '{"full_name":"E"}');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Robotics Club', 'robotics-club', '00000000-0000-0000-0000-0000000000a1');

insert into public.org_members (org_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'member');

-- Three events: EV (main tests), EV2 (node limit), EV3 (depth)
insert into public.nodes (id, org_id, type, title, assignee_id, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'event', 'Tech Fest', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'event', 'Limit Fest', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'event', 'Depth Fest', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1');

insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('30000000-0000-0000-0000-000000000001', 'segment', '20000000-0000-0000-0000-000000000001', 'Registration', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-000000000002', 'segment', '20000000-0000-0000-0000-000000000001', 'Venue',        null, '00000000-0000-0000-0000-0000000000a1');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('40000000-0000-0000-0000-000000000001', 'task', '30000000-0000-0000-0000-000000000001', 'Form', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');

select has_table('public', 'nodes', 'nodes table exists');

select ok((select event_id = id and depth = 0 and status is null and progress_cached = 0
                  and path = text2ltree(replace(id::text,'-','_'))
             from public.nodes where id = '20000000-0000-0000-0000-000000000001'),
          'event root: event_id, depth, path, status derived');
select ok((select s.depth = 1 and s.org_id = e.org_id and s.event_id = e.id and s.path <@ e.path and s.status is null
             from public.nodes s, public.nodes e
            where s.id = '30000000-0000-0000-0000-000000000001' and e.id = '20000000-0000-0000-0000-000000000001'),
          'segment inherits org/event and extends the path');
select ok((select depth = 2 and status = 'todo' and progress_cached = 0
             from public.nodes where id = '40000000-0000-0000-0000-000000000001'),
          'task starts as todo at depth 2');

select throws_ok(
  $$ insert into public.nodes (type, parent_id, title, created_by) values ('task', '40000000-0000-0000-0000-000000000001', 'x', '00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'E_PARENT_IS_TASK', 'a task cannot have children');
select throws_ok(
  $$ insert into public.nodes (type, title, created_by) values ('segment', 'orphan', '00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'E_NOT_FOUND', 'non-event node needs an existing parent');
select throws_ok(
  $$ insert into public.nodes (org_id, type, parent_id, title, created_by) values ('10000000-0000-0000-0000-000000000001', 'event', '20000000-0000-0000-0000-000000000001', 'x', '00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'E_VALIDATION', 'an event cannot have a parent');

create temp table deepest (id uuid);
do $$
declare p uuid := '20000000-0000-0000-0000-000000000003'; n uuid; i int;
begin
  for i in 1..6 loop
    n := gen_random_uuid();
    insert into public.nodes (id, type, parent_id, title, created_by)
    values (n, 'segment', p, 'level ' || i, '00000000-0000-0000-0000-0000000000a1');
    p := n;
  end loop;
  insert into deepest values (p);
end $$;
select throws_ok(
  $$ insert into public.nodes (type, parent_id, title, created_by) select 'task', id, 'too deep', '00000000-0000-0000-0000-0000000000a1' from deepest $$,
  'P0001', 'E_MAX_DEPTH', 'depth above 6 rejected');

insert into public.nodes (type, parent_id, title, created_by)
select 'task', '20000000-0000-0000-0000-000000000002', 't' || g, '00000000-0000-0000-0000-0000000000a1'
  from generate_series(1, 999) g;
select throws_ok(
  $$ insert into public.nodes (type, parent_id, title, created_by) values ('task', '20000000-0000-0000-0000-000000000002', 'one too many', '00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'E_NODE_LIMIT', 'more than 1000 nodes per event rejected');

select throws_ok(
  $$ insert into public.nodes (type, parent_id, title, assignee_id, created_by) values ('task', '30000000-0000-0000-0000-000000000002', 'x', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'E_ASSIGNEE_NOT_IN_ORG', 'assignee must belong to the org');
select throws_ok(
  $$ update public.nodes set assignee_id = '00000000-0000-0000-0000-0000000000b1' where id = '20000000-0000-0000-0000-000000000001' $$,
  'P0001', 'E_ROOT_IMMUTABLE', 'event owner cannot be changed');
select throws_ok(
  $$ update public.nodes set parent_id = '30000000-0000-0000-0000-000000000002' where id = '40000000-0000-0000-0000-000000000001' $$,
  'P0001', 'E_VALIDATION', 'a node cannot be moved');

select throws_ok(
  $$ update public.nodes set status = null where id = '40000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a task must have a status');
select throws_ok(
  $$ update public.nodes set status = 'todo' where id = '30000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a segment must not have a status');

update public.nodes set status = 'verified' where id = '40000000-0000-0000-0000-000000000001';
select is((select progress_cached from public.nodes where id = '40000000-0000-0000-0000-000000000001'),
          100.00::numeric, 'verified task is 100%');
update public.nodes set status = 'todo' where id = '40000000-0000-0000-0000-000000000001';
select is((select progress_cached from public.nodes where id = '40000000-0000-0000-0000-000000000001'),
          0.00::numeric, 'task back to todo is 0%');

-- Org membership guards that depend on nodes
select throws_ok(
  $$ delete from public.org_members where org_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'P0001', 'E_OWNS_EVENTS', 'cannot remove a member who owns an event');

delete from public.org_members
 where org_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000c1';
select is((select assignee_id from public.nodes where id = '40000000-0000-0000-0000-000000000001'),
          null::uuid, 'removing a member unassigns their nodes');

select * from finish();
rollback;
