# 06 — Implementation Plan

> **This file is the live project tracker.** The coding agent MUST update it after every completed step (see `CLAUDE.md`).
> Order is by dependency: Phase 1 DB & Auth → Phase 2 Core API → Phase 3 UI Integration → Phase 4 Edge-case tests & hardening.
> Do steps strictly in order. Do not start a step until all previous steps in the same phase are ticked.

## Current Step

**Next up: `1.05`**
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
- [ ] **1.05** — Migration `…_extensions_enums`: extensions, `app_private` schema, all enums (`05_Schema §2`). _Done when:_ `db:reset` succeeds; enums exist.
- [ ] **1.06** — Migration `…_profiles`: table, `handle_new_user` trigger with `full_name`/`name`/email-prefix fallback. _Done when:_ pgTAP test creating an `auth.users` row produces a profile.
- [ ] **1.07** — Migration `…_organizations`: `organizations`, `org_members`, `generate_join_code`, last-admin / owns-events / unassign-on-removal triggers. _Done when:_ pgTAP tests for the three org guards pass.
- [ ] **1.08** — Migration `…_nodes`: `nodes` table, constraints, indexes, triggers `01_prepare`, `02_validate`, `04_progress_leaf`. _Done when:_ pgTAP tests for shape checks, `E_PARENT_IS_TASK`, `E_MAX_DEPTH`, `E_NODE_LIMIT`, `E_ASSIGNEE_NOT_IN_ORG`, `E_ROOT_IMMUTABLE` pass.
- [ ] **1.09** — Migration `…_event_tables`: `event_settings`, `event_members`, `node_updates` (+ immutability trigger, `event_id`/`user_id` forcing trigger); `nodes_03_guard` and `nodes_05_event_members` triggers. _Done when:_ pgTAP tests for lifecycle read-only, cascade-not-blocked, event_members sync pass.
- [ ] **1.10** — Migration `…_progress_rollup`: `recompute_progress_upwards`, `nodes_06_rollup`. _Done when:_ pgTAP parity test (cached progress == recursive CTE) passes after insert/delete/status/weight changes incl. empty segment.
- [ ] **1.11** — Migration `…_rls_helpers`: all functions in `05_Schema §4` with grants. _Done when:_ pgTAP tests exercise each helper for owner/head/assignee/outsider/admin.
- [ ] **1.12** — Migration `…_rls_policies`: enable RLS, base privileges, column grants, all policies of `05_Schema §5`. _Done when:_ pgTAP: RLS enabled on all tables; `anon` has no access; org-isolation tests pass; client cannot update `status`/`progress_cached`.
- [ ] **1.13** — Migration `…_rpc_orgs`: `create_organization`, `join_org_by_code`, `rotate_join_code`, `set_org_member_role`, `remove_org_member`. _Done when:_ pgTAP covers success + each error code.
- [ ] **1.14** — Migration `…_rpc_events`: `create_event`, `create_node`, `set_event_status`. _Done when:_ pgTAP covers creation, permission failures, lifecycle table.
- [ ] **1.15** — Migration `…_rpc_status`: `transition_task_status` per `05_Schema §6.1`. _Done when:_ pgTAP covers T1–T7 × roles × modes, stale state, comment-required, self-verify rule, inactive event.
- [ ] **1.16** — Migration `…_rpc_reads`: `get_event_tree`, `get_my_tasks`, `get_review_queue`. _Done when:_ pgTAP covers visibility and ordering.
- [ ] **1.17** — Complete pgTAP suite per `05_Schema §9` (fill any gap). _Done when:_ `pnpm test:db` is green and every item in §9 maps to at least one test file.
- [ ] **1.18** — `scripts/seed.ts` (refuses non-localhost URL): 2 orgs, 6 users (owner, 2 heads, 2 assignees, 1 outsider), one active event with ~25 nodes. _Done when:_ `pnpm seed` is idempotent and demo data visible via SQL.
- [ ] **1.19** — Generate types `pnpm db:types` → `src/types/database.ts`. _Done when:_ file committed; typecheck passes; CI-style diff check is clean.

**Auth plumbing**
- [ ] **1.20** — `src/lib/supabase/{client,server,middleware}.ts` with `@supabase/ssr`. _Done when:_ unit test or manual check shows server client reads session cookie.
- [ ] **1.21** — Design tokens: implement `globals.css` per `03_UI_Spec §9`, fonts (Inter, Noto Sans Bengali, JetBrains Mono), `next-themes`, shadcn init. _Done when:_ light/dark token swap visible on a test page; Bangla sample text renders.
- [ ] **1.22** — Auth-needed primitives (Button, Input, Label, FormField, Card, Toast/Sonner, ThemeToggle) per `03_UI_Spec §8`. _Done when:_ all states (hover/focus/disabled/loading/error) verified in both themes.
- [ ] **1.23** — `src/lib/errors.ts` (ErrorCode union + message map from `02_AppFlow §7`) and `action-result.ts`. Add missing codes to `02_AppFlow §7` if discovered. _Done when:_ unit tests map every code to a message and unknown → `E_UNKNOWN`.
- [ ] **1.24** — `middleware.ts` route guards per `02_AppFlow §2` (session refresh, redirects, `next` sanitization). _Done when:_ unit tests for `sanitizeNext`; manual: guest → `/login?next=…`, authed → `/dashboard`.
- [ ] **1.25** — Auth Server Actions + Zod schemas: signUp, signIn, signOut, forgotPassword, resetPassword, resend confirmation, Google OAuth start; `auth/callback` route. _Done when:_ schemas unit-tested; generic error wording per `02_AppFlow` verified.
- [ ] **1.26** — Pages S02–S06 (signup, check-email, login, forgot, reset) per `02_AppFlow §4`. _Done when:_ full email signup → confirm (Inbucket local) → login works; wrong password and unconfirmed states render correct messages.
- [ ] **1.27** — Org Server Actions (`createOrganization`, `joinOrganization`) + S07 Onboarding page. _Done when:_ new user is forced to `/onboarding`, can create or join, lands on `/o/{slug}/events` (placeholder page ok).
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

## Decisions & Deviations Log

Record here any approved change to the docs (what, why, who approved, date).

| Date | Doc | Change | Approved by |
|---|---|---|---|
| 2026-10-29 | 04_TRD §2 | Locked versions changed: pnpm 9.x → 12.x; Tailwind CSS 4.1 → 4.3 (installed by create-next-app; build passes) | Bulbul |
| 2026-10-29 | 04_TRD §2 | Locked versions changed to installed latest: @supabase/ssr 0.7→0.12, @hookform/resolvers 5.x→6.x, react-hook-form 7.6x→7.9x, lucide-react 0.5xx→1.x, vitest 3.x→5.x, @playwright/test 1.5x→1.6x | Bulbul |

## Parking Lot (ideas that are Non-Goals right now — do not build)

- Mobile app (React Native / Flutter, or PWA), notifications, realtime, file proofs, dependencies, kanban/gantt, templates, event cloning, ownership transfer, Bangla UI, CSV/PDF export.
