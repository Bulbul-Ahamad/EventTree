begin;
select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001','adm@example.com','{"full_name":"Adm"}'),('00000000-0000-0000-0000-000000000002','own@example.com','{"full_name":"Own"}'),
  ('00000000-0000-0000-0000-000000000003','ta@example.com','{"full_name":"TA"}'),('00000000-0000-0000-0000-000000000009','bown@example.com','{"full_name":"BOwn"}');
insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000000001','Org A','org-a','00000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002','Org B','org-b','00000000-0000-0000-0000-000000000009');
insert into public.org_members (org_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','admin'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','member'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','member'),('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000009','admin');
insert into public.nodes (id, org_id, type, title, assignee_id, created_by) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','event','EV A','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','event','EV B','00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('30000000-0000-0000-0000-000000000001','segment','20000000-0000-0000-0000-000000000001','Seg A',null,'00000000-0000-0000-0000-000000000002'),('30000000-0000-0000-0000-000000000002','segment','20000000-0000-0000-0000-000000000002','Seg B',null,'00000000-0000-0000-0000-000000000009');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('40000000-0000-0000-0000-000000000001','task','30000000-0000-0000-0000-000000000001','Task A','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002'),('40000000-0000-0000-0000-000000000002','task','30000000-0000-0000-0000-000000000002','Task B','00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009');
insert into public.event_settings (event_id, event_status) values ('20000000-0000-0000-0000-000000000001','active'),('20000000-0000-0000-0000-000000000002','active');
insert into public.node_updates (node_id, user_id, kind, body) values
  ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000009','comment','B only'),('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','comment','A only');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
update public.organizations set name = 'hacked' where id = '10000000-0000-0000-0000-000000000002';
update public.nodes set title = 'hacked' where id = '40000000-0000-0000-0000-000000000002';
delete from public.nodes where id = '40000000-0000-0000-0000-000000000002';
select throws_ok($$ insert into public.nodes (parent_id, type, title) values ('30000000-0000-0000-0000-000000000002', 'task', 'intruder') $$, '42501', null, 'org isolation: cannot insert into another org');
select throws_ok($$ insert into public.node_updates (node_id, kind, body) values ('40000000-0000-0000-0000-000000000002', 'comment', 'intruder') $$, '42501', null, 'org isolation: cannot comment in another org');
select is((select (select count(*) from public.event_settings where event_id = '20000000-0000-0000-0000-000000000002') + (select count(*) from public.event_members where event_id = '20000000-0000-0000-0000-000000000002') + (select count(*) from public.node_updates where event_id = '20000000-0000-0000-0000-000000000002')), 0::bigint, 'org isolation: other org settings, members and updates are invisible');
reset role;
select is((select name from public.organizations where id = '10000000-0000-0000-0000-000000000002'), 'Org B', 'org isolation: cannot update another org');
select is((select title from public.nodes where id = '40000000-0000-0000-0000-000000000002'), 'Task B', 'org isolation: cannot update another org node');
select is((select count(*) from public.nodes where id = '40000000-0000-0000-0000-000000000002'), 1::bigint, 'org isolation: cannot delete another org node');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
select is((select count(*) from public.nodes where event_id = '20000000-0000-0000-0000-000000000001'), 3::bigint, 'admin can read every node of an event they are not assigned to');
select throws_ok($$ insert into public.nodes (parent_id, type, title) values ('30000000-0000-0000-0000-000000000001', 'task', 'admin write') $$, '42501', null, 'admin cannot add nodes');
update public.nodes set title = 'admin edit' where id = '40000000-0000-0000-0000-000000000001';
update public.event_settings set location = 'admin edit' where event_id = '20000000-0000-0000-0000-000000000001';
select throws_ok($$ select public.transition_task_status('40000000-0000-0000-0000-000000000001', 'todo', 'in_progress') $$, 'P0001', 'E_INVALID_TRANSITION', 'admin cannot change task status');
reset role;
select is((select title from public.nodes where id = '40000000-0000-0000-0000-000000000001'), 'Task A', 'admin cannot edit nodes');
select is((select location is null from public.event_settings where event_id = '20000000-0000-0000-0000-000000000001'), true, 'admin cannot edit event settings');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003"}', true);
set local role authenticated;
select throws_ok($$ update public.nodes set verified_at = now() where id = '40000000-0000-0000-0000-000000000001' $$, '42501', null, 'client cannot write verified_at');
select throws_ok($$ update public.nodes set verified_by = '00000000-0000-0000-0000-000000000003' where id = '40000000-0000-0000-0000-000000000001' $$, '42501', null, 'client cannot write verified_by');
select throws_ok($$ update public.nodes set submitted_at = now() where id = '40000000-0000-0000-0000-000000000001' $$, '42501', null, 'client cannot write submitted_at');
select throws_ok($$ insert into public.nodes (parent_id, type, title, status) values ('30000000-0000-0000-0000-000000000001', 'task', 'x', 'verified') $$, '42501', null, 'client cannot insert a status');
select throws_ok($$ update public.node_updates set body = 'edited' where node_id = '40000000-0000-0000-0000-000000000001' $$, '42501', null, 'client cannot edit node_updates');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
reset role;
update public.event_settings set event_status = 'completed' where event_id = '20000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
select throws_ok($$ delete from public.nodes where id = '20000000-0000-0000-0000-000000000001' $$, 'P0001', 'E_EVENT_READONLY', 'completed event cannot be deleted');
reset role;
update public.event_settings set event_status = 'archived' where event_id = '20000000-0000-0000-0000-000000000001';
select throws_ok($$ insert into public.nodes (parent_id, type, title, created_by) values ('30000000-0000-0000-0000-000000000001', 'task', 'late', '00000000-0000-0000-0000-000000000002') $$, 'P0001', 'E_EVENT_READONLY', 'archived event rejects new nodes');
select * from finish();
rollback;