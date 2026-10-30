# 02 — App Flow

> Defines every screen, route, state machine, button action and error/empty state.
> Role names and rules come from `01_PRD.md`. Data names come from `05_Schema.md`.
> Framework: Next.js App Router (see `04_TRD.md`). All routes below are relative to the site root.

---

## 1. Global Conventions

| Topic | Rule |
|---|---|
| Layout | Auth pages: centered card, no app shell. App pages: shell with top bar (logo, org switcher, theme toggle, user menu) + left nav (≥ lg) or bottom sheet nav (< lg). |
| Loading | Every route segment has `loading.tsx` with skeletons (no spinners for page loads). Buttons show inline spinner + disabled state while a mutation runs. |
| Mutations | Next.js Server Actions returning `ActionResult<T> = { ok: true, data: T } \| { ok: false, code: ErrorCode, message: string, fieldErrors?: Record<string,string> }`. UI never throws for expected errors. |
| Feedback | Success → toast (3 s). Recoverable error → inline message near the control + toast. Unexpected error → error boundary with "Try again". |
| Confirmations | Destructive actions (delete node/event, remove member, reopen verified task) use a confirm Dialog with explicit consequence text. |
| Dates | Display with `Intl.DateTimeFormat` in browser timezone; relative text ("in 2 days", "3 days overdue") plus absolute date in tooltip. |
| Permission gating | UI hides actions the user cannot perform (using `lib/permissions.ts`). The database is the real enforcement; if it still rejects, show the mapped error from §7. |
| 404 policy | If a resource exists but the user may not see it, respond **404** (never 403) to avoid leaking existence. |
| Optimistic UI | Not used in MVP except checkbox/status controls using `useOptimistic`, which must roll back on error. |

## 2. Route Map

| Route | Screen ID | Access | Notes |
|---|---|---|---|
| `/` | S01 | Public | Landing. Authed users → `/dashboard`. |
| `/signup` | S02 | Guest only | |
| `/signup/check-email` | S03 | Guest only | `?email=` shown |
| `/login` | S04 | Guest only | `?next=` supported (relative paths only) |
| `/forgot-password` | S05 | Guest only | |
| `/reset-password` | S06 | Recovery session | |
| `/auth/callback` | — | Route handler | OAuth + email-confirm code exchange, then redirect |
| `/onboarding` | S07 | Authed, any | Forced when user has 0 orgs |
| `/dashboard` | S08 | Authed + ≥1 org | Cross-org personal dashboard |
| `/o/[orgSlug]/events` | S09 | Org member | Events list of the org |
| `/o/[orgSlug]/events/new` | S10 | Org member | |
| `/o/[orgSlug]/events/[eventId]` | S11 | Event viewer | Tree view. `?node=<id>` opens Node Detail (S12). `?filter=all\|mine\|overdue\|review` |
| `/o/[orgSlug]/events/[eventId]/settings` | S14 | Owner | |
| `/o/[orgSlug]/members` | S15 | Org member (manage = admin) | |
| `/o/[orgSlug]/settings` | S16 | Org admin | |
| `/settings/profile` | S17 | Authed | |
| `*` | S18 | Any | `not-found.tsx`, `error.tsx`, `global-error.tsx` |

### Guard rules (implemented in `middleware.ts` + server layouts)

1. No session + route not public → redirect `/login?next=<original path+query>`.
2. Session + route in {`/login`,`/signup`,`/forgot-password`} → redirect `/dashboard`.
3. Session + 0 org memberships + route ≠ `/onboarding`, `/settings/profile`, `/auth/*` → redirect `/onboarding`.
4. Session + ≥1 org + `/onboarding` → allowed (user may join another org) but shows "Back to dashboard".
5. `/o/[orgSlug]/*` where user is not a member → 404.
6. `/o/[orgSlug]/events/[eventId]` where user cannot view event (RLS returns no row) → 404.
7. `/o/.../settings` for event where user is not Owner → 404. `/o/[orgSlug]/settings` where user not admin → 404.
8. `next` param must start with `/` and not `//`; otherwise ignored.

## 3. Auth & Session State Machine

```
                 ┌────────────┐  submit signup   ┌──────────────────┐
  (visit)  ───►  │ ANONYMOUS  │ ───────────────► │ PENDING_CONFIRM  │
                 └─────┬──────┘                  └────────┬─────────┘
                       │ Google OAuth ok                  │ click email link
                       │                                  ▼
                       │                          ┌───────────────┐
                       └────────────────────────► │ AUTHED_NO_ORG │
                         login ok (0 orgs)  ────► └───────┬───────┘
                                                          │ create org / join org
                                                          ▼
                                                 ┌────────────────┐
                                    login ok ──► │ AUTHED_WITH_ORG│ ──logout──► ANONYMOUS
                                    (≥1 org)     └────────────────┘
  Session expiry / refresh failure (any AUTHED state) ──► ANONYMOUS + toast "Session expired, please log in"
```

## 4. Screen Specifications

Legend: **[B]** button/control → action → result. **Empty**, **Loading**, **Errors** specified per screen.

### S01 — Landing `/`
- Content: product name, one-line value prop, buttons **[Sign up]** → `/signup`, **[Log in]** → `/login`.
- Authed: server redirect to `/dashboard`.

### S02 — Sign up `/signup`
- Fields: Full name, Email, Password (show/hide toggle), **[Continue with Google]**.
- **[Create account]** → validate (Zod) → `supabase.auth.signUp` → success → `/signup/check-email?email=…`.
- Errors: field validation inline (name 1–100, email format, password ≥ 10 chars with at least 1 letter and 1 digit); `E_EMAIL_TAKEN` → "An account with this email may already exist. Try logging in." (generic wording; do not confirm existence); `E_RATE_LIMIT` → "Too many attempts. Try again in a few minutes."
- Link: "Already have an account? Log in".

### S03 — Check email `/signup/check-email`
- Shows: "We sent a confirmation link to {email}".
- **[Resend email]** → resend (cooldown 60 s, button shows countdown). Missing `email` param → redirect `/signup`.

### S04 — Log in `/login`
- Fields: Email, Password, **[Log in]**, **[Continue with Google]**, link "Forgot password?", link "Create account".
- Success → `next` or `/dashboard` (or `/onboarding` if 0 orgs).
- Errors: wrong credentials → "Incorrect email or password." (same message for unknown email); unconfirmed email → "Please confirm your email first." + **[Resend]**; rate limit message as S02.

### S05 — Forgot password `/forgot-password`
- Field: Email. **[Send reset link]** → always shows "If an account exists, we sent a link." (no enumeration).

### S06 — Reset password `/reset-password`
- Requires recovery session; otherwise redirect `/forgot-password` with toast "Link expired".
- Fields: New password, Confirm. **[Update password]** → success → `/dashboard` + toast.

### S07 — Onboarding `/onboarding`
- Two cards (tabs on mobile): **Create an organization** and **Join with a code**.
- Create: Name (2–100), Slug (auto from name, editable, 3–48 chars `a-z0-9-`), Type (Club / Organization / University program / Other). **[Create]** → `create_organization` RPC → redirect `/o/{slug}/events`.
- Join: Code input (auto-uppercase, trims spaces). **[Join]** → `join_org_by_code` RPC → redirect `/o/{slug}/events`.
- Errors: `E_SLUG_TAKEN` → inline on slug "This URL name is taken"; `E_INVALID_JOIN_CODE` → "Invalid or expired code".

### S08 — Dashboard `/dashboard`
Sections (in order):
1. **Needs my review** (only if user is a strict manager of any `submitted` task): rows = task title, event, assignee, submitted time. **[Review]** → opens S12 on that node. Empty → section hidden.
2. **My tasks**: grouped Overdue / Due this week / Later / No due date. Row = checkbox-less status badge, title, event name, due date. Click → S11 with `?node=`. Empty → EmptyState "Nothing assigned to you yet." (no CTA).
3. **My events**: cards = title, org, status badge, overall progress, my role chip (Owner / Head / Assignee). Click → S11. Empty → EmptyState "You're not part of any event yet." + **[Create event]** → `/o/{lastOrgSlug}/events/new`.
- Org switcher in top bar lists orgs; selecting one → `/o/{slug}/events`.

### S09 — Events list `/o/[orgSlug]/events`
- Header: org name, **[New event]** → S10.
- Tabs: Active (draft + active) | Completed | Archived. Card = title, dates, status badge, progress, Owner avatar.
- Org admins see all events; others see only events they participate in.
- Empty (Active tab) → "No events yet" + **[Create your first event]**. Empty (other tabs) → short text, no CTA.

### S10 — New event `/o/[orgSlug]/events/new`
- Fields: Title*, Description, Start (datetime), End (datetime), Location, Review mode (radio: "Assignees submit, managers verify (recommended)" / "Managers tick tasks directly").
- **[Create event]** → `create_event` RPC → redirect S11 of new event with toast "Event created as draft".
- Errors: end < start → inline on End.

### S11 — Event tree `/o/[orgSlug]/events/[eventId]`
- **Header**: title, status badge (draft/active/completed/archived), overall progress bar, dates/location, buttons by role:
  - Owner: **[Activate event]** (draft), **[Mark completed]** (active), **[Reopen]** (completed), **[Archive]** (completed), **[Settings]**.
  - Draft banner for all: "Draft — task updates are disabled until the owner activates the event."
  - Completed/archived banner: "This event is read-only."
- **Filters**: segmented control All | Mine | Overdue | Needs review (updates `?filter=`). Filtered views show matching tasks with their ancestor chain collapsed into a breadcrumb.
- **Tree** (see TreeNodeRow in `03_UI_Spec.md`): each row = chevron (if children), type icon, title, assignee avatar+name (or "Unassigned" warning chip), right side: segment → progress bar + %; task → status badge, due date.
- **Row actions** (⋮ menu, shown only if permitted):
  - On event/segment where user is Manager: **Add segment**, **Add task**.
  - On non-root node where user is Strict Manager: **Edit**, **Reassign**, **Delete**.
  - On task: status actions per §5 for the current user (e.g. **Start**, **Submit for review**, **Verify**, **Send back**).
- **Verify tick**: managers see a ✔ icon button directly on rows whose task can be verified by them (`submitted` in Mode A; any non-verified in Mode B). Click → transition to `verified` (no comment needed).
- Clicking a row (not on a control) → sets `?node=<id>` → S12.
- **Empty (no children under event)**: Owner → "Start by adding your first segment" + **[Add segment]**; others → "The owner hasn't added any segments yet."
- **Empty segment**: inline muted row "No tasks yet" + **[Add task]** if Manager.
- **Filtered empty**: "No tasks match this filter." + **[Clear filter]**.
- **Errors**: tree load fail → error boundary with **[Try again]**. Mutation errors per §7.

### S12 — Node detail panel (`?node=<id>`)
- Desktop: right drawer 440 px. Mobile: full-screen sheet. Close (✕ / Esc / backdrop) removes `?node`.
- Content: breadcrumb (ancestors, clickable), type chip, title, description, assignee, due date, priority, weight, status (tasks) or progress + children summary (segments), **Actions** (per §5), **Activity** timeline (newest first), **Comment composer** (textarea ≤ 2000 chars, optional "Proof link" URL input, **[Post]**).
- Status actions that require a comment (Send back, Reopen) open an inline required textarea before confirming.
- Composer visible only to assignee of the node and its managers, and only when event is `active` or `draft`.
- Invalid/unviewable `node` id → panel closes and toast "That item no longer exists".
- Errors: `E_STALE_STATE` → toast "This task was just updated by someone else" + refetch.

### S13 — Add / Edit node dialog
- Fields: Type is implied (segment/task), Title*, Description, Assignee (searchable select of org members; "Unassigned" allowed), Due date (tasks & segments), Priority (tasks), Weight (1–10, default 1).
- **[Save]** → `create_node` or update → close dialog, refresh tree, toast.
- Errors: `E_MAX_DEPTH` → "Maximum nesting depth reached"; `E_NODE_LIMIT` → "This event reached the 1000-node limit"; `E_ASSIGNEE_NOT_IN_ORG`; `E_EVENT_READONLY`.

### S14 — Event settings `…/events/[eventId]/settings` (Owner)
- Edit: title, description, dates, location, review mode.
- Changing review mode shows note: "Tasks already submitted stay submitted; managers can verify them."
- Danger zone: **[Delete event]** (enabled only in `draft`/`archived`; confirm by typing the event title) → redirect `/o/{slug}/events`.

### S15 — Members `/o/[orgSlug]/members`
- Table: avatar, name, email, role, joined date. Admin controls: role select (Admin/Member), **[Remove]**.
- Admin panel: join code (masked, **[Copy]**, **[Rotate]** with confirm).
- Non-admin: read-only list + **[Leave organization]**.
- Errors: `E_LAST_ADMIN`, `E_OWNS_EVENTS` → "Transfer or delete this user's events first (events they own: N)."

### S16 — Organization settings `/o/[orgSlug]/settings` (admin)
- Edit name and type. (Slug is immutable in MVP.)

### S17 — Profile `/settings/profile`
- Edit full name; show email (read-only); theme preference radio (System/Light/Dark); **[Log out]**.

### S18 — Error pages
- 404: "We couldn't find that page." + **[Go to dashboard]**.
- 500/error boundary: "Something went wrong." + **[Try again]** + **[Go to dashboard]**.

## 5. Task Status State Machine (authoritative)

Statuses: `todo`, `in_progress`, `submitted`, `verified`.
Precondition for **every** transition: event status = `active`.
"Manager" below = **Strict Manager** of the task. "Verifier" = Strict Manager who is not the task's assignee, **or** the Owner.

| # | From | To | Who may do it | Mode | Comment |
|---|---|---|---|---|---|
| T1 | `todo` | `in_progress` | Assignee or Manager | A, B | optional |
| T2 | `in_progress` | `todo` | Assignee or Manager | A, B | optional |
| T3 | `in_progress` | `submitted` | Assignee | A only | optional |
| T4 | `submitted` | `verified` | Verifier | A | optional |
| T5 | `submitted` | `in_progress` (send back) | Manager | A | **required** |
| T6 | `todo` / `in_progress` | `verified` | Verifier | B only | optional |
| T7 | `verified` | `in_progress` (reopen) | Manager | A, B | **required** |

Anything else → `E_INVALID_TRANSITION`. If the caller's `from` does not match the DB's current status → `E_STALE_STATE`.

```
        T1                T3                 T4
 todo ─────► in_progress ─────► submitted ─────────► verified
   ▲  T2        ▲   ▲   (Mode A)   │                    │
   └─────────────┘   └──── T5 ─────┘                    │
                     ▲ (send back, comment required)    │
                     └──────────── T7 (reopen) ─────────┘
 Mode B: todo/in_progress ──T6──► verified
```

## 6. Event Lifecycle State Machine

| From | To | Who | Rules |
|---|---|---|---|
| `draft` | `active` | Owner | Warn if unassigned nodes exist (non-blocking) |
| `active` | `completed` | Owner | Warn if progress < 100 |
| `completed` | `active` | Owner | Reopen |
| `completed` | `archived` | Owner | |
| `archived` | `completed` | Owner | Unarchive |

Writes allowed per status: `draft` → structure edits only; `active` → structure edits + status transitions + comments; `completed`/`archived` → none.

## 7. Error Catalogue

Database/RPC errors are raised as `raise exception 'E_CODE'`; the Server Action maps `error.message` to `ErrorCode` and the UI message below. Unknown codes → `E_UNKNOWN`.

| Code | UI message |
|---|---|
| `E_NOT_AUTHORIZED` | "You don't have permission to do that." |
| `E_NOT_FOUND` | "That item no longer exists." |
| `E_INVALID_TRANSITION` | "That action isn't available for this task right now." |
| `E_STALE_STATE` | "This task was just updated by someone else. We've refreshed it." |
| `E_COMMENT_REQUIRED` | "Please add a comment explaining why." |
| `E_EVENT_NOT_ACTIVE` | "Task updates are only available while the event is active." |
| `E_EVENT_READONLY` | "This event is read-only." |
| `E_ASSIGNEE_NOT_IN_ORG` | "You can only assign people from this organization." |
| `E_INVALID_JOIN_CODE` | "Invalid or expired code." |
| `E_SLUG_TAKEN` | "This URL name is taken." |
| `E_LAST_ADMIN` | "An organization must keep at least one admin." |
| `E_OWNS_EVENTS` | "This member owns events. Resolve those first." |
| `E_MAX_DEPTH` | "Maximum nesting depth reached." |
| `E_PARENT_IS_TASK` | "Tasks can't contain other items." |
| `E_NODE_LIMIT` | "This event reached the 1000-item limit." |
| `E_ROOT_IMMUTABLE` | "The event owner can't be changed." |
| `E_EMAIL_TAKEN` | "An account with this email may already exist. Try logging in." |
| `E_INVALID_CREDENTIALS` | "Incorrect email or password." |
| `E_EMAIL_NOT_CONFIRMED` | "Please confirm your email first." |
| `E_VALIDATION` | Field-level messages from Zod |
| `E_RATE_LIMIT` | "Too many attempts. Try again in a few minutes." |
| `E_NETWORK` | "Can't reach the server. Check your connection and retry." |
| `E_UNKNOWN` | "Something went wrong. Please try again." |

## 8. Navigation Summary (primary paths)

```
/login ─► /dashboard ─► /o/{org}/events ─► /o/{org}/events/{id}?node=… (S12)
   │                         │                    └─► /settings (Owner)
   └─► /onboarding           └─► /events/new
/o/{org}/members  ·  /o/{org}/settings  ·  /settings/profile  (via user menu / left nav)
```

Left nav items (≥ lg): Dashboard, Events, Members, Org settings (admin only). Bottom/sheet nav (< lg): same items.
