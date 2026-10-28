-- 1.07 (part 1): organizations, org_members, join code, last-admin guard
-- (docs/05_Schema.md sections 3.2, 3.3). The owns-events and unassign-on-removal
-- guards need the nodes table and ship in 20261029042500_nodes.sql (decision logged in 06_Plan.md).
-- RLS and grants are added in step 1.12.

create function app_private.generate_join_code() returns text
language sql volatile set search_path = extensions as
$$ select upper(substr(encode(gen_random_bytes(9),'hex'),1,12)) $$;

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 100),
  slug       text not null unique
             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48),
  kind       public.org_kind not null default 'club',
  join_code  text not null unique default app_private.generate_join_code(),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id    uuid not null references public.organizations (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.org_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_idx on public.org_members (user_id);

-- An org must always keep at least one admin.
create function app_private.org_members_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role is distinct from 'admin')
     and not exists (select 1 from public.org_members m
                      where m.org_id = old.org_id and m.role = 'admin' and m.user_id <> old.user_id)
  then
    raise exception 'E_LAST_ADMIN' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

create trigger org_members_01_last_admin_update
  before update of role on public.org_members
  for each row execute function app_private.org_members_last_admin();

create trigger org_members_01_last_admin_delete
  before delete on public.org_members
  for each row execute function app_private.org_members_last_admin();
