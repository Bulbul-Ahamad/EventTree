-- 1.09: event_settings, event_members, node_updates, and the nodes triggers that need them
-- (docs/05_Schema.md sections 3.4 to 3.7). RLS and grants are added in step 1.12.

create table public.event_settings (
  event_id     uuid primary key references public.nodes (id) on delete cascade,
  review_mode  public.review_mode not null default 'assignee_submits',
  event_status public.event_status not null default 'draft',
  starts_at    timestamptz,
  ends_at      timestamptz,
  location     text check (char_length(location) <= 200),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index event_settings_status_idx on public.event_settings (event_status);

create trigger event_settings_set_updated_at
  before update on public.event_settings
  for each row execute function app_private.touch_updated_at();

create table public.event_members (
  event_id uuid not null references public.nodes (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_members_user_idx on public.event_members (user_id);

create table public.node_updates (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.nodes (id) on delete cascade,
  node_id     uuid not null references public.nodes (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id),
  kind        public.update_kind not null,
  body        text check (char_length(body) <= 2000),
  link_url    text check (link_url ~* '^https?://' and char_length(link_url) <= 2000),
  from_status public.task_status,
  to_status   public.task_status,
  created_at  timestamptz not null default now(),
  check ( (kind = 'comment' and body is not null and char_length(trim(body)) > 0)
       or (kind = 'proof_link' and link_url is not null)
       or (kind = 'status_change' and from_status is not null and to_status is not null) )
);

create index node_updates_node_idx  on public.node_updates (node_id, created_at desc);
create index node_updates_event_idx on public.node_updates (event_id, created_at desc);

-- BEFORE INSERT: event_id comes from the node; client inserts (a JWT is present) cannot forge user_id.
create function app_private.node_updates_prepare() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select n.event_id into new.event_id from public.nodes n where n.id = new.node_id;
  if not found then raise exception 'E_NOT_FOUND' using errcode = 'P0001'; end if;
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  return new;
end $$;

create trigger node_updates_01_prepare
  before insert on public.node_updates
  for each row execute function app_private.node_updates_prepare();

-- Append-only: nobody (not even owners) may edit a row.
create function app_private.node_updates_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'E_NOT_AUTHORIZED' using errcode = 'P0001';
end $$;

create trigger node_updates_02_immutable
  before update on public.node_updates
  for each row execute function app_private.node_updates_immutable();

-- nodes_03_guard: event lifecycle write protection
create function app_private.nodes_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_status public.event_status; v_event uuid; v_type public.node_type;
begin
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;   -- skip FK-cascade / nested writes
  v_event := coalesce(new.event_id, old.event_id);
  v_type  := coalesce(new.type, old.type);
  select event_status into v_status from public.event_settings where event_id = v_event;
  if not found then return coalesce(new, old); end if;                  -- root insert inside create_event
  if tg_op = 'DELETE' and v_type = 'event' then
    if v_status not in ('draft','archived') then raise exception 'E_EVENT_READONLY' using errcode='P0001'; end if;
  elsif v_status not in ('draft','active') then
    raise exception 'E_EVENT_READONLY' using errcode='P0001';
  end if;
  return coalesce(new, old);
end $$;

create trigger nodes_03_guard
  before insert or update of title, description, assignee_id, priority, due_at, weight, position
         or delete on public.nodes
  for each row execute function app_private.nodes_guard();

-- nodes_05_event_members: keep the visibility list in sync with assignments
create function app_private.sync_event_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null then
    insert into public.event_members (event_id, user_id) values (new.event_id, new.assignee_id)
    on conflict do nothing;
  end if;
  if tg_op = 'UPDATE' and old.assignee_id is not null and old.assignee_id is distinct from new.assignee_id then
    delete from public.event_members em
     where em.event_id = old.event_id and em.user_id = old.assignee_id
       and not exists (select 1 from public.nodes n
                       where n.event_id = old.event_id and n.assignee_id = old.assignee_id);
  end if;
  return new;
end $$;

create trigger nodes_05_event_members
  after insert or update of assignee_id on public.nodes
  for each row execute function app_private.sync_event_members();
