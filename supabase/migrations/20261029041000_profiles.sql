-- 1.06: profiles table + handle_new_user trigger (docs/05_Schema.md section 3.1)
-- RLS and grants for this table are added in step 1.12.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (char_length(full_name) between 1 and 100),
  email      text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_key on public.profiles (lower(email));

-- Reusable "updated_at is maintained by triggers" helper (05_Schema section 8).
create function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app_private.touch_updated_at();

create function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
                   nullif(trim(new.raw_user_meta_data->>'name'), ''),
                   split_part(new.email,'@',1)),
          new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_private.handle_new_user();
