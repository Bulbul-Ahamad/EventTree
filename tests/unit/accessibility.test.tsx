import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "./helpers/axe";

const nav = vi.hoisted(() => ({ search: "", refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh, push: nav.push, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/o/acme/events/e1",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/features/updates/actions", () => ({ transitionTask: vi.fn(), addComment: vi.fn(), addProofLink: vi.fn() }));
vi.mock("@/features/nodes/actions", () => ({ createNode: vi.fn(), updateNode: vi.fn(), reassignNode: vi.fn(), deleteNode: vi.fn() }));
vi.mock("@/features/events/actions", () => ({
  createEvent: vi.fn(),
  updateEventSettings: vi.fn(),
  setEventStatus: vi.fn(),
  deleteEvent: vi.fn(),
}));
vi.mock("@/features/orgs/actions", () => ({
  createOrganization: vi.fn(),
  joinOrganization: vi.fn(),
  setMemberRole: vi.fn(),
  removeMember: vi.fn(),
  rotateJoinCode: vi.fn(),
  leaveOrganization: vi.fn(),
  updateOrganization: vi.fn(),
}));
vi.mock("@/features/auth/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
  startGoogleOAuth: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import NotFound from "@/app/not-found";
import { EventTree } from "@/components/tree/event-tree";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { RouteError } from "@/components/ui/route-error";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoginForm } from "@/features/auth/components/login-form";
import { SignUpForm } from "@/features/auth/components/signup-form";
import { MyEvents } from "@/features/dashboard/components/my-events";
import { MyTasks } from "@/features/dashboard/components/my-tasks";
import { ReviewQueue } from "@/features/dashboard/components/review-queue";
import { EventDangerZone } from "@/features/events/components/event-danger-zone";
import { EventHeader } from "@/features/events/components/event-header";
import { EventSettingsForm } from "@/features/events/components/event-settings-form";
import { NewEventForm } from "@/features/events/components/new-event-form";
import type { EventDetail } from "@/features/events/queries";
import { JoinCodePanel } from "@/features/orgs/components/join-code-panel";
import { LeaveOrganization } from "@/features/orgs/components/leave-organization";
import { MembersList } from "@/features/orgs/components/members-list";
import { OrgSettingsForm } from "@/features/orgs/components/org-settings-form";
import type { OrgMember } from "@/features/orgs/queries";
import type { EventContext } from "@/lib/permissions";
import { buildTree, type TreeNode, type TreeRow } from "@/lib/tree";
import { TreeSkeleton, PageSkeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

// 3.16: axe-core on every main screen's content, with the dialogs and the detail
// panel open, plus keyboard and focus checks (03_UI_Spec §10). Zero serious or
// critical violations is the bar. Colour contrast is checked in the browser.

const ID = {
  event: "00000000-0000-4000-8000-000000000001",
  venue: "00000000-0000-4000-8000-000000000002",
  hall: "00000000-0000-4000-8000-000000000003",
  seating: "00000000-0000-4000-8000-000000000004",
  owner: "00000000-0000-4000-8000-0000000000a1",
  head: "00000000-0000-4000-8000-0000000000a2",
  nila: "00000000-0000-4000-8000-0000000000a3",
} as const;

function row(id: string, parent: string | null, type: TreeRow["type"], over: Partial<TreeRow> = {}): TreeRow {
  return {
    id, parent_id: parent, type, title: id, description: null, assignee_id: null, assignee_name: null,
    assignee_avatar: null, status: type === "task" ? "todo" : null, priority: "medium", due_at: null, weight: 1,
    position: 0, depth: parent === null ? 0 : type === "segment" ? 1 : 2, progress: 0, submitted_at: null,
    verified_at: null, ...over,
  };
}

function tree(): TreeNode {
  const root = buildTree([
    row(ID.event, null, "event", { title: "Tech Fest", assignee_id: ID.owner, assignee_name: "Bulbul", progress: 50 }),
    row(ID.venue, ID.event, "segment", { title: "Venue", assignee_id: ID.head, assignee_name: "Tania", progress: 50 }),
    row(ID.hall, ID.venue, "task", { title: "Hall booking", assignee_id: ID.nila, assignee_name: "Nila", status: "submitted", due_at: "2026-11-20T04:00:00.000Z" }),
    row(ID.seating, ID.venue, "task", { title: "Seating", status: "verified", progress: 100, position: 1 }),
  ]);
  if (!root) throw new Error("no root");
  return root;
}

const ownerCtx: EventContext = {
  userId: ID.owner, ownerId: ID.owner, eventStatus: "active", reviewMode: "assignee_submits", isOrgAdmin: false, isParticipant: true,
};
const members = [{ value: ID.nila, label: "Nila", description: "nila@x.com" }];

function eventTree(search = "") {
  nav.search = search;
  return render(
    <TooltipProvider>
      <EventTree root={tree()} ctx={ownerCtx} members={members} activity={[]} activityFor={null} />
    </TooltipProvider>,
  );
}

const eventDetail: EventDetail = {
  id: ID.event, orgId: "11111111-1111-1111-1111-111111111111", title: "Tech Fest", description: "Annual fest", status: "active",
  reviewMode: "assignee_submits", startsAt: "2026-11-10T04:00:00.000Z", endsAt: "2026-11-11T04:00:00.000Z", location: "Gazipur",
  completedAt: null, progress: 50, ownerId: ID.owner, ownerName: "Bulbul", ownerAvatar: null,
};

const orgMembers: OrgMember[] = [
  { userId: ID.owner, fullName: "Bulbul", email: "bulbul@x.com", avatarUrl: null, role: "admin", joinedAt: "2026-10-01T05:00:00.000Z" },
  { userId: ID.head, fullName: "Tania", email: "tania@x.com", avatarUrl: null, role: "member", joinedAt: "2026-10-05T05:00:00.000Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
});

describe("axe: event page", () => {
  it("header, filters and tree", async () => {
    render(
      <TooltipProvider>
        <EventHeader event={eventDetail} isOwner unassignedCount={1} settingsHref="/o/acme/events/e1/settings" />
      </TooltipProvider>,
    );
    expect(await axeViolations()).toEqual([]);
  });

  it("the tree with row menus", async () => {
    eventTree();
    expect(await axeViolations()).toEqual([]);
  });

  it("the open row menu", async () => {
    eventTree();
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Venue" }), { key: "Enter" });
    await screen.findByRole("menu");
    expect(await axeViolations()).toEqual([]);
  });

  it("the detail panel", async () => {
    eventTree(`node=${ID.hall}`);
    await screen.findByRole("dialog");
    expect(await axeViolations()).toEqual([]);
  });

  it("the add-task dialog", async () => {
    eventTree();
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Venue" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Add task/ }));
    await screen.findByRole("dialog");
    expect(await axeViolations()).toEqual([]);
  });

  it("the delete confirmation", async () => {
    eventTree();
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Venue" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    await screen.findByRole("dialog", { name: /^Delete segment/ });
    expect(await axeViolations()).toEqual([]);
  });

  it("the empty filter result", async () => {
    eventTree("filter=overdue");
    expect(await axeViolations()).toEqual([]);
  });
});

describe("axe: forms and settings", () => {
  it("new event form", async () => {
    render(<NewEventForm orgId="11111111-1111-1111-1111-111111111111" orgSlug="acme" />);
    expect(await axeViolations()).toEqual([]);
  });

  it("event settings form, with and without errors", async () => {
    render(<EventSettingsForm event={eventDetail} readOnly={false} />);
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Enter a title.")).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it("event settings form, read-only", async () => {
    render(<EventSettingsForm event={{ ...eventDetail, status: "completed" }} readOnly />);
    expect(await axeViolations()).toEqual([]);
  });

  it("danger zone and its typed-title dialog", async () => {
    render(<EventDangerZone eventId={ID.event} title="Tech Fest" canDelete eventsHref="/o/acme/events" />);
    expect(await axeViolations()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
    await screen.findByRole("dialog", { name: "Delete this event?" });
    expect(await axeViolations()).toEqual([]);
  });

  it("organization settings form", async () => {
    render(<OrgSettingsForm org={{ id: "11111111-1111-1111-1111-111111111111", name: "DUET CSE", slug: "duet-cse", kind: "club" }} />);
    expect(await axeViolations()).toEqual([]);
  });

  it("login and sign-up forms", async () => {
    const a = render(<LoginForm callbackFailed={false} />);
    expect(await axeViolations()).toEqual([]);
    a.unmount();
    render(<SignUpForm />);
    expect(await axeViolations()).toEqual([]);
  });
});

describe("axe: members and dashboard", () => {
  it("members list for an admin, the join code panel and Leave", async () => {
    render(
      <TooltipProvider>
        <JoinCodePanel orgId="11111111-1111-1111-1111-111111111111" joinCode="ABC123DEF456" />
        <MembersList orgId="11111111-1111-1111-1111-111111111111" members={orgMembers} viewerId={ID.owner} viewerIsAdmin />
        <LeaveOrganization orgId="11111111-1111-1111-1111-111111111111" orgName="DUET CSE" />
      </TooltipProvider>,
    );
    expect(await axeViolations()).toEqual([]);
  });

  it("members list for a plain member", async () => {
    render(
      <TooltipProvider>
        <MembersList orgId="11111111-1111-1111-1111-111111111111" members={orgMembers} viewerId={ID.head} viewerIsAdmin={false} />
      </TooltipProvider>,
    );
    expect(await axeViolations()).toEqual([]);
  });

  it("dashboard sections with data and when empty", async () => {
    const empty = { overdue: [], dueThisWeek: [], later: [], noDueDate: [] };
    const task = {
      nodeId: ID.hall, title: "Hall booking", status: "in_progress" as const, priority: "high" as const,
      dueAt: "2026-11-02T04:00:00.000Z", eventId: ID.event, eventTitle: "Tech Fest", eventStatus: "active" as const, orgSlug: "acme",
    };
    render(
      <>
        <ReviewQueue items={[{ nodeId: ID.hall, title: "Hall booking", assigneeName: "Nila", submittedAt: "2026-10-31T04:00:00.000Z", eventId: ID.event, eventTitle: "Tech Fest", orgSlug: "acme" }]} />
        <MyTasks groups={{ ...empty, overdue: [task] }} />
        <MyEvents events={[{ id: ID.event, title: "Tech Fest", orgName: "DUET CSE", orgSlug: "acme", status: "active", progress: 50, role: "owner" }]} createHref="/o/acme/events/new" />
      </>,
    );
    expect(await axeViolations()).toEqual([]);
  });
});

describe("axe: states", () => {
  it("empty state, skeletons, error and not-found pages", async () => {
    render(
      <>
        <EmptyState icon={Inbox} title="Nothing here" description="Try later." />
        <TreeSkeleton />
        <PageSkeleton label="Loading page" />
        <RouteError error={new Error("x")} reset={() => {}} />
        <NotFound />
      </>,
    );
    expect(await axeViolations()).toEqual([]);
  });

  it("the full-page states have one heading level 1 each", () => {
    const a = render(<NotFound />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    a.unmount();
    render(<RouteError error={new Error("x")} reset={() => {}} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("keyboard and focus", () => {
  it("a confirm dialog moves focus inside, Escape closes it and focus goes back", async () => {
    function Harness() {
      const [open, setOpen] = (require("react") as typeof import("react")).useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <ConfirmDialog open={open} onOpenChange={setOpen} title="Sure?" description="Really." confirmLabel="Yes" onConfirm={() => {}} />
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Sure?" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("the tree is one tab stop: only one row is tabbable", () => {
    eventTree();
    const rows = screen.getAllByRole("treeitem");
    expect(rows.filter((r) => r.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(rows.length).toBeGreaterThan(1);
  });

  it("every icon-only button has an accessible name", () => {
    eventTree();
    for (const b of screen.getAllByRole("button")) {
      expect(within(b).queryByText(/./) !== null || b.getAttribute("aria-label")).toBeTruthy();
    }
  });
});
