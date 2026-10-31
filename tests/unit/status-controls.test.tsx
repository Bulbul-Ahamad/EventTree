import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventTree } from "@/components/tree/event-tree";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { EventContext } from "@/lib/permissions";
import { buildTree, withTaskStatus, type TreeNode, type TreeRow } from "@/lib/tree";

const nav = vi.hoisted(() => ({ search: "", refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh, push: nav.push }),
  usePathname: () => "/o/acme/events/e1",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
const transitionTask = vi.fn();
vi.mock("@/features/updates/actions", () => ({
  transitionTask: (i: unknown) => transitionTask(i),
  addComment: vi.fn(),
  addProofLink: vi.fn(),
}));
vi.mock("@/features/nodes/actions", () => ({ createNode: vi.fn(), updateNode: vi.fn(), reassignNode: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ notify: toast }));

const ID = {
  event: "00000000-0000-4000-8000-000000000001",
  venue: "00000000-0000-4000-8000-000000000002",
  hall: "00000000-0000-4000-8000-000000000003",
  todo: "00000000-0000-4000-8000-000000000004",
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
    row(ID.event, null, "event", { title: "Tech Fest", assignee_id: ID.owner, assignee_name: "Bulbul" }),
    row(ID.venue, ID.event, "segment", { title: "Venue", assignee_id: ID.head, assignee_name: "Tania" }),
    row(ID.hall, ID.venue, "task", { title: "Hall booking", assignee_id: ID.nila, assignee_name: "Nila", status: "submitted", position: 0 }),
    row(ID.todo, ID.venue, "task", { title: "Seating", assignee_id: ID.nila, assignee_name: "Nila", status: "todo", position: 1 }),
  ]);
  if (!root) throw new Error("no root");
  return root;
}

function ctx(userId: string, over: Partial<EventContext> = {}): EventContext {
  return { userId, ownerId: ID.owner, eventStatus: "active", reviewMode: "assignee_submits", isOrgAdmin: false, isParticipant: true, ...over };
}

function view(c: EventContext) {
  return render(
    <TooltipProvider>
      <EventTree root={tree()} ctx={c} members={[]} activity={[]} activityFor={null} />
    </TooltipProvider>,
  );
}
const rowOf = (name: RegExp) => screen.getByRole("treeitem", { name });

// A promise the test settles by hand, to look at the screen while a request is in flight.
function deferred() {
  let resolve!: (r: ActionResult<{ status: "verified" }>) => void;
  const promise = new Promise<ActionResult<{ status: "verified" }>>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
});

describe("withTaskStatus", () => {
  it("changes one task and keeps untouched branches identical", () => {
    const root = tree();
    const next = withTaskStatus(root, ID.hall, "verified");
    const venue = (r: TreeNode) => r.children[0]!; // fixture has one segment
    expect(venue(next).children[0]?.status).toBe("verified");
    expect(venue(root).children[0]?.status).toBe("submitted"); // original untouched
    expect(venue(next).children[1]).toBe(venue(root).children[1]);
    expect(withTaskStatus(root, "00000000-0000-4000-8000-0000000000ff", "verified")).toBe(root);
  });
});

describe("verify tick on a row", () => {
  it("is offered to the owner on a submitted task and sends T4 without a comment", async () => {
    transitionTask.mockResolvedValue(ok({ status: "verified" }));
    view(ctx(ID.owner));
    fireEvent.click(screen.getByRole("button", { name: "Mark Hall booking verified" }));
    await waitFor(() =>
      expect(transitionTask).toHaveBeenCalledWith({ nodeId: ID.hall, from: "submitted", to: "verified", comment: null }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Task verified"));
  });

  it("is not offered on a task that is still to do in Mode A", () => {
    view(ctx(ID.owner));
    expect(screen.queryByRole("button", { name: "Mark Seating verified" })).toBeNull();
  });

  it("is offered on a to-do task in Mode B (T6)", () => {
    view(ctx(ID.owner, { reviewMode: "head_only" }));
    expect(screen.getByRole("button", { name: "Mark Seating verified" })).toBeInTheDocument();
  });

  it("is hidden from the assignee and when the event is not active", () => {
    const a = view(ctx(ID.nila));
    expect(screen.queryByRole("button", { name: /verified$/ })).toBeNull();
    a.unmount();
    view(ctx(ID.owner, { eventStatus: "completed" }));
    expect(screen.queryByRole("button", { name: /verified$/ })).toBeNull();
  });

  it("shows the new status at once, then puts the old one back and tells why when the request fails", async () => {
    const d = deferred();
    transitionTask.mockReturnValue(d.promise);
    view(ctx(ID.owner));
    expect(within(rowOf(/^Hall booking/)).getByText("Submitted")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark Hall booking verified" }));
    await waitFor(() => expect(within(rowOf(/^Hall booking/)).getByText("Verified")).toBeInTheDocument());
    expect(rowOf(/^Hall booking/)).toHaveAttribute("aria-busy", "true");

    await act(async () => d.resolve(fail("E_INVALID_TRANSITION")));
    await waitFor(() => expect(within(rowOf(/^Hall booking/)).getByText("Submitted")).toBeInTheDocument());
    expect(toast.error).toHaveBeenCalledWith("That action isn't available for this task right now.");
    expect(rowOf(/^Hall booking/)).not.toHaveAttribute("aria-busy");
  });

  it("on E_STALE_STATE shows the refreshed-message toast and refetches", async () => {
    transitionTask.mockResolvedValue(fail("E_STALE_STATE"));
    view(ctx(ID.owner));
    fireEvent.click(screen.getByRole("button", { name: "Mark Hall booking verified" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This task was just updated by someone else. We've refreshed it."),
    );
    expect(nav.refresh).toHaveBeenCalled();
  });
});

describe("row menu status items", () => {
  async function openMenu(name: string) {
    fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
    return within(await screen.findByRole("menu"));
  }

  it("lists the allowed status changes first and runs one", async () => {
    transitionTask.mockResolvedValue(ok({ status: "verified" }));
    view(ctx(ID.nila));
    const menu = await openMenu("Actions for Seating");
    fireEvent.click(menu.getByRole("menuitem", { name: "Start" }));
    await waitFor(() =>
      expect(transitionTask).toHaveBeenCalledWith({ nodeId: ID.todo, from: "todo", to: "in_progress", comment: null }),
    );
  });

  it("asks for a comment before Send back and refuses an empty one", async () => {
    transitionTask.mockResolvedValue(ok({ status: "verified" }));
    view(ctx(ID.owner));
    const menu = await openMenu("Actions for Hall booking");
    fireEvent.click(menu.getByRole("menuitem", { name: "Send back" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Send back" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Please add a comment explaining why.");
    expect(transitionTask).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/^Comment/), { target: { value: "Wrong date on the letter" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send back" }));
    await waitFor(() =>
      expect(transitionTask).toHaveBeenCalledWith({
        nodeId: ID.hall, from: "submitted", to: "in_progress", comment: "Wrong date on the letter",
      }),
    );
  });
});

describe("Actions in the detail panel", () => {
  it("offers Verify and Send back for a submitted task, and Send back needs a comment", async () => {
    transitionTask.mockResolvedValue(ok({ status: "verified" }));
    nav.search = `node=${ID.hall}`;
    view(ctx(ID.owner));
    const panel = within(await screen.findByRole("dialog", { name: "Hall booking" }));
    expect(panel.getByRole("button", { name: "Verify" })).toBeInTheDocument();

    fireEvent.click(panel.getByRole("button", { name: "Send back" }));
    // The form is open now: the second "Send back" is its confirm button.
    const confirm = () => panel.getAllByRole("button", { name: "Send back" }).at(-1)!; // two buttons exist at this point
    fireEvent.click(confirm());
    expect(await panel.findByRole("alert")).toHaveTextContent("Please add a comment explaining why.");
    expect(transitionTask).not.toHaveBeenCalled();

    fireEvent.change(panel.getByLabelText(/^Why\?/), { target: { value: "Wrong date" } });
    fireEvent.click(confirm());
    await waitFor(() =>
      expect(transitionTask).toHaveBeenCalledWith({ nodeId: ID.hall, from: "submitted", to: "in_progress", comment: "Wrong date" }),
    );
  });

  it("shows an inline error from the server in the panel", async () => {
    transitionTask.mockResolvedValue(fail("E_EVENT_NOT_ACTIVE"));
    nav.search = `node=${ID.hall}`;
    view(ctx(ID.owner));
    const panel = within(await screen.findByRole("dialog", { name: "Hall booking" }));
    fireEvent.click(panel.getByRole("button", { name: "Verify" }));
    expect(await panel.findByRole("alert")).toHaveTextContent("Task updates are only available while the event is active.");
  });

  it("has no Actions section for a segment or for someone who may do nothing", async () => {
    nav.search = `node=${ID.venue}`;
    const a = view(ctx(ID.owner));
    await screen.findByRole("dialog", { name: "Venue" });
    expect(screen.queryByRole("heading", { name: "Actions" })).toBeNull();
    a.unmount();
    nav.search = `node=${ID.hall}`;
    view(ctx(ID.head, { eventStatus: "completed" }));
    await screen.findByRole("dialog", { name: "Hall booking" });
    expect(screen.queryByRole("heading", { name: "Actions" })).toBeNull();
  });
});
