-- 4.13 (US-18): phone number on profiles and the private `avatars` storage bucket.
-- docs/05_Schema.md sections 3.1, 5 and 7a.

-- Phone: nullable in the database (older rows have none; the app requires it), valid format when present.
-- Stored normalized by the app: digits with an optional leading +, 8 to 15 digits.
alter table public.profiles
  add column phone text
  constraint profiles_phone_check check (phone ~ '^\+?[0-9]{8,15}$');

-- The table-level SELECT grant already covers the new column; writes are column grants.
grant update (phone) on public.profiles to authenticated;

-- Signup passes the phone in the user metadata. Keep it only when it is valid, so a bad value
-- can never make signup fail (the app validates it first; the check constraint is the backstop).
create or replace function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_phone text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
                   nullif(trim(new.raw_user_meta_data->>'name'), ''),
                   split_part(new.email,'@',1)),
          new.email,
          case when v_phone ~ '^\+?[0-9]{8,15}$' then v_phone else null end);
  return new;
end $$;

-- Private bucket: 2 MB, JPEG/PNG/WebP only. No public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Any signed-in user can read pictures; each user can write only inside their own folder `{uid}/`.
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
