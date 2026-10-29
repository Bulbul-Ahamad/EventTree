# pgTAP coverage map (docs/05_Schema.md section 9)

Run with `pnpm test:db`. Every item of the Phase 1 gate maps to at least one file in `supabase/tests/database/`.

| # | Requirement | Test files |
|---|---|---|
| 1 | RLS enabled on all 7 tables; `anon` has no privileges | `08_rls_policies` |
| 2 | Org isolation (select, insert, update, delete) | `08_rls_policies` (select, forged org_id), `13_gap_coverage` (writes) |
| 3 | Visibility: unassigned member blind, admin read-only, assignee sees | `07_rls_helpers`, `08_rls_policies`, `13_gap_coverage` |
| 4 | Node shape checks and triggers | `04_nodes` |
| 5 | Transitions T1-T7 by role and mode, stale, comment-required, self-verify, inactive event | `11_rpc_status` |
| 6 | Progress roll-up parity | `06_progress_rollup` |
| 7 | Lifecycle read-only, delete only in draft/archived, cascade not blocked | `05_event_tables`, `10_rpc_events`, `13_gap_coverage` |
| 8 | Org guards: last admin, owns events, unassign on removal | `03_organizations`, `04_nodes`, `09_rpc_orgs` |
| 9 | `node_updates` immutability and forced `user_id` | `05_event_tables`, `08_rls_policies`, `13_gap_coverage` |
| 10 | Client cannot write status, progress_cached, verified_* | `08_rls_policies`, `13_gap_coverage` |

Also covered: enums/extensions (`01`), profiles trigger (`02`), organization RPCs (`09`), event/node RPCs (`10`), read RPCs (`12`).
