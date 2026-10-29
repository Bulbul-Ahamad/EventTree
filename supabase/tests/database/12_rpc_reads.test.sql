begin;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001','own@example.com','{"full_name":"Olive Owner"}'),('00000000-0000-0000-0000-000000000002','head@example.com','{"full_name":"Hana Head"}'),
  ('00000000-0000-0000-0000-000000000003','ta@example.com','{"full_name":"Tariq Assignee"}'),('00000000-0000-0000-0000-000000000004','out@example.com','{"full_name":"Out"}'),
  ('00000000-0000-0000-0000-000000000005','r@example.com','{"full_name":"Remote"}');
insert into public.organizations (id, name, slug, created_by) values ('10000000-0000-0000-0000-000000000001','Robotics Club','robotics-club','00000000-0000-0000-0000-000000000001');
insert into public.org_members (org_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','admin'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','member'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','member'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','member');
insert into public.nodes (id, org_id, type, title, assignee_id, created_by) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','event','Tech Fest','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','event','Old Fest','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
insert into public.nodes (id, type, parent_id, title, assignee_id, position, created_by) values
  ('30000000-0000-0000-0000-000000000001','segment','20000000-0000-0000-0000-000000000001','S1','00000000-0000-0000-0000-000000000002',1,'00000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000002','segment','20000000-0000-0000-0000-000000000001','S2',null,0,'00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000009','segment','20000000-0000-0000-0000-000000000002','OldSeg',null,0,'00000000-0000-0000-0000-000000000001');
insert into public.nodes (id, type, parent_id, title, assignee_id, due_at, created_by) values
  ('40000000-0000-0000-0000-00000000000b','task','30000000-0000-0000-0000-000000000001','T_B', '00000000-0000-0000-0000-000000000003', now() - interval '1 day',  '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-00000000000e','task','30000000-0000-0000-0000-000000000001','T_E', '00000000-0000-0000-0000-000000000003', now() - interval '1 day',  '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-00000000000a','task','30000000-0000-0000-0000-000000000001','T_A', '00000000-0000-0000-0000-000000000003', now() + interval '1 day',  '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-00000000000d','task','30000000-0000-0000-0000-000000000001','T_D', '00000000-0000-0000-0000-000000000003', now() + interval '3 days', '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-00000000000c','task','30000000-0000-0000-0000-000000000001','T_C', '00000000-0000-0000-0000-000000000003', null,                      '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000051','task','30000000-0000-0000-0000-000000000001','T_S1','00000000-0000-0000-0000-000000000003', null,                      '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000052','task','30000000-0000-0000-0000-000000000002','T_S2','00000000-0000-0000-0000-000000000003', null,                      '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000053','task','30000000-0000-0000-0000-000000000009','T_OLD','00000000-0000-0000-0000-000000000003', null, '00000000-0000-0000-0000-000000000001');
update public.nodes set status = 'verified' where title = 'T_E';
update public.nodes set status = 'submitted', submitted_at = now() - interval '3 hours' where title = 'T_S1';
update public.nodes set status = 'submitted', submitted_at = now() - interval '1 hour'  where title = 'T_S2';
update public.nodes set status = 'submitted', submitted_at = now() - interval '2 hours' where title = 'T_OLD';
insert into public.event_settings (event_id, event_status) values ('20000000-0000-0000-0000-000000000001','active'), ('20000000-0000-0000-0000-000000000002','completed');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
select is((select count(*) from public.get_event_tree('20000000-0000-0000-0000-000000000001')), 10::bigint, 'owner gets every node of the event');
select is((select string_agg(title, ',') from (select title from public.get_event_tree('20000000-0000-0000-0000-000000000001') offset 0) s limit 1), 'Tech Fest,S2,S1,T_B,T_E,T_A,T_D,T_C,T_S1,T_S2', 'ordered by depth, then position (S2 before S1), then created_at');
select is((select assignee_name from public.get_event_tree('20000000-0000-0000-0000-000000000001') where title = 'S1'), 'Hana Head', 'assignee name is joined in');
select is((select assignee_name is null from public.get_event_tree('20000000-0000-0000-0000-000000000001') where title = 'S2'), true, 'unassigned node has no name');
select is((select count(*) from public.get_event_tree('20000000-0000-0000-0000-000000000001') where title = 'T_OLD'), 0::bigint, 'other events are not mixed in');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003"}', true);
set local role authenticated;
select is((select count(*) from public.get_event_tree('20000000-0000-0000-0000-000000000001')), 10::bigint, 'task assignee sees the whole tree');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
select is((select count(*) from public.get_event_tree('20000000-0000-0000-0000-000000000001')), 0::bigint, 'unassigned member gets nothing');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005"}', true);
set local role authenticated;
select is((select count(*) from public.get_event_tree('20000000-0000-0000-0000-000000000001')), 0::bigint, 'non-member gets nothing');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003"}', true);
set local role authenticated;
select is((select string_agg(title, ',') from (select title from public.get_my_tasks() limit 4) s), 'T_B,T_E,T_A,T_D', 'my tasks: overdue first, then by due date');
select is((select count(*) from public.get_my_tasks()), 7::bigint, 'my tasks: 7 tasks, the completed event is excluded');
select is((select (event_title || '/' || org_slug || '/' || event_status::text) from public.get_my_tasks() where title = 'T_A'), 'Tech Fest/robotics-club/active', 'my tasks: event and org fields');
select is((select title from public.get_my_tasks() where title = 'T_E' and due_at < now() and status = 'verified'), 'T_E', 'a verified overdue task is listed after real overdue ones');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
select is((select count(*) from public.get_my_tasks()), 0::bigint, 'no tasks for someone with none');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
select is((select string_agg(title, ',') from public.get_review_queue()), 'T_S1', 'head sees submitted tasks in their segment only');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
select is((select string_agg(title, ',') from (select title from public.get_review_queue() offset 0) s), 'T_S1,T_S2', 'owner sees all submitted, oldest first; completed event excluded');
select is((select assignee_name from public.get_review_queue() where title = 'T_S1'), 'Tariq Assignee', 'queue shows the assignee');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003"}', true);
set local role authenticated;
select is((select count(*) from public.get_review_queue()), 0::bigint, 'a task assignee has an empty review queue');
reset role; select set_config('request.jwt.claims', '', true); set local role authenticated;
select is((select count(*) from public.get_my_tasks()), 0::bigint, 'unauthenticated: my tasks is empty');
reset role;
select is((select count(*) from pg_proc p where p.proname in ('get_event_tree','get_my_tasks','get_review_queue') and p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')), 0::bigint, 'anon cannot execute the read RPCs');
select * from finish();
rollback;