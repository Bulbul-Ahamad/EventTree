begin;
select plan(31);

-- People: OWN event owner, H1 head of Registration, H2 head of Payments (inside Registration),
-- TA task assignee in Payments, TB task assignee in Registration, ADM org admin (no assignment),
-- OUT org member with no assignment, STR not in the org.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'own@example.com', '{"full_name":"Own"}'),
  ('00000000-0000-0000-0000-000000000002', 'h1@example.com',  '{"full_name":"H1"}'),
  ('00000000-0000-0000-0000-000000000003', 'h2@example.com',  '{"full_name":"H2"}'),
  ('00000000-0000-0000-0000-000000000004', 'ta@example.com',  '{"full_name":"TA"}'),
  ('00000000-0000-0000-0000-000000000005', 'tb@example.com',  '{"full_name":"TB"}'),
  ('00000000-0000-0000-0000-000000000006', 'adm@example.com', '{"full_name":"ADM"}'),
  ('00000000-0000-0000-0000-000000000007', 'out@example.com', '{"full_name":"OUT"}'),
  ('00000000-0000-0000-0000-000000000008', 'str@example.com', '{"full_name":"STR"}');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Robotics Club', 'robotics-club', '00000000-0000-0000-0000-000000000006');
insert into public.org_members (org_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'member');

-- EV -> REG (H1) -> PAY (H2) -> T_PAY (TA);  REG -> T_REG (TB);  EV -> VEN (nobody) -> T_VEN (nobody)
insert into public.nodes (id, org_id, type, title, assignee_id, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'event', 'EV', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('30000000-0000-0000-0000-000000000001', 'segment', '20000000-0000-0000-0000-000000000001', 'REG', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003', 'segment', '20000000-0000-0000-0000-000000000001', 'VEN', null,      '00000000-0000-0000-0000-000000000001');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('30000000-0000-0000-0000-000000000002', 'segment', '30000000-0000-0000-0000-000000000001', 'PAY', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'task',    '30000000-0000-0000-0000-000000000001', 'T_REG', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003', 'task',    '30000000-0000-0000-0000-000000000003', 'T_VEN', null,      '00000000-0000-0000-0000-000000000001');
insert into public.nodes (id, type, parent_id, title, assignee_id, created_by) values
  ('40000000-0000-0000-0000-000000000001', 'task',    '30000000-0000-0000-0000-000000000002', 'T_PAY', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001');

create function pg_temp.as_user(p uuid) returns void language sql as
$f$ select set_config('request.jwt.claims', json_build_object('sub', p)::text, true) $f$;

-- is_org_member / is_org_admin / shares_org_with
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select is(app_private.is_org_member('10000000-0000-0000-0000-000000000001'), true,  'member is an org member');
select pg_temp.as_user('00000000-0000-0000-0000-000000000008');
select is(app_private.is_org_member('10000000-0000-0000-0000-000000000001'), false, 'outsider is not an org member');

select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select is(app_private.is_org_admin('10000000-0000-0000-0000-000000000001'), true,  'admin is org admin');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select is(app_private.is_org_admin('10000000-0000-0000-0000-000000000001'), false, 'plain member is not org admin');
select pg_temp.as_user('00000000-0000-0000-0000-000000000008');
select is(app_private.is_org_admin('10000000-0000-0000-0000-000000000001'), false, 'outsider is not org admin');

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select is(app_private.shares_org_with('00000000-0000-0000-0000-000000000002'), true,  'members of the same org share an org');
select is(app_private.shares_org_with('00000000-0000-0000-0000-000000000008'), false, 'no shared org with an outsider');
select pg_temp.as_user('00000000-0000-0000-0000-000000000008');
select is(app_private.shares_org_with('00000000-0000-0000-0000-000000000001'), false, 'outsider shares no org with anyone');

-- can_view_event (BR-03)
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select is(app_private.can_view_event('20000000-0000-0000-0000-000000000001'), true, 'owner can view');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select is(app_private.can_view_event('20000000-0000-0000-0000-000000000001'), true, 'head can view');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select is(app_private.can_view_event('20000000-0000-0000-0000-000000000001'), true, 'nested head can view');
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select is(app_private.can_view_event('20000000-0000-0000-0000-000000000001'), true, 'task assignee can view the whole event');
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select is(app_private.can_view_event('20000000-0000-0000-0000-000000000001'), true, 'org admin can view');
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select is(app_private.can_view_event('20000000-0000-0000-0000-000000000001'), false, 'unassigned org member cannot view');

-- is_manager_of
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select is(app_private.is_manager_of('40000000-0000-0000-0000-000000000001'), false, 'task assignee is not a manager of their task');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select is(app_private.is_manager_of('40000000-0000-0000-0000-000000000001'), true,  'direct head manages the task');
select is(app_private.is_manager_of('30000000-0000-0000-0000-000000000002'), true,  'head manages their own segment');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select is(app_private.is_manager_of('40000000-0000-0000-0000-000000000001'), true,  'ancestor head manages a nested task');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select is(app_private.is_manager_of('40000000-0000-0000-0000-000000000001'), true,  'owner manages every node');
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select is(app_private.is_manager_of('40000000-0000-0000-0000-000000000001'), false, 'sibling task assignee is not a manager');
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select is(app_private.is_manager_of('40000000-0000-0000-0000-000000000001'), false, 'unassigned member is not a manager');

-- is_strict_manager_of
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select is(app_private.is_strict_manager_of('30000000-0000-0000-0000-000000000002'), false, 'head is not a strict manager of their own segment');
select is(app_private.is_strict_manager_of('40000000-0000-0000-0000-000000000001'), true,  'head is a strict manager of a task below');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select is(app_private.is_strict_manager_of('30000000-0000-0000-0000-000000000002'), true,  'parent head is a strict manager of the child segment');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select is(app_private.is_strict_manager_of('30000000-0000-0000-0000-000000000002'), true,  'owner is a strict manager of any segment');
select is(app_private.is_strict_manager_of('20000000-0000-0000-0000-000000000001'), false, 'owner is not a strict manager of the event itself');

-- is_event_owner
select is(app_private.is_event_owner('20000000-0000-0000-0000-000000000001'), true,  'owner is event owner');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select is(app_private.is_event_owner('20000000-0000-0000-0000-000000000001'), false, 'head is not event owner');
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select is(app_private.is_event_owner('20000000-0000-0000-0000-000000000001'), false, 'admin is not event owner');

-- grants
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app_private'
              and p.proname in ('is_org_member','is_org_admin','shares_org_with','can_view_event','is_manager_of','is_strict_manager_of','is_event_owner')
              and has_function_privilege('authenticated', p.oid, 'execute')),
          7::bigint, 'authenticated can execute all helpers');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app_private'
              and p.proname in ('is_org_member','is_org_admin','shares_org_with','can_view_event','is_manager_of','is_strict_manager_of','is_event_owner')
              and has_function_privilege('anon', p.oid, 'execute')),
          0::bigint, 'anon cannot execute any helper');

select * from finish();
rollback;
