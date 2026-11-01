# Structural edge cases (plan step 4.07)

Each case from the plan and where it is tested. Run `pnpm test:db` (pgTAP, rules in the database), `pnpm test:int` (server actions against local Supabase) and `pnpm test` (unit).

| # | Case | Test |
|---|---|---|
| 1 | Empty segment: 0% and it still counts in its parent's average | `supabase/tests/database/06_progress_rollup.test.sql` (S2 empty, parity, "formerly empty segment now 100"); `tests/integration/nodes.test.ts` "a segment has no status and still shows in the tree with 0% progress" |
| 2 | Weights: weighted average of direct children; a weight change moves the parent | `06_progress_rollup.test.sql` ("event rolls up weighted", "weight change re-weights"); `tests/integration/nodes.test.ts` "a weight change moves the parent's progress"; `tests/unit/progress.test.ts` |
| 3 | Depth 6 limit (`E_MAX_DEPTH`) | `04_nodes.test.sql` ("depth above 6 rejected"); `tests/integration/nodes.test.ts` "nesting stops at depth 6" |
| 4 | 1000-node limit (`E_NODE_LIMIT`) | `04_nodes.test.sql` (999 tasks inserted, the next one rejected) |
| 5 | Reassigning removes the old assignee's visibility | `tests/integration/nodes.test.ts` "a strict manager reassigns; the old assignee loses access, the new one gains it"; `13_gap_coverage.test.sql` |
| 6 | Deleting a subtree recalculates the parents | `tests/integration/nodes.test.ts` "a strict manager deletes a node and its whole subtree" and "deleting a verified task ... parent progress is recomputed"; `tests/unit/delete-node.test.tsx` (optimistic screen) |
| 7 | Last admin cannot leave, be demoted or be removed (`E_LAST_ADMIN`) | `03_organizations.test.sql`; `tests/integration/orgs.test.ts` "the last admin cannot demote themselves", "the last admin cannot leave or be removed" |
| 8 | A member who owns an event cannot be removed (`E_OWNS_EVENTS`) | `04_nodes.test.sql` ("cannot remove a member who owns an event"); `tests/integration/orgs.test.ts` "an admin who owns an event cannot leave" |
| 9 | A completed event rejects writes (`E_EVENT_READONLY`, `E_EVENT_NOT_ACTIVE`) | `tests/integration/nodes.test.ts` ("is refused in a completed event" for create, update, delete); `tests/integration/updates.test.ts` "E_EVENT_NOT_ACTIVE in a draft and in a completed event"; `13_gap_coverage.test.sql`; `tests/e2e/happy-path-mode-a.spec.ts` (read-only screen) |
| 10 | Reopening a completed event works | `tests/integration/events.test.ts` "walks draft > active > completed > active ..." and "reopening clears completed_at"; `tests/e2e/happy-path-mode-a.spec.ts` (Mark completed; lifecycle) |
