-- Plan 4.10: EXPLAIN ANALYZE of get_event_tree at 1000 nodes, as the event owner (RLS applies).
-- Run:  docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) psql -U postgres -f - < scripts/perf/explain.sql
-- Budget (04_TRD section 9): Execution Time <= 100 ms.
begin;
select set_config('app.perf_event', (select id::text from public.nodes where type = 'event' and title = 'Perf Event (1000 nodes)' limit 1), true);
select set_config('app.perf_owner', (select id::text from auth.users where email = 'perf-owner@demo.test'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.perf_owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
-- warm up once, then measure three times
select count(*) from public.get_event_tree(current_setting('app.perf_event')::uuid);
explain (analyze, buffers) select * from public.get_event_tree(current_setting('app.perf_event')::uuid);
explain (analyze, buffers) select * from public.get_event_tree(current_setting('app.perf_event')::uuid);
explain (analyze, buffers) select * from public.get_event_tree(current_setting('app.perf_event')::uuid);
rollback;
