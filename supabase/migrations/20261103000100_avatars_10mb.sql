-- 4.15: profile pictures may be up to 10 MB (phone photos are larger than the 2 MB first chosen).
-- Decision approved by Bulbul on 2026-11-03, logged in docs/06_Plan.md. The bucket limit is the
-- backstop; the app checks the same number before uploading. Still below the global 50 MiB limit.
update storage.buckets set file_size_limit = 10485760 where id = 'avatars';
