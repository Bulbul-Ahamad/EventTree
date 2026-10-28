begin;
select plan(23);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com', '{"full_name":"B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@example.com', '{"full_name":"C"}');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Robotics Club', 'robotics-club', '00000000-0000-0000-0000-0000000000a1');
insert into public.org_members (org_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'member');

-- EV (main), EVD (draft, to delete), EVA (archived, to delete)
insert into public.nodes (id, org_id, type, title, assignee_id, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'event', 'Main',     '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'event', 'Draft',    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'event', 'Archived', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1');

select has_table('public', 'event_settings', 'event_settings exists');
select has_table('public', 'event_members', 'event_members exists');
select has_table('public', 'node_updates', 'node_updates exists');

insert into public.event_settings (event_id) values ('20000000-0000-0000-0000-000000000001');
select ok((select review_mode = 'assignee_submits' and event_status = 'draft'
             from public.event_settings where event_id = '20000000-0000-0000-0000-000000000001'),
          'event_settings defaults');
select throws_ok(
  $$ update public.event_settings set starts_at = '2026-11-15', ends_at = '2026-11-14' where event_id = '20000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'ends_at before starts_at rejected');
select throws_ok(
  $$ update public.event_settings set location = repeat('x', 201) where event_id = '20000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'location longer than 200 rejected');

-- event_members sync
select ok(exists (select 1 from public.event_members where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000a1'),
          'event owner is a visibility member');

insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('40000000-0000-0000-0000-000000000001', 'task', '20000000-0000-0000-0000-000000000001', 'T1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1');
select ok(exists (select 1 from public.event_members where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000b1'),
          'assigning a node adds the assignee');
update public.nodes set assignee_id = '00000000-0000-0000-0000-0000000000c1' where id = '40000000-0000-0000-0000-000000000001';
select ok(not exists (select 1 from public.event_members where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000b1'),
          'reassigning removes a member with no other node');

insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('40000000-0000-0000-0000-000000000002', 'task', '20000000-0000-0000-0000-000000000001', 'T2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-000000000003', 'task', '20000000-0000-0000-0000-000000000001', 'T3', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1');
update public.nodes set assignee_id = '00000000-0000-0000-0000-0000000000c1' where id = '40000000-0000-0000-0000-000000000002';
select ok(exists (select 1 from public.event_members where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000b1'),
          'member stays while they still hold another node');

-- lifecycle read-only
update public.event_settings set event_status = 'completed' where event_id = '20000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ insert into public.nodes (type, parent_id, title, created_by) values ('segment', '20000000-0000-0000-0000-000000000001', 'x', '00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'E_EVENT_READONLY', 'completed event: cannot add nodes');
select throws_ok(
  $$ update public.nodes set title = 'renamed' where id = '40000000-0000-0000-0000-000000000001' $$,
  'P0001', 'E_EVENT_READONLY', 'completed event: cannot edit nodes');
select throws_ok(
  $$ delete from public.nodes where id = '40000000-0000-0000-0000-000000000001' $$,
  'P0001', 'E_EVENT_READONLY', 'completed event: cannot delete nodes');

update public.event_settings set event_status = 'active' where event_id = '20000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ insert into public.nodes (type, parent_id, title, created_by) values ('segment', '20000000-0000-0000-0000-000000000001', 'ok', '00000000-0000-0000-0000-0000000000a1') $$,
  'active event: can add nodes');
select throws_ok(
  $$ delete from public.nodes where id = '20000000-0000-0000-0000-000000000001' $$,
  'P0001', 'E_EVENT_READONLY', 'active event cannot be deleted');

-- cascade is not blocked by the guard
insert into public.event_settings (event_id, event_status) values
  ('20000000-0000-0000-0000-000000000002', 'draft'),
  ('20000000-0000-0000-0000-000000000003', 'archived');
insert into public.nodes (type, parent_id, title, created_by) values
  ('task', '20000000-0000-0000-0000-000000000002', 'd1', '00000000-0000-0000-0000-0000000000a1'),
  ('task', '20000000-0000-0000-0000-000000000003', 'a1', '00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ delete from public.nodes where id = '20000000-0000-0000-0000-000000000002' $$,
  'draft event can be deleted with its children');
select lives_ok(
  $$ delete from public.nodes where id = '20000000-0000-0000-0000-000000000003' $$,
  'archived event can be deleted with its children');

-- node_updates
select throws_ok(
  $$ insert into public.node_updates (node_id, user_id, kind, body) values ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'comment', '   ') $$,
  '23514', null, 'blank comment rejected');
select throws_ok(
  $$ insert into public.node_updates (node_id, user_id, kind) values ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'proof_link') $$,
  '23514', null, 'proof_link needs a link');
select throws_ok(
  $$ insert into public.node_updates (node_id, user_id, kind, link_url) values ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'proof_link', 'javascript:alert(1)') $$,
  '23514', null, 'link must be http(s)');

insert into public.node_updates (id, node_id, user_id, kind, body)
values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'comment', 'Started');
select is((select event_id from public.node_updates where id = '50000000-0000-0000-0000-000000000001'),
          '20000000-0000-0000-0000-000000000001'::uuid, 'event_id is taken from the node');
select throws_ok(
  $$ update public.node_updates set body = 'edited' where id = '50000000-0000-0000-0000-000000000001' $$,
  'P0001', 'E_NOT_AUTHORIZED', 'updates are immutable');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
insert into public.node_updates (id, node_id, user_id, kind, body)
values ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'comment', 'forged');
select is((select user_id from public.node_updates where id = '50000000-0000-0000-0000-000000000002'),
          '00000000-0000-0000-0000-0000000000c1'::uuid, 'client inserts cannot forge user_id');

select * from finish();
rollback;
