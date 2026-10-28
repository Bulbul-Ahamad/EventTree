# 01 — Product Requirements Document (PRD)

> Working product name: **EventTree**
> Status: LOCKED for MVP. Changes require explicit approval from the product owner (Bulbul).
> Companion docs: `02_AppFlow.md`, `03_UI_Spec.md`, `04_TRD.md`, `05_Schema.md`, `06_Plan.md`.

---

## 1. Core Problem

Clubs, student organizations and university programs run events (fests, workshops, seminars, competitions) with volunteers who coordinate over chat groups and spreadsheets. This causes:

1. **No single source of truth** — nobody knows which parts of the event are done.
2. **No accountability** — tasks are "assigned" in a group chat; ownership is vague.
3. **No hierarchy of visibility** — an event owner cannot see, at a glance, which segment (Venue, Publicity, Registration…) is on track, and a segment head cannot see their own team's progress.
4. **No verification** — "done" is self-reported and never checked.

**EventTree models an event as a tree.** The event is the root; segments are subtrees; tasks are leaves. Every node has exactly one responsible person. Progress rolls up from leaves to root. People higher in the tree can see and verify everything below them.

## 2. Target Personas

| Persona | Real-world example | Primary need | Role in system |
|---|---|---|---|
| **P1 — Event Owner** (primary) | Club president, program coordinator, fest chairperson | See whole-event progress, structure the event, delegate | Event Owner (root assignee) |
| **P2 — Segment Head** | Publicity lead, venue lead, treasurer | Break their segment into tasks, assign members, verify their work | Segment Head (assignee of a segment node) |
| **P3 — Task Assignee / Volunteer** | General member, volunteer | Know exactly what is mine, mark progress, show proof | Task Assignee |
| **P4 — Org Admin** | Faculty adviser, club general secretary | Oversee all events of the organization (read-only) | Org Admin |

Context notes:
- Primary market: universities and clubs in Bangladesh (e.g. DUET) — users type content in **Bangla and English**; the UI must render Bangla text correctly. UI language itself is English in MVP.
- Mobile-first usage: most volunteers will open the product on a phone browser.

## 3. Glossary (use these exact terms in code, UI and docs)

| Term | Definition |
|---|---|
| **Organization** | A tenant: a club, organization or university program. Users belong to one or more. |
| **Event** | The root node of a tree. Belongs to one Organization. |
| **Segment** | An internal node (child of Event or another Segment). Has a **Head** (assignee). Max nesting by depth rule below. |
| **Task** | A leaf node. Cannot have children. Has one **Assignee** and a status. |
| **Node** | Generic word for Event, Segment or Task. |
| **Owner** | The assignee of the Event root node. Exactly one per event. |
| **Head** | The assignee of a Segment node. |
| **Manager (of node N)** | A user who is the assignee of N (if N is event/segment) or of any ancestor event/segment of N. |
| **Strict Manager (of node N)** | A user who is the assignee of any *ancestor* of N (excluding N itself). |
| **Review Mode** | Per-event setting: `assignee_submits` (Mode A) or `head_only` (Mode B). |
| **Progress** | 0–100 number per node, computed bottom-up (see BR-06). |

## 4. MVP Scope Summary

Web application (responsive, PWA-ready, mobile-first) with: email/Google auth, organizations, event tree builder, role-based task workflow with verification, progress roll-up, "My Tasks" dashboard, activity history, light/dark theme.

## 5. MVP User Stories

Format: **ID — As a [persona], I want …, so that …** + acceptance criteria (AC).

### 5.1 Accounts & Organizations

**US-01 — Sign up / log in.** As any user, I want to sign up and log in with email+password or Google, so that my work is tied to me.
- AC1: Email signup requires full name, valid email, password ≥ 10 chars; confirmation email must be clicked before first login.
- AC2: Google OAuth signup/login works and creates a profile automatically.
- AC3: "Forgot password" sends a reset link; reset page sets a new password.
- AC4: Logged-out access to any app route redirects to `/login?next=…`.

**US-02 — Create or join an organization.** As a new user, I want to create an organization or join one via a join code, so that I can collaborate with my club.
- AC1: Creating an organization makes me its Org Admin.
- AC2: Joining with a valid join code makes me a Member; an invalid code shows a generic error (no information leak).
- AC3: A user with zero organizations is always redirected to `/onboarding`.

**US-03 — Manage organization members.** As an Org Admin, I want to see members, rotate the join code, change roles and remove members, so that I control access.
- AC1: Cannot demote/remove the last admin.
- AC2: Cannot remove a member who owns an event (must be resolved first).
- AC3: Removing a member unassigns them from all nodes of that organization.

### 5.2 Building the Event Tree

**US-04 — Create an event.** As any org member, I want to create an event (title, description, dates, location, review mode), so that a new tree root exists.
- AC1: I become the Owner automatically; event starts in `draft`.
- AC2: Title required (1–200 chars). End date ≥ start date.

**US-05 — Structure the event.** As an Owner, I want to add segments (nested) and assign a Head to each, so that responsibility is clear.
- AC1: Segment requires title; Head optional at creation but flagged "Unassigned" until set.
- AC2: Assignee must be a member of the same organization.
- AC3: Max depth 6 (event = depth 0); max 1000 nodes per event.

**US-06 — Break down a segment.** As a Head, I want to add sub-segments and tasks inside my segment and assign people, so that my team knows their work.
- AC1: I can create nodes only inside subtrees I manage.
- AC2: Task fields: title, description, assignee, due date, priority, weight (1–10, default 1).

**US-07 — View the tree.** As any event participant, I want to see the tree with per-node progress, status and assignee, so that I understand the event at a glance.
- AC1: Expand/collapse per node; state remembered per event on this device.
- AC2: Segment rows show progress bar + %; task rows show status badge; overdue is highlighted.
- AC3: Filters: All / Mine / Overdue / Needs review.

**US-08 — Activate the event.** As an Owner, I want to move the event from `draft` to `active`, so that assignees can start updating tasks.
- AC1: In `draft`, structure can be edited but task statuses cannot change.
- AC2: Owner is warned (not blocked) if any segment has no Head or any task has no Assignee.

### 5.3 Doing & Verifying Work

**US-09 — My Tasks.** As an assignee, I want one list of all tasks assigned to me across events, so that I know what to do.
- AC1: Grouped: Overdue, Due this week, Later, No due date. Shows event name and status.

**US-10 — Update my task.** As an Assignee, I want to set status (To Do ↔ In Progress), add comments and proof links, so that my manager sees progress.
- AC1: Allowed only when event is `active`.
- AC2: Proof link must start with `http://` or `https://`.

**US-11 — Submit & verify (Mode A).** As an Assignee, I want to submit a finished task for review; as a Manager, I want to verify it or send it back with a comment.
- AC1: Send back and reopen require a comment.
- AC2: A manager cannot verify their own assigned task unless they are the Owner.

**US-12 — Direct check mark (Mode B).** As a Head (strict manager), I want to tick tasks as verified myself, so that small teams skip the submit step.
- AC1: In Mode B, assignees cannot submit; only managers can mark `verified`.

**US-13 — Progress roll-up & dashboard.** As an Owner/Head, I want segment and event progress computed automatically and an overdue/needs-review list, so that I can act early.
- AC1: Progress changes immediately after a task is verified/reopened/added/removed.
- AC2: Dashboard shows "Needs my review" queue and "My events" with progress.

**US-14 — Activity history.** As any participant, I want a per-node timeline (status changes, comments, proof links, who and when), so that there is an audit trail.
- AC1: History entries are immutable (no edit/delete in UI or DB).

**US-15 — Edit, reassign, delete nodes.** As a Strict Manager, I want to edit, reassign or delete nodes below me.
- AC1: Deleting a node with children shows a confirmation with the count of nodes that will be deleted.
- AC2: Reassigning away from a user removes their access to the event if they have no other assignment in it.

**US-16 — Complete the event.** As an Owner, I want to mark the event `completed` (read-only) and later `archived`.
- AC1: Completion allowed at any progress; UI warns if < 100%.
- AC2: Completed/archived events reject all node/status writes. Owner may reopen a completed event.

### 5.4 Experience

**US-17 — Theme.** As any user, I want light/dark/system theme, so that I can use the app comfortably.
- AC1: Default = system. Choice persists across sessions.

## 6. Business Rules (authoritative)

| ID | Rule |
|---|---|
| **BR-01** | One assignee per node. Event node assignee = Owner and **cannot be changed in MVP**. |
| **BR-02** | Authority flows **down** the tree: the assignee of an event/segment manages that whole subtree. |
| **BR-03** | Visibility: a user can view an event iff they are assigned to at least one node in it (including the root) **or** are an Org Admin of its organization. |
| **BR-04** | Tasks cannot have children. Segments can have segments and tasks. |
| **BR-05** | Task statuses: `todo`, `in_progress`, `submitted`, `verified`. Segments/events have no status — only derived progress. |
| **BR-06** | Task progress = 100 if `verified`, else 0. Segment/event progress = weighted average of **direct children** progress (weight = child's `weight`). A segment with no children has progress 0 and still counts in its parent's average. |
| **BR-07** | Review Mode A (`assignee_submits`): `todo → in_progress → submitted → verified`. Mode B (`head_only`): managers set `verified` directly from `todo` or `in_progress`; `submitted` is unused. |
| **BR-08** | Transition table in `02_AppFlow.md §5` is the only legal set of status changes. All transitions go through the DB function `transition_task_status`. |
| **BR-09** | Overdue = `due_at < now()` AND status ≠ `verified` AND event is `active`. |
| **BR-10** | Event lifecycle: `draft → active → completed → archived` (+ `completed → active` reopen, `archived → completed` unarchive). Node writes are allowed only in `draft`/`active`; status transitions only in `active`. |
| **BR-11** | Users cannot assign nodes to people outside the event's organization. |
| **BR-12** | Activity history is append-only. |
| **BR-13** | Org Admins have read-only visibility of events; they are not managers unless also assigned. |

## 7. Permission Matrix

| Action | Org Admin (not assigned) | Owner | Head (of ancestor/self segment) | Task Assignee | Other org member |
|---|---|---|---|---|---|
| View event tree & history | ✅ | ✅ | ✅ | ✅ | ❌ (404) |
| Edit event settings, lifecycle | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create child under node N | ❌ | ✅ | ✅ if Manager of N | ❌ | ❌ |
| Edit / reassign / delete node N | ❌ | ✅ | ✅ if Strict Manager of N | ❌ | ❌ |
| `todo ↔ in_progress` | ❌ | ✅ | ✅ if Strict Manager | ✅ own task | ❌ |
| Submit (`in_progress → submitted`), Mode A | ❌ | ❌* | ❌* | ✅ own task | ❌ |
| Verify / send back / reopen | ❌ | ✅ | ✅ if Strict Manager (not own task) | ❌ | ❌ |
| Mark verified directly (Mode B) | ❌ | ✅ | ✅ if Strict Manager (not own task) | ❌ | ❌ |
| Comment / add proof link on N | ❌ | ✅ | ✅ if Manager of N | ✅ own task | ❌ |
| Delete event | ❌ | ✅ only in `draft`/`archived` | ❌ | ❌ | ❌ |

\* A manager who is also the assignee of a task may submit it as assignee; verification must then come from another strict manager (or the Owner).

## 8. Success Metrics

Initial targets — revisit after 30 days of real use.

| Metric | Target | Measurement |
|---|---|---|
| Time from signup to first event with ≥ 1 segment and ≥ 3 tasks | ≤ 10 minutes (median) | Timestamp diff: profile.created_at → 3rd task created |
| Task coverage | ≥ 90% of tasks have an assignee at activation | Query on nodes |
| Update rate | ≥ 70% of tasks reach `verified` before event end date | Query |
| Verification latency (Mode A) | Median `submitted → verified` ≤ 24 h | Timestamp diff |
| Adoption | ≥ 3 events created per active organization within 60 days | Query |
| Reliability | 0 data-leak incidents; p95 tree load ≤ 1.0 s for 500 nodes | Tests + Vercel/Supabase metrics |
| Mobile usability | Core flows completable at 360 px width without horizontal scroll | Playwright viewport test |

## 9. Out of Scope (Non-Goals) — STRICT

The coding agent must **not** build, scaffold, stub or "prepare for" any of the following in the MVP:

1. Native mobile app (iOS/Android, React Native, Flutter). PWA manifest is also deferred.
2. Email, SMS or push notifications (only Supabase auth emails).
3. Real-time collaboration / live updates (no Supabase Realtime, no websockets).
4. File uploads or storage buckets (proof is **links only**).
5. Task dependencies, subtasks beyond the tree, recurring tasks, templates, event cloning.
6. Kanban, Gantt, calendar views. (Only tree + dashboard lists.)
7. Budgeting, payments, ticketing, attendee/participant registration, QR check-in, certificates.
8. Public event pages, sharing links, guest access without account.
9. Multiple assignees per node; custom roles/permissions; ownership transfer; drag-and-drop re-parenting.
10. @mentions, threaded or rich-text comments (plain text only).
11. UI localization (Bangla UI). Bangla **content** must render fine; UI strings are English.
12. Import/export (CSV, PDF), reports, analytics beyond metrics in §8.
13. SSO/SAML, 2FA, magic links, other OAuth providers (Google only).
14. AI features of any kind inside the product.
15. Soft delete / undo / trash bin.
16. Admin super-panel, billing, subscriptions.

If a task seems to require any of the above, **stop and ask** instead of implementing.

## 10. Assumptions & Defaults (resolve ambiguity this way)

- Time values stored in UTC (`timestamptz`), displayed in the browser's local timezone.
- Default review mode for new events: Mode A (`assignee_submits`).
- Any org member may create events (no extra permission).
- A user may belong to many organizations; there is no "personal" workspace.
- Deleting a node permanently deletes its subtree and its activity history.
