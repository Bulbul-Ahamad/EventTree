import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NodeDetailPanel } from "@/components/tree/node-detail-panel";
import { fail, ok } from "@/lib/action-result";
import type { ActivityItem } from "@/features/updates/queries";
import type { EventContext } from "@/lib/permissions";
import { breadcrumbOf, buildNodeContexts, buildTree, subtreeSummary, type TreeNode, type TreeRow } from "@/lib/tree";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const addComment = vi.fn();
const addProofLink = vi.fn();
vi.mock("@/features/updates/actions", () => ({
  addComment: (i: unknown) => addComment(i),
  addProofLink: (i: unknown) => addProofLink(i),
}));
const success = vi.fn();
vi.mock("@/lib/toast", () => ({ notify: { success: (m: string) => success(m), error: vi.fn() } }));

const ID = {
  event: "00000000-0000-4000-8000-000000000001",
  venue: "00000000-0000-4000-8000-000000000002",
  hall: "00000000-0000-4000-8000-000000000003",
  stage: "00000000-0000-4000-8000-000000000004",
  owner: "00000000-0000-4000-8000-0000000000a1",
  head: "00000000-0000-4000-8000-0000000000a2",
  nila: "00000000-0000-4000-8000-0000000000a3",
  sumon: "00000000-0000-4000-8000-0000000000a4",
} as const;

function row(id: string, parent: string | null, type: TreeRow["type"], over: Partial<TreeRow> = {}): TreeRow {
  return {
    id, parent_id: parent, type, title: id, description: null, assignee_id: null, assignee_name: null,
    assignee_avatar: null, status: type === "task" ? "todo" : null, priority: "medium", due_at: null, weight: 1,
    position: 0, depth: parent === null ? 0 : type === "segment" ? 1 : 2, progress: 0, submitted_at: null,
    verified_at: null, ...over,
  };
}

// Tech Fest -> Venue -> (Hall booking [nila, submitted], Stage [unassigned, todo])
function tree(): TreeNode {
  const root = buildTree([
    row(ID.event, null, "event", { title: "Tech Fest", assignee_id: ID.owner, assignee_name: "Bulbul", progress: 25 }),
    row(ID.venue, ID.event, "segment", { title: "Venue", assignee_id: ID.head, assignee_name: "Tania", progress: 50 }),
    row(ID.hall, ID.venue, "task", {
      title: "Hall booking", description: "Book the <b>main</b> hall", assignee_id: ID.nila, assignee_name: "Nila Akter",
      status: "submitted", priority: "high", weight: 3, due_at: "2026-11-05T10:00:00.000Z", position: 0,
    }),
    row(ID.stage, ID.venue, "task", { title: "Stage", position: 1 }),
  ]);
  if (!root) throw new Error("no root");
  return root;
}
const nodeOf = (root: TreeNode, id: string): TreeNode => {
  const all = [root, ...root.children, ...root.children.flatMap((c) => c.children)];
  const hit = all.find((n) => n.id === id);
  if (!hit) throw new Error(id);
  return hit;
};

function ctx(userId: string, over: Partial<EventContext> = {}): EventContext {
  return { userId, ownerId: ID.owner, eventStatus: "active", reviewMode: "assignee_submits", isOrgAdmin: false, isParticipant: true, ...over };
}

function item(id: string, over: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id, kind: "comment", body: "Hello", linkUrl: null, fromStatus: null, toStatus: null,
    createdAt: new Date(Date.now() - 3600_000).toISOString(), authorId: ID.nila, authorName: "Nila Akter", authorAvatar: null,
    ...over,
  };
}

function panel(nodeId: string, c: EventContext, activity: ActivityItem[] | null = []) {
  const root = tree();
  const onNavigate = vi.fn();
  const onClose = vi.fn();
  const { unmount } = render(
    <NodeDetailPanel
      root={root}
      node={nodeOf(root, nodeId)}
      ctx={c}
      nodeCtx={buildNodeContexts(root).get(nodeId)!} // the id comes from the fixture above
      activity={activity}
      overdue={false}
      transitions={[]}
      transitionPending={false}
      transitionError={null}
      onTransition={vi.fn()}
      onNavigate={onNavigate}
      onClose={onClose}
    />,
  );
  return { onNavigate, onClose, unmount };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tree helpers for the panel", () => {
  it("breadcrumbOf lists proper ancestors, event first", () => {
    const root = tree();
    expect(breadcrumbOf(root, ID.hall).map((n) => n.title)).toEqual(["Tech Fest", "Venue"]);
    expect(breadcrumbOf(root, ID.event)).toEqual([]);
  });

  it("subtreeSummary counts tasks and segments below a node, not the node", () => {
    const root = tree();
    expect(subtreeSummary(root)).toEqual({
      segments: 1, tasks: 2, byStatus: { todo: 1, in_progress: 0, submitted: 1, verified: 0 },
    });
    expect(subtreeSummary(nodeOf(root, ID.hall)).tasks).toBe(0);
  });
});

describe("NodeDetailPanel content", () => {
  it("shows a task: breadcrumb, type, title, description as text, assignee, due, status, priority, weight", () => {
    panel(ID.hall, ctx(ID.owner));
    const dialog = screen.getByRole("dialog", { name: "Hall booking" });
    expect(within(dialog).getByText("Task")).toBeInTheDocument();
    expect(within(dialog).getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Tech Fest›Venue");
    expect(within(dialog).getByText("Book the <b>main</b> hall")).toBeInTheDocument();
    expect(dialog.querySelector("b")).toBeNull();
    expect(within(dialog).getByText("Nila Akter")).toBeInTheDocument();
    expect(within(dialog).getByText("Submitted")).toBeInTheDocument();
    expect(within(dialog).getByText("High")).toBeInTheDocument();
    expect(within(dialog).getByText("3")).toBeInTheDocument();
  });

  it("shows an Unassigned chip and 'No due date' when there is neither", () => {
    panel(ID.stage, ctx(ID.owner));
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("No due date")).toBeInTheDocument();
  });

  it("shows progress and a children summary for a segment, but no status row", () => {
    panel(ID.venue, ctx(ID.owner));
    expect(screen.getByText("Segment")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Venue progress" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
    expect(screen.queryByText("Priority")).toBeNull();
  });

  it("breadcrumb items navigate and Escape closes", () => {
    const { onNavigate, onClose } = panel(ID.hall, ctx(ID.owner));
    fireEvent.click(screen.getByRole("button", { name: "Venue" }));
    expect(onNavigate).toHaveBeenCalledWith(ID.venue);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Activity timeline", () => {
  it("shows who, when and what for each kind, in the order given", () => {
    panel(ID.hall, ctx(ID.owner), [
      item("a", { kind: "status_change", fromStatus: "in_progress", toStatus: "submitted", body: "Final version attached." }),
      item("b", { kind: "proof_link", linkUrl: "https://example.com/proof", body: "Signed letter", authorName: "Sumon" }),
      item("c", { body: "Quote <i>received</i>" }),
    ]);
    const list = within(screen.getByRole("region", { name: "Activity" })).getByRole("list");
    const entries = within(list).getAllByRole("listitem");
    expect(entries).toHaveLength(3);
    expect(entries[0]).toHaveTextContent("Nila Akter");
    expect(entries[0]).toHaveTextContent("Changed status from In progress to Submitted");
    expect(entries[0]).toHaveTextContent("Final version attached.");
    expect(entries[1]).toHaveTextContent("Sumon");
    const link = within(entries[1]!).getByRole("link", { name: "https://example.com/proof" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(entries[1]).toHaveTextContent("Signed letter");
    expect(entries[2]?.querySelector("i")).toBeNull();
    expect(entries[2]).toHaveTextContent("Quote <i>received</i>");
  });

  it("does not make a link out of a non-http(s) address", () => {
    panel(ID.hall, ctx(ID.owner), [item("x", { kind: "proof_link", linkUrl: "javascript:alert(1)" })]);
    expect(screen.queryByRole("link", { name: /javascript/ })).toBeNull();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  it("shows an empty message and a loading state", () => {
    panel(ID.hall, ctx(ID.owner), []);
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });

  it("shows a loading state while the activity is fetched", () => {
    panel(ID.hall, ctx(ID.owner), null);
    expect(screen.getByRole("status", { name: "Loading activity" })).toBeInTheDocument();
  });
});

describe("Comment composer", () => {
  it("is shown to the task's assignee and to its managers while the event is active or draft", () => {
    for (const [who, over] of [
      [ID.nila, {}],
      [ID.head, {}],
      [ID.owner, {}],
      [ID.owner, { eventStatus: "draft" as const }],
    ] as const) {
      const { unmount } = panel(ID.hall, ctx(who, over));
      expect(screen.getByRole("button", { name: "Post" })).toBeInTheDocument();
      unmount();
    }
  });

  it("is hidden from other people, and in a completed event", () => {
    const first = panel(ID.hall, ctx(ID.sumon));
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
    first.unmount();
    panel(ID.hall, ctx(ID.owner, { eventStatus: "completed" }));
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });

  it("asks for a comment when empty and does not call the action", () => {
    panel(ID.hall, ctx(ID.nila));
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(screen.getByText("Write a comment.")).toBeInTheDocument();
    expect(addComment).not.toHaveBeenCalled();
  });

  it("posts a comment, clears the box, toasts and refreshes", async () => {
    addComment.mockResolvedValue(ok());
    panel(ID.hall, ctx(ID.nila));
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Booked." } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(addComment).toHaveBeenCalledWith({ nodeId: ID.hall, body: "Booked." }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(success).toHaveBeenCalledWith("Comment posted");
    expect(screen.getByLabelText("Comment")).toHaveValue("");
  });

  it("posts a proof link with the comment as its note", async () => {
    addProofLink.mockResolvedValue(ok());
    panel(ID.hall, ctx(ID.nila));
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Signed letter" } });
    fireEvent.change(screen.getByLabelText("Proof link (optional)"), { target: { value: "https://example.com/p" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() =>
      expect(addProofLink).toHaveBeenCalledWith({ nodeId: ID.hall, url: "https://example.com/p", note: "Signed letter" }),
    );
    expect(addComment).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith("Proof link added");
  });

  it("rejects a link that is not http(s)", () => {
    panel(ID.hall, ctx(ID.nila));
    fireEvent.change(screen.getByLabelText("Proof link (optional)"), { target: { value: "ftp://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(screen.getByText("Enter a link starting with http:// or https://.")).toBeInTheDocument();
    expect(addProofLink).not.toHaveBeenCalled();
  });

  it("shows the mapped message when the server refuses, and keeps what was typed", async () => {
    addComment.mockResolvedValue(fail("E_NOT_AUTHORIZED"));
    panel(ID.hall, ctx(ID.nila));
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission to do that.");
    expect(screen.getByLabelText("Comment")).toHaveValue("Hi");
    expect(refresh).not.toHaveBeenCalled();
  });
});
