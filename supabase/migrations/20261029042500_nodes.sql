-- 1.08 (plus the org guards of 1.07 that need nodes): nodes table, indexes,
-- triggers 01_prepare / 02_validate / 04_progress_leaf (docs/05_Schema.md section 3.4).
-- nodes_03_guard and nodes_05_event_members need event_settings / event_members (step 1.09).
-- RLS and grants are added in step 1.12.

create table public.nodes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete restrict,
  event_id        uuid not null references public.nodes (id) on delete cascade
                  deferrable initially deferred,
  parent_id       uuid references public.nodes (id) on delete cascade,
  type            public.node_type not null,
  title           text not null check (char_length(title) between 1 and 200),
  description     text check (char_length(description) <= 5000),
  assignee_id     uuid references public.profiles (id) on delete set null,
  status          public.task_status,
  priority        public.priority_level not null default 'medium',
  due_at          timestamptz,
  weight          smallint not null default 1 check (weight between 1 and 10),
  position        integer not null default 0,
  depth           smallint not null,
  path            extensions.ltree not null,
  progress_cached numeric(5,2) not null default 0 check (progress_cached between 0 and 100),
  submitted_at    timestamptz,
  verified_at     timestamptz,
  verified_by     uuid references public.profiles (id) on delete set null,
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint nodes_root_shape   check ((type = 'event') = (parent_id is null)),
  constraint nodes_status_shape check ((type = 'task')  = (status is not null)),
  constraint nodes_depth_range  check (depth between 0 and 6)
);

create index nodes_event_idx        on public.nodes (event_id);
create index nodes_parent_pos_idx   on public.nodes (parent_id, position, created_at);
create index nodes_path_gist_idx    on public.nodes using gist (path);
create index nodes_assignee_idx     on public.nodes (assignee_id) where assignee_id is not null;
create index nodes_my_tasks_idx     on public.nodes (assignee_id, status, due_at) where type = 'task';
create index nodes_org_events_idx   on public.nodes (org_id) where type = 'event';

-- nodes_01_prepare: fill derived columns, validate structure
create function app_private.nodes_prepare() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare p public.nodes;
begin
  if new.type = 'event' then
    if new.parent_id is not null then raise exception 'E_VALIDATION' using errcode='P0001'; end if;
    new.event_id := new.id;  new.depth := 0;
    new.path := text2ltree(replace(new.id::text,'-','_'));
    new.status := null;
  else
    select * into p from public.nodes where id = new.parent_id;
    if not found then raise exception 'E_NOT_FOUND' using errcode='P0001'; end if;
    if p.type = 'task' then raise exception 'E_PARENT_IS_TASK' using errcode='P0001'; end if;
    if p.depth + 1 > 6 then raise exception 'E_MAX_DEPTH' using errcode='P0001'; end if;
    if (select count(*) from public.nodes where event_id = p.event_id) >= 1000 then
      raise exception 'E_NODE_LIMIT' using errcode='P0001'; end if;
    new.org_id := p.org_id;  new.event_id := p.event_id;  new.depth := p.depth + 1;
    new.path := p.path || text2ltree(replace(new.id::text,'-','_'));
    new.status := case when new.type = 'task' then 'todo'::public.task_status else null end;
  end if;
  new.progress_cached := 0;
  return new;
end $$;

create trigger nodes_01_prepare
  before insert on public.nodes
  for each row execute function app_private.nodes_prepare();

-- nodes_02_validate: assignee in org, immutable structure, root assignee immutable, updated_at
create function app_private.nodes_validate() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'UPDATE' then
    if new.type       is distinct from old.type
    or new.parent_id  is distinct from old.parent_id
    or new.event_id   is distinct from old.event_id
    or new.org_id     is distinct from old.org_id
    or new.path       is distinct from old.path
    or new.depth      is distinct from old.depth
    or new.created_by is distinct from old.created_by then
      raise exception 'E_VALIDATION' using errcode='P0001';
    end if;
    if new.type = 'event' and new.assignee_id is distinct from old.assignee_id then
      raise exception 'E_ROOT_IMMUTABLE' using errcode='P0001';
    end if;
  end if;
  if new.assignee_id is not null and not exists (
       select 1 from public.org_members m
        where m.org_id = new.org_id and m.user_id = new.assignee_id) then
    raise exception 'E_ASSIGNEE_NOT_IN_ORG' using errcode='P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger nodes_02_validate
  before insert or update on public.nodes
  for each row execute function app_private.nodes_validate();

-- nodes_04_progress_leaf: a task is 0% until verified, then 100%
create function app_private.nodes_progress_leaf() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.type = 'task' then
    new.progress_cached := case when new.status = 'verified' then 100 else 0 end;
  end if;
  return new;
end $$;

create trigger nodes_04_progress_leaf
  before insert or update of status on public.nodes
  for each row execute function app_private.nodes_progress_leaf();

-- Org membership guards that depend on nodes (docs/05_Schema.md section 3.3)
create function app_private.org_members_owns_events() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.nodes n
              where n.org_id = old.org_id and n.type = 'event' and n.assignee_id = old.user_id) then
    raise exception 'E_OWNS_EVENTS' using errcode = 'P0001';
  end if;
  return old;
end $$;

create trigger org_members_02_owns_events
  before delete on public.org_members
  for each row execute function app_private.org_members_owns_events();

create function app_private.org_members_unassign() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.nodes set assignee_id = null
   where org_id = old.org_id and assignee_id = old.user_id;
  return old;
end $$;

create trigger org_members_03_unassign
  after delete on public.org_members
  for each row execute function app_private.org_members_unassign();
