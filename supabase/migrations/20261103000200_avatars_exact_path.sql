-- 4.16: two findings of the adversarial run against the storage API (docs/05_Schema.md §7a).
--
-- 1. The bucket policies let a user write ANY object name inside their own folder, so one user
--    could store many files. Only the one picture object `{uid}/avatar` may be written now.
-- 2. `profiles.avatar_url` was free text, so a user could point it at somebody else's picture
--    (`{other_uid}/avatar`) and show it as their own. It must now name the user's own object.

alter table public.profiles
  add constraint profiles_avatar_url_check
  check (avatar_url is null or avatar_url ~ ('^' || id::text || '/avatar(\?v=[0-9]+)?$'));

drop policy avatars_insert on storage.objects;
drop policy avatars_update on storage.objects;
drop policy avatars_delete on storage.objects;

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
