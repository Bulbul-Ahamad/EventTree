begin;
select plan(11);

select has_extension('extensions', 'ltree', 'ltree extension installed');
select has_extension('extensions', 'pgcrypto', 'pgcrypto extension installed');
select has_schema('app_private', 'app_private schema exists');

select enum_has_labels('public', 'org_kind', array['club','organization','university_program','other']);
select enum_has_labels('public', 'org_role', array['admin','member']);
select enum_has_labels('public', 'node_type', array['event','segment','task']);
select enum_has_labels('public', 'task_status', array['todo','in_progress','submitted','verified']);
select enum_has_labels('public', 'priority_level', array['low','medium','high','urgent']);
select enum_has_labels('public', 'review_mode', array['assignee_submits','head_only']);
select enum_has_labels('public', 'event_status', array['draft','active','completed','archived']);
select enum_has_labels('public', 'update_kind', array['comment','proof_link','status_change']);

select * from finish();
rollback;
