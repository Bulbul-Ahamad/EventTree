# 06 — Implementation Plan

> **This file is the live project tracker.** The coding agent MUST update it after every completed step (see `CLAUDE.md`).
> Order is by dependency: Phase 1 DB & Auth → Phase 2 Core API → Phase 3 UI Integration → Phase 4 Edge-case tests & hardening.
> Do steps strictly in order. Do not start a step until all previous steps in the same phase are ticked.

## Current Step

**Next up: `1.28`**
(Agent: update this line after each completed step.)

## How to read a step

`- [ ] **ID** — Task. _Done when:_ verifiable condition.` — A step is complete only when its "Done when" is true **and** `pnpm check` (lint + typecheck + unit tests) passes — plus `pnpm test:db` for DB steps. One step ≈ one commit.

---

## Phase 1 — Database & Auth

**Repo & tooling**
- [x] **1.01** — Scaffold Next.js (App Router, TypeScript, Tailwind, ESLint, `src/` dir, alias `@/*`, pnpm) in repo root without overwriting `docs/`, `CLAUDE.md`, `.cursorrules`. Add `.nvmrc` (22). _Done when:_ `pnpm dev` serves the default page and `pnpm build` succeeds.
- [x] **1.02** — Verify every dependency in `04_TRD §2` exists at its locked minor; install; fill the "Resolved" column in `04_TRD.md`; commit lockfile. _Done when:_ table has no empty Resolved cells; `pnpm install --frozen-lockfile` works.
- [x] **1.03** — Configure TS strict options, ESLint, Prettier (+ tailwind plugin), and the scripts table from `04_TRD §11` (stubs allowed for later scripts). Add `src/lib/env.ts` (Zod) and `.env.example`. _Done when:_ `pnpm check` passes; missing env var makes app fail fast with a clear message.
- [x] **1.04** — Init Supabase CLI (`supabase init`), configure `config.toml` per `05_Schema §7.8` (email confirm on, min password 10, redirect URLs), start local stack. _Done when:_ `pnpm db:start` runs and `pnpm db:reset` succeeds on an empty migration set.

**Migrations (one concern per file, applied in order)**
- [x] **1.05** — Migration `…_extensions_enums`: extensions, `app_private` schema, all enums (`05_Schema §2`). _Done when:_ `db:reset` succeeds; enums exist.
- [x] **1.06** — Migration `…_profiles`: table, `handle_new_user` trigger with `full_name`/`name`/email-prefix fallback. _Done when:_ pgTAP test creating an `auth.users` row produces a profile.
- [x] **1.07** — Migration `…_organizations`: `organizations`, `org_members`, `generate_join_code`, last-admin / owns-events / unassign-on-removal triggers. _Done when:_ pgTAP tests for the three org guards pass.
- [x] **1.08** — Migration `…_nodes`: `nodes` table, constraints, indexes, triggers `01_prepare`, `02_validate`, `04_progress_leaf`. _Done when:_ pgTAP tests for shape checks, `E_PARENT_IS_TASK`, `E_MAX_DEPTH`, `E_NODE_LIMIT`, `E_ASSIGNEE_NOT_IN_ORG`, `E_ROOT_IMMUTABLE` pass.
- [x] **1.09** — Migration `…_event_tables`: `event_settings`, `event_members`, `node_updates` (+ immutability trigger, `event_id`/`user_id` forcing trigger); `nodes_03_guard` and `nodes_05_event_members` triggers. _Done when:_ pgTAP tests for lifecycle read-only, cascade-not-blocked, event_members sync pass.
- [x] **1.10** — Migration `…_progress_rollup`: `recompute_progress_upwards`, `nodes_06_rollup`. _Done when:_ pgTAP parity test (cached progress == recursive CTE) passes after insert/delete/status/weight changes incl. empty segment.
- [x] **1.11** — Migration `…_rls_helpers`: all functions in `05_Schema §4` with grants. _Done when:_ pgTAP tests exercise each helper for owner/head/assignee/outsider/admin.
- [x] **1.12** — Migration `…_rls_policies`: enable RLS, base privileges, column grants, all policies of `05_Schema §5`. _Done when:_ pgTAP: RLS enabled on all tables; `anon` has no access; org-isolation tests pass; client cannot update `status`/`progress_cached`.
- [x] **1.13** — Migration `…_rpc_orgs`: `create_organization`, `join_org_by_code`, `rotate_join_code`, `set_org_member_role`, `remove_org_member`. _Done when:_ pgTAP covers success + each error code.
- [x] **1.14** — Migration `…_rpc_events`: `create_event`, `create_node`, `set_event_status`. _Done when:_ pgTAP covers creation, permission failures, lifecycle table.
- [x] **1.15** — Migration `…_rpc_status`: `transition_task_status` per `05_Schema §6.1`. _Done when:_ pgTAP covers T1–T7 × roles × modes, stale state, comment-required, self-verify rule, inactive event.
- [x] **1.16** — Migration `…_rpc_reads`: `get_event_tree`, `get_my_tasks`, `get_review_queue`. _Done when:_ pgTAP covers visibility and ordering.
- [x] **1.17** — Complete pgTAP suite per `05_Schema §9` (fill any gap). _Done when:_ `pnpm test:db` is green and every item in §9 maps to at least one test file.
- [x] **1.18** — `scripts/seed.ts` (refuses non-localhost URL): 2 orgs, 6 users (owner, 2 heads, 2 assignees, 1 outsider), one active event with ~25 nodes. _Done when:_ `pnpm seed` is idempotent and demo data visible via SQL.
- [x] **1.19** — Generate types `pnpm db:types` → `src/types/database.ts`. _Done when:_ file committed; typecheck passes; CI-style diff check is clean.

**Auth plumbing**
- [x] **1.20** — `src/lib/supabase/{client,server,middleware}.ts` with `@supabase/ssr`. _Done when:_ unit test or manual check shows server client reads session cookie.
- [x] **1.21** — Design tokens: implement `globals.css` per `03_UI_Spec §9`, fonts (Inter, Noto Sans Bengali, JetBrains Mono), `next-themes`, shadcn init. _Done when:_ light/dark token swap visible on a test page; Bangla sample text renders.
- [x] **1.22** — Auth-needed primitives (Button, Input, Label, FormField, Card, Toast/Sonner, ThemeToggle) per `03_UI_Spec §8`. _Done when:_ all states (hover/focus/disabled/loading/error) verified in both themes.
- [x] **1.23** — `src/lib/errors.ts` (ErrorCode union + message map from `02_AppFlow §7`) and `action-result.ts`. Add missing codes to `02_AppFlow §7` if discovered. _Done when:_ unit tests map every code to a message and unknown → `E_UNKNOWN`.
- [x] **1.24** — `middleware.ts` route guards per `02_AppFlow §2` (session refresh, redirects, `next` sanitization). _Done when:_ unit tests for `sanitizeNext`; manual: guest → `/login?next=…`, authed → `/dashboard`.
- [x] **1.25** — Auth Server Actions + Zod schemas: signUp, signIn, signOut, forgotPassword, resetPassword, resend confirmation, Google OAuth start; `auth/callback` route. _Done when:_ schemas unit-tested; generic error wording per `02_AppFlow` verified.
- [x] **1.26** — Pages S02–S06 (signup, check-email, login, forgot, reset) per `02_AppFlow §4`. _Done when:_ full email signup → confirm (Inbucket local) → login works; wrong password and unconfirmed states render correct messages.
- [x] **1.27** — Org Server Actions (`createOrganization`, `joinOrganization`) + S07 Onboarding page. _Done when:_ new user is forced to `/onboarding`, can create or join, lands on `/o/{slug}/events` (placeholder page ok).
- [ ] **1.28** — Profile page S17 (name edit, theme, logout). _Done when:_ name change persists; logout returns to `/login`.
- [ ] **1.29** — **Phase 1 gate:** run `pnpm check`, `pnpm test:db`; manually test signup→confirm→login→onboarding→logout. Log results in Progress Log. _Done when:_ all green and logged.

---

## Phase 2 — Core API (server data layer & logic)

- [ ] **2.01** — Zod schemas + inferred types for org, event, node, update (`features/*/schemas.ts`), `.strict()`. _Done when:_ unit tests cover boundaries (lengths, weight 1–10, URL scheme, dates).
- [ ] **2.02** — `lib/permissions.ts`: pure functions mirroring RLS (canCreateChild, canEditNode, canComment, canTransition…) taking a minimal context (user id, ancestor chain, event settings). _Done when:_ unit tests reproduce the permission matrix in `01_PRD §7` row by row.
- [ ] **2.03** — `lib/status.ts`: `allowedTransitions(context)` implementing T1–T7. _Done when:_ table-driven tests match `02_AppFlow §5` exactly (incl. Mode A/B, self-verify rule, comment-required flag).
- [ ] **2.04** — `lib/progress.ts` (weighted roll-up) and `lib/tree.ts` (flat → nested, sibling sort, filters All/Mine/Overdue/Needs review, expansion helpers). _Done when:_ unit tests incl. empty segment, weights, 6-deep tree, filter breadcrumbs.
- [ ] **2.05** — Org queries/actions: list my orgs, members, rotate code, set role, remove/leave. _Done when:_ integration tests (real RLS) pass for admin vs member.
- [ ] **2.06** — Event queries/actions: list events (tabs), get event + settings, `createEvent`, `updateEventSettings`, `setEventStatus`, `deleteEvent`. _Done when:_ integration tests pass for owner/outsider/admin.
- [ ] **2.07** — Node queries/actions: `getEventTree` (RPC → nested), `createNode`, `updateNode`, `reassignNode`, `deleteNode`. _Done when:_ integration tests cover manager/strict-manager rules and all node error codes surfaced as `ActionResult`.
- [ ] **2.08** — Update/status actions: `transitionTask`, `addComment`, `addProofLink`, `getNodeActivity`. _Done when:_ integration tests cover T1–T7 through the action layer incl. `E_STALE_STATE`.
- [ ] **2.09** — Dashboard queries: `getMyTasks` (grouped), `getReviewQueue`, `getMyEvents`. _Done when:_ integration tests verify grouping and visibility.
- [ ] **2.10** — Error-mapping integration: every RPC error message maps to `ErrorCode`; unknown Postgres errors → `E_UNKNOWN` without leaking details. _Done when:_ tests assert no raw SQL text reaches `message`.
- [ ] **2.11** — **Phase 2 gate:** `pnpm check`, `pnpm test:int`, `pnpm test:db` green. Log results. _Done when:_ logged.

---

## Phase 3 — UI Integration

**Shell & primitives**
- [ ] **3.01** — Remaining primitives per `03_UI_Spec §8`: Badge/StatusBadge/RoleChip, ProgressBar, Dialog, Sheet/Drawer, DropdownMenu, Select (searchable), Tabs/Segmented, Avatar, Skeleton, EmptyState, Banner, ConfirmDialog, Tooltip. _Done when:_ each has all states; checked in light + dark at 360 px and 1280 px.
- [ ] **3.02** — App shell: TopBar, LeftNav / mobile nav, OrgSwitcher, UserMenu, skip link, landmarks. Org layout enforces membership (404 otherwise). _Done when:_ navigation works at all breakpoints; non-member `/o/x` → 404.
- [ ] **3.03** — S01 Landing + S18 `not-found`/`error`/`global-error`. _Done when:_ authed `/` redirects to `/dashboard`.
- [ ] **3.04** — S09 Events list (tabs, cards, empty states) and S10 New event form. _Done when:_ creating an event redirects to the tree page with "draft" toast.
- [ ] **3.05** — S08 Dashboard (review queue, my tasks groups, my events) with empty/loading states. _Done when:_ seeded users see correct sections; empty user sees EmptyStates.

**Tree experience**
- [ ] **3.06** — `TreeView` + `TreeNodeRow` (indent, chevrons, progress/status, assignee, overdue, keyboard nav, ARIA tree, expand state persisted per event in `localStorage` with try/catch). _Done when:_ keyboard + screen-reader roles verified; 500-node render smooth.
- [ ] **3.07** — Event header (progress, status badge, banners, lifecycle buttons with confirm dialogs and warnings) + filter control (`?filter=`). _Done when:_ lifecycle buttons only for Owner; banners per status.
- [ ] **3.08** — `NodeFormDialog` (add/edit segment/task, assignee select, due, priority, weight) wired to actions with field + mapped errors. _Done when:_ create/edit/reassign works; each error code displays its message.
- [ ] **3.09** — `NodeDetailPanel` (`?node=`): breadcrumb, fields, children summary, activity timeline, comment/proof composer. _Done when:_ opens/closes via URL; invalid id handled; timeline shows who/when/what.
- [ ] **3.10** — `StatusControls`: row/panel actions from `lib/status.ts`, verify tick, comment-required flows (send back, reopen), `useOptimistic` with rollback, stale-state handling. _Done when:_ Mode A and Mode B flows work end to end for owner/head/assignee personas.
- [ ] **3.11** — Delete flows with subtree-count confirmation; row ⋮ menu gated by permissions. _Done when:_ deleting a segment updates parent progress immediately.
- [ ] **3.12** — S14 Event settings (+ review mode note, danger zone with typed-title confirm). _Done when:_ only Owner reaches it; delete enabled only in draft/archived.

**Org management**
- [ ] **3.13** — S15 Members (table, role select, remove, leave, join-code copy/rotate) and S16 Org settings. _Done when:_ last-admin and owns-events errors display correctly.

**Polish**
- [ ] **3.14** — Loading skeletons (`loading.tsx`), empty states, error boundaries for every route per `02_AppFlow`. _Done when:_ throttled network shows skeletons; forced error shows boundary with retry.
- [ ] **3.15** — Responsive pass at 360 / 768 / 1280 and dark-mode pass on all screens. _Done when:_ no horizontal scroll at 360; Bangla text not clipped; checklist logged.
- [ ] **3.16** — Accessibility pass per `03_UI_Spec §10` (axe checks, keyboard-only walkthrough, focus management in dialogs/drawer). _Done when:_ zero serious/critical axe violations on main screens.
- [ ] **3.17** — **Phase 3 gate:** manual run-through of every user story US-01…US-17 against its AC; list any gaps as new steps. _Done when:_ every US ticked or gap-steps added.

---

## Phase 4 — Edge-Case Tests & Hardening

**Automated E2E & adversarial tests**
- [ ] **4.01** — Playwright setup (chromium + mobile viewport 360×740), auth fixtures (seeded users logged in via API), DB reset per spec file. _Done when:_ sample test passes locally.
- [ ] **4.02** — E2E happy path (Mode A): owner creates event → segments → head adds tasks → activate → assignee starts & submits → head verifies → progress reaches 100% → owner completes event (read-only afterwards). _Done when:_ test green on desktop and mobile viewport.
- [ ] **4.03** — E2E Mode B: head ticks tasks directly; assignee cannot submit. _Done when:_ green.
- [ ] **4.04** — E2E send-back and reopen flows with required comment. _Done when:_ green; history shows entries.
- [ ] **4.05** — Permission negatives (UI + direct API): assignee cannot verify; head cannot touch sibling segment; non-participant gets 404; org admin is read-only; cross-org access denied. _Done when:_ green.
- [ ] **4.06** — Concurrency: two sessions transition the same task; loser sees `E_STALE_STATE` message and refreshed state. _Done when:_ deterministic test green.
- [ ] **4.07** — Structural edge cases: empty segment progress; weights; depth 6 limit; 1000-node limit; reassign removes visibility; delete subtree recalculates parents; last-admin; member who owns event can't be removed; completed event rejects writes; reopen works. _Done when:_ each case has a test.
- [ ] **4.08** — Adversarial RLS suite: with another user's JWT call PostgREST/RPC directly (select, insert with forged `org_id/event_id/status/created_by`, update protected columns, call RPCs on foreign ids). _Done when:_ all rejected/empty; results documented.
- [ ] **4.09** — Input abuse tests: oversized text, Bangla/emoji text, `javascript:` proof links, open-redirect `next`, HTML in titles rendered as text. _Done when:_ all handled safely.

**Quality gates**
- [ ] **4.10** — Performance: seed 1000-node event; `EXPLAIN ANALYZE get_event_tree` ≤ 100 ms; tree page p95 ≤ 1 s; Lighthouse budgets in `04_TRD §9`. _Done when:_ numbers logged; add indexes only if needed (new migration).
- [ ] **4.11** — Security hardening: CSP and headers in `next.config.ts`, grep for `service_role` / `dangerouslySetInnerHTML` (none), `pnpm audit --prod`, review `SECURITY DEFINER` functions' `search_path`/grants. _Done when:_ checklist from `04_TRD §8` fully ticked in log.
- [ ] **4.12** — CI workflow `.github/workflows/ci.yml` with the five jobs from `04_TRD §12`. _Done when:_ pipeline green on a PR.
- [ ] **4.13** — Production setup: Supabase Cloud project, `supabase db push`, Google OAuth credentials, custom SMTP (Resend), auth URL config, Vercel project + env vars (no service role), domain. _Done when:_ production smoke test passes (signup→confirm→create org→create event→assign→verify).
- [ ] **4.14** — **MVP acceptance:** tick every US-01…US-17 and every metric instrumentation query from `01_PRD §8` documented. Update README with setup/run/deploy instructions. _Done when:_ all ticked; tag `v0.1.0`.

---

## Progress Log (append-only, newest last)

| Date | Step | What changed | Commit | Notes / deviations |
|---|---|---|---|---|
| — | — | Plan created | — | — |
| 2026-10-29 | 1.01 | Scaffolded Next.js 15.5.28 (App Router, TS 5.9, Tailwind 4.3, ESLint, `src/`, `@/*`, pnpm 12) + `.nvmrc` (22). `pnpm dev` serves default page; `pnpm build` passes. | ccd5860 | pnpm 12 blocks install scripts: approved `unrs-resolver` via `pnpm approve-builds`. First build failed with `useContext` null on /404; fixed by clean reinstall (`rm -rf .next node_modules`). ESLint-patch warning seen once, gone after reinstall. Plan tick committed after scaffold commit. |
| 2026-10-29 | 1.02 | Installed all TRD §2 dependencies; filled Resolved column in `04_TRD.md`; committed lockfile; renamed package to `eventtree`. `pnpm install --frozen-lockfile` and `pnpm build` pass. | 44a99b3 | Deviations approved by Bulbul and logged: pnpm 9→12, Tailwind 4.1→4.3, ssr 0.7→0.12, resolvers 5→6, react-hook-form 7.6x→7.9x, lucide 0.5xx→1.x, vitest 3→5, playwright 1.5x→1.6x. shadcn/Radix not yet installed (added on demand). |
| 2026-10-29 | 1.03 | Strict TS (`noUncheckedIndexedAccess`, `noImplicitOverride`), ESLint `no-console`, Prettier + tailwind plugin, all TRD §11 scripts, `src/lib/env-schema.ts` + `env.ts` (Zod), `src/instrumentation.ts` boot validation, `.env.example` (un-ignored in `.gitignore`), Vitest config + 4 env unit tests. `pnpm check` passes; a missing env var stops `pnpm dev` with a clear error naming it. | 5fd25b3, d1c3de4 | First test run failed because `env.ts` validated at import; fixed by splitting pure `parseEnv` into `env-schema.ts`. `vitest.config.ts` renamed `.mts` (Vite ESM warning). `seed` script uses `tsx`, which is not in the TRD stack and not installed: `pnpm seed` will not run until a decision is made (open question for Bulbul). `test:int`, `test:e2e`, `test:db` are stubs until later steps. |
| 2026-10-29 | 1.04 | `supabase init`; `supabase/config.toml` set per `05_Schema §7.8`: site URL `http://localhost:3000`, redirect `http://localhost:3000/**`, min password 10, email confirmations ON, JWT 3600, refresh rotation ON, signup enabled. Local stack starts (`pnpm db:start`); `pnpm db:reset` succeeds on empty migration set. | 2e27e63, 72ea164 | Postgres major_version 17 (TRD says 15+). `db:reset` warns `supabase/seed.sql` not found: expected, no seed yet. Production redirect URL to be added at deploy. Push needed `git pull --rebase` (remote had plan commit); author identity fixed on 2e27e63. |
| 2026-10-29 | 1.05 | Migration `20261029040500_extensions_enums.sql`: `ltree`, `pgcrypto`, `app_private` schema, 8 enums per `05_Schema §2`. pgTAP `01_extensions_enums.test.sql` (11 tests) passes via `pnpm test:db`. | a03853f | None. |
| 2026-10-29 | 1.06 | Migration `20261029041000_profiles.sql`: `profiles`, `lower(email)` unique index, `app_private.handle_new_user` + `on_auth_user_created` trigger (full_name/name/email-prefix fallback), `profiles_set_updated_at`. pgTAP `02_profiles.test.sql` (9 tests) passes; `db:reset` + `test:db` green (20 tests). | a5802fd | Added reusable helper `app_private.touch_updated_at()` (05_Schema §8 says updated_at is trigger-maintained). RLS/grants for profiles deferred to 1.12 per plan. |
| 2026-10-29 | 1.07 + 1.08 | Migrations `20261029042000_organizations.sql` (organizations, org_members, `generate_join_code`, last-admin guard) and `20261029042500_nodes.sql` (nodes, indexes, triggers 01_prepare/02_validate/04_progress_leaf, plus the `E_OWNS_EVENTS` and unassign-on-removal org guards). pgTAP `03_organizations` (10) and `04_nodes` (18) pass; `db:reset` + `test:db` green (48 tests). | 5c2e4c6 | Executed together by decision (see Decisions log): the owns-events and unassign guards read `nodes`, which only exists from 1.08. RLS/grants deferred to 1.12. |
| 2026-10-29 | 1.09 | Migration `20261029043000_event_tables.sql`: `event_settings`, `event_members`, `node_updates` (append-only, event_id/user_id forcing triggers), `nodes_03_guard`, `nodes_05_event_members`. pgTAP `05_event_tables` (23) passes; `test:db` green (71 tests). | 4a78c6c, 320a3a4 | First run failed because the test inserted a child into an already-archived event (guard correctly blocked it); fixed test ordering, no migration change. `user_id` is forced to `auth.uid()` only when a JWT is present, so RPC/trigger inserts as a superuser keep their value. |
| 2026-10-29 | 1.10 | Migration `20261029043500_progress_rollup.sql`: `recompute_progress_upwards`, `nodes_06_rollup`. pgTAP `06_progress_rollup` (19) passes: cached progress equals a from-scratch oracle after insert/delete/status/weight changes, empty segment, subtree delete. `test:db` green (90 tests). | bfc9e42 | Oracle is a recursive plpgsql function, not a recursive CTE (same result, rounds per level like the trigger). |
| 2026-10-29 | 1.11 | Migration `20261029044000_rls_helpers.sql`: 7 helper functions of `05_Schema §4`, execute revoked from public/anon and granted to authenticated. pgTAP `07_rls_helpers` (31) passes with owner/head/nested head/assignee/outsider/admin personas; `test:db` green (121 tests). | f3c60fc | Tests set `request.jwt.claims` as superuser rather than switching DB role (helpers are SECURITY DEFINER); grants checked via `has_function_privilege`. |
| 2026-10-29 | 1.12 | Migration `20261029044500_rls_policies.sql`: RLS enabled on all 7 tables, base privileges revoked from anon/authenticated, column grants and all policies of `05_Schema §5`. pgTAP `08_rls_policies` (31) passes as the real `authenticated` role: org isolation, no client writes to status/progress_cached, forged created_by/org_id rejected, head scope, comment permission; `test:db` green (152 tests). | aa8f0c0, f29c9ba | First run failed on an apostrophe in a test description (SQL quoting), fixed in the test only. |
| 2026-10-29 | 1.13 | Migration `20261029045000_rpc_orgs.sql`: `create_organization`, `join_org_by_code`, `rotate_join_code`, `set_org_member_role`, `remove_org_member` (SECURITY DEFINER, anon revoked). pgTAP `09_rpc_orgs` (34) passes: success paths and E_VALIDATION, E_SLUG_TAKEN, E_NOT_AUTHORIZED, E_INVALID_JOIN_CODE, E_NOT_FOUND, E_LAST_ADMIN, E_OWNS_EVENTS; `test:db` green (186 tests). | 89d68f4 | `set_org_member_role` / `remove_org_member` raise E_NOT_FOUND when the target row does not exist (not spelled out in the schema doc). |
| 2026-10-29 | 1.14 | Migration `20261029045500_rpc_events.sql`: `create_event` (root + settings + event_members in one call), `create_node` (SECURITY INVOKER, maps RLS/check errors to E_NOT_AUTHORIZED/E_VALIDATION), `set_event_status` (lifecycle table of AppFlow §6, completed_at set/cleared). pgTAP `10_rpc_events` (33) passes; `test:db` green (219 tests). | eedcfd4 | `create_event` and `create_node` also raise E_VALIDATION for out-of-range title/description/location/weight (schema doc only says Validates). |
| 2026-10-29 | 1.15 | Migration `20261029050000_rpc_status.sql`: `transition_task_status` exactly per `05_Schema §6.1`. pgTAP `11_rpc_status` (35) covers T1-T7 by role (assignee/head/owner/unrelated) and both review modes, self-verify rule (head blocked, owner allowed), E_COMMENT_REQUIRED, E_STALE_STATE, E_EVENT_NOT_ACTIVE (draft, completed), E_NOT_FOUND, E_NOT_AUTHORIZED, audit rows, verified_by/at and progress; `test:db` green (254 tests). | d9706e0, 12feea7 | First run: test setup bug (user had no node so correctly got E_NOT_FOUND); fixed in the test only. |
| 2026-10-29 | 1.16 | Migration `20261029050500_rpc_reads.sql` (`get_event_tree`, `get_my_tasks`, `get_review_queue`, all SECURITY INVOKER) plus `20261029051000_review_queue_self_exclusion.sql`. pgTAP `12_rpc_reads` (21) covers visibility, ordering, overdue-first, completed events excluded, review queue scope, anon denied; `test:db` green (275 tests). | b245a58, 804ffe9, 7ee7c17 | Decision logged: own submitted tasks are excluded from a user's review queue unless they are the event owner; `05_Schema §6` updated. |
| 2026-10-29 | 1.17 | Added `13_gap_coverage.test.sql` (18 tests: org-isolation writes, admin read-only, protected columns, node_updates append-only for clients, completed/archived event writes) and `supabase/tests/COVERAGE.md` mapping every `05_Schema §9` item to test files. `test:db` green: 13 files, 293 tests. | 954a069, b00d18b | First run had a wrong expected node count in my test (3, not 4); fixed in the test only. |
| 2026-10-29 | 1.18 | `scripts/seed.ts`: refuses non-localhost URL, needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, creates 2 orgs, 6 users (owner, 2 heads, 2 assignees, 1 outsider), event "Tech Fest 2026" with 25 nodes (1 event, 4 segments, 20 tasks), activity rows, event set active. `tsx` 4.23.15 added as dev dependency (approved, TRD updated). `pnpm seed` run twice: second run changes nothing. SQL check: event 42.9%, segments avg 31.0%, tasks avg 35.0%. `pnpm check` green. | 88c20fe, dd17fb3 | First `tsc` run failed (nullable helper return type); fixed. `package.json` / lockfile for `tsx` committed from Bulbul's machine. Login password for demo users: `Passw0rd!demo`. |
| 2026-10-30 | 1.19 | `src/types/database.ts` generated via `pnpm db:types` (public tables, enums, RPCs). Re-running leaves `git status` clean; `pnpm check` green (lint, tsc, 4 unit tests). | db86965 | CLI prints an unformatted-output hint; ignored (file is eslint-ignored, never hand-edited). |
| 2026-10-30 | 1.20 | `src/lib/supabase/client.ts` (browser), `server.ts` (async, `next/headers` cookies, `server-only`), `middleware.ts` (`updateSession` refreshes session, returns user via `getUser()`); all typed with generated `Database`. 2 unit tests: server client reads the session from the cookie; no cookie gives null. `pnpm check` green (6 tests). | a9f7334 | `server-only` is not an npm dependency (not in locked stack): added `src/types/server-only.d.ts` and a vitest alias stub; Next resolves it at build. Test stderr warnings (getSession insecure, multiple GoTrueClient) are expected in the test. |
| 2026-10-30 | 1.21 | `globals.css` with all tokens of `03_UI_Spec` (light/dark, status, priority, progress, shadows, radii, `:lang(bn)`, focus ring, reduced motion); Inter, Noto Sans Bengali, JetBrains Mono via `next/font`; `next-themes` ThemeProvider (class, system default); `components.json` + `src/lib/utils.ts` (`cn`); temporary `/dev/tokens` page (404 in production). Verified by Bulbul in the browser: theme swap, Bangla text, 360 px, dark mode. | e1b10f7, 5209fe5, 1ffb04f, c8d3df2 | Theme changed to emerald green (approved, see Decisions log); dark primary softened to `#10B981`. Hydration error in the theme switcher fixed. shadcn CLI not run (it would overwrite `globals.css`): config written by hand; shadcn color names (`--card`, `--muted`...) must be mapped to our tokens when components are added in 1.22. `/dev/tokens` to be removed with 3.03. |
| 2026-10-30 | 1.22 | Primitives in `src/components/ui`: Button (4 variants, 4 sizes, loading, disabled), Input/Textarea, Label, FormField (label, hint, error, aria wiring), Card; `shell/theme-toggle.tsx` (system/light/dark); `ui/toaster.tsx` (sonner, token-styled) + `lib/toast.ts` (`notify`, 3 s / 6 s). 4 unit tests (Button loading/type, FormField aria). Temporary `/dev/primitives` page. Visually verified by Bulbul in light and dark. | 1158aa2, 6545392, 9ab8440, b89d321 | `sonner` 2.0.8 added with approval (TRD + Decisions log). First `pnpm check` failed: Testing Library did not clean the DOM between tests (vitest globals off); fixed with `afterEach(cleanup)` in `tests/setup.ts`. No Radix used yet (not needed). `pnpm check` output after the last commit was not pasted; Bulbul confirmed the page works. `/dev/primitives` to be removed with 3.03. |
| 2026-10-30 | 1.23 | `src/lib/errors.ts` (21 codes of `02_AppFlow §7` + messages, `toErrorCode`, unknown → `E_UNKNOWN`) and `src/lib/action-result.ts` (`ActionResult`, `ok`, `fail`, `failFrom`). 11 unit tests incl. catalogue-equals-doc check and no raw SQL text in `message`. `pnpm check` green. | 2c42554 | All `E_` codes raised in migrations are already in §7: no doc change. `E_VALIDATION` fallback text "Please check the highlighted fields." is mine (doc says field-level messages from Zod). |
| 2026-10-30 | 1.24 | `src/lib/route-guards.ts` (`sanitizeNext`, `decideRoute`, `needsOrgCount`) and `src/middleware.ts` (session refresh, org count lookup only when needed, redirects keep refreshed cookies). Implements `02_AppFlow §2` rules 1-4 and 8. Unit tests for guests, signed-in with 0 / 1+ orgs, exempt pages, unknown org count, and open-redirect inputs. Manual: guest `/dashboard` goes to `/login?next=%2Fdashboard`. | 568540c | Rules 5-7 (404s inside `/o/[orgSlug]`) belong to server layouts (3.02), not middleware. `/dev/*` is reachable without login only when `NODE_ENV` is not production. Authed redirects need the login page (1.26) for a manual check; covered by unit tests now. `pnpm check` output not pasted; Bulbul confirmed it passed. |
| 2026-10-30 | 1.25 | `src/features/auth/{schemas,map-error,actions}.ts` (signUp, signIn, signOut, forgotPassword, resetPassword, resendConfirmation, startGoogleOAuth; all Zod `.strict()` first) and `src/app/auth/callback/route.ts` (code exchange, sanitized `next`, failure to `/login?error=callback`). New helpers `fieldErrorsFrom` / `failValidation`. New catalogue codes `E_INVALID_CREDENTIALS`, `E_EMAIL_NOT_CONFIRMED` added to `02_AppFlow §7` and `errors.ts`. `pnpm check` green, 44 tests. | 5725e58 | Doc exception used (new error codes). `?error=callback` on `/login` is my naming, to be handled in 1.26. forgotPassword/resend always return ok (only rate limit differs) so email existence is not revealed. Google OAuth needs credentials in Supabase (plan 4.13); action only builds the URL. |
| 2026-10-30 | 1.26 | Pages S02-S06 under `src/app/(auth)/` (signup, check-email with 60 s resend countdown, login, forgot-password, reset-password) with forms in `src/features/auth/components/`; `PasswordInput`, `FormError`, `useFormAction`; temporary `/dashboard` placeholder. Verified manually by Bulbul: signup, Inbucket confirm email, login with seed user, wrong-password message, unconfirmed message. | 39dec3f | New user with 0 orgs is sent to `/onboarding` (rule 3), which is a 404 until 1.27: expected. No logout yet (1.28): use a private window to switch users. Forms use plain state + the shared Zod schemas rather than react-hook-form. `/dashboard` placeholder replaced in 3.05. |
| 2026-10-30 | 1.27 | `src/features/orgs/{schemas,slug,actions}.ts` (`createOrganization`, `joinOrganization` via RPCs), `/onboarding` page (create card with auto slug, join card with upper-casing, tabs on mobile, "Back to dashboard" for users with orgs), `NativeSelect`, placeholder `/o/[orgSlug]/events` (404 for non-members via RLS). 14 unit tests. Verified manually by Bulbul: new user forced to onboarding, create, slug taken, join with code, invalid code. | dbb7e63 | `/o/[orgSlug]/events` placeholder replaced in 3.04; real membership layout in 3.02. `pnpm check` output not pasted this time; Bulbul confirmed pass. |

## Decisions & Deviations Log

Record here any approved change to the docs (what, why, who approved, date).

| Date | Doc | Change | Approved by |
|---|---|---|---|
| 2026-10-29 | 04_TRD §2 | Locked versions changed: pnpm 9.x → 12.x; Tailwind CSS 4.1 → 4.3 (installed by create-next-app; build passes) | Bulbul |
| 2026-10-29 | 04_TRD §2 | Added `tsx` (dev dependency) as the script runner for `pnpm seed` (`04_TRD §11` already used it but it was not in the locked stack) | Bulbul |
| 2026-10-29 | 05_Schema §6 `get_review_queue` | Exclude tasks assigned to the caller from their own review queue unless caller is event owner (matches self-verify rule in `transition_task_status`) | Bulbul |
| 2026-10-29 | 06_Plan 1.07/1.08 | Steps 1.07 and 1.08 done together: org guards `E_OWNS_EVENTS` and unassign-on-removal depend on `nodes` (created in 1.08) | Bulbul |
| 2026-10-29 | 04_TRD §2 | Locked versions changed to installed latest: @supabase/ssr 0.7→0.12, @hookform/resolvers 5.x→6.x, react-hook-form 7.6x→7.9x, lucide-react 0.5xx→1.x, vitest 3.x→5.x, @playwright/test 1.5x→1.6x | Bulbul |
| 2026-10-30 | 03_UI_Spec §2.1, §2.2 (todo), §2.4 (track), §9 | Theme changed from indigo to emerald green: primary, ring, backgrounds, surfaces, borders and foreground tokens now green-tinted in light and dark; status/priority colors (except todo), success, warning, danger, info unchanged; 100% progress fill still uses `--success` | Bulbul |
| 2026-10-30 | 04_TRD §2 | Added `sonner` (shadcn toast library) to the stack, resolved 2.0.8; used only through `src/components/ui/toaster.tsx` and `src/lib/toast.ts` | Bulbul |

## Parking Lot (ideas that are Non-Goals right now — do not build)

- Mobile app (React Native / Flutter, or PWA), notifications, realtime, file proofs, dependencies, kanban/gantt, templates, event cloning, ownership transfer, Bangla UI, CSV/PDF export, profile photo upload or photo URL (initials avatars only in MVP; `profiles.avatar_url` exists but has no UI).
