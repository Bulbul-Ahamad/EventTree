begin;
select plan(17);

-- Three users: alice and bob share an organization, carol is in another one.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'alice-p@example.com', '{"full_name":"Alice","phone":"+8801712345678"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob-p@example.com',   '{"full_name":"Bob","phone":"01812345678"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'carol-p@example.com', '{"full_name":"Carol","phone":"not a phone"}'),
  ('00000000-0000-0000-0000-0000000000b4', 'dave-p@example.com',  '{"full_name":"Dave"}');

insert into public.organizations (id, name, slug, created_by) values
  ('00000000-0000-0000-0000-0000000000c1', 'Org One', 'org-one-p', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c2', 'Org Two', 'org-two-p', '00000000-0000-0000-0000-0000000000b3');
insert into public.org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'admin'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'member'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b3', 'admin');

-- phone column and constraint
select has_column('public', 'profiles', 'phone', 'profiles.phone exists');
select is((select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
          '+8801712345678', 'signup trigger keeps a valid phone from the metadata');
select is((select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b3'),
          null, 'signup trigger drops an invalid phone instead of failing');
select is((select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b4'),
          null, 'no phone in the metadata gives a null phone');
select throws_ok(
  $$ update public.profiles set phone = '12345' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'too short phone rejected');
select throws_ok(
  $$ update public.profiles set phone = '+88017abc45678' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'phone with letters rejected');
select throws_ok(
  $$ update public.profiles set phone = '+1234567890123456' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'phone longer than 15 digits rejected');

-- visibility and writes (alice, organization one)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
set local role authenticated;

select is((select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'),
          '01812345678', 'a member of the same organization can read the phone');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000b3'),
          0::bigint, 'a user of another organization is not visible, phone included');
select lives_ok(
  $$ update public.profiles set phone = '01912345678' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'a user can change their own phone');
select is(
  (with u as (update public.profiles set phone = '01999999999'
               where id = '00000000-0000-0000-0000-0000000000b2' returning 1) select count(*) from u),
  0::bigint, 'a user cannot change someone else''s phone');

-- avatars bucket policies
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000b1/avatar') $$,
  'a user can write inside their own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000b2/avatar') $$,
  '42501', null, 'a user cannot write inside another user''s folder');

reset role;
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000b2/avatar');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'avatars' and name like '%b2/avatar'),
          1::bigint, 'signed-in users can read other users'' pictures');
select is(
  (with u as (update storage.objects set name = name || 'x'
               where bucket_id = 'avatars' and name like '%b2/avatar' returning 1) select count(*) from u),
  0::bigint, 'a user cannot overwrite another user''s picture');

reset role;
set local role anon;
select is((select count(*) from storage.objects where bucket_id = 'avatars'),
          0::bigint, 'anon sees no pictures');
reset role;

-- bucket settings
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars' $$,
  $$ values (false, 2097152::bigint, array['image/jpeg','image/png','image/webp']) $$,
  'avatars bucket is private, 2 MB, jpeg/png/webp only');

select * from finish();
rollback;
