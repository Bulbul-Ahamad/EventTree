begin;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001','own@example.com','{"full_name":"Own"}'),('00000000-0000-0000-0000-000000000002','h1@example.com','{"full_name":"H1"}'),
  ('00000000-0000-0000-0000-000000000003','h2@example.com','{"full_name":"H2"}'),('00000000-0000-0000-0000-000000000004','ta@example.com','{"full_name":"TA"}'),
  ('00000000-0000-0000-0000-000000000005','tb@example.com','{"full_name":"TB"}'),('00000000-0000-0000-0000-000000000006','adm@example.com','{"full_name":"ADM"}'),
  ('00000000-0000-0000-0000-000000000007','out@example.com','{"full_name":"OUT"}'),('00000000-0000-0000-0000-000000000008','str@example.com','{"full_name":"STR"}'),
  ('00000000-0000-0000-0000-000000000009','x@example.com','{"full_name":"X"}');
insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000000001','Robotics Club','robotics-club','00000000-0000-0000-0000-000000000006'),('10000000-0000-0000-0000-000000000002','Other Club','other-club','00000000-0000-0000-0000-000000000009');
insert into public.org_members (org_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','admin'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','member'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','member'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','member'),
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','member'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005','member'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000007','member'),('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000009','admin');
insert into public.nodes (id, org_id, type, title, assignee_id, created_by) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','event','EV','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','event','EV2','00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('30000000-0000-0000-0000-000000000001','segment','20000000-0000-0000-0000-000000000001','REG','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000003','segment','20000000-0000-0000-0000-000000000001','VEN',null,'00000000-0000-0000-0000-000000000001');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('30000000-0000-0000-0000-000000000002','segment','30000000-0000-0000-0000-000000000001','PAY','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001'),('40000000-0000-0000-0000-000000000002','task','30000000-0000-0000-0000-000000000001','T_REG','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003','task','30000000-0000-0000-0000-000000000003','T_VEN',null,'00000000-0000-0000-0000-000000000001');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('40000000-0000-0000-0000-000000000001','task','30000000-0000-0000-0000-000000000002','T_PAY','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001');
insert into public.event_settings (event_id) values ('20000000-0000-0000-0000-000000000001');

reset role;
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('profiles','organizations','org_members','nodes','event_settings','event_members','node_updates') and c.relrowsecurity), 7::bigint, 'RLS is enabled on all 7 tables');
select is((select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'), 0::bigint, 'anon has no table privileges');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000007"}', true);
set local role authenticated;
select is((select count(*) from public.nodes), 0::bigint, 'unassigned member sees no nodes');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000008"}', true);
set local role authenticated;
select is((select count(*) from public.nodes), 0::bigint, 'non-member sees no nodes');
select is((select count(*) from public.profiles), 1::bigint, 'non-member sees only their own profile');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000009"}', true);
set local role authenticated;
select is((select count(*) from public.nodes where org_id = '10000000-0000-0000-0000-000000000001'), 0::bigint, 'org isolation: other org's nodes are invisible');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
select is((select count(*) from public.nodes where event_id = '20000000-0000-0000-0000-000000000001'), 7::bigint, 'task assignee sees the whole event tree');
select is((select count(*) from public.nodes where org_id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'task assignee cannot see another org's nodes');
select is((select count(*) from public.organizations), 1::bigint, 'member sees only their own organization');
select is((select count(*) from public.org_members), 7::bigint, 'member sees members of their org only');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000009'), 0::bigint, 'no profile access across orgs');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 1::bigint, 'profiles of org-mates are visible');
select throws_ok($$ update public.nodes set status = 'verified' where id = '40000000-0000-0000-0000-000000000001' $$, '42501', null, 'client cannot write status');
select throws_ok($$ update public.nodes set progress_cached = 100 where id = '40000000-0000-0000-0000-000000000001' $$, '42501', null, 'client cannot write progress_cached');
select throws_ok($$ insert into public.nodes (parent_id, type, title) values ('30000000-0000-0000-0000-000000000002', 'task', 'sneaky') $$, '42501', null, 'non-manager cannot add children');
select throws_ok($$ insert into public.organizations (name, slug, created_by) values ('Hack', 'hack-org', '00000000-0000-0000-0000-000000000004') $$, '42501', null, 'clients cannot insert organizations directly');
select lives_ok($$ insert into public.node_updates (node_id, kind, body) values ('40000000-0000-0000-0000-000000000001', 'comment', 'Started') $$, 'assignee can comment on their task');
select is((select count(*) from public.node_updates), 1::bigint, 'comment is visible to event viewers');
select throws_ok($$ delete from public.node_updates $$, '42501', null, 'node_updates cannot be deleted by clients');
update public.nodes set title = 'hijack' where id = '40000000-0000-0000-0000-000000000001';
reset role;
select is((select title from public.nodes where id = '40000000-0000-0000-0000-000000000001'), 'T_PAY', 'assignee is not a strict manager of their own task (no edit)');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005"}', true);
set local role authenticated;
select throws_ok($$ insert into public.node_updates (node_id, kind, body) values ('40000000-0000-0000-0000-000000000001', 'comment', 'not mine') $$, '42501', null, 'non-assignee non-manager cannot comment');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003"}', true);
set local role authenticated;
select lives_ok($$ insert into public.nodes (parent_id, type, title) values ('30000000-0000-0000-0000-000000000002', 'task', 'New task') $$, 'head can add a task in their segment');
select throws_ok($$ insert into public.nodes (parent_id, type, title, created_by) values ('30000000-0000-0000-0000-000000000002', 'task', 'forged', '00000000-0000-0000-0000-000000000001') $$, '42501', null, 'created_by cannot be forged');
select throws_ok($$ insert into public.nodes (parent_id, type, title, org_id) values ('30000000-0000-0000-0000-000000000002', 'task', 'forged', '10000000-0000-0000-0000-000000000002') $$, '42501', null, 'org_id cannot be forged');
update public.nodes set title = 'renamed' where id = '30000000-0000-0000-0000-000000000002';
update public.event_settings set review_mode = 'head_only' where event_id = '20000000-0000-0000-0000-000000000001';
reset role;
select is((select title from public.nodes where id = '30000000-0000-0000-0000-000000000002'), 'PAY', 'head cannot edit their own segment node');
select is((select review_mode::text from public.event_settings where event_id = '20000000-0000-0000-0000-000000000001'), 'assignee_submits', 'head cannot change event settings');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
select throws_ok($$ insert into public.nodes (parent_id, type, title) values ('30000000-0000-0000-0000-000000000003', 'task', 'outside') $$, '42501', null, 'head cannot add outside their segment');
update public.nodes set title = 'Payments' where id = '30000000-0000-0000-0000-000000000002';
delete from public.nodes where id = '40000000-0000-0000-0000-000000000002';
reset role;
select is((select title from public.nodes where id = '30000000-0000-0000-0000-000000000002'), 'Payments', 'parent head can edit a child segment');
select is((select count(*) from public.nodes where id = '40000000-0000-0000-0000-000000000002'), 0::bigint, 'parent head can delete a task below');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
update public.nodes set title = 'EV renamed' where id = '20000000-0000-0000-0000-000000000001';
update public.event_settings set review_mode = 'head_only' where event_id = '20000000-0000-0000-0000-000000000001';
reset role;
select is((select title from public.nodes where id = '20000000-0000-0000-0000-000000000001'), 'EV renamed', 'owner can edit the event');
select is((select review_mode::text from public.event_settings where event_id = '20000000-0000-0000-0000-000000000001'), 'head_only', 'owner can change event settings');
select * from finish();
rollback;