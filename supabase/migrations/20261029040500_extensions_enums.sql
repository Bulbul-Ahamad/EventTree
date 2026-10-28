-- 1.05: extensions, app_private schema, enums (docs/05_Schema.md section 2)

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
