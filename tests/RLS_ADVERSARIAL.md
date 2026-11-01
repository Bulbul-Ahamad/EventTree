# Adversarial RLS suite (plan step 4.08)

`tests/integration/rls-adversarial.test.ts`, run with `pnpm test:int` against the local Supabase. The attacker uses a real login (or none) and talks to PostgREST and the RPCs directly, around the app. "Blocked" means refused with an error, or accepted but touching no row. At the end the victim's data (nodes, event settings, members, organization, history) is compared with a snapshot taken before the attacks.

| Attacker | Attempts | Expected |
|---|---|---|
| No login (anon key) | select on all 7 tables; all 10 RPCs | empty / error |
| User of another organization | select on all tables (no victim row visible), `join_code`; `get_event_tree`; insert nodes / comments / org members / event members with forged `org_id`, `event_id`, `status`, `created_by`, `user_id`; `create_node` under a foreign parent; `create_event` in a foreign organization; update or delete nodes, organization, event settings, someone's profile; RPCs `rotate_join_code`, `set_org_member_role`, `remove_org_member`, `set_event_status`, `transition_task_status`, `get_join_code` on foreign ids; wrong join codes | all blocked; both wrong codes give the same message |
| Member of the organization, not in the event | read nodes, history, settings, tree; insert node or comment; update organization; promote self; remove a member; rotate or read the join code; change status; transition | all blocked |
| Assignee of a task | update every protected column of own task (`status`, `progress_cached`, `verified_by`, `verified_at`, `submitted_at`, `event_id`, `org_id`, `created_by`, `depth`, `type`, `parent_id`); edit, reassign, delete the task; change event status or settings; add event members; forge author, event or a status-change entry in the history; edit or delete history; promote self; remove the owner; read another organization's join code | all blocked |
| After everything | snapshot of the victim's data | identical |

## Finding

The join code was readable by any member through the API. Fixed in `20261102000000_join_code_admin_only.sql` (column grant on `organizations` without `join_code`, new admin-only RPC `get_join_code`). Recorded in the Decisions & Deviations Log of `docs/06_Plan.md`.
