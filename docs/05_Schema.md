# 05 — Database Schema, RLS & Auth Flow

> Target: PostgreSQL 15+ on Supabase. All objects in schema `public` unless noted. Helper functions live in schema `app_private` (not exposed through the API).
> SQL below is the **reference implementation**. The agent must write migrations that implement exactly these semantics and prove them with pgTAP tests (see `06_Plan.md`, Phase 1).
> Error convention: `raise exception 'E_CODE' using errcode = 'P0001';` (codes listed in `02_AppFlow.md §7`).

---

## 1. Entity Overview

```
auth.users 1──1 profiles
organizations 1──* org_members *──1 profiles
organizations 1──* nodes                      (nodes.org_id)
nodes (type='event') 1──1 event_settings
nodes (type='event') 1──* event_members *──1 profiles   (visibility list)
nodes 1──* nodes                              (parent_id; tree via adjacency list + ltree path)
nodes 1──* node_updates *──1 profiles         (append-only activity log)
```

Node type shape:
- `event`: `parent_id IS NULL`, `depth = 0`, `status IS NULL`, `assignee_id` = Owner.
- `segment`: parent is event/segment, `status IS NULL`, `assignee_id` = Head.
- `task`: parent is event/segment, `status IS NOT NULL`, no children.

## 2. Setup, Extensions, Enums

```sql
create extension if not exists ltree with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create type public.org_kind       as enum ('club','organization','university_program','other');
create type public.org_role       as enum ('admin','member');
create type public.node_type      as enum ('event','segment','task');
create type public.task_status    as enum ('todo','in_progress','submitted','verified');
create type public.priority_level as enum ('low','medium','high','urgent');
create type public.review_mode    as enum ('assignee_submits','head_only');
create type public.event_status   as enum ('draft','active','completed','archived');
create type public.update_kind    as enum ('comment','proof_link','status_change');
```

Functions that touch `ltree` use `set search_path = public, extensions`. Policies call `(select auth.uid())` wrapped form for planner caching.

## 3. Tables

### 3.1 `profiles`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | **PK**, FK → `auth.users(id)` ON DELETE CASCADE |
| `full_name` | text | NOT NULL, CHECK `char_length BETWEEN 1 AND 100` |
| `email` | text | NOT NULL |
| `avatar_url` | text | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

Indexes: `UNIQUE (lower(email))`.

```sql
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
```

### 3.2 `organizations`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | **PK** DEFAULT gen_random_uuid() |
| `name` | text | NOT NULL, CHECK length 2–100 |
| `slug` | text | NOT NULL **UNIQUE**, CHECK `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` AND length 3–48 |
| `kind` | org_kind | NOT NULL DEFAULT 'club' |
| `join_code` | text | NOT NULL **UNIQUE** DEFAULT `app_private.generate_join_code()` |
| `created_by` | uuid | NOT NULL FK → profiles(id) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

```sql
create function app_private.generate_join_code() returns text
language sql volatile set search_path = extensions as
$$ select upper(substr(encode(gen_random_bytes(9),'hex'),1,12)) $$;
```

### 3.3 `org_members`
| Column | Type | Constraints |
|---|---|---|
| `org_id` | uuid | FK → organizations(id) ON DELETE CASCADE |
| `user_id` | uuid | FK → profiles(id) ON DELETE CASCADE |
| `role` | org_role | NOT NULL DEFAULT 'member' |
| `joined_at` | timestamptz | NOT NULL DEFAULT now() |
| | | **PK (org_id, user_id)** |

Indexes: `(user_id)`.
Triggers: `BEFORE UPDATE OF role / BEFORE DELETE` → `E_LAST_ADMIN` if it would leave the org with 0 admins. `BEFORE DELETE` → `E_OWNS_EVENTS` if the user is assignee of any `event` node in that org. `AFTER DELETE` → set `assignee_id = NULL` on all nodes of that org assigned to the user (event_members cleanup via the nodes trigger).

### 3.4 `nodes` (the tree)
| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | **PK** DEFAULT gen_random_uuid() |
| `org_id` | uuid | NOT NULL FK → organizations(id) ON DELETE RESTRICT. Set by trigger from parent. |
| `event_id` | uuid | NOT NULL FK → nodes(id) ON DELETE CASCADE **DEFERRABLE INITIALLY DEFERRED**. Root: = own id. Set by trigger. |
| `parent_id` | uuid | NULL FK → nodes(id) ON DELETE CASCADE |
| `type` | node_type | NOT NULL |
| `title` | text | NOT NULL, CHECK length 1–200 |
| `description` | text | NULL, CHECK length ≤ 5000 |
| `assignee_id` | uuid | NULL FK → profiles(id) ON DELETE SET NULL (root: effectively NOT NULL by trigger) |
| `status` | task_status | NULL for event/segment; NOT NULL for task (default 'todo' set by trigger) |
| `priority` | priority_level | NOT NULL DEFAULT 'medium' |
| `due_at` | timestamptz | NULL |
| `weight` | smallint | NOT NULL DEFAULT 1, CHECK 1–10 |
| `position` | integer | NOT NULL DEFAULT 0 (sibling order; ties by created_at) |
| `depth` | smallint | NOT NULL, CHECK 0–6. Set by trigger. |
| `path` | extensions.ltree | NOT NULL. Labels = node id with `-` → `_`. Set by trigger. |
| `progress_cached` | numeric(5,2) | NOT NULL DEFAULT 0, CHECK 0–100. Maintained by triggers only. |
| `submitted_at` | timestamptz | NULL |
| `verified_at` | timestamptz | NULL |
| `verified_by` | uuid | NULL FK → profiles(id) ON DELETE SET NULL |
| `created_by` | uuid | NOT NULL DEFAULT auth.uid() FK → profiles(id) |
| `created_at` / `updated_at` | timestamptz | NOT NULL DEFAULT now() |

Table CHECKs:
```sql
constraint nodes_root_shape   check ((type = 'event') = (parent_id is null)),
constraint nodes_status_shape check ((type = 'task')  = (status is not null)),
constraint nodes_depth_range  check (depth between 0 and 6)
```

Indexes:
```sql
create index nodes_event_idx        on public.nodes (event_id);
create index nodes_parent_pos_idx   on public.nodes (parent_id, position, created_at);
create index nodes_path_gist_idx    on public.nodes using gist (path);
create index nodes_assignee_idx     on public.nodes (assignee_id) where assignee_id is not null;
create index nodes_my_tasks_idx     on public.nodes (assignee_id, status, due_at) where type = 'task';
create index nodes_org_events_idx   on public.nodes (org_id) where type = 'event';
```

#### Trigger pipeline on `nodes` (fire alphabetically — names are prefixed to guarantee order)

**`nodes_01_prepare` BEFORE INSERT** — fills derived columns, validates structure:
```sql
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
```

**`nodes_02_validate` BEFORE INSERT OR UPDATE** — assignee must belong to the node's org (`E_ASSIGNEE_NOT_IN_ORG`); on UPDATE forbid changes to `type, parent_id, event_id, org_id, path, depth, created_by` (`E_VALIDATION`); forbid changing the assignee of an `event` node (`E_ROOT_IMMUTABLE`); set `updated_at = now()`.

**`nodes_03_guard` BEFORE INSERT OR UPDATE OF title, description, assignee_id, priority, due_at, weight, position OR DELETE** — event lifecycle write protection:
```sql
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
```

**`nodes_04_progress_leaf` BEFORE INSERT OR UPDATE OF status** — `if new.type='task' then new.progress_cached := case when new.status='verified' then 100 else 0 end;`

**`nodes_05_event_members` AFTER INSERT OR UPDATE OF assignee_id** — maintain visibility list:
```sql
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
```

**`nodes_06_rollup` AFTER INSERT OR DELETE OR UPDATE OF status, weight** — progress propagation (BR-06):
```sql
create function app_private.recompute_progress_upwards(p_node uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cur uuid := p_node; v numeric;
begin
  while cur is not null loop
    select coalesce(sum(progress_cached * weight) / nullif(sum(weight), 0), 0)
      into v from public.nodes where parent_id = cur;
    update public.nodes set progress_cached = round(v, 2)
     where id = cur and progress_cached is distinct from round(v, 2);
    select parent_id into cur from public.nodes where id = cur;   -- NULL when not found or root
  end loop;
end $$;

create function app_private.nodes_rollup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform app_private.recompute_progress_upwards(
    case when tg_op = 'DELETE' then old.parent_id else new.parent_id end);
  return coalesce(new, old);
end $$;
```
Updating `progress_cached` does not re-fire the trigger (trigger is `UPDATE OF status, weight`). Segment with no children → progress 0.

### 3.5 `event_settings`
| Column | Type | Constraints |
|---|---|---|
| `event_id` | uuid | **PK**, FK → nodes(id) ON DELETE CASCADE |
| `review_mode` | review_mode | NOT NULL DEFAULT 'assignee_submits' |
| `event_status` | event_status | NOT NULL DEFAULT 'draft' |
| `starts_at` | timestamptz | NULL |
| `ends_at` | timestamptz | NULL, CHECK `ends_at is null or starts_at is null or ends_at >= starts_at` |
| `location` | text | NULL, length ≤ 200 |
| `completed_at` | timestamptz | NULL |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

Index: `(event_status)`.

### 3.6 `event_members` (visibility list, trigger-maintained)
| Column | Type | Constraints |
|---|---|---|
| `event_id` | uuid | FK → nodes(id) ON DELETE CASCADE |
| `user_id` | uuid | FK → profiles(id) ON DELETE CASCADE |
| `added_at` | timestamptz | NOT NULL DEFAULT now() |
| | | **PK (event_id, user_id)** |

Index: `(user_id)`.

### 3.7 `node_updates` (append-only activity log)
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | **PK** DEFAULT gen_random_uuid() |
| `event_id` | uuid | NOT NULL FK → nodes(id) ON DELETE CASCADE (set by trigger from node) |
| `node_id` | uuid | NOT NULL FK → nodes(id) ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL DEFAULT auth.uid() FK → profiles(id) |
| `kind` | update_kind | NOT NULL |
| `body` | text | NULL, CHECK length ≤ 2000 |
| `link_url` | text | NULL, CHECK `link_url ~* '^https?://'` AND length ≤ 2000 |
| `from_status` / `to_status` | task_status | NULL (used by `status_change`) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

Row-shape CHECK:
```sql
check ( (kind='comment' and body is not null and char_length(trim(body)) > 0)
     or (kind='proof_link' and link_url is not null)
     or (kind='status_change' and from_status is not null and to_status is not null) )
```
Indexes: `(node_id, created_at desc)`, `(event_id, created_at desc)`.
Immutability: no UPDATE/DELETE policies; `REVOKE UPDATE, DELETE ON node_updates FROM authenticated`; a `BEFORE UPDATE` trigger raising `E_NOT_AUTHORIZED` guards even owners. `BEFORE INSERT` trigger sets `event_id` from the node and (for client inserts) forces `user_id = auth.uid()`.

## 4. Helper Functions (for RLS)

All `STABLE SECURITY DEFINER SET search_path = public, extensions`; `GRANT EXECUTE … TO authenticated`.

```sql
-- org helpers (avoid RLS recursion)
create function app_private.is_org_member(p_org uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.org_members where org_id = p_org and user_id = (select auth.uid())) $$;

create function app_private.is_org_admin(p_org uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.org_members
                 where org_id = p_org and user_id = (select auth.uid()) and role = 'admin') $$;

create function app_private.shares_org_with(p_user uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.org_members a join public.org_members b on a.org_id = b.org_id
                 where a.user_id = (select auth.uid()) and b.user_id = p_user) $$;

-- BR-03 visibility
create function app_private.can_view_event(p_event uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.event_members em
                 where em.event_id = p_event and em.user_id = (select auth.uid()))
      or exists (select 1 from public.nodes n join public.org_members om on om.org_id = n.org_id
                 where n.id = p_event and n.type = 'event'
                   and om.user_id = (select auth.uid()) and om.role = 'admin') $$;

-- Manager of node: assignee of the node itself (if event/segment) or any ancestor event/segment
create function app_private.is_manager_of(p_node uuid) returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.nodes t join public.nodes a on a.path @> t.path
                 where t.id = p_node and a.type in ('event','segment')
                   and a.assignee_id = (select auth.uid())) $$;

-- Strict manager: assignee of any proper ancestor
create function app_private.is_strict_manager_of(p_node uuid) returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.nodes t join public.nodes a on a.path @> t.path and a.id <> t.id
                 where t.id = p_node and a.type in ('event','segment')
                   and a.assignee_id = (select auth.uid())) $$;

create function app_private.is_event_owner(p_event uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.nodes where id = p_event and type = 'event'
                 and assignee_id = (select auth.uid())) $$;
```

## 5. Row-Level Security

`ALTER TABLE … ENABLE ROW LEVEL SECURITY` (and `FORCE` is **not** used) on: `profiles, organizations, org_members, nodes, event_settings, event_members, node_updates`.

Base privileges:
```sql
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.profiles, public.organizations, public.org_members,
                public.nodes, public.event_settings, public.event_members, public.node_updates
  to authenticated;
grant update (full_name, avatar_url)                         on public.profiles       to authenticated;
grant update (name, kind)                                    on public.organizations  to authenticated;
grant insert (parent_id, type, title, description, assignee_id, priority, due_at, weight, position)
                                                             on public.nodes          to authenticated;
grant update (title, description, assignee_id, priority, due_at, weight, position)
                                                             on public.nodes          to authenticated;
grant delete                                                 on public.nodes          to authenticated;
grant update (review_mode, starts_at, ends_at, location)     on public.event_settings to authenticated;
grant insert (node_id, kind, body, link_url)                 on public.node_updates   to authenticated;
```
`status`, `progress_cached`, `submitted_at`, `verified_*` are therefore **not writable by clients**; they change only via `SECURITY DEFINER` RPCs/triggers.

### Policies

| Table | Op | Policy (USING / WITH CHECK) |
|---|---|---|
| `profiles` | SELECT | `id = auth.uid() OR app_private.shares_org_with(id)` |
| | UPDATE | `id = auth.uid()` (both) |
| `organizations` | SELECT | `app_private.is_org_member(id)` |
| | UPDATE | `app_private.is_org_admin(id)` (both) |
| | INSERT/DELETE | none (use RPC `create_organization`; org delete not supported in MVP) |
| `org_members` | SELECT | `app_private.is_org_member(org_id)` |
| | INSERT/UPDATE/DELETE | none (use RPCs) |
| `nodes` | SELECT | `app_private.can_view_event(event_id)` |
| | INSERT | `type in ('segment','task') AND parent_id IS NOT NULL AND created_by = auth.uid() AND app_private.is_manager_of(parent_id)` |
| | UPDATE | USING & CHECK: `CASE WHEN type='event' THEN assignee_id = auth.uid() ELSE app_private.is_strict_manager_of(id) END` |
| | DELETE | same predicate as UPDATE |
| `event_settings` | SELECT | `app_private.can_view_event(event_id)` |
| | UPDATE | `app_private.is_event_owner(event_id)` (both) |
| | INSERT/DELETE | none (RPC / cascade) |
| `event_members` | SELECT | `app_private.can_view_event(event_id)` |
| | writes | none (trigger only) |
| `node_updates` | SELECT | `app_private.can_view_event(event_id)` |
| | INSERT | `kind in ('comment','proof_link') AND user_id = auth.uid() AND EXISTS (SELECT 1 FROM nodes n WHERE n.id = node_id AND (n.assignee_id = auth.uid() OR app_private.is_manager_of(n.id)))` |
| | UPDATE/DELETE | none |

Notes: a node's own assignee who is a Head of a segment is a *manager* of that segment (can add children, comment) but not a *strict* manager of it (cannot edit/reassign/delete their own segment node — their parent's manager does).

## 6. RPC Functions (public API surface)

All `SECURITY DEFINER` (unless noted), `set search_path = public, extensions`, begin with `if auth.uid() is null then raise exception 'E_NOT_AUTHORIZED'`. `REVOKE EXECUTE … FROM public, anon; GRANT EXECUTE … TO authenticated;`

| Function | Signature | Behavior |
|---|---|---|
| `create_organization` | `(p_name text, p_slug text, p_kind org_kind) returns organizations` | Validates; `E_SLUG_TAKEN` on unique violation; inserts org with `created_by = auth.uid()` and inserts creator into `org_members` as `admin`. |
| `join_org_by_code` | `(p_code text) returns organizations` | Normalizes (`upper(trim())`); on unknown code `E_INVALID_JOIN_CODE`; inserts member (idempotent). |
| `rotate_join_code` | `(p_org uuid) returns text` | Admin only; sets a new `generate_join_code()`; returns it. |
| `set_org_member_role` | `(p_org uuid, p_user uuid, p_role org_role) returns void` | Admin only; last-admin guard via trigger. |
| `remove_org_member` | `(p_org uuid, p_user uuid) returns void` | Admin, or self-leave; guards `E_LAST_ADMIN`, `E_OWNS_EVENTS`; unassigns the user's nodes in that org. |
| `create_event` | `(p_org uuid, p_title text, p_description text, p_starts_at timestamptz, p_ends_at timestamptz, p_location text, p_review_mode review_mode) returns uuid` | Caller must be org member (`E_NOT_AUTHORIZED`). In one transaction: insert root node (`type='event'`, `assignee_id = auth.uid()`, `created_by = auth.uid()`, `org_id = p_org`), insert `event_settings` (status `draft`), ensure `event_members` row. Returns event id. |
| `create_node` | `(p_parent uuid, p_type node_type, p_title text, p_description text, p_assignee uuid, p_due_at timestamptz, p_priority priority_level, p_weight smallint) returns nodes` | **SECURITY INVOKER** (RLS insert policy + triggers enforce everything). `p_type` must be segment/task. |
| `transition_task_status` | `(p_node uuid, p_from task_status, p_to task_status, p_comment text default null) returns nodes` | See §6.1. |
| `set_event_status` | `(p_event uuid, p_to event_status) returns void` | Owner only; enforces lifecycle table (BR-10 / AppFlow §6) → else `E_INVALID_TRANSITION`; sets `completed_at` on completion (null on reopen). |
| `get_event_tree` | `(p_event uuid) returns table (id uuid, parent_id uuid, type node_type, title text, description text, assignee_id uuid, assignee_name text, assignee_avatar text, status task_status, priority priority_level, due_at timestamptz, weight smallint, position int, depth smallint, progress numeric, submitted_at timestamptz, verified_at timestamptz)` | **SECURITY INVOKER**; returns all nodes of the event the caller can see (RLS), ordered by `depth, position, created_at`. Client nests them. |
| `get_my_tasks` | `() returns table (node_id uuid, title text, status task_status, priority priority_level, due_at timestamptz, event_id uuid, event_title text, event_status event_status, org_slug text)` | **INVOKER**; tasks where `assignee_id = auth.uid()` and event status in (`draft`,`active`); ordered overdue-first then `due_at nulls last`. |
| `get_review_queue` | `() returns table (node_id uuid, title text, assignee_name text, submitted_at timestamptz, event_id uuid, event_title text, org_slug text)` | **INVOKER**; tasks with `status='submitted'` where `app_private.is_strict_manager_of(id)` and event `active`, excluding tasks assigned to the caller unless the caller is the event owner (self-verify rule); oldest first. |

### 6.1 `transition_task_status` (reference)

```sql
create or replace function public.transition_task_status(
  p_node uuid, p_from public.task_status, p_to public.task_status, p_comment text default null)
returns public.nodes language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  n public.nodes; s public.event_settings;
  is_assignee boolean; is_mgr boolean; is_owner boolean; can_verify boolean; ok boolean := false;
begin
  if uid is null then raise exception 'E_NOT_AUTHORIZED' using errcode='P0001'; end if;
  select * into n from public.nodes where id = p_node and type = 'task' for update;   -- row lock serializes concurrent changes
  if not found or not app_private.can_view_event(n.event_id) then
    raise exception 'E_NOT_FOUND' using errcode='P0001'; end if;
  select * into s from public.event_settings where event_id = n.event_id;
  if s.event_status <> 'active' then raise exception 'E_EVENT_NOT_ACTIVE' using errcode='P0001'; end if;
  if n.status is distinct from p_from then raise exception 'E_STALE_STATE' using errcode='P0001'; end if;

  is_assignee := n.assignee_id = uid;
  is_mgr      := app_private.is_strict_manager_of(n.id);
  is_owner    := app_private.is_event_owner(n.event_id);
  can_verify  := is_mgr and (n.assignee_id is distinct from uid or is_owner);

  ok := case
    when p_from='todo'        and p_to='in_progress' then is_assignee or is_mgr                         -- T1
    when p_from='in_progress' and p_to='todo'        then is_assignee or is_mgr                         -- T2
    when p_from='in_progress' and p_to='submitted'   then is_assignee and s.review_mode='assignee_submits' -- T3
    when p_from='submitted'   and p_to='verified'    then can_verify                                    -- T4
    when p_from='submitted'   and p_to='in_progress' then is_mgr                                        -- T5
    when p_from in ('todo','in_progress') and p_to='verified'
                                                      then can_verify and s.review_mode='head_only'     -- T6
    when p_from='verified'    and p_to='in_progress' then is_mgr                                        -- T7
    else false end;
  if not ok then raise exception 'E_INVALID_TRANSITION' using errcode='P0001'; end if;

  if ((p_from='submitted' and p_to='in_progress') or (p_from='verified' and p_to='in_progress'))
     and (p_comment is null or char_length(trim(p_comment)) = 0) then
    raise exception 'E_COMMENT_REQUIRED' using errcode='P0001'; end if;

  update public.nodes set
    status       = p_to,
    submitted_at = case when p_to='submitted' then now() else submitted_at end,
    verified_at  = case when p_to='verified'  then now() when p_from='verified' then null else verified_at end,
    verified_by  = case when p_to='verified'  then uid   when p_from='verified' then null else verified_by end
  where id = n.id returning * into n;                       -- fires progress triggers

  insert into public.node_updates (event_id, node_id, user_id, kind, body, from_status, to_status)
  values (n.event_id, n.id, uid, 'status_change', nullif(trim(p_comment),''), p_from, p_to);
  return n;
end $$;
```

## 7. Auth Flow

1. **Sign up (email)**: client calls `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: SITE_URL + '/auth/callback' } })`. Trigger `on_auth_user_created` creates `profiles`. User must confirm email (Supabase setting *Confirm email = ON*).
2. **Confirm / OAuth callback**: `GET /auth/callback?code=…&next=…` → `exchangeCodeForSession(code)` → sets httpOnly session cookies → redirect to sanitized `next` (default `/dashboard`).
3. **Google OAuth**: `signInWithOAuth({ provider: 'google', options: { redirectTo: SITE_URL + '/auth/callback' } })`; profile created by the same trigger (`full_name` falls back to metadata `name` — handle in trigger via `coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1))`).
4. **Session**: `@supabase/ssr` cookie client; `middleware.ts` calls `supabase.auth.getUser()` on each request to refresh tokens and apply route guards (`02_AppFlow §2`). Server code always uses `getUser()` (validated) — never trust `getSession()` alone for authorization.
5. **Password reset**: `resetPasswordForEmail(email, { redirectTo: SITE_URL + '/auth/callback?next=/reset-password' })` → recovery session → `updateUser({ password })`.
6. **Authorization**: every query runs with the user's JWT (`authenticated` role); `auth.uid()` drives RLS and RPCs. No custom claims. After a user is removed from an org or reassigned, access changes instantly because policies read live tables.
7. **Logout**: `signOut()` then redirect `/login`.
8. **Auth settings (Supabase dashboard / `config.toml`)**: Site URL = production URL; additional redirect URLs = `http://localhost:3000/**` and production `/**`; JWT expiry 3600 s; refresh token rotation ON; min password length 10; email confirmations ON; signup enabled.

## 8. Data Lifecycle & Integrity Notes

- Deleting a node cascades to its subtree and its `node_updates` (history is lost; accepted in MVP).
- Reassigning a node away from a user removes that user from `event_members` if they hold no other node in the event; they lose access immediately.
- `progress_cached` is derived; never written by application code. A pgTAP test must assert cached values equal a recomputed recursive-CTE result after random mutations.
- Maximum 1000 nodes per event; depth ≤ 6 (event = 0).
- All timestamps UTC. `updated_at` maintained by triggers.

## 9. Required pgTAP Test Coverage (Phase 1 gate)

1. RLS enabled on all 7 public tables; `anon` has no privileges.
2. Org isolation: user in org A cannot select/insert/update/delete anything of org B.
3. Visibility: unassigned org member cannot see an event; org admin can (read-only); assignee can.
4. Node shape checks (root/status/depth) and triggers (`E_PARENT_IS_TASK`, `E_MAX_DEPTH`, `E_NODE_LIMIT`, `E_ASSIGNEE_NOT_IN_ORG`, `E_ROOT_IMMUTABLE`).
5. Every transition T1–T7 allowed/denied per role and mode; stale `p_from`; comment-required cases; self-verification denied for non-owner; non-active event denied.
6. Progress roll-up parity with recursive CTE after insert/delete/status/weight changes, including empty segments and weighted children.
7. Event lifecycle: read-only enforcement in `completed`/`archived`; delete event only in `draft`/`archived`; FK cascade on event delete is not blocked.
8. Org membership guards: last admin, owns events, unassign on removal.
9. `node_updates` immutability and forced `user_id`.
10. Client cannot write `status`, `progress_cached`, `verified_*` directly.
