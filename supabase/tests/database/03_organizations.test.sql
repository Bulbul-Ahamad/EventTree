begin;
select plan(10);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'org_members', 'org_members table exists');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com', '{"full_name":"Admin A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com', '{"full_name":"Member B"}');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Robotics Club', 'robotics-club', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000002', 'Debate Club',   'debate-club',   '00000000-0000-0000-0000-0000000000a1');

insert into public.org_members (org_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'member');

select matches((select join_code from public.organizations where slug = 'robotics-club'),
               '^[0-9A-F]{12}$', 'join_code is 12 uppercase hex chars');
select isnt((select join_code from public.organizations where slug = 'robotics-club'),
            (select join_code from public.organizations where slug = 'debate-club'),
            'join codes differ between orgs');

select throws_ok(
  $$ insert into public.organizations (name, slug, created_by) values ('Bad Slug Org', 'Bad Slug', '00000000-0000-0000-0000-0000000000a1') $$,
  '23514', null, 'invalid slug rejected');
select throws_ok(
  $$ insert into public.organizations (name, slug, created_by) values ('X', 'valid-slug', '00000000-0000-0000-0000-0000000000a1') $$,
  '23514', null, 'name shorter than 2 chars rejected');
select throws_ok(
  $$ insert into public.organizations (name, slug, created_by) values ('Another', 'robotics-club', '00000000-0000-0000-0000-0000000000a1') $$,
  '23505', null, 'duplicate slug rejected');

select throws_ok(
  $$ update public.org_members set role = 'member' where org_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'P0001', 'E_LAST_ADMIN', 'cannot demote the last admin');
select throws_ok(
  $$ delete from public.org_members where org_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'P0001', 'E_LAST_ADMIN', 'cannot remove the last admin');

select lives_ok(
  $$ update public.org_members set role = 'admin' where org_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000b1';
     update public.org_members set role = 'member' where org_id = '10000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'demoting an admin is fine when another admin exists');

select * from finish();
rollback;
