begin;
select plan(9);

select has_table('public', 'profiles', 'profiles table exists');
select has_trigger('auth', 'users', 'on_auth_user_created', 'signup trigger exists');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com', '{"full_name":"  Alice Rahman  "}'),
  ('00000000-0000-0000-0000-0000000000a2', 'bob@example.com',   '{"name":"Bob Khan"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'carol@example.com', '{}');

select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
          'Alice Rahman', 'full_name from metadata, trimmed');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
          'Bob Khan', 'falls back to metadata name');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
          'carol', 'falls back to email prefix');

select throws_ok(
  $$ update public.profiles set email = 'ALICE@example.com' where id = '00000000-0000-0000-0000-0000000000a2' $$,
  '23505', null, 'email is unique case-insensitively');

select throws_ok(
  $$ update public.profiles set full_name = '' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null, 'empty full_name rejected');

alter table public.profiles disable trigger profiles_set_updated_at;
update public.profiles set updated_at = '2000-01-01' where id = '00000000-0000-0000-0000-0000000000a1';
alter table public.profiles enable trigger profiles_set_updated_at;
update public.profiles set full_name = 'Alice R' where id = '00000000-0000-0000-0000-0000000000a1';
select ok((select updated_at > '2000-01-01' from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
          'updated_at maintained by trigger');

delete from auth.users where id = '00000000-0000-0000-0000-0000000000a3';
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
          0::bigint, 'profile deleted with auth user (cascade)');

select * from finish();
rollback;
