# 04 — Technical Requirements Document (TRD)

> The tech stack below is **LOCKED**. Do not add, swap or upgrade dependencies without explicit approval.
> Related: `01_PRD.md` (what), `05_Schema.md` (data), `06_Plan.md` (order of work).

---

## 1. Architectural Principles

1. **Business rules live in Postgres** (constraints, triggers, RLS policies, RPC functions). The web app is a thin client. This lets the future mobile app reuse 100% of the rules by calling the same Supabase API.
2. **The database is the security boundary.** Every table has RLS enabled. UI permission checks (`lib/permissions.ts`) are for UX only and must mirror, never replace, DB rules.
3. **Server-first rendering.** Read data in Server Components; mutate via Server Actions that call Supabase with the user's session (never with the service-role key).
4. **No custom auth claims.** Authority is derived from the tree at query time, so there are no stale tokens when assignments change.
5. **Boring technology, strict types.** TypeScript strict, generated DB types, Zod at every boundary.

## 2. Locked Stack & Versions

Versions are locked at **major.minor**. Step 1.02 of `06_Plan.md` must verify each exists on the registry (`pnpm view <pkg> versions`), install the latest patch of that minor, commit the lockfile, and **write the exact installed versions into the "Resolved" column below**. If a listed minor does not exist, stop and ask.

| Layer | Choice | Locked version | Resolved (fill in step 1.02) |
|---|---|---|---|
| Runtime | Node.js LTS | 22.x | 22.x (`.nvmrc` = 22; local v22) |
| Package manager | pnpm | 12.x | 12.16.1 |
| Language | TypeScript | 5.9 | 5.9.3 |
| Framework | Next.js (App Router, `src/` dir, **no Pages Router**) | 15.5 | 15.5.28 |
| UI library | React / React DOM | 19.1 | 19.1.0 |
| Styling | Tailwind CSS | 4.3 | 4.3.3 (+ @tailwindcss/postcss 4.3.3) |
| Components | shadcn/ui (CLI-generated, copied into `src/components/ui`) | CLI latest at install; components pinned by commit | Added on demand with `pnpm dlx shadcn@latest add`; CLI version recorded when first used |
| Primitives | Radix UI (via shadcn) | as pulled by shadcn | Resolved when first shadcn component is added |
| Icons | lucide-react | 1.x (latest at install) | 1.62.0 |
| Theming | next-themes | 0.4 | 0.4.6 |
| Backend platform | Supabase (Postgres 15+, Auth, PostgREST) | managed | Local: Supabase CLI 2.122.0 stack; Cloud: managed |
| Supabase JS | @supabase/supabase-js | 2.x (latest 2) | 2.118.0 |
| Supabase SSR | @supabase/ssr | 0.12 | 0.12.7 |
| Supabase CLI | supabase (dev dependency) | 2.x (latest 2) | 2.122.0 |
| Validation | zod | 4.x | 4.6.7 |
| Forms | react-hook-form + @hookform/resolvers | 7.9x + 6.x | react-hook-form 7.91.0 + @hookform/resolvers 6.0.1 |
| Dates | date-fns | 4.x | 4.4.0 |
| Toasts | sonner (shadcn toast) | latest at install | 2.0.8 |
| Class utils | clsx, tailwind-merge, class-variance-authority | latest at install | clsx 2.1.1, tailwind-merge 3.7.0, class-variance-authority 0.7.1 |
| Unit/integration tests | vitest + @testing-library/react + jsdom | vitest 5.x | vitest 5.0.5, @testing-library/react 16.3.3, @testing-library/jest-dom 7.0.1, jsdom 30.1.3, @vitejs/plugin-react 6.1.2 |
| E2E tests | @playwright/test | 1.6x (latest at install) | 1.64.1 |
| DB tests | pgTAP via `supabase test db` | bundled | Bundled with Supabase CLI 2.122.0 |
| Script runner | tsx (dev dependency, used only by `pnpm seed`) | latest at install | 4.23.15 |
| Lint/format | ESLint (next/core-web-vitals + typescript-eslint), Prettier + prettier-plugin-tailwindcss | latest at install | ESLint 9.39.5 + eslint-config-next 15.5.28; Prettier 3.9.10 + prettier-plugin-tailwindcss 0.8.1 |
| CI | GitHub Actions | — | n/a (service) |
| Hosting | Vercel (web) + Supabase Cloud (DB/Auth) | n/a (service) |

**Explicitly NOT in the stack (do not install):** Redux/Zustand/MobX, TanStack Query, tRPC, Prisma/Drizzle (DB access is via supabase-js and SQL migrations), Express/Nest, GraphQL, Firebase, NextAuth/Auth.js, Moment.js, Axios, any CSS-in-JS library, any component library other than shadcn/ui, Storybook, Sentry (not in MVP).

## 3. Third-Party Services & APIs

| Service | Purpose | Notes |
|---|---|---|
| Supabase Auth | Email+password, Google OAuth, password reset, session cookies | Email confirmation **ON**. Min password length 10. Enable leaked-password protection if the plan allows. |
| Supabase Postgres | Primary datastore | Extensions: `ltree`, `pgcrypto`. |
| Supabase PostgREST | Auto API used by `supabase-js` | Exposed schema: `public` only. `app_private` is **not** exposed. |
| Google Cloud OAuth | Google sign-in | Credentials set in Supabase dashboard; redirect URL = `{SUPABASE_URL}/auth/v1/callback`. |
| SMTP provider (Resend) | Production auth emails | Supabase's default mailer is heavily rate-limited — configure custom SMTP before launch (plan step 4.11). |
| Vercel | Hosting, preview deploys, env vars | Region closest to Supabase project. |

No other third-party APIs. No analytics/tracking scripts in MVP.

## 4. Environment Variables

| Name | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | Anon/publishable key (safe to expose; protected by RLS) |
| `NEXT_PUBLIC_SITE_URL` | client+server | Canonical site URL (used for auth redirects) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server scripts only** | Used **only** by `scripts/seed.ts` against a **local** Supabase. Must never be imported by `src/`. Never set in Vercel. |

`.env.example` is committed; `.env.local` is git-ignored. Env access goes through `src/lib/env.ts` (Zod-validated; throws at boot if invalid).

## 5. Folder Structure (authoritative)

```
/
├─ CLAUDE.md
├─ .cursorrules
├─ docs/                      # the 6 context docs (this folder)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/             # timestamped SQL, one concern per file (see 06_Plan Phase 1)
│  ├─ tests/                  # pgTAP *.test.sql
│  └─ seed.sql                # (optional minimal data; real seeding in scripts/seed.ts)
├─ scripts/
│  └─ seed.ts                 # local-only demo data via service role (guards: URL must be localhost)
├─ src/
│  ├─ middleware.ts           # session refresh + route guards (02_AppFlow §2)
│  ├─ app/
│  │  ├─ layout.tsx           # fonts, ThemeProvider, Toaster
│  │  ├─ globals.css          # tokens from 03_UI_Spec §9
│  │  ├─ page.tsx             # S01
│  │  ├─ not-found.tsx · error.tsx · global-error.tsx
│  │  ├─ (auth)/              # login, signup, signup/check-email, forgot-password, reset-password
│  │  ├─ auth/callback/route.ts
│  │  ├─ onboarding/
│  │  ├─ dashboard/
│  │  ├─ settings/profile/
│  │  └─ o/[orgSlug]/
│  │     ├─ layout.tsx        # org membership check + shell
│  │     ├─ events/{page,loading}.tsx
│  │     ├─ events/new/page.tsx
│  │     ├─ events/[eventId]/{page,loading,error}.tsx
│  │     ├─ events/[eventId]/settings/page.tsx
│  │     ├─ members/page.tsx
│  │     └─ settings/page.tsx
│  ├─ components/
│  │  ├─ ui/                  # shadcn primitives (themed per 03_UI_Spec)
│  │  ├─ shell/               # TopBar, LeftNav, OrgSwitcher, ThemeToggle, UserMenu
│  │  ├─ tree/                # TreeView, TreeNodeRow, NodeDetailPanel, NodeFormDialog, StatusControls
│  │  └─ common/              # EmptyState, ProgressBar, StatusBadge, RoleChip, Avatar, ConfirmDialog
│  ├─ features/               # one folder per domain; no cross-imports except via index.ts
│  │  ├─ auth/    {actions.ts, schemas.ts}
│  │  ├─ orgs/    {queries.ts, actions.ts, schemas.ts}
│  │  ├─ events/  {queries.ts, actions.ts, schemas.ts}
│  │  ├─ nodes/   {queries.ts, actions.ts, schemas.ts}
│  │  └─ updates/ {queries.ts, actions.ts, schemas.ts}
│  ├─ lib/
│  │  ├─ supabase/{client.ts, server.ts, middleware.ts}
│  │  ├─ env.ts · errors.ts (ErrorCode map, §7 of 02_AppFlow) · action-result.ts
│  │  ├─ permissions.ts       # UI-gating mirror of RLS (unit-tested)
│  │  ├─ status.ts            # allowed transitions (mirrors transition_task_status)
│  │  ├─ progress.ts          # roll-up math (mirrors DB; used for tests/optimistic display)
│  │  ├─ tree.ts              # flat rows -> nested tree; filters
│  │  └─ utils.ts · dates.ts
│  └─ types/database.ts       # GENERATED by `pnpm db:types` — never edit by hand
├─ tests/
│  ├─ unit/                   # vitest, pure logic
│  ├─ integration/            # vitest against local Supabase (real RLS)
│  └─ e2e/                    # Playwright
├─ .github/workflows/ci.yml
├─ package.json · pnpm-lock.yaml · tsconfig.json · eslint.config.mjs · prettier.config.mjs
└─ .env.example · .nvmrc (22) · .gitignore
```

Rules: server-only modules import `"server-only"`. Client Components are the exception, marked `"use client"`, and never import from `features/*/queries.ts` or server clients. Import alias `@/*` → `src/*`. Max file length ≈ 300 lines; split by responsibility.

## 6. Data Access Pattern

- **Reads**: Server Components call functions in `features/*/queries.ts` which use `createServerClient()` (anon key + user cookies) → RLS applies automatically.
- **Writes**: Server Actions in `features/*/actions.ts`: (1) parse input with Zod, (2) call a Supabase RPC or table op, (3) map errors via `lib/errors.ts`, (4) `revalidatePath`, (5) return `ActionResult`.
- **Tree loading**: one RPC `get_event_tree(p_event)` returns flat rows; `lib/tree.ts` nests them. No N+1 queries.
- **Types**: all Supabase calls use the generated `Database` type. No `any`; no `as unknown as`.
- **No direct `fetch` to Supabase REST** from app code; always `supabase-js`.

## 7. Coding Standards

- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes: false`, `moduleResolution: bundler`.
- ESLint errors fail CI. `no-console` (allow `warn`/`error` in server code only).
- Naming: files `kebab-case.ts(x)`, React components `PascalCase`, DB objects `snake_case`, TS types from DB re-exported through `features/*`.
- All user-facing strings in components are English literals in MVP (no i18n library).
- Server Actions must be `async` functions exported from files starting with `"use server"`, and must validate with Zod **before** touching the DB.
- Git: Conventional Commits (`feat:`, `fix:`, `db:`, `test:`, `docs:`, `chore:`). One plan step ≈ one commit.

## 8. Security Constraints (non-negotiable)

1. **RLS enabled on every table in `public`**; no table is readable/writable by `anon`. A pgTAP test asserts `relrowsecurity = true` for all public tables.
2. `SECURITY DEFINER` functions: must `set search_path`, must check `auth.uid()`, must revoke `EXECUTE` from `public`/`anon`, grant only to `authenticated`.
3. `SUPABASE_SERVICE_ROLE_KEY` never appears in `src/`, never shipped to client or Vercel. CI greps for it.
4. Session cookies are managed by `@supabase/ssr` (httpOnly, secure, sameSite=lax). Do not store tokens in localStorage manually.
5. Validate all inputs with Zod on the server (never trust client validation). Reject unknown keys (`.strict()`).
6. XSS: render user content as plain text only (React escaping). **No `dangerouslySetInnerHTML`** anywhere. Proof links validated `^https?://` and rendered with `rel="noopener noreferrer nofollow" target="_blank"`.
7. Open redirect: `next` param must be a same-origin relative path (`/…`, not `//…`).
8. CSRF: rely on Server Actions' built-in origin checks; no custom state-changing GET routes. `auth/callback` is the only route handler.
9. Security headers (via `next.config.ts` `headers()`): `Content-Security-Policy` (default-src 'self'; connect-src 'self' + Supabase URL; img-src 'self' data: https: ; script-src 'self' 'unsafe-inline' only as required by Next, no `unsafe-eval` in prod), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` minimal, `Strict-Transport-Security` (Vercel default).
10. Auth responses must not reveal whether an email exists (login, forgot-password, join-code errors).
11. Rate limiting: rely on Supabase Auth limits for auth endpoints; join-code attempts are protected by 48-bit code entropy + Supabase API gateway limits (documented limitation).
12. Secrets never logged; no PII in `console.*`. Errors shown to users are the mapped messages only (no raw SQL/stack traces).
13. Dependencies: `pnpm audit --prod` must have no high/critical findings at release; Dependabot enabled.
14. Org isolation: every cross-org access attempt must fail at RLS and is covered by adversarial tests (Phase 4).

## 9. Performance Budgets

| Item | Budget |
|---|---|
| Tree page (500 nodes) server response | p95 ≤ 1.0 s (incl. DB) |
| `get_event_tree` query | ≤ 100 ms at 1000 nodes (verified with `EXPLAIN ANALYZE`) |
| Client JS on `/dashboard` (gzipped) | ≤ 200 KB first load |
| Lighthouse (mobile) | Performance ≥ 85, Accessibility ≥ 95 on `/login` and event tree |
| CLS | < 0.1 |

## 10. Browser & Device Support

Last 2 versions of Chrome, Edge, Safari (iOS 16+), Firefox; Android Chrome. Minimum viewport 360 px. JavaScript required.

## 11. Scripts (`package.json`)

| Script | Command |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run tests/unit` |
| `test:int` | `vitest run tests/integration` (requires local Supabase running) |
| `test:db` | `supabase test db` |
| `test:e2e` | `playwright test` |
| `db:start` / `db:stop` | `supabase start` / `supabase stop` |
| `db:reset` | `supabase db reset` |
| `db:types` | `supabase gen types typescript --local > src/types/database.ts` |
| `seed` | `tsx scripts/seed.ts` |
| `check` | `pnpm lint && pnpm typecheck && pnpm test` |

## 12. CI (GitHub Actions) — minimum jobs

1. `check`: install, lint, typecheck, unit tests.
2. `db`: start Supabase, `supabase db reset`, `supabase test db`, assert `db:types` produces no diff.
3. `integration`: run `test:int` against local Supabase.
4. `e2e`: build, run Playwright (chromium + mobile viewport) against local Supabase.
5. `security`: `pnpm audit --prod`, grep for `service_role` / `dangerouslySetInnerHTML` in `src/` (must find none).

## 13. Deployment

- Environments: **local** (Supabase CLI), **production** (Supabase Cloud + Vercel). Preview deployments may point to production DB only if disposable test accounts are used — default: no previews against prod.
- Migrations: applied with `supabase db push` from CI/manual; never edit the production DB via the dashboard SQL editor except emergencies (record in `06_Plan.md` log).
- Auth config (Site URL, redirect URLs, Google OAuth, SMTP) documented in plan step 4.11.

## 14. Future-Proofing Notes (do NOT implement now)

Mobile app will use `supabase-js` against the same RPCs and RLS. To keep that possible: do not put business logic only in Server Actions; every rule must be enforceable in SQL. Keep RPC names/arguments stable once released.
