import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventTree } from "@/components/tree/event-tree";
import { deleteDescription } from "@/components/tree/delete-node-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { EventContext } from "@/lib/permissions";
import { buildTree, deleteImpact, isInSubtree, withoutNode, type TreeNode, type TreeRow } from "@/lib/tree";

const nav = vi.hoisted(() => ({ search: "", refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh, push: nav.push }),
  usePathname: () => "/o/acme/events/e1",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/features/updates/actions", () => ({ transitionTask: vi.fn(), addComment: vi.fn(), addProofLink: vi.fn() }));
const deleteNode = vi.fn();
vi.mock("@/features/nodes/actions", () => ({
  createNode: vi.fn(),
  updateNode: vi.fn(),
  reassignNode: vi.fn(),
  deleteNode: (i: unknown) => deleteNode(i),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ notify: toast }));

const ID = {
  event: "00000000-0000-4000-8000-000000000001",
  venue: "00000000-0000-4000-8000-000000000002",
  hall: "00000000-0000-4000-8000-000000000003",
  seating: "00000000-0000-4000-8000-000000000004",
  food: "00000000-0000-4000-8000-000000000005",
  menu: "00000000-0000-4000-8000-000000000006",
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

// Venue has two tasks (one verified), Food has one verified task: event 75%, Venue 50%, Food 100%.
function tree(): TreeNode {
  const root = buildTree([
    row(ID.event, null, "event", { title: "Tech Fest", assignee_id: ID.owner, assignee_name: "Bulbul", progress: 75 }),
    row(ID.venue, ID.event, "segment", { title: "Venue", assignee_id: ID.head, assignee_name: "Tania", progress: 50, position: 0 }),
    row(ID.hall, ID.venue, "task", { title: "Hall booking", assignee_id: ID.nila, assignee_name: "Nila", status: "verified", progress: 100, position: 0 }),
    row(ID.seating, ID.venue, "task", { title: "Seating", assignee_id: ID.nila, assignee_name: "Nila", position: 1 }),
    row(ID.food, ID.event, "segment", { title: "Food", assignee_id: ID.head, assignee_name: "Tania", progress: 100, position: 1 }),
    row(ID.menu, ID.food, "task", { title: "Menu", assignee_id: ID.nila, assignee_name: "Nila", status: "verified", progress: 100 }),
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

// The detail panel is a dialog too, so the confirmation is found by its title.
const confirmDialog = () => screen.getByRole("dialog", { name: /^Delete (segment|task)\?/ });

function openDelete(title: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: `Actions for ${title}`, hidden: true }), { key: "Enter" });
  const item = within(screen.getByRole("menu")).getByRole("menuitem", { name: /Delete/ });
  fireEvent.click(item);
}

function deferred() {
  let resolve!: (r: ActionResult) => void;
  const promise = new Promise<ActionResult>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
});

describe("withoutNode and deleteImpact", () => {
  it("drops the subtree and works out the ancestors' progress again", () => {
    const root = tree();
    const next = withoutNode(root, ID.seating);
    const venue = next.children[0]!; // fixture: Venue first
    expect(venue.children.map((c) => c.id)).toEqual([ID.hall]);
    expect(venue.progress).toBe(100);
    expect(next.progress).toBe(100);
    expect(root.children[0]?.children).toHaveLength(2); // original untouched
    expect(next.children[1]).toBe(root.children[1]); // other branch kept
  });

  it("removing a whole segment updates the event at once", () => {
    const next = withoutNode(tree(), ID.food);
    expect(next.children.map((c) => c.id)).toEqual([ID.venue]);
    expect(next.progress).toBe(50);
  });

  it("an empty parent counts as 0 and the event root cannot be removed", () => {
    const only = withoutNode(withoutNode(tree(), ID.hall), ID.seating);
    expect(only.children[0]?.progress).toBe(0);
    const root = tree();
    expect(withoutNode(root, ID.event)).toBe(root);
    expect(withoutNode(root, "00000000-0000-4000-8000-0000000000ff")).toBe(root);
  });

  it("counts what a delete takes and tells if an id is inside it", () => {
    const venue = tree().children[0]!;
    expect(deleteImpact(venue)).toEqual({ segments: 1, tasks: 2, total: 3 });
    expect(isInSubtree(venue, ID.seating)).toBe(true);
    expect(isInSubtree(venue, ID.menu)).toBe(false);
  });

  it("the confirmation text names the number of items below", () => {
    const [venue, food] = tree().children as [TreeNode, TreeNode];
    expect(deleteDescription(venue)).toContain("2 tasks");
    expect(deleteDescription(venue)).toContain("2 items in all");
    expect(deleteDescription(food)).toContain("1 task");
    expect(deleteDescription(food)).toContain("1 item in all");
    expect(deleteDescription(venue.children[1]!)).toContain("deleted for good");
  });
});

describe("Delete in the row menu", () => {
  it("is offered to the owner on a segment and a task, never on the event", () => {
    view(ctx(ID.owner));
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Tech Fest" }), { key: "Enter" });
    expect(within(screen.getByRole("menu")).queryByRole("menuitem", { name: /Delete/ })).toBeNull();
  });

  it("is hidden from an assignee, and when the event is completed", () => {
    const a = view(ctx(ID.nila));
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    a.unmount();
    view(ctx(ID.owner, { eventStatus: "completed" }));
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
  });

  it("asks first, says how many items go, and Cancel changes nothing", () => {
    view(ctx(ID.owner));
    openDelete("Venue");
    const dialog = confirmDialog();
    expect(within(dialog).getByText(/2 tasks/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(deleteNode).not.toHaveBeenCalled();
    expect(rowOf(/Venue/)).toBeInTheDocument();
  });

  it("removes the segment and updates the event progress at once, then refreshes", async () => {
    const d = deferred();
    deleteNode.mockReturnValue(d.promise);
    view(ctx(ID.owner));
    expect(within(rowOf(/Tech Fest/)).getByText(/75/)).toBeInTheDocument();
    openDelete("Food");
    fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("treeitem", { name: /Food/ })).toBeNull());
    expect(deleteNode).toHaveBeenCalledWith({ nodeId: ID.food });
    expect(within(rowOf(/Tech Fest/)).getByText(/50/)).toBeInTheDocument();

    await waitFor(() => d.resolve(ok()));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Segment deleted"));
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("puts the row back and shows the reason when the server refuses", async () => {
    deleteNode.mockResolvedValue(fail("E_EVENT_READONLY"));
    view(ctx(ID.owner));
    openDelete("Food");
    fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This event is read-only."));
    await waitFor(() => expect(rowOf(/Food/)).toBeInTheDocument());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("closes the detail panel first when the open item is inside the deleted segment", async () => {
    nav.search = `node=${ID.seating}`;
    deleteNode.mockResolvedValue(ok());
    view(ctx(ID.owner));
    openDelete("Venue");
    fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/o/acme/events/e1", { scroll: false }));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
